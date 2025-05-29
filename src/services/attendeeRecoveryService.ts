
import { supabase } from '@/integrations/supabase/client';
import { WebinarAttendeeResult } from '@/types/attendeeRecovery';

export const clearStuckAttendeeJobs = async (userId: string): Promise<void> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { error: clearError } = await supabase
    .from('sync_logs')
    .delete()
    .eq('organization_id', profile.organization_id)
    .eq('sync_type', 'participants')
    .eq('status', 'started')
    .lt('started_at', thirtyMinutesAgo);

  if (clearError) {
    throw new Error(`Failed to clear stuck jobs: ${clearError.message}`);
  }
};

export const getWebinarsForAttendeeRecovery = async (userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  const { data: webinars, error } = await supabase
    .from('webinars')
    .select('id, zoom_webinar_id, title, attendees_count, start_time')
    .eq('organization_id', profile.organization_id)
    .not('zoom_webinar_id', 'is', null)
    .order('start_time', { ascending: false });

  if (error) throw error;

  const prioritized = webinars?.sort((a, b) => {
    const aCount = a.attendees_count || 0;
    const bCount = b.attendees_count || 0;
    if (aCount === 0 && bCount > 0) return -1;
    if (aCount > 0 && bCount === 0) return 1;
    return 0;
  }) || [];

  return { webinars: prioritized, organization_id: profile.organization_id };
};

export const recoverWebinarAttendees = async (
  webinar: any,
  organizationId: string,
  userId: string
): Promise<WebinarAttendeeResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('zoom-sync-participants', {
      body: {
        organization_id: organizationId,
        user_id: userId,
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id
      }
    });

    if (error) {
      return {
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        title: webinar.title,
        attendees_found: 0,
        attendees_stored: 0,
        errors: 1,
        success: false,
        error_message: error.message
      };
    }

    const result = data as any;
    return {
      webinar_id: webinar.id,
      zoom_webinar_id: webinar.zoom_webinar_id,
      title: webinar.title,
      attendees_found: result.total_found || 0,
      attendees_stored: result.participants_synced || 0,
      errors: result.errors || 0,
      success: result.success || false,
      api_used: result.api_used,
      error_message: result.error_summary
    };
  } catch (error: any) {
    return {
      webinar_id: webinar.id,
      zoom_webinar_id: webinar.zoom_webinar_id,
      title: webinar.title,
      attendees_found: 0,
      attendees_stored: 0,
      errors: 1,
      success: false,
      error_message: error.message
    };
  }
};
