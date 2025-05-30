
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
      engagement_score: Math.min(9.99, Math.max(0, (attendee.duration || 0) / 60 / 10)), // Ensure score is between 0-9.99
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

export async function handleGetInstanceParticipants(req: Request, supabase: any, user: any, credentials: any, webinarId: string, instanceId: string) {
  console.log(`[getInstanceParticipants] Starting for webinar ${webinarId}, instance ${instanceId}`);
  
  try {
    // Verify the instance exists in our database
    const { data: dbInstance, error: instanceError } = await supabase
      .from('webinar_instances')
      .select('*')
      .eq('zoom_instance_id', instanceId)
      .eq('webinar_id', webinarId)
      .single();
    
    if (instanceError) {
      console.error('[getInstanceParticipants] Instance not found in database:', instanceError);
      return new Response(JSON.stringify({
        error: 'Instance not found in database',
        webinar_id: webinarId,
        instance_id: instanceId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const token = await getZoomJwtToken(credentials.account_id, credentials.client_id, credentials.client_secret);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Get ALL registrants with pagination
    console.log(`[getInstanceParticipants] Fetching ALL registrants for webinar ${webinarId}, instance ${instanceId}`);
    const allRegistrants = await fetchAllPaginatedData(
      `https://api.zoom.us/v2/webinars/${webinarId}/registrants?occurrence_id=${instanceId}`,
      headers
    );
    
    // Get ALL attendees with pagination  
    console.log(`[getInstanceParticipants] Fetching ALL attendees for instance ${instanceId}`);
    const allAttendees = await fetchAllPaginatedData(
      `https://api.zoom.us/v2/past_webinars/${instanceId}/participants`,
      headers
    );
    
    console.log(`[getInstanceParticipants] Retrieved ${allRegistrants.length} registrants and ${allAttendees.length} attendees`);
    
    // Store in database with batch operations
    const totalStored = await storeParticipantsInBatches(supabase, user.id, instanceId, webinarId, allRegistrants, allAttendees);
    
    // Record comprehensive sync history
    await supabase
      .from('zoom_sync_history')
      .insert({
        user_id: user.id,
        sync_type: 'instance_participants_full',
        status: 'success',
        items_synced: totalStored,
        total_expected: allRegistrants.length + allAttendees.length,
        total_retrieved: allRegistrants.length + allAttendees.length,
        pages_processed: Math.ceil((allRegistrants.length + allAttendees.length) / 300),
        message: `Fully synced ${allRegistrants.length} registrants and ${allAttendees.length} attendees for instance ${instanceId}. Stored: ${totalStored}`,
        sync_details: {
          webinar_id: webinarId,
          instance_id: instanceId,
          registrants_count: allRegistrants.length,
          attendees_count: allAttendees.length,
          total_stored: totalStored,
          pagination_used: true
        }
      });
    
    return new Response(JSON.stringify({
      registrants: allRegistrants,
      attendees: allAttendees,
      total_count: allRegistrants.length + allAttendees.length,
      total_stored: totalStored,
      sync_complete: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[getInstanceParticipants] Error:', error);
    
    // Record sync failure
    await supabase
      .from('zoom_sync_history')
      .insert({
        user_id: user.id,
        sync_type: 'instance_participants_full',
        status: 'error',
        items_synced: 0,
        total_expected: 0,
        total_retrieved: 0,
        pages_processed: 0,
        message: `Failed to sync participants for instance ${instanceId}: ${error.message}`,
        sync_details: {
          webinar_id: webinarId,
          instance_id: instanceId,
          error: error.message
        }
      });
    
    return new Response(JSON.stringify({
      error: error.message,
      webinar_id: webinarId,
      instance_id: instanceId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
