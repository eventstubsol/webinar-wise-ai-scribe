
import { useState, useEffect } from 'react';
import { SyncProgress, SyncJob } from '@/types/sync';
import { calculateEstimatedTime } from '@/utils/syncUtils';

export const useSyncProgress = (syncJobs: SyncJob[], syncing: boolean) => {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });

  // Update progress based on latest sync job
  useEffect(() => {
    if (syncJobs.length > 0) {
      const latestJob = syncJobs[0];
      if (latestJob.status === 'running' && latestJob.job_type === 'comprehensive_rate_limited_sync') {
        const metadata = latestJob.metadata || {};
        setSyncProgress({
          stage: metadata.current_stage || 'webinars',
          message: metadata.stage_message || 'Processing...',
          progress: latestJob.progress || 0,
          details: {
            webinars_found: metadata.webinars_found,
            webinars_synced: metadata.webinars_synced,
            detailed_sync_count: metadata.detailed_sync_count
          },
          apiRequestsUsed: metadata.api_requests_made,
          estimatedTimeRemaining: calculateEstimatedTime(latestJob.progress, latestJob.started_at)
        });
      } else if (latestJob.status === 'completed' && syncing) {
        setSyncProgress({
          stage: 'completed',
          message: 'Comprehensive sync completed successfully!',
          progress: 100,
          details: latestJob.metadata
        });
      } else if (latestJob.status === 'failed' && syncing) {
        setSyncProgress({
          stage: 'error',
          message: latestJob.error_message || 'Sync failed',
          progress: 0
        });
      }
    }
  }, [syncJobs, syncing]);

  return { syncProgress, setSyncProgress };
};
