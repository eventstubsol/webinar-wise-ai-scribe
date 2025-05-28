
import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export const useSyncStatusManager = (
  syncJobs: any[],
  syncing: boolean,
  syncTimeout: NodeJS.Timeout | null,
  setSyncing: (syncing: boolean) => void,
  clearSyncTimeout: () => void
) => {
  // Update syncing state based on latest sync job with better logic
  useEffect(() => {
    if (syncJobs.length > 0) {
      const latestJob = syncJobs[0];
      
      if (latestJob.status === 'completed' && syncing) {
        console.log('Sync job completed successfully');
        setSyncing(false);
        
        clearSyncTimeout();
        
        toast({
          title: "Sync Complete",
          description: "All webinar data has been synchronized successfully.",
        });
      } else if (latestJob.status === 'failed' && syncing) {
        console.log('Sync job failed:', latestJob.error_message);
        setSyncing(false);
        
        clearSyncTimeout();
        
        toast({
          title: "Sync Failed",
          description: latestJob.error_message || "Sync encountered an error. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [syncJobs, syncing, syncTimeout, setSyncing, clearSyncTimeout]);
};
