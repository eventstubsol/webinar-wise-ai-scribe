
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
}
