
export interface AttendeeRecoveryProgress {
  totalWebinars: number;
  processedWebinars: number;
  currentWebinar: string;
  totalAttendees: number;
  errors: number;
  isRunning: boolean;
  startTime?: Date;
  estimatedTimeRemaining?: string;
}

export interface RecoveryStats {
  database_errors?: number;
  validation_errors?: number;
  bot_detections?: number;
  email_rejections?: number;
  duration_filters?: number;
  api_calls_made?: number;
  pages_processed?: number;
  total_raw_found?: number;
}

export interface WebinarAttendeeResult {
  webinar_id: string;
  zoom_webinar_id: string;
  title: string;
  attendees_found: number;
  attendees_stored: number;
  errors: number;
  success: boolean;
  api_used?: string;
  error_message?: string;
  recovery_stats?: RecoveryStats;
}
