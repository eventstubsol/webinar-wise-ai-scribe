
import { useState, useEffect } from 'react';
import { SyncProgress, SyncJob } from '@/types/sync';
import { calculateEstimatedTime } from '@/utils/syncUtils';

export const useSyncProgress = (syncJobs: SyncJob[], syncing: boolean) => {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });

  // Enhanced progress tracking with better state management
  useEffect(() => {
    if (syncJobs.length > 0) {
      const latestJob = syncJobs[0];
      
      if (latestJob.status === 'running' && latestJob.job_type === 'comprehensive_rate_limited_sync') {
        const metadata = latestJob.metadata || {};
        
        // Enhanced stage handling
        let stageMessage = metadata.stage_message || 'Processing...';
        let currentStage = metadata.current_stage || 'webinars';
        
        // More intelligent progress tracking
        if (latestJob.progress >= 60 && latestJob.progress < 100) {
          if (metadata.enhanced_sync) {
            stageMessage = 'Enhanced sync: Processing detailed data with improved reliability...';
          } else {
            stageMessage = 'Basic sync complete. Processing detailed data in background...';
          }
          currentStage = 'background_processing';
        } else if (latestJob.progress >= 95) {
          stageMessage = 'Finalizing sync process...';
          currentStage = 'finalizing';
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
            comprehensive_coverage: metadata.enhanced_sync 
              ? 'Enhanced sync with improved reliability and error handling'
              : latestJob.progress >= 60 ? 'Basic sync complete, detailed processing in background' : undefined
          },
          apiRequestsUsed: metadata.api_requests_made,
          estimatedTimeRemaining: latestJob.progress < 95
            ? calculateEstimatedTime(latestJob.progress, latestJob.started_at)
            : latestJob.progress >= 95 && latestJob.progress < 100
              ? 'Finalizing...'
              : 'Processing in background...'
        });
      } else if (latestJob.status === 'completed' && syncing) {
        const metadata = latestJob.metadata || {};
        
        setSyncProgress({
          stage: 'completed',
          message: metadata.enhanced_completion 
            ? 'Enhanced comprehensive sync completed successfully!'
            : 'Comprehensive sync completed successfully!',
          progress: 100,
          details: {
            ...latestJob.metadata,
            comprehensive_coverage: metadata.enhanced_sync 
              ? 'Enhanced sync completed with improved reliability'
              : 'Sync completed successfully'
          },
          estimatedTimeRemaining: 'Complete'
        });
      } else if (latestJob.status === 'failed' && syncing) {
        setSyncProgress({
          stage: 'error',
          message: latestJob.error_message || 'Sync failed',
          progress: 0,
          details: {
            error_type: latestJob.metadata?.error_type || 'unknown',
            error_details: latestJob.metadata?.error_details
          }
        });
      }
    } else if (!syncing) {
      // Reset to idle when not syncing and no jobs
      setSyncProgress({
        stage: 'idle',
        message: '',
        progress: 0
      });
    }
  }, [syncJobs, syncing]);

  return { syncProgress, setSyncProgress };
};
