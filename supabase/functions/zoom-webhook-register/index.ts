
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id } = await req.json()

    // Get Zoom credentials
    const { data: connection, error: connectionError } = await supabase
      .from('zoom_connections')
      .select('*')
      .eq('user_id', user_id)
      .eq('connection_status', 'active')
      .single()

    if (connectionError || !connection) {
      throw new Error('No active Zoom connection found')
    }

    // Get stored credentials
    const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID')
    const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')
    const zoomAccountId = Deno.env.get('ZOOM_ACCOUNT_ID')

    if (!zoomClientId || !zoomClientSecret || !zoomAccountId) {
      throw new Error('Zoom credentials not configured')
    }

    // Get access token for API calls
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: zoomAccountId
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Zoom access token')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Webhook endpoint URL
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zoom-webhook-handler`

    // Register webhook with Zoom
    const webhookResponse = await fetch('https://api.zoom.us/v2/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        auth_user: '',
        auth_password: '',
        events: [
          'webinar.started',
          'webinar.ended',
          'webinar.participant_joined',
          'webinar.participant_left',
          'webinar.registration_created',
          'webinar.registration_approved',
          'webinar.registration_cancelled',
          'webinar.registration_denied'
        ]
      })
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error('Webhook registration failed:', errorText)
      throw new Error(`Failed to register webhook: ${errorText}`)
    }

    const webhookData = await webhookResponse.json()
    console.log('Webhook registered successfully:', webhookData)

    // Store webhook configuration
    const { error: storeError } = await supabase
      .from('zoom_webhook_events')
      .insert({
        organization_id,
        event_type: 'webhook_registered',
        payload: {
          webhook_id: webhookData.webhook_id,
          webhook_url: webhookUrl,
          events: webhookData.events,
          status: 'active'
        },
        processed: true
      })

    if (storeError) {
      console.error('Error storing webhook config:', storeError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        webhook_id: webhookData.webhook_id,
        message: 'Zoom webhook registered successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Webhook registration error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
