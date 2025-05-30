
import { fetchAllPaginatedData } from '../utils/pagination.ts';
import { storeParticipantsInBatches } from '../utils/batchOperations.ts';

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

export async function syncSingleWebinarParticipants(webinarId: string, credentials: any, supabase: any, user: any) {
  console.log(`[syncSingleWebinarParticipants] Syncing single webinar ${webinarId}`);
  
  const token = await getZoomJwtToken(credentials.account_id, credentials.client_id, credentials.client_secret);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  let registrants = [];
  let attendees = [];
  let errors = [];
  
  try {
    // Fetch registrants - these are typically available longer than participant data
    console.log(`[syncSingleWebinarParticipants] Fetching registrants for webinar ${webinarId}`);
    registrants = await fetchAllPaginatedData(`https://api.zoom.us/v2/webinars/${webinarId}/registrants`, headers);
    console.log(`[syncSingleWebinarParticipants] Found ${registrants.length} registrants`);
  } catch (error) {
    console.error(`[syncSingleWebinarParticipants] Error fetching registrants for webinar ${webinarId}:`, error);
    errors.push(`Registrants fetch failed: ${error.message}`);
  }
  
  try {
    // Fetch attendees - may fail for webinars older than 30 days
    console.log(`[syncSingleWebinarParticipants] Fetching attendees for webinar ${webinarId}`);
    attendees = await fetchAllPaginatedData(`https://api.zoom.us/v2/past_webinars/${webinarId}/participants`, headers);
    console.log(`[syncSingleWebinarParticipants] Found ${attendees.length} attendees`);
  } catch (error) {
    console.error(`[syncSingleWebinarParticipants] Error fetching attendees for webinar ${webinarId}:`, error);
    errors.push(`Attendees fetch failed: ${error.message}`);
    
    // If attendees fetch fails, log more details about the webinar
    console.log(`[syncSingleWebinarParticipants] Attendee data may not be available for webinar ${webinarId}. This is normal for webinars older than 30 days.`);
  }
  
  // Continue with storage even if some data failed to fetch
  let totalStored = 0;
  
  if (registrants.length > 0 || attendees.length > 0) {
    try {
      totalStored = await storeParticipantsInBatches(supabase, user.id, webinarId, webinarId, registrants, attendees);
    } catch (storageError) {
      console.error(`[syncSingleWebinarParticipants] Error storing participants for webinar ${webinarId}:`, storageError);
      errors.push(`Storage failed: ${storageError.message}`);
    }
  }
  
  return {
    webinar_id: webinarId,
    instances_processed: 1,
    total_registrants: registrants.length,
    total_attendees: attendees.length,
    total_stored: totalStored,
    errors: errors,
    success: errors.length === 0 || totalStored > 0 // Consider success if we stored some data
  };
}
