
import { mapRegistrantToParticipant, mapAttendeeToParticipant, mapAttendeeToAttendeeRecord } from './participantMapper.ts';

const BATCH_SIZE = 30; // Reduced batch size for better error handling

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
  
  console.log(`[participantStorage] Storing ${attendees.length} attendees in batches of ${BATCH_SIZE} using INSERT operations to capture all attendance sessions`);
  
  for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
    const batch = attendees.slice(i, i + BATCH_SIZE);
    
    // Store in zoom_webinar_instance_participants (this should not have conflicts)
    const participantsToInsert = batch.map((attendee: any, index: number) => 
      mapAttendeeToParticipant(attendee, userId, instanceId, webinarId, i + index)
    );
    
    // Store in attendees table using INSERT (no more UPSERT to allow multiple records)
    const attendeesToInsert = batch.map((attendee: any, index: number) => {
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
    
    // INSERT into attendees table (no longer using upsert to allow multiple records per person)
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
      console.error(`[participantStorage] Attendees error details:`, JSON.stringify(attendeesResult.error, null, 2));
      
      // If the batch failed, try inserting one by one to identify any remaining issues
      console.log(`[participantStorage] Attempting individual inserts for failed batch...`);
      let individualSuccesses = 0;
      
      for (const attendee of attendeesToInsert) {
        try {
          const { error: individualError } = await supabase
            .from('attendees')
            .insert([attendee]);
          
          if (!individualError) {
            individualSuccesses++;
          } else {
            console.error(`[participantStorage] Individual insert failed for ${attendee.name} (${attendee.email}):`, individualError.message);
          }
        } catch (err) {
          console.error(`[participantStorage] Exception during individual insert for ${attendee.name}:`, err);
        }
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`[participantStorage] Individual inserts completed: ${individualSuccesses}/${attendeesToInsert.length} successful`);
      totalStored += individualSuccesses;
    } else {
      console.log(`[participantStorage] Successfully inserted attendees batch ${i + 1}-${i + batch.length} - now storing ALL attendance records including multiple sessions per person`);
      totalStored += batch.length;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return totalStored;
}
