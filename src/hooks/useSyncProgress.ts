
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
        
        // Handle different stages of background processing
        let stageMessage = metadata.stage_message || 'Processing...';
        let currentStage = metadata.current_stage || 'webinars';
        
        // Show appropriate message based on progress
        if (latestJob.progress >= 60 && latestJob.progress < 100) {
          stageMessage = 'Basic sync complete. Processing detailed data in background...';
          currentStage = 'background_processing';
        }
        
        setSyncProgress({
          stage: currentStage,
          message: stageMessage,
          progress: latestJob.progress || 0,
          details: {
            webinars_found: metadata.webinars_found,
            webinars_synced: metadata.webinars_synced,
            detailed_sync_count: metadata.detailed_sync_count,
            participants_synced: metadata.participants_synced,
            panelists_synced: metadata.panelists_synced,
            polls_synced: metadata.polls_synced,
            qa_synced: metadata.qa_synced,
            registrations_synced: metadata.registrations_synced,
            comprehensive_coverage: latestJob.progress >= 60 ? 'Basic sync complete, detailed processing in background' : undefined
          },
          apiRequestsUsed: metadata.api_requests_made,
          estimatedTimeRemaining: latestJob.progress < 60 
            ? calculateEstimatedTime(latestJob.progress, latestJob.started_at)
            : 'Processing in background...'
        });
      } else if (latestJob.status === 'completed' && syncing) {
        setSyncProgress({
          stage: 'completed',
          message: 'Comprehensive sync completed successfully!',
          progress: 100,
          details: latestJob.metadata,
          estimatedTimeRemaining: 'Complete'
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
