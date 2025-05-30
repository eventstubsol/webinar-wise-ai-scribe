
import { mapRegistrantToParticipant, mapAttendeeToParticipant, mapAttendeeToAttendeeRecord } from './participantMapper.ts';

const BATCH_SIZE = 50; // Reduced batch size for better reliability

export async function storeRegistrants(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  registrants: any[]
) {
  let totalStored = 0;
  
  if (registrants.length === 0) return totalStored;
  
  console.log(`[participantStorage] Storing ${registrants.length} registrants in batches of ${BATCH_SIZE}`);
  
  for (let i = 0; i < registrants.length; i += BATCH_SIZE) {
    const batch = registrants.slice(i, i + BATCH_SIZE);
    const registrantsToInsert = batch.map((registrant: any, index: number) => 
      mapRegistrantToParticipant(registrant, userId, instanceId, webinarId, i + index)
    );
    
    const { error } = await supabase
      .from('zoom_webinar_instance_participants')
      .insert(registrantsToInsert);
    
    if (error) {
      console.error(`[participantStorage] Error inserting registrants batch ${i}-${i + batch.length}:`, error);
    } else {
      totalStored += batch.length;
      console.log(`[participantStorage] Inserted registrants batch ${i + 1}-${i + batch.length}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return totalStored;
}

export async function storeAttendees(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  attendees: any[],
  organizationId: string,
  internalWebinarId: string
) {
  let totalStored = 0;
  
  if (attendees.length === 0) return totalStored;
  
  console.log(`[participantStorage] Storing ${attendees.length} attendees in batches of ${BATCH_SIZE}`);
  
  // Log sample attendee data to understand structure
  if (attendees[0]) {
    console.log(`[participantStorage] Sample attendee data structure:`, JSON.stringify(attendees[0], null, 2));
  }
  
  for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
    const batch = attendees.slice(i, i + BATCH_SIZE);
    
    // Store in zoom_webinar_instance_participants
    const participantsToInsert = batch.map((attendee: any, index: number) => 
      mapAttendeeToParticipant(attendee, userId, instanceId, webinarId, i + index)
    );
    
    // Store in attendees table using UPSERT with proper data validation
    const attendeesToUpsert = batch.map((attendee: any, index: number) => {
      const mappedAttendee = mapAttendeeToAttendeeRecord(attendee, organizationId, internalWebinarId, instanceId, i + index);
      
      // Validate engagement_score to prevent numeric overflow
      if (mappedAttendee.engagement_score > 9.99) {
        console.warn(`[participantStorage] Capping engagement_score from ${mappedAttendee.engagement_score} to 9.99 for attendee ${mappedAttendee.name}`);
        mappedAttendee.engagement_score = 9.99;
      }
      
      return mappedAttendee;
    });
    
    // Insert into zoom_webinar_instance_participants
    const participantsResult = await supabase
      .from('zoom_webinar_instance_participants')
      .insert(participantsToInsert);
    
    // UPSERT into attendees table with the unique constraint
    const attendeesResult = await supabase
      .from('attendees')
      .upsert(attendeesToUpsert, {
        onConflict: 'organization_id,webinar_id,zoom_user_id',
        ignoreDuplicates: false
      });
    
    if (participantsResult.error) {
      console.error(`[participantStorage] Error inserting participants batch ${i}-${i + batch.length}:`, participantsResult.error);
    }
    
    if (attendeesResult.error) {
      console.error(`[participantStorage] Error upserting attendees batch ${i}-${i + batch.length}:`, attendeesResult.error);
      console.error(`[participantStorage] Attendees error details:`, JSON.stringify(attendeesResult.error, null, 2));
      // Log the problematic data for debugging
      console.error(`[participantStorage] Problematic attendee data sample:`, JSON.stringify(attendeesToUpsert.slice(0, 3), null, 2));
    } else {
      console.log(`[participantStorage] Successfully upserted attendees batch ${i + 1}-${i + batch.length}`);
    }
    
    if (!participantsResult.error) {
      totalStored += batch.length;
      console.log(`[participantStorage] Successfully inserted participants batch ${i + 1}-${i + batch.length}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return totalStored;
}
