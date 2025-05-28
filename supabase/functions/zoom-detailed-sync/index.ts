
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Background processor for detailed webinar data
async function processDetailedWebinarData(
  zoomWebinarId: string,
  organizationId: string,
  userId: string,
  supabaseClient: any
) {
  console.log(`Starting detailed sync for webinar: ${zoomWebinarId}`);
  
  try {
    // Get webinar record from database
    const { data: webinarRecord, error: webinarError } = await supabaseClient
      .from('webinars')
      .select('id')
      .eq('zoom_webinar_id', zoomWebinarId)
      .eq('organization_id', organizationId)
      .single();

    if (webinarError || !webinarRecord) {
      console.error(`Webinar not found: ${zoomWebinarId}`);
      return { success: false, error: 'Webinar not found' };
    }

    const webinarId = webinarRecord.id;
    const results = {
      participants: { success: 0, failed: 0 },
      registrations: { success: 0, failed: 0 },
      polls: { success: 0, failed: 0 }
    };

    // Process participants
    try {
      const participantsResult = await supabaseClient.functions.invoke('zoom-sync-participants', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id: webinarId,
          zoom_webinar_id: zoomWebinarId,
        }
      });

      if (participantsResult.data?.success) {
        results.participants.success = participantsResult.data.participants_synced || 0;
        console.log(`✓ Participants synced: ${results.participants.success}`);
      } else {
        results.participants.failed = 1;
        console.log(`❌ Participants sync failed: ${participantsResult.error?.message}`);
      }
    } catch (error) {
      results.participants.failed = 1;
      console.log(`❌ Participants sync error: ${error.message}`);
    }

    // Small delay between operations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Process registrations
    try {
      const registrationsResult = await supabaseClient.functions.invoke('zoom-sync-registrations', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id: webinarId,
          zoom_webinar_id: zoomWebinarId,
        }
      });

      if (registrationsResult.data?.success) {
        results.registrations.success = registrationsResult.data.registrations_synced || 0;
        console.log(`✓ Registrations synced: ${results.registrations.success}`);
      } else {
        results.registrations.failed = 1;
        console.log(`❌ Registrations sync failed: ${registrationsResult.error?.message}`);
      }
    } catch (error) {
      results.registrations.failed = 1;
      console.log(`❌ Registrations sync error: ${error.message}`);
    }

    // Small delay between operations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Process polls
    try {
      const pollsResult = await supabaseClient.functions.invoke('zoom-sync-polls', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id: webinarId,
          zoom_webinar_id: zoomWebinarId,
        }
      });

      if (pollsResult.data?.success) {
        results.polls.success = pollsResult.data.polls_synced || 0;
        console.log(`✓ Polls synced: ${results.polls.success}`);
      } else {
        results.polls.failed = 1;
        console.log(`❌ Polls sync failed: ${pollsResult.error?.message}`);
      }
    } catch (error) {
      results.polls.failed = 1;
      console.log(`❌ Polls sync error: ${error.message}`);
    }

    console.log(`Detailed sync completed for webinar: ${zoomWebinarId}`, results);
    return { success: true, results };
    
  } catch (error) {
    console.error(`Detailed sync failed for webinar ${zoomWebinarId}:`, error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  console.log('Detailed sync called with method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { webinar_zoom_id, organization_id, user_id } = await req.json();
    
    if (!webinar_zoom_id || !organization_id || !user_id) {
      throw new Error('Webinar Zoom ID, Organization ID, and User ID are required');
    }

    console.log('Starting detailed sync for webinar:', webinar_zoom_id);

    // Process detailed data in background
    const backgroundProcess = processDetailedWebinarData(
      webinar_zoom_id,
      organization_id,
      user_id,
      supabaseClient
    );

    // Return immediate response
    const processingTime = Date.now() - startTime;
    
    // Use background task to continue processing
    // Note: In a real implementation, you'd use EdgeRuntime.waitUntil() here
    backgroundProcess.catch(error => 
      console.error('Background detailed sync failed:', error)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Detailed sync started in background',
        webinar_zoom_id,
        processing_time_ms: processingTime,
        background_processing: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Detailed sync error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        processing_time_ms: Date.now() - startTime
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
