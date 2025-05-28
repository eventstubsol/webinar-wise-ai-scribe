
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
    days_back?: number;
  };
  apiRequestsUsed?: number;
  estimatedTimeRemaining?: string;
}

export type WebinarStatus = 'scheduled' | 'upcoming' | 'live' | 'completed' | 'cancelled';
