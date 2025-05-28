
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useSyncLogs } from './useSyncLogs';
import { useSyncJobs } from './useSyncJobs';
import { useSyncProgress } from './useSyncProgress';
import { useSyncTimeout } from './useSyncTimeout';
import { useSyncStatusManager } from './useSyncStatusManager';
import { useSyncValidation } from './useSyncValidation';
import { useSyncErrorHandler } from './useSyncErrorHandler';

export const useZoomSync = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const { syncLogs, refreshLogs } = useSyncLogs();
  const { syncJobs, refreshJobs } = useSyncJobs();
  const { syncProgress, setSyncProgress } = useSyncProgress(syncJobs, syncing);
  
  const {
    syncTimeout,
    setSyncTimeout,
    startSyncTimeout,
    clearSyncTimeout
  } = useSyncTimeout(syncing, refreshJobs, syncJobs, setSyncProgress, setSyncing);

  const { validateUserProfile, validateZoomConnection } = useSyncValidation();
  const { handleSyncError } = useSyncErrorHandler();

  // Use sync status manager to handle job status changes
  useSyncStatusManager(syncJobs, syncing, syncTimeout, setSyncing, clearSyncTimeout);

  const syncWebinarData = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    // Prevent multiple concurrent syncs
    if (syncing) {
      toast({
        title: "Sync in Progress",
        description: "A sync is already running. Please wait for it to complete.",
        variant: "default",
      });
      return;
    }

    setSyncing(true);
    setSyncProgress({ 
      stage: 'webinars', 
      message: 'Initializing robust sync process...', 
      progress: 5,
      apiRequestsUsed: 0
    });
    
    try {
      console.log('Starting robust sync for user:', user.id);
      
      // Validate user profile and zoom connection
      const profile = await validateUserProfile(user.id);
      console.log('Found organization:', profile.organization_id);

      await validateZoomConnection(user.id);
      console.log('Active Zoom connection confirmed');

      setSyncProgress({ 
        stage: 'webinars', 
        message: 'Starting reliable comprehensive sync...', 
        progress: 10,
        apiRequestsUsed: 0
      });

      console.log('Calling robust sync function...');

      // Call the sync function with enhanced error handling
      const syncResponse = await supabase.functions.invoke('zoom-comprehensive-rate-limited-sync', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      console.log('Robust sync response:', syncResponse);

      if (syncResponse.error) {
        console.error('Sync function error:', syncResponse.error);
        throw new Error(syncResponse.error.message || 'Comprehensive sync function failed');
      }

      const result = syncResponse.data;
      console.log('Robust sync result:', result);

      // Handle the response with better error checking
      if (result && result.success) {
        console.log('Sync started successfully');
        
        toast({
          title: "Sync Started Successfully",
          description: "Webinar data sync is now running with improved reliability.",
        });

        // Show immediate progress feedback
        if (result.summary) {
          const summary = result.summary;
          console.log('Sync summary:', summary);
          
          setSyncProgress({ 
            stage: 'background_processing', 
            message: 'Basic sync complete. Enhanced processing continues in background...', 
            progress: 60,
            apiRequestsUsed: summary.api_requests_made || 0,
            details: {
              webinars_synced: summary.webinars_synced,
              webinars_found: summary.webinars_found,
              comprehensive_coverage: 'Basic sync complete, detailed processing continues with improved reliability'
            }
          });
        }

        // Start timeout management
        startSyncTimeout();
      } else {
        console.error('Sync failed with result:', result);
        throw new Error(result?.error || 'Unknown error occurred during sync');
      }

      // Refresh data after successful start
      await Promise.all([refreshLogs(), refreshJobs()]);
      
    } catch (error: any) {
      handleSyncError(error, setSyncProgress, setSyncing, clearSyncTimeout);
    }
  };

  return {
    syncLogs,
    syncJobs,
    syncing,
    syncProgress,
    syncWebinarData,
    refreshLogs,
    refreshJobs,
  };
};
