
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple encryption function using built-in Web Crypto API
async function encryptCredential(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  // Combine IV and encrypted data, then base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

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

    const { clientId, clientSecret, accountId } = await req.json()
    
    if (!clientId || !clientSecret || !accountId) {
      throw new Error('All credentials are required')
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Unable to get user organization')
    }

    // Use a combination of user ID and a server secret as encryption key
    const encryptionKey = `${user.id}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
    
    // Encrypt the credentials
    const encryptedClientId = await encryptCredential(clientId, encryptionKey)
    const encryptedClientSecret = await encryptCredential(clientSecret, encryptionKey)
    const encryptedAccountId = await encryptCredential(accountId, encryptionKey)

    // Store or update the zoom connection with encrypted credentials
    const { error: upsertError } = await supabaseClient
      .from('zoom_connections')
      .upsert({
        user_id: user.id,
        organization_id: profile.organization_id,
        encrypted_client_id: encryptedClientId,
        encrypted_client_secret: encryptedClientSecret,
        encrypted_account_id: encryptedAccountId,
        credentials_stored_at: new Date().toISOString(),
        connection_status: 'pending', // Will be updated to 'active' after OAuth
        zoom_user_id: '', // Will be set after OAuth
        zoom_email: '', // Will be set after OAuth
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })

    if (upsertError) {
      console.error('Error storing credentials:', upsertError)
      throw new Error(`Failed to store credentials: ${upsertError.message}`)
    }

    console.log('Successfully stored encrypted credentials for user:', user.id)

    return new Response(
      JSON.stringify({ success: true, message: 'Credentials stored successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Store credentials error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
