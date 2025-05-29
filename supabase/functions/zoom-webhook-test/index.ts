
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

    const { 
      event_type, 
      webinar_id, 
      organization_id, 
      participant_data,
      custom_data 
    } = await req.json()

    console.log(`Testing webhook event: ${event_type} for webinar: ${webinar_id}`)

    // Generate mock webhook payload based on event type
    let mockPayload = {}

    switch (event_type) {
      case 'webinar.started':
        mockPayload = {
          event: 'webinar.started',
          payload: {
            account_id: 'test_account',
            object: {
              id: Math.floor(Math.random() * 1000000000),
              uuid: `test-uuid-${Date.now()}`,
              host_id: 'test_host_123',
              topic: 'Test Webinar',
              type: 5,
              start_time: new Date().toISOString(),
              timezone: 'UTC',
              duration: 60,
              ...custom_data
            }
          }
        }
        break

      case 'webinar.ended':
        mockPayload = {
          event: 'webinar.ended',
          payload: {
            account_id: 'test_account',
            object: {
              id: Math.floor(Math.random() * 1000000000),
              uuid: `test-uuid-${Date.now()}`,
              host_id: 'test_host_123',
              topic: 'Test Webinar',
              type: 5,
              start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              end_time: new Date().toISOString(),
              duration: 60,
              ...custom_data
            }
          }
        }
        break

      case 'webinar.participant_joined':
        mockPayload = {
          event: 'webinar.participant_joined',
          payload: {
            account_id: 'test_account',
            object: {
              id: Math.floor(Math.random() * 1000000000),
              uuid: `test-uuid-${Date.now()}`,
              host_id: 'test_host_123',
              topic: 'Test Webinar',
              participant: {
                id: participant_data?.id || `test_participant_${Date.now()}`,
                user_id: participant_data?.user_id || 'test_user_123',
                user_name: participant_data?.name || 'Test Participant',
                email: participant_data?.email || 'test@example.com',
                join_time: new Date().toISOString(),
                client_type: 'Mac',
                version: '5.0.0',
                ...participant_data
              },
              ...custom_data
            }
          }
        }
        break

      case 'webinar.participant_left':
        mockPayload = {
          event: 'webinar.participant_left',
          payload: {
            account_id: 'test_account',
            object: {
              id: Math.floor(Math.random() * 1000000000),
              uuid: `test-uuid-${Date.now()}`,
              host_id: 'test_host_123',
              topic: 'Test Webinar',
              participant: {
                id: participant_data?.id || `test_participant_${Date.now()}`,
                user_id: participant_data?.user_id || 'test_user_123',
                user_name: participant_data?.name || 'Test Participant',
                email: participant_data?.email || 'test@example.com',
                leave_time: new Date().toISOString(),
                client_type: 'Mac',
                version: '5.0.0',
                ...participant_data
              },
              ...custom_data
            }
          }
        }
        break

      case 'webinar.registration_created':
        mockPayload = {
          event: 'webinar.registration_created',
          payload: {
            account_id: 'test_account',
            object: {
              id: Math.floor(Math.random() * 1000000000),
              uuid: `test-uuid-${Date.now()}`,
              host_id: 'test_host_123',
              topic: 'Test Webinar',
              registrant: {
                id: participant_data?.id || `test_registrant_${Date.now()}`,
                email: participant_data?.email || 'test@example.com',
                first_name: participant_data?.first_name || 'Test',
                last_name: participant_data?.last_name || 'User',
                status: 'approved',
                create_time: new Date().toISOString(),
                join_url: 'https://zoom.us/j/test',
                ...participant_data
              },
              ...custom_data
            }
          }
        }
        break

      default:
        mockPayload = {
          event: event_type,
          payload: {
            account_id: 'test_account',
            object: {
              id: Math.floor(Math.random() * 1000000000),
              ...custom_data
            }
          }
        }
    }

    // Call the webhook handler with the mock payload
    const webhookResponse = await supabase.functions.invoke('zoom-webhook-handler', {
      body: mockPayload,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('Webhook handler response:', webhookResponse)

    // Also store the test event for tracking
    const { error: logError } = await supabase
      .from('zoom_webhook_events')
      .insert({
        organization_id,
        webinar_id,
        event_type: `test_${event_type}`,
        payload: {
          ...mockPayload,
          test_metadata: {
            triggered_at: new Date().toISOString(),
            test_type: 'manual_trigger',
            original_event_type: event_type
          }
        },
        processed: true
      })

    if (logError) {
      console.error('Error logging test event:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Test webhook event '${event_type}' triggered successfully`,
        mock_payload: mockPayload,
        webhook_response: webhookResponse
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Webhook test error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
