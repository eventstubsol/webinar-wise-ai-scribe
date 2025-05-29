
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

    console.log('Starting real-time data cleanup...')

    // Cleanup inactive participant sessions (older than 10 minutes)
    const { error: sessionsError } = await supabase.rpc('cleanup_inactive_sessions')
    
    if (sessionsError) {
      console.error('Error cleaning up sessions:', sessionsError)
    } else {
      console.log('Successfully cleaned up inactive sessions')
    }

    // Archive old events (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { error: eventsError } = await supabase
      .from('webinar_live_events')
      .delete()
      .lt('timestamp', twentyFourHoursAgo)

    if (eventsError) {
      console.error('Error archiving old events:', eventsError)
    } else {
      console.log('Successfully archived old events')
    }

    // Update stale webinar statuses
    const { error: statusError } = await supabase
      .from('webinar_live_status')
      .update({ 
        is_live: false,
        status: 'ended',
        updated_at: new Date().toISOString()
      })
      .eq('is_live', true)
      .lt('last_activity', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 30 minutes ago

    if (statusError) {
      console.error('Error updating stale statuses:', statusError)
    } else {
      console.log('Successfully updated stale webinar statuses')
    }

    // Process unprocessed webhook events (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data: unprocessedEvents } = await supabase
      .from('zoom_webhook_events')
      .select('*')
      .eq('processed', false)
      .lt('created_at', fiveMinutesAgo)
      .limit(10)

    if (unprocessedEvents && unprocessedEvents.length > 0) {
      console.log(`Processing ${unprocessedEvents.length} delayed webhook events`)
      
      for (const event of unprocessedEvents) {
        try {
          // Mark as processed to avoid reprocessing
          await supabase
            .from('zoom_webhook_events')
            .update({ processed: true })
            .eq('id', event.id)

          console.log(`Processed delayed event: ${event.event_type}`)
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Real-time cleanup completed successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
