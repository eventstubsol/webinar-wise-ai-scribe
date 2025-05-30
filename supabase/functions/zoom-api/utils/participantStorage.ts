
import { mapRegistrantToParticipant, mapAttendeeToParticipant, mapAttendeeToAttendeeRecord } from './participantMapper.ts';
import { getAttendeesTableConstraints, determineConflictColumns } from './constraintChecker.ts';

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
  
  console.log(`[participantStorage] Storing ${attendees.length} attendees in batches of ${BATCH_SIZE}`);
  
  // Check database constraints to determine proper conflict resolution
  const constraints = await getAttendeesTableConstraints(supabase);
  const conflictColumns = determineConflictColumns(constraints);
  
  console.log(`[participantStorage] Using conflict resolution on columns: ${conflictColumns}`);
  if (constraints) {
    console.log(`[participantStorage] Available constraints:`, constraints.map(c => `${c.constraint_name}: ${c.columns}`));
  }

  // Deduplicate attendees client-side before insertion
  const uniqueAttendees = deduplicateAttendees(attendees, internalWebinarId);
  console.log(`[participantStorage] Deduplicated ${attendees.length} attendees to ${uniqueAttendees.length} unique entries`);
  
  for (let i = 0; i < uniqueAttendees.length; i += BATCH_SIZE) {
    const batch = uniqueAttendees.slice(i, i + BATCH_SIZE);
    
    // Store in zoom_webinar_instance_participants (this should not have conflicts)
    const participantsToInsert = batch.map((attendee: any, index: number) => 
      mapAttendeeToParticipant(attendee, userId, instanceId, webinarId, i + index)
    );
    
    // Store in attendees table with proper conflict resolution
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
    
    // UPSERT into attendees table with proper conflict resolution
    const attendeesResult = await supabase
      .from('attendees')
      .upsert(attendeesToUpsert, {
        onConflict: conflictColumns,
        ignoreDuplicates: false
      });
    
    if (participantsResult.error) {
      console.error(`[participantStorage] Error inserting participants batch ${i}-${i + batch.length}:`, participantsResult.error);
    }
    
    if (attendeesResult.error) {
      console.error(`[participantStorage] Error upserting attendees batch ${i}-${i + batch.length}:`, attendeesResult.error);
      console.error(`[participantStorage] Attendees error details:`, JSON.stringify(attendeesResult.error, null, 2));
      
      // If the batch failed, try inserting one by one to identify problematic records
      console.log(`[participantStorage] Attempting individual inserts for failed batch...`);
      let individualSuccesses = 0;
      
      for (const attendee of attendeesToUpsert) {
        try {
          const { error: individualError } = await supabase
            .from('attendees')
            .upsert([attendee], {
              onConflict: conflictColumns,
              ignoreDuplicates: false
            });
          
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
      
      console.log(`[participantStorage] Individual inserts completed: ${individualSuccesses}/${attendeesToUpsert.length} successful`);
      totalStored += individualSuccesses;
    } else {
      console.log(`[participantStorage] Successfully upserted attendees batch ${i + 1}-${i + batch.length}`);
      totalStored += batch.length;
    }
    
    if (!participantsResult.error) {
      console.log(`[participantStorage] Successfully inserted participants batch ${i + 1}-${i + batch.length}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return totalStored;
}

function deduplicateAttendees(attendees: any[], webinarId: string): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const attendee of attendees) {
    // Create a unique key based on available identifiers
    const email = attendee.user_email || attendee.email || '';
    const name = attendee.name || attendee.user_name || '';
    const zoomUserId = attendee.id || attendee.user_id || attendee.participant_user_id || '';
    
    // Use the most specific identifier available
    let uniqueKey: string;
    if (zoomUserId) {
      uniqueKey = `${webinarId}:zoom_id:${zoomUserId}`;
    } else if (email) {
      uniqueKey = `${webinarId}:email:${email}`;
    } else {
      uniqueKey = `${webinarId}:name:${name}:${attendee.join_time || Date.now()}`;
    }
    
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      unique.push(attendee);
    } else {
      console.log(`[participantStorage] Skipping duplicate attendee: ${name} (${email}) with key ${uniqueKey}`);
    }
  }
  
  return unique;
}
