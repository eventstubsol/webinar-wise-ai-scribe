
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
