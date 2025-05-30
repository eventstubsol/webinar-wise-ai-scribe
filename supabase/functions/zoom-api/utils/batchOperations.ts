
export async function storeParticipantsInBatches(
  supabase: any, 
  userId: string, 
  instanceId: string, 
  webinarId: string, 
  registrants: any[], 
  attendees: any[]
) {
  const BATCH_SIZE = 100; // Supabase recommended batch size
  let totalStored = 0;
  
  try {
    console.log(`[batchOperations] Starting batch storage for instance ${instanceId}: ${registrants.length} registrants, ${attendees.length} attendees`);
    
    // Clear existing data for this instance to avoid duplicates
    await supabase
      .from('zoom_webinar_instance_participants')
      .delete()
      .eq('user_id', userId)
      .eq('instance_id', instanceId);
    
    // Process registrants in batches
    if (registrants.length > 0) {
      console.log(`[batchOperations] Storing ${registrants.length} registrants in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < registrants.length; i += BATCH_SIZE) {
        const batch = registrants.slice(i, i + BATCH_SIZE);
        const registrantsToInsert = batch.map((registrant: any) => ({
          user_id: userId,
          instance_id: instanceId,
          webinar_id: webinarId,
          participant_type: 'registrant',
          participant_id: registrant.id,
          email: registrant.email,
          name: registrant.first_name && registrant.last_name 
            ? `${registrant.first_name} ${registrant.last_name}`.trim()
            : registrant.email,
          join_time: registrant.create_time,
          raw_data: registrant
        }));
        
        const { error } = await supabase
          .from('zoom_webinar_instance_participants')
          .insert(registrantsToInsert);
        
        if (error) {
          console.error(`[batchOperations] Error inserting registrants batch ${i}-${i + batch.length}:`, error);
          throw error;
        }
        
        totalStored += batch.length;
        console.log(`[batchOperations] Inserted registrants batch ${i + 1}-${i + batch.length}`);
      }
    }
    
    // Process attendees in batches
    if (attendees.length > 0) {
      console.log(`[batchOperations] Storing ${attendees.length} attendees in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
        const batch = attendees.slice(i, i + BATCH_SIZE);
        const attendeesToInsert = batch.map((attendee: any) => ({
          user_id: userId,
          instance_id: instanceId,
          webinar_id: webinarId,
          participant_type: 'attendee',
          participant_id: attendee.id || attendee.user_id,
          email: attendee.user_email,
          name: attendee.name || attendee.user_name,
          join_time: attendee.join_time,
          leave_time: attendee.leave_time,
          duration: attendee.duration || 0,
          raw_data: attendee
        }));
        
        const { error } = await supabase
          .from('zoom_webinar_instance_participants')
          .insert(attendeesToInsert);
        
        if (error) {
          console.error(`[batchOperations] Error inserting attendees batch ${i}-${i + batch.length}:`, error);
          throw error;
        }
        
        totalStored += batch.length;
        console.log(`[batchOperations] Inserted attendees batch ${i + 1}-${i + batch.length}`);
      }
    }
    
    console.log(`[batchOperations] Successfully stored ${totalStored} total participants for instance ${instanceId}`);
    return totalStored;
    
  } catch (error) {
    console.error('[batchOperations] Critical error during batch storage:', error);
    throw error;
  }
}

export async function storeWebinarInstance(
  supabase: any,
  userId: string,
  webinarId: string,
  instanceData: any
) {
  try {
    const { data: dbInstance, error } = await supabase
      .from('webinar_instances')
      .upsert({
        user_id: userId,
        webinar_id: webinarId,
        zoom_instance_id: instanceData.uuid,
        start_time: instanceData.start_time,
        host_id: instanceData.host_id,
        duration: instanceData.duration,
        total_participants: instanceData.participants_count || 0,
        raw_data: instanceData
      }, {
        onConflict: 'user_id,webinar_id,zoom_instance_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error(`[batchOperations] Error storing webinar instance:`, error);
      throw error;
    }
    
    console.log(`[batchOperations] Successfully stored webinar instance ${instanceData.uuid}`);
    return dbInstance;
  } catch (error) {
    console.error('[batchOperations] Error in storeWebinarInstance:', error);
    throw error;
  }
}
