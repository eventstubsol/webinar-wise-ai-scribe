
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
  error_stats: {
    database_errors: number;
    constraint_violations: number;
    validation_failures: number;
    total_errors: number;
    error_rate: number;
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

// Enhanced analysis with comprehensive error detection and data validation
export const analyzeMissingAttendees = async (userId: string): Promise<AttendeeRecoveryDiagnostics[]> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  // Get webinars with their current attendee counts and detailed sync logs
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
    // Calculate expected attendees with enhanced prediction model
    let expectedAttendees = 0;
    
    if (webinar.registrants_count && webinar.registrants_count > 0) {
      // If we have actual registrants, use historical attendance rates as base
      const typicalAttendanceRate = 0.65; // 65% attendance is typical
      expectedAttendees = Math.round(webinar.registrants_count * typicalAttendanceRate);
    } else {
      // If no registrants data, use more conservative estimate
      expectedAttendees = webinar.attendees_count ? Math.round(webinar.attendees_count * 1.2) : 50;
    }
    
    // Ensure minimum expected value for statistically significant results
    expectedAttendees = Math.max(expectedAttendees, 20);
    
    const actualAttendees = webinar.attendees_count || 0;
    const gapCount = Math.max(0, expectedAttendees - actualAttendees);
    const gapPercentage = expectedAttendees > 0 ? (gapCount / expectedAttendees) * 100 : 0;

    // Get sync logs for this webinar with enhanced error analysis
    const { data: syncLogs } = await supabase
      .from('sync_logs')
      .select('error_message, records_processed, sync_type, status')
      .eq('organization_id', profile.organization_id)
      .eq('webinar_id', webinar.id)
      .order('started_at', { ascending: false })
      .limit(10);

    // Enhanced analysis of error messages and filtering statistics
    let botsFiltered = 0;
    let invalidEmails = 0;
    let validationErrors = 0;
    let duplicatesMerged = 0;
    let databaseErrors = 0;
    let constraintViolations = 0;
    let apiCalls = 0;
    let pagesProcessed = 0;
    let apiEndpoint = 'unknown';
    let totalFound = 0;

    syncLogs?.forEach(log => {
      const message = (log.error_message || '').toLowerCase();
      const syncType = log.sync_type || '';
      
      // Check if it's an enhanced sync and extract metrics
      if (syncType.includes('aggressive') && message.includes('found')) {
        try {
          // Parse numbers from enhanced recovery summary messages
          const foundMatch = message.match(/found (\d+),/i);
          const botsMatch = message.match(/(\d+) bots filtered/i);
          const emailsMatch = message.match(/(\d+) invalid emails/i);
          const validationMatch = message.match(/(\d+) validation errors/i);
          const dbErrorsMatch = message.match(/(\d+) db errors/i);
          const constraintMatch = message.match(/(\d+) constraint/i);
          
          if (foundMatch) totalFound = Math.max(totalFound, parseInt(foundMatch[1]));
          if (botsMatch) botsFiltered += parseInt(botsMatch[1]);
          if (emailsMatch) invalidEmails += parseInt(emailsMatch[1]);
          if (validationMatch) validationErrors += parseInt(validationMatch[1]);
          if (dbErrorsMatch) databaseErrors += parseInt(dbErrorsMatch[1]);
          if (constraintMatch) constraintViolations += parseInt(constraintMatch[1]);
          
          // Try to extract API endpoint info
          if (message.includes('past_webinar')) apiEndpoint = 'past_webinars';
          else if (message.includes('metrics')) apiEndpoint = 'metrics';
          else if (message.includes('registrant')) apiEndpoint = 'registrants';
          
          // Estimate API calls based on records processed
          const estimatedApiCalls = Math.ceil((log.records_processed || 0) / 300);
          apiCalls = Math.max(apiCalls, estimatedApiCalls);
          pagesProcessed = Math.max(pagesProcessed, estimatedApiCalls);
        } catch (e) {
          console.error('Error parsing metrics from log:', e);
        }
      } else {
        // Legacy log parsing
        if (message.includes('bot')) botsFiltered += extractNumber(message, 'bot');
        if (message.includes('invalid email')) invalidEmails += extractNumber(message, 'invalid');
        if (message.includes('validation error')) validationErrors += extractNumber(message, 'validation');
        if (message.includes('duplicate')) duplicatesMerged += extractNumber(message, 'duplicate');
      }
    });

    // Enhanced and more specific recommendations engine
    const recommendations: string[] = [];
    
    if (gapPercentage > 30) {
      recommendations.push('High data gap detected - run enhanced recovery with transaction-based processing');
    }
    
    if (constraintViolations > 0) {
      recommendations.push('Database constraint violations detected - try enhanced data validation');
    }
    
    if (databaseErrors > validationErrors && databaseErrors > 0) {
      recommendations.push('Database errors exceeding validation errors - database constraints may be causing issues');
    }
    
    if (botsFiltered > actualAttendees * 0.1) {
      recommendations.push('Bot filtering may be too aggressive - consider tuning bot detection settings');
    }
    
    if (invalidEmails > 20) {
      recommendations.push('High email rejection rate - enable progressive email validation');
    }
    
    if (actualAttendees === 0 && expectedAttendees > 0) {
      recommendations.push('Complete data loss - run enhanced recovery with multiple endpoint fallback');
    }
    
    if (gapCount > 100) {
      recommendations.push('Large data gap - use transaction-based batch processing');
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
        total_api_calls: apiCalls,
        total_found: totalFound,
        pages_processed: pagesProcessed,
        api_endpoint_used: apiEndpoint,
      },
      error_stats: {
        database_errors: databaseErrors,
        constraint_violations: constraintViolations,
        validation_failures: validationErrors,
        total_errors: databaseErrors + constraintViolations + validationErrors,
        error_rate: actualAttendees > 0 ? 
          Math.round((databaseErrors + constraintViolations + validationErrors) / actualAttendees * 100) / 100 : 0
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

    console.log(`🎯 Starting enhanced recovery for: ${webinar.title}`);

    // Use the enhanced recovery function with transaction-based processing
    const { data, error } = await supabase.functions.invoke('zoom-sync-participants', {
      body: {
        organization_id: profile.organization_id,
        user_id: userId,
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        options: {
          lenient_bot_detection: options.enableLenientBotDetection,
          lenient_email_validation: options.enableLenientEmailValidation,
          max_retries: options.maxRetryAttempts,
          batch_size: options.batchSize,
          min_duration: options.customFilters?.minDuration,
          allow_partial_emails: options.customFilters?.allowPartialEmails,
        }
      }
    });

    results.push({
      webinar_id: webinarId,
      success: !error,
      data,
      error: error?.message,
      recovery_type: 'enhanced_transaction_processing'
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

// Generate enhanced summary statistics with data integrity metrics
export const generateRecoverySummary = (diagnostics: AttendeeRecoveryDiagnostics[]) => {
  const totalWebinars = diagnostics.length;
  const totalExpected = diagnostics.reduce((sum, d) => sum + d.expected_attendees, 0);
  const totalActual = diagnostics.reduce((sum, d) => sum + d.actual_attendees, 0);
  const totalGap = totalExpected - totalActual;
  const averageGapPercentage = totalWebinars > 0 ? 
    diagnostics.reduce((sum, d) => sum + d.gap_percentage, 0) / totalWebinars : 0;

  const highGapWebinars = diagnostics.filter(d => d.gap_percentage > 30).length;
  const zeroAttendeeWebinars = diagnostics.filter(d => d.actual_attendees === 0).length;
  
  // Enhanced integrity metrics
  const totalBots = diagnostics.reduce((sum, d) => sum + d.filtering_stats.bots_filtered, 0);
  const totalInvalidEmails = diagnostics.reduce((sum, d) => sum + d.filtering_stats.invalid_emails, 0);
  const totalDatabaseErrors = diagnostics.reduce((sum, d) => sum + d.error_stats.database_errors, 0);
  const totalConstraintViolations = diagnostics.reduce((sum, d) => sum + d.error_stats.constraint_violations, 0);

  return {
    totalWebinars,
    totalExpected,
    totalActual,
    totalGap,
    averageGapPercentage: Math.round(averageGapPercentage * 100) / 100,
    highGapWebinars,
    zeroAttendeeWebinars,
    recoveryPotential: Math.min(totalGap, totalExpected * 0.8), // Conservative estimate
    // Data integrity metrics
    totalFiltered: totalBots + totalInvalidEmails,
    totalErrors: totalDatabaseErrors + totalConstraintViolations,
    errorBreakdown: {
      databaseErrors: totalDatabaseErrors,
      constraintViolations: totalConstraintViolations,
      filteringRate: totalActual > 0 ? Math.round((totalBots + totalInvalidEmails) / totalActual * 100) / 100 : 0
    }
  };
};
