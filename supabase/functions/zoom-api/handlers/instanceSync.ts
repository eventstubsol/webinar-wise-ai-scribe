
import { fetchAllPaginatedData } from '../utils/pagination.ts';
import { storeParticipantsInBatches } from './participantStorage.ts';

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

export async function syncInstanceParticipants(webinarId: string, instanceId: string, dbInstanceId: string, credentials: any, supabase: any, user: any) {
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
