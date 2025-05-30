
// Legacy participant storage - now replaced with historical preservation
// This file is kept for compatibility but the main logic has moved to historicalParticipantStorage.ts

import { mapRegistrantToParticipant, mapAttendeeToParticipant, mapAttendeeToAttendeeRecord } from './participantMapper.ts';

const BATCH_SIZE = 30;

// Legacy function - kept for backward compatibility
// New syncs should use historicalParticipantStorage.ts functions
export async function storeRegistrants(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  registrants: any[]
) {
  console.log(`[participantStorage] Legacy storeRegistrants called - consider using historical preservation instead`);
  
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

// Legacy function - kept for backward compatibility
// New syncs should use historicalParticipantStorage.ts functions
export async function storeAttendees(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  attendees: any[],
  organizationId: string,
  internalWebinarId: string
) {
  console.log(`[participantStorage] Legacy storeAttendees called - consider using historical preservation instead`);
  
  let totalStored = 0;
  
  if (attendees.length === 0) return totalStored;
  
  console.log(`[participantStorage] Storing ${attendees.length} attendees in batches of ${BATCH_SIZE} - HISTORICAL PRESERVATION MODE`);
  
  for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
    const batch = attendees.slice(i, i + BATCH_SIZE);
    
    // Store in zoom_webinar_instance_participants (legacy compatibility)
    const participantsToInsert = batch.map((attendee: any, index: number) => 
      mapAttendeeToParticipant(attendee, userId, instanceId, webinarId, i + index)
    );
    
    // Store in attendees table using INSERT (preserving multiple records per person)
    const attendeesToInsert = batch.map((attendee: any, index: number) => {
      const mappedAttendee = mapAttendeeToAttendeeRecord(attendee, organizationId, internalWebinarId, instanceId, i + index);
      
      // Add historical preservation fields
      mappedAttendee.is_historical = false;
      mappedAttendee.zoom_data_available = true;
      mappedAttendee.last_zoom_sync = new Date().toISOString();
      mappedAttendee.data_source = 'zoom_sync';
      
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
    
    // INSERT into attendees table (allowing multiple records per person per webinar)
    const attendeesResult = await supabase
      .from('attendees')
      .insert(attendeesToInsert);
    
    if (participantsResult.error) {
      console.error(`[participantStorage] Error inserting participants batch ${i}-${i + batch.length}:`, participantsResult.error);
    } else {
      console.log(`[participantStorage] Successfully inserted participants batch ${i + 1}-${i + batch.length}`);
    }
    
    if (attendeesResult.error) {
      console.error(`[participantStorage] Error inserting attendees batch ${i}-${i + batch.length}:`, attendeesResult.error);
    } else {
      console.log(`[participantStorage] Successfully inserted attendees batch ${i + 1}-${i + batch.length} - HISTORICAL PRESERVATION ENABLED`);
      totalStored += batch.length;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return totalStored;
}
