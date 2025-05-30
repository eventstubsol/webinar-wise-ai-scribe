
export async function updateWebinarAttendeeCounts(
  supabase: any,
  webinarId: string
) {
  console.log(`[attendeeCountUpdater] Updating counts for webinar: ${webinarId}`);
  
  try {
    // Get attendee count
    const { count: attendeeCount, error: attendeeError } = await supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('webinar_id', webinarId);

    if (attendeeError) {
      console.error('[attendeeCountUpdater] Error counting attendees:', attendeeError);
      throw attendeeError;
    }

    // Get registrant count
    const { count: registrantCount, error: registrantError } = await supabase
      .from('zoom_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('webinar_id', webinarId);

    if (registrantError) {
      console.error('[attendeeCountUpdater] Error counting registrants:', registrantError);
      throw registrantError;
    }

    // Update webinar with actual counts
    const { error: updateError } = await supabase
      .from('webinars')
      .update({
        attendees_count: attendeeCount || 0,
        registrants_count: registrantCount || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', webinarId);

    if (updateError) {
      console.error('[attendeeCountUpdater] Error updating webinar counts:', updateError);
      throw updateError;
    }

    console.log(`[attendeeCountUpdater] Successfully updated counts - Attendees: ${attendeeCount || 0}, Registrants: ${registrantCount || 0}`);
    
    return {
      attendees_count: attendeeCount || 0,
      registrants_count: registrantCount || 0
    };
  } catch (error) {
    console.error(`[attendeeCountUpdater] Failed to update counts for webinar ${webinarId}:`, error);
    throw error;
  }
}
