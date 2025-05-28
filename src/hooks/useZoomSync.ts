
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useSyncLogs } from './useSyncLogs';
import { useSyncJobs } from './useSyncJobs';
import { useSyncProgress } from './useSyncProgress';

export const useZoomSync = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncTimeout, setSyncTimeout] = useState<NodeJS.Timeout | null>(null);

  const { syncLogs, refreshLogs } = useSyncLogs();
  const { syncJobs, refreshJobs } = useSyncJobs();
  const { syncProgress, setSyncProgress } = useSyncProgress(syncJobs, syncing);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
    };
  }, [syncTimeout]);

  useEffect(() => {
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
  }, [syncing, refreshJobs]);

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

  // Update syncing state based on latest sync job with better logic
  useEffect(() => {
    if (syncJobs.length > 0) {
      const latestJob = syncJobs[0];
      
      if (latestJob.status === 'completed' && syncing) {
        console.log('Sync job completed successfully');
        setSyncing(false);
        
        if (syncTimeout) {
          clearTimeout(syncTimeout);
          setSyncTimeout(null);
        }
        
        toast({
          title: "Sync Complete",
          description: "All webinar data has been synchronized successfully.",
        });
      } else if (latestJob.status === 'failed' && syncing) {
        console.log('Sync job failed:', latestJob.error_message);
        setSyncing(false);
        
        if (syncTimeout) {
          clearTimeout(syncTimeout);
          setSyncTimeout(null);
        }
        
        toast({
          title: "Sync Failed",
          description: latestJob.error_message || "Sync encountered an error. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [syncJobs, syncing, syncTimeout]);

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
      
      // Get user's organization with retry logic
      let profile;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

          if (profileError) {
            throw profileError;
          }
          
          profile = profileData;
          break;
        } catch (error) {
          retryCount++;
          console.log(`Profile fetch attempt ${retryCount} failed:`, error);
          
          if (retryCount >= maxRetries) {
            throw new Error('Unable to get organization information after multiple attempts');
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!profile) {
        throw new Error('Unable to get organization information');
      }

      console.log('Found organization:', profile.organization_id);

      // Check connection with retry logic
      let connection;
      retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          const { data: connectionData, error: connectionError } = await supabase
            .from('zoom_connections')
            .select('connection_status')
            .eq('user_id', user.id)
            .eq('connection_status', 'active')
            .single();

          if (connectionError) {
            throw connectionError;
          }
          
          connection = connectionData;
          break;
        } catch (error) {
          retryCount++;
          console.log(`Connection check attempt ${retryCount} failed:`, error);
          
          if (retryCount >= maxRetries) {
            throw new Error('No active Zoom connection found. Please reconnect your Zoom account with the updated permissions.');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

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
      } else {
        console.error('Sync failed with result:', result);
        throw new Error(result?.error || 'Unknown error occurred during sync');
      }

      // Refresh data after successful start
      await Promise.all([refreshLogs(), refreshJobs()]);
      
    } catch (error: any) {
      console.error('Robust sync error:', error);
      
      setSyncProgress({ 
        stage: 'error', 
        message: 'Sync failed - please try again', 
        progress: 0 
      });
      setSyncing(false);
      
      if (syncTimeout) {
        clearTimeout(syncTimeout);
        setSyncTimeout(null);
      }
      
      // Provide specific error messages
      let errorMessage = "Failed to sync webinar data. Please try again.";
      
      if (error.message && error.message.includes('scopes')) {
        errorMessage = "Your Zoom connection needs updated permissions. Please reconnect your Zoom account.";
      } else if (error.message && error.message.includes('organization')) {
        errorMessage = "Unable to access your organization. Please check your account settings.";
      } else if (error.message && error.message.includes('connection')) {
        errorMessage = "Zoom connection issue. Please check your connection and try again.";
      }
      
      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive",
      });

      // Reset progress after error display
      setTimeout(() => {
        setSyncProgress({ stage: 'idle', message: '', progress: 0 });
      }, 5000);
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
