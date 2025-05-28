
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

    const { user_id } = await req.json()
    
    if (!user_id) {
      throw new Error('User ID is required')
    }

    // Get Zoom credentials from environment
    const clientId = Deno.env.get('ZOOM_CLIENT_ID')
    const accountId = Deno.env.get('ZOOM_ACCOUNT_ID')
    
    if (!clientId || !accountId) {
      throw new Error('Zoom credentials not configured')
    }

    // Encode user ID in state parameter
    const state = btoa(user_id)
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zoom-oauth-callback`
    
    const scope = 'webinar:read:admin meeting:read:admin user:read:admin'
    
    const authUrl = `https://zoom.us/oauth/authorize?` + 
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`

    console.log('Generated OAuth URL for user:', user_id)

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
