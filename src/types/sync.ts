
export interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_processed: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  progress: number;
  total_items: number;
  current_item: number;
  error_message: string | null;
  metadata: any;
  started_at: string;
  completed_at: string | null;
}

export interface SyncProgress {
  stage: 'idle' | 'webinars' | 'webinar_details' | 'participants' | 'chat' | 'polls' | 'qa' | 'registrations' | 'background_processing' | 'completed' | 'error';
  message: string;
  progress: number;
  details?: {
    webinars_found?: number;
    webinars_synced?: number;
    detailed_sync_count?: number;
    participants_synced?: number;
    polls_synced?: number;
    qa_synced?: number;
    registrations_synced?: number;
    comprehensive_coverage?: string;
  };
  apiRequestsUsed?: number;
  estimatedTimeRemaining?: string;
}

export type WebinarStatus = 'scheduled' | 'upcoming' | 'live' | 'completed' | 'cancelled';

// Extended webinar interface to match the comprehensive data structure
export interface WebinarDetails {
  // Basic Information
  id: string;
  zoom_webinar_id: string;
  uuid: string;
  host_id: string;
  host_email: string;
  host_name: string;
  title: string;
  agenda: string;
  webinar_type: string;
  
  // Scheduling Details
  start_time: string;
  timezone: string;
  duration_minutes: number;
  created_at_zoom: string;
  
  // Access & Registration
  join_url: string;
  registration_url: string;
  password: string;
  pstn_password: string;
  
  // Status Information
  status: WebinarStatus;
  start_url: string;
  h323_passcode: string;
  encrypted_passcode: string;
  
  // Additional fields
  is_simulive: boolean;
  registrants_count: number;
  attendees_count: number;
  
  // Related data structures
  settings?: any;
  recurrence?: any;
  tracking_fields?: Array<{
    field_name: string;
    field_value: string;
    visible: boolean;
  }>;
  occurrences?: Array<{
    occurrence_id: string;
    start_time: string;
    duration: number;
    status: string;
  }>;
  authentication?: any;
  qa_settings?: any;
  notifications?: any;
  interpreters?: any[];
}
