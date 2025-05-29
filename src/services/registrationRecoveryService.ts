
import { supabase } from '@/integrations/supabase/client';
import { WebinarRecoveryResult } from '@/types/registrationRecovery';

export const clearStuckRegistrationJobs = async (userId: string): Promise<void> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  // Clear stuck registration sync jobs
  const { error: clearError } = await supabase
    .from('registration_sync_jobs')
    .delete()
    .eq('organization_id', profile.organization_id)
    .in('status', ['running', 'pending'])
    .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes old

  if (clearError) {
    throw new Error(`Failed to clear stuck jobs: ${clearError.message}`);
  }
};

export const getWebinarsForRegistrationRecovery = async (userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  // Get all webinars for this organization
  const { data: webinars, error } = await supabase
    .from('webinars')
    .select('id, zoom_webinar_id, title, registrants_count')
    .eq('organization_id', profile.organization_id)
    .not('zoom_webinar_id', 'is', null)
    .order('start_time', { ascending: false });

  if (error) throw error;
  
  // Prioritize webinars with 0 registrants_count first
  const prioritized = webinars?.sort((a, b) => {
    if (a.registrants_count === 0 && b.registrants_count > 0) return -1;
    if (a.registrants_count > 0 && b.registrants_count === 0) return 1;
    return 0;
  }) || [];

  return { webinars: prioritized, organization_id: profile.organization_id };
};

export const recoverWebinarRegistrations = async (
  webinar: any,
  organizationId: string,
  userId: string
): Promise<WebinarRecoveryResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('zoom-sync-registrations', {
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
        registrations_found: 0,
        registrations_stored: 0,
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
      registrations_found: result.total_found || 0,
      registrations_stored: result.registrations_synced || 0,
      errors: result.errors || 0,
      success: result.success || false,
      error_message: result.error
    };
  } catch (error: any) {
    return {
      webinar_id: webinar.id,
      zoom_webinar_id: webinar.zoom_webinar_id,
      title: webinar.title,
      registrations_found: 0,
      registrations_stored: 0,
      errors: 1,
      success: false,
      error_message: error.message
    };
  }
};
