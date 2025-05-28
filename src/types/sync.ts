
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
  stage: 'idle' | 'webinars' | 'webinar_details' | 'participants' | 'chat' | 'polls' | 'qa' | 'registrations' | 'completed' | 'error';
  message: string;
  progress: number;
  details?: any;
  apiRequestsUsed?: number;
  estimatedTimeRemaining?: string;
}
