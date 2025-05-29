
export interface RecoveryProgress {
  totalWebinars: number;
  processedWebinars: number;
  currentWebinar: string;
  totalRegistrations: number;
  errors: number;
  isRunning: boolean;
  startTime?: Date;
  estimatedTimeRemaining?: string;
}

export interface WebinarRecoveryResult {
  webinar_id: string;
  zoom_webinar_id: string;
  title: string;
  registrations_found: number;
  registrations_stored: number;
  errors: number;
  success: boolean;
  error_message?: string;
}
