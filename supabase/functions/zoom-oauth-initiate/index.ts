
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple decryption function using built-in Web Crypto API
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  // Decode base64 and extract IV and encrypted data
  const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )
  
  return decoder.decode(decrypted)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user from the JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Get user's stored Zoom credentials
    const { data: connection, error: connectionError } = await supabaseClient
      .from('zoom_connections')
      .select('encrypted_client_id, encrypted_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (connectionError) {
      throw new Error(`Failed to get connection: ${connectionError.message}`)
    }

    if (!connection || !connection.encrypted_client_id || !connection.encrypted_account_id) {
      throw new Error('No stored credentials found. Please store your Zoom credentials first.')
    }

    // Decrypt the credentials
    const encryptionKey = `${user.id}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)

    // Encode user ID in state parameter
    const state = btoa(user.id)
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zoom-oauth-callback`
    
    // Updated scope to include comprehensive permissions
    const scope = 'webinar:read:admin meeting:read:admin user:read:admin dashboard:read:webinar:admin dashboard:read:list_webinar_participants:admin'
    
    const authUrl = `https://zoom.us/oauth/authorize?` + 
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`

    console.log('Generated OAuth URL for user:', user.id)

    return new Response(
      JSON.stringify({ auth_url: authUrl }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('OAuth initiation error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
