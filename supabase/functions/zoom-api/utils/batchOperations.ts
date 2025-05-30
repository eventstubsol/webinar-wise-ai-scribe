import { storeAttendeesWithHistoricalPreservation, storeRegistrantsWithHistoricalPreservation } from './historicalParticipantStorage.ts';
import { storeWebinarInstance } from './webinarInstanceStorage.ts';
import { updateWebinarAttendeeCounts } from './attendeeCountUpdater.ts';

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
    console.log(`[batchOperations] Starting historical data preservation for instance ${instanceId}: ${registrants.length} registrants, ${attendees.length} attendees`);
    console.log(`[batchOperations] Using historical preservation - existing data will be preserved and marked as historical when changes occur`);
    
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
      .single();

    if (webinarError || !webinarRecord) {
      console.error('[batchOperations] Failed to get internal webinar ID:', webinarError);
      throw new Error(`Unable to find webinar with zoom_webinar_id: ${webinarId}`);
    }

    const internalWebinarId = webinarRecord.id;
    console.log(`[batchOperations] Found internal webinar ID: ${internalWebinarId}`);

    // Store registrants with historical preservation
    if (registrants.length > 0) {
      console.log(`[batchOperations] Storing registrants with historical preservation...`);
      const registrantsStored = await storeRegistrantsWithHistoricalPreservation(
        supabase,
        userId,
        instanceId,
        webinarId,
        registrants,
        internalWebinarId,
        organizationId
      );
      totalStored += registrantsStored;
      console.log(`[batchOperations] Registrants processed: ${registrantsStored} new/updated records`);
    }
    
    // Store attendees with historical preservation
    if (attendees.length > 0) {
      console.log(`[batchOperations] Storing attendees with historical preservation...`);
      const attendeesStored = await storeAttendeesWithHistoricalPreservation(
        supabase,
        userId,
        instanceId,
        webinarId,
        attendees,
        organizationId,
        internalWebinarId
      );
      totalStored += attendeesStored;
      console.log(`[batchOperations] Attendees processed: ${attendeesStored} new/updated records`);
    }

    // **NEW: Update webinar attendee and registrant counts**
    console.log(`[batchOperations] Updating webinar attendee and registrant counts...`);
    const updatedCounts = await updateWebinarAttendeeCounts(supabase, internalWebinarId);
    console.log(`[batchOperations] Updated webinar counts - Attendees: ${updatedCounts.attendees_count}, Registrants: ${updatedCounts.registrants_count}`);

    console.log(`[batchOperations] Successfully processed participants with historical preservation for instance ${instanceId}`);
    
    // Log preservation summary
    const { data: totalHistorical } = await supabase
      .from('attendees')
      .select('id')
      .eq('webinar_id', internalWebinarId)
      .eq('is_historical', true);
    
    console.log(`[batchOperations] Historical preservation summary:`);
    console.log(`  - New/updated records: ${totalStored}`);
    console.log(`  - Current active attendees: ${updatedCounts.attendees_count}`);
    console.log(`  - Current registrants: ${updatedCounts.registrants_count}`);
    console.log(`  - Historical records preserved: ${totalHistorical?.length || 0}`);
    console.log(`  - Total records in database: ${updatedCounts.attendees_count + (totalHistorical?.length || 0)}`);
    console.log(`  - Data preservation: ENABLED - Historical data will persist beyond Zoom's 90-day window`);
    
    return totalStored;
    
  } catch (error) {
    console.error(`[batchOperations] Error in historical data preservation:`, error);
    throw error;
  }
}

// Keep the existing storeWebinarInstance export for compatibility
export { storeWebinarInstance };
