
// Utility functions for mapping Zoom API data to database records

export function extractZoomUserId(attendee: any, instanceId: string, index: number): string {
  // Try multiple fields for zoom user ID with enhanced field mapping
  let zoomUserId = attendee.id || 
                   attendee.user_id || 
                   attendee.registrant_id || 
                   attendee.participant_user_id ||
                   attendee.participant_id;
  
  // Handle cases where zoom_user_id might be null or empty
  if (!zoomUserId || zoomUserId === '') {
    // Use a combination of instance, index, and email/name for deterministic fallback
    const identifier = attendee.email || attendee.user_email || attendee.name || attendee.user_name || 'unknown';
    zoomUserId = `fallback_${instanceId}_${index}_${identifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
    console.log(`[participantMapper] Generated fallback zoom_user_id: ${zoomUserId} for attendee ${attendee.name || attendee.user_name || 'Unknown'}`);
  }
  
  return zoomUserId;
}

export function mapRegistrantToParticipant(registrant: any, userId: string, instanceId: string, webinarId: string, index: number) {
  return {
    user_id: userId,
    instance_id: instanceId,
    webinar_id: webinarId,
    participant_type: 'registrant',
    participant_id: registrant.id || registrant.registrant_id || `reg_${instanceId}_${index}`,
    email: registrant.email || '',
    name: registrant.first_name && registrant.last_name 
      ? `${registrant.first_name} ${registrant.last_name}`.trim()
      : registrant.email || 'Unknown',
    join_time: registrant.create_time || new Date().toISOString(),
    raw_data: registrant
  };
}

export function mapAttendeeToParticipant(attendee: any, userId: string, instanceId: string, webinarId: string, index: number) {
  // Extract participant ID with improved field mapping
  let participantId = attendee.id || 
                     attendee.user_id || 
                     attendee.registrant_id || 
                     attendee.participant_user_id ||
                     attendee.participant_id;
  
  if (!participantId) {
    participantId = `att_${instanceId}_${index}_${Date.now()}`;
    console.log(`[participantMapper] Generated participant_id: ${participantId} for attendee ${attendee.name || attendee.user_name || 'Unknown'}`);
  }
  
  return {
    user_id: userId,
    instance_id: instanceId,
    webinar_id: webinarId,
    participant_type: 'attendee',
    participant_id: participantId,
    email: attendee.user_email || attendee.email || '',
    name: attendee.name || attendee.user_name || 'Unknown',
    join_time: attendee.join_time || new Date().toISOString(),
    leave_time: attendee.leave_time,
    duration: attendee.duration || 0,
    raw_data: attendee
  };
}

export function mapAttendeeToAttendeeRecord(attendee: any, organizationId: string, internalWebinarId: string, instanceId: string, index: number) {
  const duration = attendee.duration || 0;
  // Cap engagement score to prevent database overflow (numeric(3,2) field)
  const engagementScore = Math.min(9.99, Math.max(0, duration / 60)); // Max 9.99 to fit in numeric(3,2)
  
  const zoomUserId = extractZoomUserId(attendee, instanceId, index);
  const email = attendee.user_email || attendee.email || '';
  const name = attendee.name || attendee.user_name || 'Unknown';
  
  console.log(`[participantMapper] Processing attendee: name=${name}, email=${email}, zoom_user_id=${zoomUserId}, duration=${duration}, engagement_score=${engagementScore}`);
  
  // Validate required fields
  if (!email && !zoomUserId) {
    console.warn(`[participantMapper] Attendee has no email or zoom_user_id: ${name} - this may cause storage issues`);
  }
  
  return {
    organization_id: organizationId,
    webinar_id: internalWebinarId,
    zoom_user_id: zoomUserId,
    email: email,
    name: name,
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
}
