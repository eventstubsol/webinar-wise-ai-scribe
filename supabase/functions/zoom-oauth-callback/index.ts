
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

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    
    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error)
      const appOrigin = 'https://fvehswcrxhdxztycnvgz.lovable.app'
      const errorUrl = `${appOrigin}/account?zoom_error=${encodeURIComponent(`OAuth error: ${error}`)}`
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': errorUrl,
        },
      })
    }
    
    if (!code) {
      throw new Error('Authorization code not provided')
    }

    // Decode the user_id from state (base64 encoded)
    const userId = state ? atob(state) : null
    
    if (!userId) {
      throw new Error('Invalid state parameter')
    }

    console.log('Processing OAuth callback for user:', userId)

    // Get user's stored Zoom credentials
    const { data: connection, error: connectionError } = await supabaseClient
      .from('zoom_connections')
      .select('encrypted_client_id, encrypted_client_secret, organization_id')
      .eq('user_id', userId)
      .single()

    if (connectionError || !connection) {
      console.error('Connection error:', connectionError)
      throw new Error('No stored credentials found')
    }

    // Decrypt the credentials
    const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)

    console.log('Decrypted credentials successfully, exchanging for token...')

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/zoom-oauth-callback`,
      }),
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData)
      throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`)
    }

    console.log('Token exchange successful, getting user info...')

    // Get user info from Zoom
    const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const userData = await userResponse.json()
    
    if (!userResponse.ok) {
      console.error('Failed to get user info:', userData)
      throw new Error(`Failed to get user info: ${userData.message}`)
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))

    // Store tokens in user profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        zoom_access_token: tokenData.access_token,
        zoom_refresh_token: tokenData.refresh_token,
        zoom_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to store tokens:', updateError)
      throw new Error(`Failed to store tokens: ${updateError.message}`)
    }

    // Update zoom connection record with connection details
    const { error: connectionUpdateError } = await supabaseClient
      .from('zoom_connections')
      .update({
        zoom_user_id: userData.id,
        zoom_email: userData.email,
        connection_status: 'active',
        permissions: { scope: tokenData.scope },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (connectionUpdateError) {
      console.error('Failed to update connection record:', connectionUpdateError)
    }

    console.log('Successfully connected Zoom for user:', userId)

    // Redirect to the actual app URL instead of the function URL
    const appOrigin = 'https://fvehswcrxhdxztycnvgz.lovable.app'
    const redirectUrl = `${appOrigin}/account?zoom_connected=true`
    
    console.log('Redirecting to:', redirectUrl)
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    })

  } catch (error) {
    console.error('OAuth callback error:', error)
    
    // Redirect to error page with the actual app URL
    const appOrigin = 'https://fvehswcrxhdxztycnvgz.lovable.app'
    const errorUrl = `${appOrigin}/account?zoom_error=${encodeURIComponent(error.message)}`
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': errorUrl,
      },
    })
  }
})
