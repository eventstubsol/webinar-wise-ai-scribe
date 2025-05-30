
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
    .in('sync_type', ['participants', 'participants_aggressive'])
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
    .select('id, zoom_webinar_id, title, attendees_count, start_time, registrants_count')
    .eq('organization_id', profile.organization_id)
    .not('zoom_webinar_id', 'is', null)
    .order('start_time', { ascending: false });

  if (error) throw error;

  // Enhanced prioritization algorithm:
  // 1. Zero attendees webinars (highest priority)
  // 2. Webinars with significant gap between registrants and attendees
  // 3. Recent webinars with low attendee counts
  const prioritized = webinars?.sort((a, b) => {
    const aCount = a.attendees_count || 0;
    const bCount = b.attendees_count || 0;
    
    // Expected attendees based on registrants or reasonable estimate
    const aExpected = a.registrants_count || Math.max(50, aCount * 1.5);
    const bExpected = b.registrants_count || Math.max(50, bCount * 1.5);
    
    // Prioritize zero attendees first
    if (aCount === 0 && bCount > 0) return -1;
    if (aCount > 0 && bCount === 0) return 1;
    
    // Calculate gap percentages
    const aGapPercentage = aExpected > 0 ? ((aExpected - aCount) / aExpected) * 100 : 0;
    const bGapPercentage = bExpected > 0 ? ((bExpected - bCount) / bExpected) * 100 : 0;
    
    // Significant gap threshold (40%)
    const significantGap = 40;
    
    // If both have significant gaps or neither has, sort by gap size
    if ((aGapPercentage > significantGap && bGapPercentage > significantGap) ||
        (aGapPercentage <= significantGap && bGapPercentage <= significantGap)) {
      return bGapPercentage - aGapPercentage;
    }
    
    // Prioritize significant gaps
    if (aGapPercentage > significantGap) return -1;
    if (bGapPercentage > significantGap) return 1;
    
    // If we get here, sort by gap percentage
    return bGapPercentage - aGapPercentage;
  }) || [];

  return { webinars: prioritized, organization_id: profile.organization_id };
};

export const recoverWebinarAttendees = async (
  webinar: any,
  organizationId: string,
  userId: string
): Promise<WebinarAttendeeResult> => {
  try {
    console.log(`🚀 Starting enhanced recovery for webinar: ${webinar.title} (${webinar.zoom_webinar_id})`);
    
    // Use the enhanced recovery function
    const { data, error } = await supabase.functions.invoke('zoom-sync-participants', {
      body: {
        organization_id: organizationId,
        user_id: userId,
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id
      }
    });

    if (error) {
      console.error(`❌ Enhanced recovery failed for ${webinar.title}:`, error);
      return {
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        title: webinar.title,
        attendees_found: 0,
        attendees_stored: 0,
        errors: 1,
        success: false,
        error_message: error.message,
        api_used: 'unknown'
      };
    }

    const result = data as any;
    console.log(`📊 Enhanced recovery result for ${webinar.title}:`, result);
    
    // Comprehensive result processing with enhanced statistics
    const recoveryStats = result.recovery_stats || {};
    const totalErrors = 
      (recoveryStats.database_errors || 0) + 
      (recoveryStats.validation_errors || 0) + 
      (recoveryStats.constraint_violations || 0);
    
    // Generate a detailed success message with enhanced information
    const successMessage = result.message || 
      `Enhanced recovery: Found ${result.total_found || 0}, stored ${result.participants_synced || 0}`;
    
    // Return comprehensive result with detailed statistics
    return {
      webinar_id: webinar.id,
      zoom_webinar_id: webinar.zoom_webinar_id,
      title: webinar.title,
      attendees_found: result.total_found || 0,
      attendees_stored: result.participants_synced || 0,
      errors: totalErrors,
      success: result.success || false,
      api_used: result.api_used || 'unknown',
      error_message: result.success ? 
        (totalErrors > 0 ? `${successMessage} (${totalErrors} errors handled)` : successMessage) :
        (result.error || 'Unknown error during enhanced recovery'),
      recovery_stats: recoveryStats
    };
  } catch (error: any) {
    console.error(`💥 Exception during enhanced recovery for ${webinar.title}:`, error);
    return {
      webinar_id: webinar.id,
      zoom_webinar_id: webinar.zoom_webinar_id,
      title: webinar.title,
      attendees_found: 0,
      attendees_stored: 0,
      errors: 1,
      success: false,
      error_message: `Exception during enhanced recovery: ${error.message}`,
      api_used: 'unknown'
    };
  }
};
