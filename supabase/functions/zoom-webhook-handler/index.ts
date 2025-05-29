
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

    const payload = await req.json()
    console.log('Received webhook:', JSON.stringify(payload, null, 2))

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
      }
    }

    // Store webhook event
    const { error: webhookError } = await supabase
      .from('zoom_webhook_events')
      .insert({
        organization_id: organizationId,
        event_type: eventType,
        event_ts: eventPayload?.object?.start_time || new Date().toISOString(),
        payload: payload,
        webinar_id: webinarId,
        processed: false
      })

    if (webhookError) {
      console.error('Error storing webhook:', webhookError)
    }

    // Process real-time events immediately
    if (webinarId && organizationId) {
      await processRealTimeEvent(supabase, eventType, eventPayload, webinarId, organizationId)
    }

    return new Response(
      JSON.stringify({ success: true }),
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
      default:
        console.log('Unhandled event type:', eventType)
    }
  } catch (error) {
    console.error('Error processing real-time event:', error)
  }
}

async function handleWebinarStarted(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
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
      live_metrics: {
        start_time: eventPayload.object?.start_time,
        host_id: eventPayload.object?.host_id
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
}

async function handleWebinarEnded(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  // Update webinar live status
  await supabase
    .from('webinar_live_status')
    .update({
      status: 'ended',
      is_live: false,
      updated_at: new Date().toISOString()
    })
    .eq('webinar_id', webinarId)

  // Mark all participant sessions as inactive
  await supabase
    .from('live_participant_sessions')
    .update({
      is_active: false,
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
}

async function handleParticipantJoined(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  const participant = eventPayload.object?.participant
  
  if (participant) {
    // Create or update participant session
    await supabase
      .from('live_participant_sessions')
      .upsert({
        webinar_id: webinarId,
        organization_id: organizationId,
        zoom_participant_id: participant.id,
        participant_name: participant.user_name,
        participant_email: participant.email,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true,
        device_info: {
          client_type: participant.client_type,
          version: participant.version
        }
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
  }
}

async function handleParticipantLeft(supabase: any, eventPayload: any, webinarId: string, organizationId: string) {
  const participant = eventPayload.object?.participant
  
  if (participant) {
    // Mark participant session as inactive
    await supabase
      .from('live_participant_sessions')
      .update({
        is_active: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('webinar_id', webinarId)
      .eq('zoom_participant_id', participant.id)

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
  }
}
