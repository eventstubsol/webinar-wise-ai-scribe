
import { fetchAllPaginatedData } from '../utils/pagination.ts';

export async function storeParticipantsInBatches(supabase: any, userId: string, instanceId: string, webinarId: string, registrants: any[], attendees: any[]) {
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
