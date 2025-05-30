
import { fetchAllPaginatedData } from '../utils/pagination.ts';

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

async function storeParticipantsInBatches(supabase: any, userId: string, instanceId: string, webinarId: string, registrants: any[], attendees: any[]) {
  const batchSize = 100;
  let totalStored = 0;
  
  // Store registrants in batches
  for (let i = 0; i < registrants.length; i += batchSize) {
    const batch = registrants.slice(i, i + batchSize).map(registrant => ({
      webinar_id: webinarId,
      instance_id: instanceId,
      user_id: userId,
      zoom_participant_id: registrant.id,
      name: registrant.first_name && registrant.last_name 
        ? `${registrant.first_name} ${registrant.last_name}` 
        : registrant.email,
      email: registrant.email,
      registration_time: registrant.create_time,
      join_time: null,
      leave_time: null,
      duration_minutes: 0,
      engagement_score: 0,
      participant_type: 'registrant'
    }));
    
    const { error } = await supabase
      .from('attendees')
      .upsert(batch, { onConflict: 'webinar_id,zoom_participant_id' });
    
    if (error) {
      console.error(`[storeParticipants] Error storing registrant batch ${i}-${i + batchSize}:`, error);
    } else {
      totalStored += batch.length;
      console.log(`[storeParticipants] Stored registrant batch ${i + 1}-${Math.min(i + batchSize, registrants.length)} of ${registrants.length}`);
    }
  }
  
  // Store attendees in batches
  for (let i = 0; i < attendees.length; i += batchSize) {
    const batch = attendees.slice(i, i + batchSize).map(attendee => ({
      webinar_id: webinarId,
      instance_id: instanceId,
      user_id: userId,
      zoom_participant_id: attendee.id || attendee.user_id,
      name: attendee.name || attendee.user_name,
      email: attendee.user_email,
      registration_time: null,
      join_time: attendee.join_time,
      leave_time: attendee.leave_time,
      duration_minutes: attendee.duration ? Math.round(attendee.duration / 60) : 0,
      engagement_score: Math.min(9.99, Math.max(0, (attendee.duration || 0) / 60 / 10)),
      participant_type: 'attendee'
    }));
    
    const { error } = await supabase
      .from('attendees')
      .upsert(batch, { onConflict: 'webinar_id,zoom_participant_id' });
    
    if (error) {
      console.error(`[storeParticipants] Error storing attendee batch ${i}-${i + batchSize}:`, error);
    } else {
      totalStored += batch.length;
      console.log(`[storeParticipants] Stored attendee batch ${i + 1}-${Math.min(i + batchSize, attendees.length)} of ${attendees.length}`);
    }
  }
  
  console.log(`[storeParticipants] Total participants stored: ${totalStored} out of ${registrants.length + attendees.length}`);
  return totalStored;
}

async function syncInstanceParticipants(webinarId: string, instanceId: string, dbInstanceId: string, credentials: any, supabase: any, user: any) {
  const token = await getZoomJwtToken(credentials.account_id, credentials.client_id, credentials.client_secret);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  console.log(`[syncInstanceParticipants] Syncing participants for instance ${instanceId}`);
  
  // Get registrants and attendees with pagination
  const [registrants, attendees] = await Promise.all([
    fetchAllPaginatedData(`https://api.zoom.us/v2/webinars/${webinarId}/registrants?occurrence_id=${instanceId}`, headers),
    fetchAllPaginatedData(`https://api.zoom.us/v2/past_webinars/${instanceId}/participants`, headers)
  ]);
  
  console.log(`[syncInstanceParticipants] Found ${registrants.length} registrants and ${attendees.length} attendees for instance ${instanceId}`);
  
  // Store in database
  const totalStored = await storeParticipantsInBatches(supabase, user.id, dbInstanceId, webinarId, registrants, attendees);
  
  return {
    registrants_count: registrants.length,
    attendees_count: attendees.length,
    total_count: registrants.length + attendees.length,
    total_stored: totalStored
  };
}

async function syncSingleWebinarParticipants(webinarId: string, credentials: any, supabase: any, user: any) {
  console.log(`[syncSingleWebinarParticipants] Syncing single webinar ${webinarId}`);
  
  const token = await getZoomJwtToken(credentials.account_id, credentials.client_id, credentials.client_secret);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // For single webinars, use the webinar ID as the instance ID
  const [registrants, attendees] = await Promise.all([
    fetchAllPaginatedData(`https://api.zoom.us/v2/webinars/${webinarId}/registrants`, headers),
    fetchAllPaginatedData(`https://api.zoom.us/v2/past_webinars/${webinarId}/participants`, headers)
  ]);
  
  const totalStored = await storeParticipantsInBatches(supabase, user.id, webinarId, webinarId, registrants, attendees);
  
  return {
    webinar_id: webinarId,
    instances_processed: 1,
    total_registrants: registrants.length,
    total_attendees: attendees.length,
    total_stored: totalStored,
    errors: []
  };
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
