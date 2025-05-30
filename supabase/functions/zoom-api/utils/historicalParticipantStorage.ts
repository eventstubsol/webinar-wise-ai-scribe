
// Historical data preservation utilities for participant storage

export async function generateParticipantChecksum(participant: any): Promise<string> {
  const data = [
    participant.name || '',
    participant.email || '',
    participant.join_time || '',
    (participant.duration_minutes || 0).toString(),
    (participant.engagement_score || 0).toString()
  ].join('|');
  
  const encoder = new TextEncoder();
  const data_buffer = encoder.encode(data);
  const hash_buffer = await crypto.subtle.digest('MD5', data_buffer);
  const hash_array = Array.from(new Uint8Array(hash_buffer));
  return hash_array.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function storeAttendeesWithHistoricalPreservation(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  attendees: any[],
  organizationId: string,
  internalWebinarId: string
) {
  let totalStored = 0;
  const batchSize = 30;
  
  if (attendees.length === 0) return totalStored;
  
  console.log(`[historicalStorage] Processing ${attendees.length} attendees with historical preservation`);
  
  for (let i = 0; i < attendees.length; i += batchSize) {
    const batch = attendees.slice(i, i + batchSize);
    
    for (const attendee of batch) {
      try {
        // Generate checksum for change detection
        const checksum = await generateParticipantChecksum(attendee);
        
        // Prepare attendee data
        const attendeeData = {
          webinar_id: internalWebinarId,
          organization_id: organizationId,
          name: attendee.name || attendee.user_name || 'Unknown',
          email: (attendee.user_email || attendee.email || '').toLowerCase().trim(),
          join_time: attendee.join_time,
          leave_time: attendee.leave_time,
          duration_minutes: Math.round((attendee.duration || 0) / 60),
          engagement_score: Math.min(9.99, Math.max(0, ((attendee.duration || 0) / 60) / 10)),
          zoom_user_id: attendee.user_id || attendee.id,
          device_type: attendee.device_type,
          ip_address: attendee.ip_address,
          location: attendee.location,
          network_type: attendee.network_type,
          last_zoom_sync: new Date().toISOString(),
          data_source: 'zoom_sync',
          data_checksum: checksum,
          zoom_data_available: true,
          is_historical: false
        };
        
        // Check if this exact record already exists
        const { data: existingRecords } = await supabase
          .from('attendees')
          .select('id, data_checksum, join_time, duration_minutes')
          .eq('webinar_id', internalWebinarId)
          .eq('email', attendeeData.email)
          .eq('zoom_user_id', attendee.user_id || attendee.id);
        
        let shouldInsert = true;
        
        if (existingRecords && existingRecords.length > 0) {
          // Check if we have an exact match (same checksum)
          const exactMatch = existingRecords.find(record => record.data_checksum === checksum);
          
          if (exactMatch) {
            // Exact match found, just update the sync timestamp
            await supabase
              .from('attendees')
              .update({ 
                last_zoom_sync: new Date().toISOString(),
                zoom_data_available: true 
              })
              .eq('id', exactMatch.id);
            
            shouldInsert = false;
            console.log(`[historicalStorage] Updated sync timestamp for existing record: ${attendeeData.email}`);
          } else {
            // Data has changed, but we want to preserve the old record as historical
            // Mark existing records as historical
            await supabase
              .from('attendees')
              .update({ 
                is_historical: true,
                zoom_data_available: false 
              })
              .in('id', existingRecords.map(r => r.id));
            
            console.log(`[historicalStorage] Marked ${existingRecords.length} existing records as historical for: ${attendeeData.email}`);
          }
        }
        
        if (shouldInsert) {
          // Insert new record
          const { error } = await supabase
            .from('attendees')
            .insert([attendeeData]);
          
          if (!error) {
            totalStored++;
            console.log(`[historicalStorage] Inserted new attendee record: ${attendeeData.email}`);
          } else {
            console.error(`[historicalStorage] Error inserting attendee ${attendeeData.email}:`, error);
          }
        }
        
        // Also store in instance participants table with same logic
        await storeInstanceParticipantWithPreservation(
          supabase, 
          userId, 
          instanceId, 
          webinarId, 
          attendee, 
          checksum
        );
        
      } catch (error) {
        console.error(`[historicalStorage] Error processing attendee:`, error);
      }
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[historicalStorage] Historical preservation complete: ${totalStored} new records stored`);
  return totalStored;
}

async function storeInstanceParticipantWithPreservation(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  attendee: any,
  checksum: string
) {
  const participantData = {
    webinar_id: webinarId,
    instance_id: instanceId,
    user_id: userId,
    zoom_participant_id: attendee.user_id || attendee.id,
    name: attendee.name || attendee.user_name || 'Unknown',
    email: (attendee.user_email || attendee.email || '').toLowerCase().trim(),
    registration_time: null,
    join_time: attendee.join_time,
    leave_time: attendee.leave_time,
    duration_minutes: Math.round((attendee.duration || 0) / 60),
    engagement_score: Math.min(9.99, Math.max(0, ((attendee.duration || 0) / 60) / 10)),
    participant_type: 'attendee',
    last_zoom_sync: new Date().toISOString(),
    data_source: 'zoom_sync',
    data_checksum: checksum,
    zoom_data_available: true,
    is_historical: false
  };
  
  // Check for existing records
  const { data: existing } = await supabase
    .from('zoom_webinar_instance_participants')
    .select('id, data_checksum')
    .eq('instance_id', instanceId)
    .eq('zoom_participant_id', participantData.zoom_participant_id);
  
  if (existing && existing.length > 0) {
    const exactMatch = existing.find(record => record.data_checksum === checksum);
    
    if (exactMatch) {
      // Update sync timestamp only
      await supabase
        .from('zoom_webinar_instance_participants')
        .update({ 
          last_zoom_sync: new Date().toISOString(),
          zoom_data_available: true 
        })
        .eq('id', exactMatch.id);
    } else {
      // Mark old records as historical and insert new one
      await supabase
        .from('zoom_webinar_instance_participants')
        .update({ 
          is_historical: true,
          zoom_data_available: false 
        })
        .in('id', existing.map(r => r.id));
      
      await supabase
        .from('zoom_webinar_instance_participants')
        .insert([participantData]);
    }
  } else {
    // Insert new record
    await supabase
      .from('zoom_webinar_instance_participants')
      .insert([participantData]);
  }
}

export async function storeRegistrantsWithHistoricalPreservation(
  supabase: any,
  userId: string,
  instanceId: string,
  webinarId: string,
  registrants: any[],
  internalWebinarId: string,
  organizationId: string
) {
  let totalStored = 0;
  const batchSize = 30;
  
  if (registrants.length === 0) return totalStored;
  
  console.log(`[historicalStorage] Processing ${registrants.length} registrants with historical preservation`);
  
  for (let i = 0; i < registrants.length; i += batchSize) {
    const batch = registrants.slice(i, i + batchSize);
    
    for (const registrant of batch) {
      try {
        // Generate checksum for change detection
        const checksum = await generateParticipantChecksum({
          name: `${registrant.first_name || ''} ${registrant.last_name || ''}`.trim(),
          email: registrant.email,
          join_time: registrant.create_time,
          duration_minutes: 0,
          engagement_score: 0
        });
        
        const registrationData = {
          webinar_id: internalWebinarId,
          organization_id: organizationId,
          zoom_registrant_id: registrant.id,
          first_name: registrant.first_name,
          last_name: registrant.last_name,
          email: (registrant.email || '').toLowerCase().trim(),
          registration_time: registrant.create_time,
          status: registrant.status || 'approved',
          join_url: registrant.join_url,
          custom_questions: registrant.custom_questions,
          last_synced_at: new Date().toISOString(),
          data_source: 'zoom_sync',
          data_checksum: checksum,
          zoom_data_available: true,
          is_historical: false
        };
        
        // Check for existing registrations
        const { data: existing } = await supabase
          .from('zoom_registrations')
          .select('id, data_checksum')
          .eq('webinar_id', internalWebinarId)
          .eq('email', registrationData.email);
        
        let shouldInsert = true;
        
        if (existing && existing.length > 0) {
          const exactMatch = existing.find(record => record.data_checksum === checksum);
          
          if (exactMatch) {
            // Update sync timestamp only
            await supabase
              .from('zoom_registrations')
              .update({ 
                last_synced_at: new Date().toISOString(),
                zoom_data_available: true 
              })
              .eq('id', exactMatch.id);
            
            shouldInsert = false;
          } else {
            // Mark existing as historical
            await supabase
              .from('zoom_registrations')
              .update({ 
                is_historical: true,
                zoom_data_available: false 
              })
              .in('id', existing.map(r => r.id));
          }
        }
        
        if (shouldInsert) {
          const { error } = await supabase
            .from('zoom_registrations')
            .insert([registrationData]);
          
          if (!error) {
            totalStored++;
          } else {
            console.error(`[historicalStorage] Error inserting registration:`, error);
          }
        }
        
      } catch (error) {
        console.error(`[historicalStorage] Error processing registrant:`, error);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[historicalStorage] Historical preservation complete: ${totalStored} new registration records stored`);
  return totalStored;
}
