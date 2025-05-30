
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

export interface DiagnosticsSummary {
  totalWebinars: number;
  totalExpected: number;
  totalActual: number;
  totalGap: number;
  averageGapPercentage: number;
  highGapWebinars: number;
  zeroAttendeeWebinars: number;
  recoveryPotential: number;
  totalFiltered: number;
  totalErrors: number;
  errorBreakdown: {
    databaseErrors: number;
    constraintViolations: number;
    filteringRate: number;
  };
}
