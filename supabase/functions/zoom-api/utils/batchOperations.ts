
import { storeRegistrants, storeAttendees } from './participantStorage.ts';
import { storeWebinarInstance } from './webinarInstanceStorage.ts';

export async function storeParticipantsInBatches(
  supabase: any, 
  userId: string, 
  instanceId: string, 
  webinarId: string, 
  registrants: any[], 
  attendees: any[]
) {
  let totalStored = 0;
  
  try {
    console.log(`[batchOperations] Starting enhanced batch storage for instance ${instanceId}: ${registrants.length} registrants, ${attendees.length} attendees`);
    
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
    
    // Store registrants
    console.log(`[batchOperations] Storing registrants...`);
    const registrantsStored = await storeRegistrants(supabase, userId, instanceId, webinarId, registrants);
    totalStored += registrantsStored;
    console.log(`[batchOperations] Registrants stored: ${registrantsStored}`);
    
    // Store attendees with enhanced error handling
    console.log(`[batchOperations] Storing attendees...`);
    const attendeesStored = await storeAttendees(
      supabase, 
      userId, 
      instanceId, 
      webinarId, 
      attendees, 
      organizationId, 
      internalWebinarId
    );
    totalStored += attendeesStored;
    console.log(`[batchOperations] Attendees stored: ${attendeesStored}`);
    
    console.log(`[batchOperations] Successfully stored ${totalStored} total participants for instance ${instanceId}`);
    
    // Log final counts for verification
    const { data: finalAttendeeCount } = await supabase
      .from('attendees')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('webinar_id', internalWebinarId);
    
    console.log(`[batchOperations] Total attendees now in attendees table for this webinar: ${finalAttendeeCount?.length || 'unknown'}`);
    
    // Detailed success reporting
    console.log(`[batchOperations] Batch operation summary:`);
    console.log(`  - Instance ID: ${instanceId}`);
    console.log(`  - Total input: ${registrants.length + attendees.length} participants`);
    console.log(`  - Successfully stored: ${totalStored} participants`);
    console.log(`  - Success rate: ${((totalStored / (registrants.length + attendees.length)) * 100).toFixed(1)}%`);
    
    return totalStored;
    
  } catch (error) {
    console.error('[batchOperations] Critical error during enhanced batch storage:', error);
    console.error('[batchOperations] Error details:', JSON.stringify(error, null, 2));
    return totalStored;
  }
}

export { storeWebinarInstance };
