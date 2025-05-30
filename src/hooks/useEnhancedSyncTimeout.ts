
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export const useEnhancedSyncTimeout = (
  syncing: boolean,
  refreshJobs: () => Promise<void>,
  syncJobs: any[],
  setSyncProgress: (progress: any) => void,
  setSyncing: (syncing: boolean) => void,
  webinarCount?: number
) => {
  const [syncTimeout, setSyncTimeout] = useState<NodeJS.Timeout | null>(null);
  const [backgroundProcessing, setBackgroundProcessing] = useState(false);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // Dynamic timeout calculation
  const calculateTimeout = (webinarCount?: number) => {
    const baseTimeout = 600000; // 10 minutes
    const perWebinarTimeout = 30000; // 30 seconds per webinar
    const maxTimeout = 1800000; // 30 minutes max
    
    if (webinarCount) {
      return Math.min(baseTimeout + (webinarCount * perWebinarTimeout), maxTimeout);
    }
    return baseTimeout;
  };

  const checkBackgroundJobs = useCallback(async () => {
    console.log('Checking background job status...');
    await refreshJobs();
    
    const runningJobs = syncJobs.filter(job => job.status === 'running' || job.status === 'pending');
    
    if (runningJobs.length > 0) {
      console.log(`Found ${runningJobs.length} active background jobs`);
      setBackgroundProcessing(true);
      
      // Update progress based on job metadata
      const latestJob = runningJobs[0];
      if (latestJob.metadata) {
        setSyncProgress({
          stage: 'background_processing',
          message: `Background processing: ${latestJob.metadata.stage_message || 'Processing detailed data...'}`,
          progress: latestJob.progress || 0,
          details: {
            ...latestJob.metadata,
            background_jobs: runningJobs.length,
            comprehensive_coverage: 'Sync continues in background - large dataset processing'
          },
          estimatedTimeRemaining: 'Processing in background...'
        });
      }
    } else {
      setBackgroundProcessing(false);
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
    }
  }, [refreshJobs, syncJobs, setSyncProgress]);

  const handleGracefulTimeout = async () => {
    console.log('Handling graceful sync timeout...');
    
    // Force refresh to get latest job status
    await refreshJobs();
    
    const activeJobs = syncJobs.filter(job => job.status === 'running' || job.status === 'pending');
    
    if (activeJobs.length > 0) {
      console.log('Active jobs found after timeout, switching to background mode');
      setBackgroundProcessing(true);
      
      setSyncProgress({
        stage: 'background_processing',
        message: 'Sync continues in background - this is normal for large datasets',
        progress: 75,
        details: {
          background_jobs: activeJobs.length,
          comprehensive_coverage: 'Large dataset processing continues automatically',
          timeout_reason: 'Client timeout reached, server continues processing'
        },
        estimatedTimeRemaining: 'Processing in background...'
      });
      
      toast({
        title: "Sync Continues in Background",
        description: `Processing ${activeJobs.length} background jobs. You'll be notified when complete.`,
      });

      // Start checking job status every 30 seconds
      const interval = setInterval(checkBackgroundJobs, 30000);
      setStatusCheckInterval(interval);
      
    } else {
      setSyncProgress({
        stage: 'completed',
        message: 'Sync completed successfully!',
        progress: 100,
        estimatedTimeRemaining: 'Complete'
      });
      
      toast({
        title: "Sync Complete",
        description: "All webinar data has been synchronized successfully.",
      });
    }
    
    setSyncing(false);
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      setSyncTimeout(null);
    }
  };

  const startEnhancedSyncTimeout = useCallback(() => {
    if (syncing) {
      // Enhanced polling - check more frequently for responsiveness
      const pollInterval = setInterval(() => {
        refreshJobs();
      }, 2000);

      // Dynamic timeout based on dataset size
      const timeoutDuration = calculateTimeout(webinarCount);
      console.log(`Setting dynamic timeout: ${Math.round(timeoutDuration / 60000)} minutes for ${webinarCount || 'unknown'} webinars`);

      const timeout = setTimeout(() => {
        console.log('Enhanced sync timeout reached, checking final status...');
        handleGracefulTimeout();
      }, timeoutDuration);

      setSyncTimeout(timeout);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }
  }, [syncing, webinarCount, refreshJobs, handleGracefulTimeout]);

  const clearSyncTimeout = useCallback(() => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      setSyncTimeout(null);
    }
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
    setBackgroundProcessing(false);
  }, [syncTimeout, statusCheckInterval]);

  const manualStatusCheck = useCallback(async () => {
    console.log('Manual status check triggered');
    await checkBackgroundJobs();
    
    toast({
      title: "Status Updated",
      description: "Checked latest job progress.",
    });
  }, [checkBackgroundJobs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      if (statusCheckInterval) clearInterval(statusCheckInterval);
    };
  }, [syncTimeout, statusCheckInterval]);

  return {
    syncTimeout,
    setSyncTimeout,
    backgroundProcessing,
    startEnhancedSyncTimeout,
    clearSyncTimeout,
    manualStatusCheck,
    timeoutMinutes: Math.round(calculateTimeout(webinarCount) / 60000)
  };
};
