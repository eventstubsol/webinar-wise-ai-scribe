
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp',
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

    // Get request body and headers
    const body = await req.text()
    const signature = req.headers.get('x-zm-signature')
    const timestamp = req.headers.get('x-zm-request-timestamp')

    console.log('Webhook received:', {
      signature: signature ? 'present' : 'missing',
      timestamp: timestamp ? 'present' : 'missing',
      bodyLength: body.length
    })

    // Verify webhook signature if present
    if (signature && timestamp) {
      const webhookSecret = Deno.env.get('ZOOM_WEBHOOK_SECRET')
      if (webhookSecret) {
        const message = `v0:${timestamp}:${body}`
        const expectedSignature = `v0=${createHmac('sha256', webhookSecret).update(message).digest('hex')}`
        
        if (signature !== expectedSignature) {
          console.error('Invalid webhook signature')
          return new Response('Invalid signature', { status: 401, headers: corsHeaders })
        }
        console.log('Webhook signature verified')
      }
    }

    const payload = JSON.parse(body)
    console.log('Parsed webhook payload:', JSON.stringify(payload, null, 2))

    // Handle URL verification challenge
    if (payload.event === 'endpoint.url_validation') {
      console.log('URL validation challenge received')
      return new Response(
        JSON.stringify({
          plainToken: payload.payload.plainToken,
          encryptedToken: payload.payload.encryptedToken
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Extract event data
    const { event, payload: eventPayload } = payload
    const eventType = event || payload.event

    // Find organization based on the webinar
    let organizationId = null
    let webinarId = null

    if (eventPayload?.object?.id) {
      const zoomWebinarId = eventPayload.object.id.toString()
      
      // Look up webinar in our database
      const { data: webinar } = await supabase
        .from('webinars')
        .select('id, organization_id')
        .eq('zoom_webinar_id', zoomWebinarId)
        .single()

      if (webinar) {
        organizationId = webinar.organization_id
        webinarId = webinar.id
        console.log(`Found webinar: ${webinarId} for org: ${organizationId}`)
      } else {
        console.log(`No webinar found for Zoom ID: ${zoomWebinarId}`)
      }
    }

    // Store webhook event with retry mechanism
    const maxRetries = 3
    let attempt = 0
    let webhookError = null

    while (attempt < maxRetries) {
      try {
        const { error } = await supabase
          .from('zoom_webhook_events')
          .insert({
            organization_id: organizationId,
            event_type: eventType,
            event_ts: eventPayload?.object?.start_time || new Date().toISOString(),
            payload: payload,
            webinar_id: webinarId,
            processed: false
          })

        if (error) {
          webhookError = error
          attempt++
          console.error(`Webhook storage attempt ${attempt} failed:`, error)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // exponential backoff
          }
        } else {
          webhookError = null
          break
        }
      } catch (error) {
        webhookError = error
        attempt++
        console.error(`Webhook storage attempt ${attempt} failed:`, error)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    if (webhookError) {
      console.error('Failed to store webhook after all retries:', webhookError)
    }

    // Process real-time events immediately if we have webinar mapping
    if (webinarId && organizationId) {
      try {
        await processRealTimeEvent(supabase, eventType, eventPayload, webinarId, organizationId)
      } catch (error) {
        console.error('Error processing real-time event:', error)
        // Don't fail the webhook response due to processing errors
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: !!webinarId }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function processRealTimeEvent(supabase: any, eventType: string, eventPayload: any, webinarId: string, organizationId: string) {
  try {
    console.log(`Processing real-time event: ${eventType} for webinar: ${webinarId}`)
    
    switch (eventType) {
      case 'webinar.started':
        await handleWebinarStarted(supabase, eventPayload, webinarId, organizationId)
        break
      case 'webinar.ended':
        await handleWebinarEnded(supabase, eventPayload, webinarId, organizationId)
        break
      case 'webinar.participant_joined':
        await handleParticipantJoined(supabase, eventPayload, webinarId, organizationId)
        break
      case 'webinar.participant_left':
        await handleParticipantLeft(supabase, eventPayload, webinarId, organizationId)
        break
      case 'webinar.registration_created':
      case 'webinar.registration_approved':
        await handleRegistrationEvent(supabase, eventPayload, webinarId, organizationId, eventType)
        break
      default:
        console.log('Unhandled event type:', eventType)
        await logGenericEvent(supabase, eventType, eventPayload, webinarId, organizationId)
    }
  } catch (error) {
    console.error('Error processing real-time event:', error)
    throw error
  }
}

async function handleWebinarStarted(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  console.log('Handling webinar started event')
  
  // Update webinar live status
  await supabase
    .from('webinar_live_status')
    .upsert({
      webinar_id: webinarId,
      organization_id: organizationId,
      status: 'live',
      is_live: true,
      started_at: new Date().toISOString(),
      current_participants: 0,
      peak_participants: 0,
      last_activity: new Date().toISOString(),
      live_metrics: {
        start_time: eventPayload.object?.start_time,
        host_id: eventPayload.object?.host_id,
        webinar_number: eventPayload.object?.id
      }
    })

  // Log event
  await supabase
    .from('webinar_live_events')
    .insert({
      webinar_id: webinarId,
      organization_id: organizationId,
      event_type: 'webinar_started',
      event_data: eventPayload,
      processed: true
    })

  console.log('Webinar started event processed successfully')
}

async function handleWebinarEnded(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  console.log('Handling webinar ended event')
  
  // Update webinar live status
  await supabase
    .from('webinar_live_status')
    .update({
      status: 'ended',
      is_live: false,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('webinar_id', webinarId)

  // Mark all participant sessions as inactive
  await supabase
    .from('live_participant_sessions')
    .update({
      is_active: false,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('webinar_id', webinarId)
    .eq('is_active', true)

  // Log event
  await supabase
    .from('webinar_live_events')
    .insert({
      webinar_id: webinarId,
      organization_id: organizationId,
      event_type: 'webinar_ended',
      event_data: eventPayload,
      processed: true
    })

  console.log('Webinar ended event processed successfully')
}

async function handleParticipantJoined(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  const participant = eventPayload.object?.participant
  
  if (participant) {
    console.log(`Handling participant joined: ${participant.user_name}`)
    
    // Create or update participant session
    await supabase
      .from('live_participant_sessions')
      .upsert({
        webinar_id: webinarId,
        organization_id: organizationId,
        zoom_participant_id: participant.id?.toString(),
        participant_name: participant.user_name || 'Unknown',
        participant_email: participant.email || '',
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true,
        device_info: {
          client_type: participant.client_type,
          version: participant.version,
          user_agent: participant.user_agent
        },
        attention_score: 1.0,
        interaction_count: 0
      })

    // Update current participant count
    const { data: currentStatus } = await supabase
      .from('webinar_live_status')
      .select('current_participants, peak_participants')
      .eq('webinar_id', webinarId)
      .single()

    if (currentStatus) {
      const newCount = (currentStatus.current_participants || 0) + 1
      const peakCount = Math.max(newCount, currentStatus.peak_participants || 0)

      await supabase
        .from('webinar_live_status')
        .update({
          current_participants: newCount,
          peak_participants: peakCount,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('webinar_id', webinarId)
    }

    // Log event
    await supabase
      .from('webinar_live_events')
      .insert({
        webinar_id: webinarId,
        organization_id: organizationId,
        event_type: 'participant_joined',
        event_data: eventPayload,
        processed: true
      })

    console.log('Participant joined event processed successfully')
  }
}

async function handleParticipantLeft(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  const participant = eventPayload.object?.participant
  
  if (participant) {
    console.log(`Handling participant left: ${participant.user_name}`)
    
    // Mark participant session as inactive
    await supabase
      .from('live_participant_sessions')
      .update({
        is_active: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('webinar_id', webinarId)
      .eq('zoom_participant_id', participant.id?.toString())

    // Update current participant count
    const { data: currentStatus } = await supabase
      .from('webinar_live_status')
      .select('current_participants')
      .eq('webinar_id', webinarId)
      .single()

    if (currentStatus && currentStatus.current_participants > 0) {
      await supabase
        .from('webinar_live_status')
        .update({
          current_participants: currentStatus.current_participants - 1,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('webinar_id', webinarId)
    }

    // Log event
    await supabase
      .from('webinar_live_events')
      .insert({
        webinar_id: webinarId,
        organization_id: organizationId,
        event_type: 'participant_left',
        event_data: eventPayload,
        processed: true
      })

    console.log('Participant left event processed successfully')
  }
}

async function handleRegistrationEvent(supabase: any, eventPayload: any, webinarId: string, organizationId: string, eventType: string) {
  const registrant = eventPayload.object?.registrant
  
  if (registrant) {
    console.log(`Handling registration event: ${eventType} for ${registrant.email}`)
    
    // Log event
    await supabase
      .from('webinar_live_events')
      .insert({
        webinar_id: webinarId,
        organization_id: organizationId,
        event_type: eventType.replace('webinar.', ''),
        event_data: eventPayload,
        processed: true
      })
  }
}

async function logGenericEvent(supabase: any, eventType: string, eventPayload: any, webinarId: string, organizationId: string) {
  console.log(`Logging generic event: ${eventType}`)
  
  await supabase
    .from('webinar_live_events')
    .insert({
      webinar_id: webinarId,
      organization_id: organizationId,
      event_type: eventType,
      event_data: eventPayload,
      processed: true
    })
}
