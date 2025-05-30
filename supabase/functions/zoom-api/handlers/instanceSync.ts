
import { fetchAllPaginatedData } from '../utils/pagination.ts';
import { storeParticipantsInBatches, storeWebinarInstance } from '../utils/batchOperations.ts';

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

export async function syncInstanceParticipants(webinarId: string, instanceData: any, credentials: any, supabase: any, user: any) {
  const token = await getZoomJwtToken(credentials.account_id, credentials.client_id, credentials.client_secret);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  console.log(`[syncInstanceParticipants] Syncing participants for instance ${instanceData.uuid}`);
  
  // Store the webinar instance first
  const dbInstance = await storeWebinarInstance(supabase, user.id, webinarId, instanceData);
  
  let registrants = [];
  let attendees = [];
  let errors = [];
  
  try {
    // For recurring webinar instances, use occurrence_id parameter for registrants
    console.log(`[syncInstanceParticipants] Fetching registrants for instance ${instanceData.uuid}`);
    registrants = await fetchAllPaginatedData(`https://api.zoom.us/v2/webinars/${webinarId}/registrants?occurrence_id=${instanceData.uuid}`, headers);
    console.log(`[syncInstanceParticipants] Found ${registrants.length} registrants for instance ${instanceData.uuid}`);
  } catch (error) {
    console.error(`[syncInstanceParticipants] Error fetching registrants for instance ${instanceData.uuid}:`, error);
    errors.push(`Registrants fetch failed: ${error.message}`);
  }
  
  try {
    // For past webinar instances, use the instance UUID directly as the webinar ID in the participants endpoint
    console.log(`[syncInstanceParticipants] Fetching attendees for instance ${instanceData.uuid}`);
    attendees = await fetchAllPaginatedData(`https://api.zoom.us/v2/past_webinars/${instanceData.uuid}/participants`, headers);
    console.log(`[syncInstanceParticipants] Found ${attendees.length} attendees for instance ${instanceData.uuid}`);
  } catch (error) {
    console.error(`[syncInstanceParticipants] Error fetching attendees for instance ${instanceData.uuid}:`, error);
    errors.push(`Attendees fetch failed: ${error.message}`);
    
    // Log additional context for debugging
    console.log(`[syncInstanceParticipants] Attendee data may not be available for instance ${instanceData.uuid}. This is normal for instances older than 30 days or if the instance hasn't occurred yet.`);
  }
  
  // Store participants using batch operations
  let totalStored = 0;
  
  if (registrants.length > 0 || attendees.length > 0) {
    try {
      totalStored = await storeParticipantsInBatches(supabase, user.id, instanceData.uuid, webinarId, registrants, attendees);
    } catch (storageError) {
      console.error(`[syncInstanceParticipants] Error storing participants for instance ${instanceData.uuid}:`, storageError);
      errors.push(`Storage failed: ${storageError.message}`);
    }
  }
  
  return {
    registrants_count: registrants.length,
    attendees_count: attendees.length,
    total_count: registrants.length + attendees.length,
    total_stored: totalStored,
    errors: errors,
    success: errors.length === 0 || totalStored > 0
  };
}
