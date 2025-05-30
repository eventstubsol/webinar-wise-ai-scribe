
import { fetchAllPaginatedData } from '../utils/pagination.ts';
import { syncInstanceParticipants } from './instanceSync.ts';
import { syncSingleWebinarParticipants } from './singleWebinarSync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getZoomJwtToken(accountId: string, clientId: string, clientSecret: string) {
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: `grant_type=account_credentials&account_id=${accountId}`
  });

  if (!response.ok) {
    throw new Error(`Failed to get Zoom token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function syncCompleteWebinarWithAllInstances(webinarId: string, credentials: any, supabase: any, user: any) {
  console.log(`[syncCompleteWebinar] Starting complete sync for webinar ${webinarId}`);
  
  const token = await getZoomJwtToken(credentials.account_id, credentials.client_id, credentials.client_secret);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  let totalParticipantsSynced = 0;
  const syncResults = {
    webinar_id: webinarId,
    instances_processed: 0,
    total_registrants: 0,
    total_attendees: 0,
    total_stored: 0,
    errors: []
  };
  
  try {
    // Step 1: Get ALL instances of this webinar
    console.log(`[syncCompleteWebinar] Fetching all instances for webinar ${webinarId}`);
    const instances = await fetchAllPaginatedData(
      `https://api.zoom.us/v2/past_webinars/${webinarId}/instances`,
      headers
    );
    
    console.log(`[syncCompleteWebinar] Found ${instances.length} instances for webinar ${webinarId}`);
    
    if (instances.length === 0) {
      // Handle single webinar (not recurring)
      console.log(`[syncCompleteWebinar] No instances found, treating as single webinar`);
      return await syncSingleWebinarParticipants(webinarId, credentials, supabase, user);
    }
    
    // Step 2: Process each instance
    for (const instance of instances) {
      try {
        console.log(`[syncCompleteWebinar] Processing instance ${instance.uuid}`);
        
        // Ensure instance exists in database
        const { data: dbInstance, error: instanceError } = await supabase
          .from('webinar_instances')
          .upsert({
            user_id: user.id,
            webinar_id: webinarId,
            zoom_instance_id: instance.uuid,
            start_time: instance.start_time,
            host_id: instance.host_id,
            duration: instance.duration,
            total_participants: instance.participants_count || 0,
            raw_data: instance
          }, {
            onConflict: 'user_id,webinar_id,zoom_instance_id'
          })
          .select()
          .single();
        
        if (instanceError) {
          console.error(`[syncCompleteWebinar] Error creating instance ${instance.uuid}:`, instanceError);
          syncResults.errors.push(`Instance ${instance.uuid}: ${instanceError.message}`);
          continue;
        }
        
        // Sync participants for this instance
        const instanceResult = await syncInstanceParticipants(
          webinarId, 
          instance.uuid, 
          dbInstance.id, 
          credentials, 
          supabase, 
          user
        );
        
        syncResults.instances_processed++;
        syncResults.total_registrants += instanceResult.registrants_count;
        syncResults.total_attendees += instanceResult.attendees_count;
        syncResults.total_stored += instanceResult.total_stored;
        totalParticipantsSynced += instanceResult.total_count;
        
      } catch (instanceError) {
        console.error(`[syncCompleteWebinar] Error processing instance ${instance.uuid}:`, instanceError);
        syncResults.errors.push(`Instance ${instance.uuid}: ${instanceError.message}`);
      }
    }
    
    // Record comprehensive sync
    await supabase
      .from('zoom_sync_history')
      .insert({
        user_id: user.id,
        sync_type: 'complete_webinar_sync',
        status: syncResults.errors.length === 0 ? 'success' : 'partial_success',
        items_synced: syncResults.total_stored,
        total_expected: syncResults.total_registrants + syncResults.total_attendees,
        total_retrieved: totalParticipantsSynced,
        pages_processed: syncResults.instances_processed,
        message: `Complete sync: ${syncResults.instances_processed} instances, ${syncResults.total_stored} total participants stored`,
        sync_details: syncResults
      });
    
    console.log(`[syncCompleteWebinar] Completed sync for webinar ${webinarId}:`, syncResults);
    return syncResults;
    
  } catch (error) {
    console.error(`[syncCompleteWebinar] Critical error for webinar ${webinarId}:`, error);
    
    // Record sync failure
    await supabase
      .from('zoom_sync_history')
      .insert({
        user_id: user.id,
        sync_type: 'complete_webinar_sync',
        status: 'error',
        items_synced: 0,
        total_expected: 0,
        total_retrieved: 0,
        pages_processed: 0,
        message: `Failed to sync webinar ${webinarId}: ${error.message}`,
        sync_details: {
          webinar_id: webinarId,
          error: error.message
        }
      });
    
    throw error;
  }
}
