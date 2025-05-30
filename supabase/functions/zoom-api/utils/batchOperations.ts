export async function storeParticipantsInBatches(
  supabase: any, 
  userId: string, 
  instanceId: string, 
  webinarId: string, 
  registrants: any[], 
  attendees: any[]
) {
  const BATCH_SIZE = 50; // Reduced batch size for better reliability
  let totalStored = 0;
  
  try {
    console.log(`[batchOperations] Starting batch storage for instance ${instanceId}: ${registrants.length} registrants, ${attendees.length} attendees`);
    
    // Get user's organization_id first
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('[batchOperations] Failed to get user profile:', profileError);
      throw new Error('Unable to get user organization');
    }

    const organizationId = profile.organization_id;
    console.log(`[batchOperations] Using organization_id: ${organizationId}`);

    // Get the internal webinar UUID from the Zoom webinar ID
    const { data: webinarRecord, error: webinarError } = await supabase
      .from('webinars')
      .select('id')
      .eq('zoom_webinar_id', webinarId)
      .eq('organization_id', organizationId)
      .single();

    if (webinarError || !webinarRecord) {
      console.error('[batchOperations] Failed to find webinar record:', webinarError);
      throw new Error(`Unable to find webinar with Zoom ID: ${webinarId}`);
    }

    const internalWebinarId = webinarRecord.id;
    console.log(`[batchOperations] Found internal webinar ID: ${internalWebinarId}`);
    
    // Clear existing data for THIS SPECIFIC INSTANCE ONLY to avoid duplicates
    console.log(`[batchOperations] Clearing existing data for instance ${instanceId} only`);
    await supabase
      .from('zoom_webinar_instance_participants')
      .delete()
      .eq('user_id', userId)
      .eq('instance_id', instanceId);
    
    // Process registrants in batches (keep existing logic)
    if (registrants.length > 0) {
      console.log(`[batchOperations] Storing ${registrants.length} registrants in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < registrants.length; i += BATCH_SIZE) {
        const batch = registrants.slice(i, i + BATCH_SIZE);
        const registrantsToInsert = batch.map((registrant: any, index: number) => ({
          user_id: userId,
          instance_id: instanceId,
          webinar_id: webinarId,
          participant_type: 'registrant',
          participant_id: registrant.id || `reg_${instanceId}_${i + index}`,
          email: registrant.email || '',
          name: registrant.first_name && registrant.last_name 
            ? `${registrant.first_name} ${registrant.last_name}`.trim()
            : registrant.email || 'Unknown',
          join_time: registrant.create_time || new Date().toISOString(),
          raw_data: registrant
        }));
        
        const { error } = await supabase
          .from('zoom_webinar_instance_participants')
          .insert(registrantsToInsert);
        
        if (error) {
          console.error(`[batchOperations] Error inserting registrants batch ${i}-${i + batch.length}:`, error);
        } else {
          totalStored += batch.length;
          console.log(`[batchOperations] Inserted registrants batch ${i + 1}-${i + batch.length}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Process attendees in batches - store in BOTH tables using UPSERT with better error handling
    if (attendees.length > 0) {
      console.log(`[batchOperations] Storing ${attendees.length} attendees in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
        const batch = attendees.slice(i, i + BATCH_SIZE);
        
        // Store in zoom_webinar_instance_participants (existing logic)
        const participantsToInsert = batch.map((attendee: any, index: number) => ({
          user_id: userId,
          instance_id: instanceId,
          webinar_id: webinarId,
          participant_type: 'attendee',
          participant_id: attendee.id || attendee.user_id || `att_${instanceId}_${i + index}`,
          email: attendee.user_email || attendee.email || '',
          name: attendee.name || attendee.user_name || 'Unknown',
          join_time: attendee.join_time || new Date().toISOString(),
          leave_time: attendee.leave_time,
          duration: attendee.duration || 0,
          raw_data: attendee
        }));
        
        // Store in attendees table using UPSERT with improved handling for null values
        const attendeesToUpsert = batch.map((attendee: any, index: number) => {
          const duration = attendee.duration || 0;
          const engagementScore = Math.min(10, Math.max(0, duration / 60)); // Simple engagement based on duration
          let zoomUserId = attendee.id || attendee.user_id;
          
          // Handle cases where zoom_user_id might be null or empty
          if (!zoomUserId || zoomUserId === '') {
            zoomUserId = `att_${instanceId}_${i + index}_${Date.now()}`;
            console.log(`[batchOperations] Generated fallback zoom_user_id: ${zoomUserId} for attendee ${attendee.name || 'Unknown'}`);
          }
          
          return {
            organization_id: organizationId,
            webinar_id: internalWebinarId,
            zoom_user_id: zoomUserId,
            email: attendee.user_email || attendee.email || '',
            name: attendee.name || attendee.user_name || 'Unknown',
            join_time: attendee.join_time || new Date().toISOString(),
            leave_time: attendee.leave_time,
            duration_minutes: Math.round(duration / 60), // Convert seconds to minutes
            engagement_score: engagementScore,
            device_type: attendee.device_type || null,
            ip_address: attendee.ip_address || null,
            location: attendee.location || null,
            network_type: attendee.network_type || null,
            total_attention_time: duration,
            join_count: 1
          };
        });
        
        // Insert into zoom_webinar_instance_participants
        const participantsResult = await supabase
          .from('zoom_webinar_instance_participants')
          .insert(participantsToInsert);
        
        // UPSERT into attendees table with the new unique constraint
        const attendeesResult = await supabase
          .from('attendees')
          .upsert(attendeesToUpsert, {
            onConflict: 'unique_attendee_per_webinar',
            ignoreDuplicates: false
          });
        
        if (participantsResult.error) {
          console.error(`[batchOperations] Error inserting participants batch ${i}-${i + batch.length}:`, participantsResult.error);
        }
        
        if (attendeesResult.error) {
          console.error(`[batchOperations] Error upserting attendees batch ${i}-${i + batch.length}:`, attendeesResult.error);
          console.error(`[batchOperations] Attendees error details:`, JSON.stringify(attendeesResult.error, null, 2));
          // Continue processing even if some attendees fail
        } else {
          console.log(`[batchOperations] Successfully upserted attendees batch ${i + 1}-${i + batch.length}`);
        }
        
        if (!participantsResult.error) {
          totalStored += batch.length;
          console.log(`[batchOperations] Successfully inserted participants batch ${i + 1}-${i + batch.length}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[batchOperations] Successfully stored ${totalStored} total participants for instance ${instanceId}`);
    
    // Log final counts for verification
    const { data: finalAttendeeCount } = await supabase
      .from('attendees')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('webinar_id', internalWebinarId);
    
    console.log(`[batchOperations] Total attendees now in attendees table for this webinar: ${finalAttendeeCount?.length || 'unknown'}`);
    
    return totalStored;
    
  } catch (error) {
    console.error('[batchOperations] Critical error during batch storage:', error);
    return totalStored;
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
