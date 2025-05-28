
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple decryption function using built-in Web Crypto API
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  try {
    console.log('Attempting to decrypt credential, encrypted length:', encryptedText.length)
    
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    console.log('Decryption components - IV length:', iv.length, 'Encrypted length:', encrypted.length)
    
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
    
    const result = new TextDecoder().decode(decrypted)
    console.log('Decryption successful, result length:', result.length, 'starts with:', result.substring(0, 4))
    
    return result
  } catch (error) {
    console.error('Decryption error details:', error)
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    throw new Error(`Failed to decrypt credential: ${error.message}`)
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
      console.error('No authorization header found')
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
      console.error('Database error fetching connection:', connectionError)
      throw new Error('Failed to fetch connection data')
    }

    if (!connection) {
      console.error('No Zoom connection found for user:', user.id)
      throw new Error('No Zoom connection found. Please store your credentials first.')
    }

    console.log('Found connection with status:', connection.connection_status)
    console.log('Connection ID:', connection.id)
    console.log('Has encrypted_client_id:', !!connection.encrypted_client_id)
    console.log('Has encrypted_client_secret:', !!connection.encrypted_client_secret)
    console.log('Has encrypted_account_id:', !!connection.encrypted_account_id)

    if (!connection.encrypted_client_id || !connection.encrypted_client_secret || !connection.encrypted_account_id) {
      console.error('Missing encrypted credentials')
      throw new Error('Zoom credentials not found or incomplete')
    }

    console.log('Found connection, starting credential decryption...')

    // Create decryption key (same as used in zoom-store-credentials)
    const encryptionKey = `${user.id}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
    console.log('Decryption key generated, length:', encryptionKey.length)
    
    try {
      const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
      const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
      const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)
      
      console.log('All credentials decrypted successfully')
      console.log('Client ID length:', clientId.length, 'starts with:', clientId.substring(0, 4))
      console.log('Client Secret length:', clientSecret.length, 'starts with:', clientSecret.substring(0, 4))
      console.log('Account ID length:', accountId.length, 'starts with:', accountId.substring(0, 4))
      
      // Validate credential formats
      if (clientId.length < 10) {
        throw new Error('Client ID appears to be too short after decryption')
      }
      if (clientSecret.length < 10) {
        throw new Error('Client Secret appears to be too short after decryption')
      }
      if (accountId.length < 10) {
        throw new Error('Account ID appears to be too short after decryption')
      }
      
      console.log('Credentials validated, making Zoom API call...')
      
      // Create the Authorization header for Basic auth
      const basicAuth = btoa(`${clientId}:${clientSecret}`)
      console.log('Basic auth header created, length:', basicAuth.length)
      
      // Get access token using account credentials (server-to-server OAuth)
      const tokenRequestBody = `grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`
      console.log('Token request body:', tokenRequestBody)
      
      const tokenResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenRequestBody,
      })

      console.log('Token response status:', tokenResponse.status)
      console.log('Token response headers:', Object.fromEntries(tokenResponse.headers.entries()))
      
      const tokenData = await tokenResponse.json()
      console.log('Token response data:', tokenData)
      
      if (!tokenResponse.ok) {
        console.error('Token request failed with status:', tokenResponse.status)
        console.error('Token error response:', tokenData)
        
        let errorMessage = 'Failed to authenticate with Zoom'
        if (tokenData.error === 'invalid_client') {
          errorMessage = 'Invalid Zoom credentials. Please verify your Client ID, Client Secret, and Account ID are correct.'
        } else if (tokenData.error_description) {
          errorMessage = `Zoom API error: ${tokenData.error_description}`
        } else if (tokenData.error) {
          errorMessage = `Zoom API error: ${tokenData.error}`
        }
        
        throw new Error(errorMessage)
      }

      console.log('Access token obtained successfully, testing API call...')

      // Test the API by getting user information
      const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('User API response status:', userResponse.status)
      const userData = await userResponse.json()
      console.log('User API response data:', userData)
      
      if (!userResponse.ok) {
        console.error('User API call failed with status:', userResponse.status)
        console.error('User API error response:', userData)
        throw new Error(`API test failed: ${userData.message || 'Unable to fetch user data from Zoom'}`)
      }

      console.log('Connection test successful for user:', userData.email)

      // Update the connection status to active
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
      } else {
        console.log('Connection status updated to active')
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
      console.error('Error during credential processing:', decryptError.message)
      
      let userFriendlyMessage = decryptError.message
      if (decryptError.message.includes('decrypt')) {
        userFriendlyMessage = 'Failed to decrypt stored credentials. Please re-enter your Zoom credentials.'
      } else if (decryptError.message.includes('invalid_client')) {
        userFriendlyMessage = 'Invalid Zoom credentials. Please verify your Client ID, Client Secret, and Account ID are correct.'
      }
      
      throw new Error(userFriendlyMessage)
    }

  } catch (error) {
    console.error('Connection test error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        details: 'Check the edge function logs for more detailed error information'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
