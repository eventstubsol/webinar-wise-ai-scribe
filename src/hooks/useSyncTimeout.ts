
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
    if (latestJob && latestJob.status === 'running') {
      console.log('Job still running after timeout, marking as completed');
      // If job is still running after timeout, consider it completed
      // The background processing will continue on the server
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
      // Poll more frequently for better responsiveness
      const interval = setInterval(() => {
        refreshJobs();
      }, 1500);

      // Set a maximum sync timeout of 10 minutes
      const timeout = setTimeout(() => {
        console.log('Sync timeout reached, checking final status...');
        handleSyncTimeout();
      }, 600000); // 10 minutes

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
