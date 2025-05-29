
import { supabase } from '@/integrations/supabase/client';

export interface AttendeeRecoveryDiagnostics {
  webinar_id: string;
  zoom_webinar_id: string;
  title: string;
  expected_attendees: number;
  actual_attendees: number;
  gap_count: number;
  gap_percentage: number;
  filtering_stats: {
    bots_filtered: number;
    invalid_emails: number;
    validation_errors: number;
    duplicates_merged: number;
  };
  api_response_stats: {
    total_api_calls: number;
    total_found: number;
    pages_processed: number;
    api_endpoint_used: string;
  };
  recommendations: string[];
}

export interface ProgressiveRecoveryOptions {
  enableLenientBotDetection: boolean;
  enableLenientEmailValidation: boolean;
  maxRetryAttempts: number;
  batchSize: number;
  customFilters?: {
    minDuration?: number;
    allowPartialEmails?: boolean;
  };
}

export const analyzeMissingAttendees = async (userId: string): Promise<AttendeeRecoveryDiagnostics[]> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  // Get webinars with their current attendee counts
  const { data: webinars, error } = await supabase
    .from('webinars')
    .select(`
      id,
      zoom_webinar_id,
      title,
      attendees_count,
      start_time,
      registrants_count
    `)
    .eq('organization_id', profile.organization_id)
    .not('zoom_webinar_id', 'is', null)
    .order('start_time', { ascending: false });

  if (error) throw error;

  const diagnostics: AttendeeRecoveryDiagnostics[] = [];

  for (const webinar of webinars || []) {
    // Estimate expected attendees (use registrants as baseline, or default heuristics)
    const expectedAttendees = webinar.registrants_count || 
      Math.max(50, Math.floor((webinar.attendees_count || 0) * 1.5)); // Conservative estimate
    
    const actualAttendees = webinar.attendees_count || 0;
    const gapCount = Math.max(0, expectedAttendees - actualAttendees);
    const gapPercentage = expectedAttendees > 0 ? (gapCount / expectedAttendees) * 100 : 0;

    // Get sync logs for this webinar to analyze filtering
    const { data: syncLogs } = await supabase
      .from('sync_logs')
      .select('error_message, records_processed')
      .eq('organization_id', profile.organization_id)
      .eq('sync_type', 'participants')
      .eq('webinar_id', webinar.id)
      .order('started_at', { ascending: false })
      .limit(5);

    // Analyze filtering patterns from error messages
    let botsFiltered = 0;
    let invalidEmails = 0;
    let validationErrors = 0;
    let duplicatesMerged = 0;

    syncLogs?.forEach(log => {
      if (log.error_message) {
        const message = log.error_message.toLowerCase();
        if (message.includes('bot')) botsFiltered += extractNumber(message, 'bot');
        if (message.includes('invalid email')) invalidEmails += extractNumber(message, 'invalid');
        if (message.includes('validation error')) validationErrors += extractNumber(message, 'validation');
        if (message.includes('duplicate')) duplicatesMerged += extractNumber(message, 'duplicate');
      }
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (gapPercentage > 30) {
      recommendations.push('High data gap detected - consider lenient recovery mode');
    }
    if (botsFiltered > actualAttendees * 0.1) {
      recommendations.push('Aggressive bot filtering may be removing real attendees');
    }
    if (invalidEmails > 20) {
      recommendations.push('Consider relaxed email validation for recovery');
    }
    if (actualAttendees === 0 && expectedAttendees > 0) {
      recommendations.push('Complete data loss - priority for manual review');
    }
    if (gapCount > 100) {
      recommendations.push('Large webinar - may need multiple recovery attempts');
    }

    diagnostics.push({
      webinar_id: webinar.id,
      zoom_webinar_id: webinar.zoom_webinar_id,
      title: webinar.title,
      expected_attendees: expectedAttendees,
      actual_attendees: actualAttendees,
      gap_count: gapCount,
      gap_percentage: Math.round(gapPercentage * 100) / 100,
      filtering_stats: {
        bots_filtered: botsFiltered,
        invalid_emails: invalidEmails,
        validation_errors: validationErrors,
        duplicates_merged: duplicatesMerged,
      },
      api_response_stats: {
        total_api_calls: syncLogs?.length || 0,
        total_found: syncLogs?.[0]?.records_processed || 0,
        pages_processed: 0, // Will be enhanced with more detailed logging
        api_endpoint_used: 'past_webinars', // Default assumption
      },
      recommendations
    });
  }

  // Sort by gap percentage descending to prioritize problematic webinars
  return diagnostics.sort((a, b) => b.gap_percentage - a.gap_percentage);
};

export const performProgressiveRecovery = async (
  webinarIds: string[],
  options: ProgressiveRecoveryOptions,
  userId: string
): Promise<any[]> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  const results = [];

  for (const webinarId of webinarIds) {
    const { data: webinar } = await supabase
      .from('webinars')
      .select('*')
      .eq('id', webinarId)
      .single();

    if (!webinar) continue;

    // Call the enhanced sync function with progressive options
    const { data, error } = await supabase.functions.invoke('zoom-sync-participants-progressive', {
      body: {
        organization_id: profile.organization_id,
        user_id: userId,
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        progressive_options: options
      }
    });

    results.push({
      webinar_id: webinarId,
      success: !error,
      data,
      error: error?.message
    });
  }

  return results;
};

// Helper function to extract numbers from error messages
const extractNumber = (text: string, keyword: string): number => {
  const regex = new RegExp(`(\\d+)\\s*${keyword}`, 'i');
  const match = text.match(regex);
  return match ? parseInt(match[1]) : 0;
};

// Generate summary statistics
export const generateRecoverySummary = (diagnostics: AttendeeRecoveryDiagnostics[]) => {
  const totalWebinars = diagnostics.length;
  const totalExpected = diagnostics.reduce((sum, d) => sum + d.expected_attendees, 0);
  const totalActual = diagnostics.reduce((sum, d) => sum + d.actual_attendees, 0);
  const totalGap = totalExpected - totalActual;
  const averageGapPercentage = totalWebinars > 0 ? 
    diagnostics.reduce((sum, d) => sum + d.gap_percentage, 0) / totalWebinars : 0;

  const highGapWebinars = diagnostics.filter(d => d.gap_percentage > 30).length;
  const zeroAttendeeWebinars = diagnostics.filter(d => d.actual_attendees === 0).length;

  return {
    totalWebinars,
    totalExpected,
    totalActual,
    totalGap,
    averageGapPercentage: Math.round(averageGapPercentage * 100) / 100,
    highGapWebinars,
    zeroAttendeeWebinars,
    recoveryPotential: Math.min(totalGap, totalExpected * 0.8) // Conservative estimate
  };
};
