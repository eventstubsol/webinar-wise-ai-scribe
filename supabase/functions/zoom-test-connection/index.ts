
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple decryption function using built-in Web Crypto API
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    )
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credential')
  }
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
      console.error('Auth error:', authError)
      throw new Error('Invalid authentication')
    }

    console.log('Testing connection for user:', user.id)

    // Get the zoom connection with encrypted credentials - look for any connection regardless of status
    const { data: connection, error: connectionError } = await supabaseClient
      .from('zoom_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (connectionError) {
      console.error('Database error:', connectionError)
      throw new Error('Failed to fetch connection data')
    }

    if (!connection) {
      console.error('No Zoom connection found for user')
      throw new Error('No Zoom connection found. Please store your credentials first.')
    }

    if (!connection.encrypted_client_id || !connection.encrypted_client_secret || !connection.encrypted_account_id) {
      throw new Error('Zoom credentials not found or incomplete')
    }

    console.log('Found connection, decrypting credentials...')

    // Create decryption key (same as used in zoom-store-credentials)
    const encryptionKey = `${user.id}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
    
    try {
      const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
      const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
      const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)
      
      console.log('Credentials decrypted successfully, testing with Zoom API...')
      
      // Get access token using account credentials (server-to-server OAuth)
      const tokenResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      })

      const tokenData = await tokenResponse.json()
      
      if (!tokenResponse.ok) {
        console.error('Token request failed:', tokenData)
        throw new Error(`Invalid credentials: ${tokenData.error_description || tokenData.error || 'Failed to authenticate with Zoom'}`)
      }

      console.log('Access token obtained, testing API call...')

      // Test the API by getting user information
      const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const userData = await userResponse.json()
      
      if (!userResponse.ok) {
        console.error('User API call failed:', userData)
        throw new Error(`API test failed: ${userData.message || 'Unable to fetch user data from Zoom'}`)
      }

      console.log('Connection test successful for user:', userData.email)

      // Update the connection status to active if it was pending
      if (connection.connection_status === 'pending') {
        const { error: updateError } = await supabaseClient
          .from('zoom_connections')
          .update({ 
            connection_status: 'active',
            zoom_user_id: userData.id || '',
            zoom_email: userData.email || '',
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)

        if (updateError) {
          console.error('Failed to update connection status:', updateError)
          // Don't fail the test if we can't update, just log it
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Connection test successful',
          zoom_user_id: userData.id,
          zoom_email: userData.email,
          zoom_account_id: userData.account_id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (decryptError) {
      console.error('Credential processing error:', decryptError)
      throw new Error(`Credential validation failed: ${decryptError.message}`)
    }

  } catch (error) {
    console.error('Connection test error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
