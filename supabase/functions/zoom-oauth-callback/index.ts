
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    if (!code) {
      throw new Error('Authorization code not provided')
    }

    // Get Zoom credentials from environment
    const clientId = Deno.env.get('ZOOM_CLIENT_ID')
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')
    
    if (!clientId || !clientSecret) {
      throw new Error('Zoom credentials not configured')
    }

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

    // Decode the user_id from state (base64 encoded)
    const userId = state ? atob(state) : null
    
    if (!userId) {
      throw new Error('Invalid state parameter')
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))

    // Get user's organization ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Failed to get user profile:', profileError)
      throw new Error('Unable to get user organization')
    }

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

    // Create/update zoom connection record for this user
    const { error: connectionError } = await supabaseClient
      .from('zoom_connections')
      .upsert({
        user_id: userId,
        organization_id: profile.organization_id,
        zoom_user_id: userData.id,
        zoom_email: userData.email,
        connection_status: 'active',
        permissions: { scope: tokenData.scope },
        updated_at: new Date().toISOString(),
      })

    if (connectionError) {
      console.error('Failed to create connection record:', connectionError)
    }

    console.log('Successfully connected Zoom for user:', userId)

    // Redirect to success page
    const redirectUrl = `${url.origin}/account?zoom_connected=true`
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    })

  } catch (error) {
    console.error('OAuth callback error:', error)
    
    // Redirect to error page
    const url = new URL(req.url)
    const errorUrl = `${url.origin}/account?zoom_error=${encodeURIComponent(error.message)}`
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': errorUrl,
      },
    })
  }
})
