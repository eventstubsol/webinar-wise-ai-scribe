
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export const useSyncTimeout = (
  syncing: boolean,
  refreshJobs: () => Promise<void>,
  syncJobs: any[],
  setSyncProgress: (progress: any) => void,
  setSyncing: (syncing: boolean) => void
) => {
  const [syncTimeout, setSyncTimeout] = useState<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
    };
  }, [syncTimeout]);

  const handleSyncTimeout = async () => {
    console.log('Handling sync timeout...');
    
    // Force refresh to get latest status
    await refreshJobs();
    
    const latestJob = syncJobs[0];
    if (latestJob && (latestJob.status === 'running' || latestJob.status === 'pending')) {
      console.log('Job still active after timeout, transitioning to background mode');
      
      // Enhanced timeout handling - show background processing status
      setSyncProgress({
        stage: 'background_processing',
        message: 'Large dataset detected - processing continues in background',
        progress: latestJob.progress || 60,
        estimatedTimeRemaining: 'Processing in background...',
        details: {
          ...latestJob.metadata,
          timeout_transition: true,
          background_processing: true,
          comprehensive_coverage: 'Sync continues automatically in background for large datasets'
        }
      });
      
      toast({
        title: "Sync Continues in Background",
        description: "Large dataset detected. Processing continues automatically - you'll be notified when complete.",
      });
    } else {
      setSyncProgress({
        stage: 'completed',
        message: 'Sync completed successfully! Data processing continues in background.',
        progress: 100,
        estimatedTimeRemaining: 'Complete'
      });
      
      toast({
        title: "Sync Complete",
        description: "Webinar data has been synchronized. Background processing continues for detailed data.",
      });
    }
    
    setSyncing(false);
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      setSyncTimeout(null);
    }
  };

  const startSyncTimeout = () => {
    if (syncing) {
      // Enhanced polling for better responsiveness
      const interval = setInterval(() => {
        refreshJobs();
      }, 1000); // More frequent polling

      // Extended timeout for large datasets - 20 minutes instead of 10
      const timeout = setTimeout(() => {
        console.log('Enhanced sync timeout reached, checking final status...');
        handleSyncTimeout();
      }, 1200000); // 20 minutes

      setSyncTimeout(timeout);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  };

  const clearSyncTimeout = () => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      setSyncTimeout(null);
    }
  };

  return {
    syncTimeout,
    setSyncTimeout,
    handleSyncTimeout,
    startSyncTimeout,
    clearSyncTimeout
  };
};
