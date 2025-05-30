
import { syncCompleteWebinarWithAllInstances } from './syncCompleteWebinar.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleMassResyncAllWebinars(req: Request, supabase: any, user: any, credentials: any) {
  console.log('[massResync] Starting complete historical re-sync of all webinars');
  
  const resyncResults = {
    total_webinars: 0,
    successful_webinars: 0,
    failed_webinars: 0,
    total_participants_synced: 0,
    total_instances_processed: 0,
    errors: [],
    detailed_results: []
  };
  
  try {
    // Get all webinars for this user from the webinars table
    const { data: webinars, error: webinarsError } = await supabase
      .from('webinars')
      .select('zoom_webinar_id, title')
      .eq('user_id', user.id)
      .not('zoom_webinar_id', 'is', null);
    
    if (webinarsError) {
      throw new Error(`Failed to fetch webinars: ${webinarsError.message}`);
    }
    
    resyncResults.total_webinars = webinars.length;
    console.log(`[massResync] Found ${webinars.length} webinars to re-sync`);
    
    // Process each webinar
    for (const webinar of webinars) {
      try {
        console.log(`[massResync] Processing webinar: ${webinar.title} (${webinar.zoom_webinar_id})`);
        
        const webinarResult = await syncCompleteWebinarWithAllInstances(
          webinar.zoom_webinar_id,
          credentials,
          supabase,
          user
        );
        
        resyncResults.successful_webinars++;
        resyncResults.total_participants_synced += (webinarResult.total_registrants + webinarResult.total_attendees);
        resyncResults.total_instances_processed += webinarResult.instances_processed;
        
        resyncResults.detailed_results.push({
          webinar_id: webinar.zoom_webinar_id,
          topic: webinar.title,
          status: 'success',
          ...webinarResult
        });
        
        // Add delay between webinars to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (webinarError) {
        console.error(`[massResync] Error processing webinar ${webinar.zoom_webinar_id}:`, webinarError);
        resyncResults.failed_webinars++;
        resyncResults.errors.push({
          webinar_id: webinar.zoom_webinar_id,
          topic: webinar.title,
          error: webinarError.message
        });
        
        resyncResults.detailed_results.push({
          webinar_id: webinar.zoom_webinar_id,
          topic: webinar.title,
          status: 'failed',
          error: webinarError.message
        });
      }
    }
    
    // Record mass re-sync completion
    await supabase
      .from('sync_logs')
      .insert({
        user_id: user.id,
        organization_id: user.organization_id,
        sync_type: 'mass_resync_all',
        status: resyncResults.failed_webinars === 0 ? 'completed' : 'partial',
        records_processed: resyncResults.total_participants_synced,
        error_message: resyncResults.errors.length > 0 ? `${resyncResults.failed_webinars} webinars failed to sync` : null
      });
    
    console.log('[massResync] Mass re-sync completed:', resyncResults);
    
    return new Response(JSON.stringify({
      success: true,
      results: resyncResults,
      message: `Mass re-sync completed: ${resyncResults.successful_webinars}/${resyncResults.total_webinars} webinars processed successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[massResync] Critical error during mass re-sync:', error);
    
    await supabase
      .from('sync_logs')
      .insert({
        user_id: user.id,
        organization_id: user.organization_id,
        sync_type: 'mass_resync_all',
        status: 'failed',
        records_processed: resyncResults.total_participants_synced,
        error_message: `Mass re-sync failed: ${error.message}`
      });
    
    throw error;
  }
}
