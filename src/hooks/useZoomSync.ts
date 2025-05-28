
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

  const { syncLogs, refreshLogs } = useSyncLogs();
  const { syncJobs, refreshJobs } = useSyncJobs();
  const { syncProgress, setSyncProgress } = useSyncProgress(syncJobs, syncing);

  useEffect(() => {
    if (syncing) {
      // Poll for sync job updates while syncing
      const interval = setInterval(() => {
        refreshJobs();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [syncing, refreshJobs]);

  // Update syncing state based on latest sync job
  useEffect(() => {
    if (syncJobs.length > 0) {
      const latestJob = syncJobs[0];
      if (latestJob.status === 'completed' && syncing) {
        setSyncing(false);
        // Show completion message
        toast({
          title: "Sync Complete",
          description: "All webinar data has been synchronized successfully.",
        });
      } else if (latestJob.status === 'failed' && syncing) {
        setSyncing(false);
        toast({
          title: "Sync Failed",
          description: latestJob.error_message || "Sync encountered an error.",
          variant: "destructive",
        });
      }
    }
  }, [syncJobs, syncing]);

  const syncWebinarData = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    setSyncProgress({ 
      stage: 'webinars', 
      message: 'Starting fast comprehensive sync...', 
      progress: 5,
      apiRequestsUsed: 0
    });
    
    try {
      console.log('Starting fast comprehensive sync for user:', user.id);
      
      // Get user's organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        throw new Error('Unable to get organization information');
      }

      console.log('Found organization:', profile.organization_id);

      // Check if user has an active Zoom connection
      const { data: connection, error: connectionError } = await supabase
        .from('zoom_connections')
        .select('connection_status')
        .eq('user_id', user.id)
        .eq('connection_status', 'active')
        .single();

      if (connectionError || !connection) {
        console.error('Connection error:', connectionError);
        throw new Error('No active Zoom connection found. Please reconnect your Zoom account with the updated permissions.');
      }

      console.log('Active Zoom connection found');

      setSyncProgress({ 
        stage: 'webinars', 
        message: 'Starting fast comprehensive sync...', 
        progress: 10,
        apiRequestsUsed: 0
      });

      console.log('Calling zoom-comprehensive-rate-limited-sync function...');

      // Call the improved rate-limited comprehensive sync function
      const syncResponse = await supabase.functions.invoke('zoom-comprehensive-rate-limited-sync', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      console.log('Fast comprehensive sync response:', syncResponse);

      if (syncResponse.error) {
        console.error('Sync function error:', syncResponse.error);
        throw new Error(syncResponse.error.message || 'Fast comprehensive sync function failed');
      }

      const result = syncResponse.data;
      console.log('Fast comprehensive sync result:', result);

      // Handle the new response structure
      if (result && result.success) {
        toast({
          title: "Sync Started Successfully",
          description: "Basic webinar data synced! Detailed processing continues in background.",
        });

        // Show immediate success feedback
        if (result.summary) {
          const summary = result.summary;
          console.log('Fast sync summary:', summary);
          
          setSyncProgress({ 
            stage: 'background_processing', 
            message: 'Basic sync complete. Processing detailed data in background...', 
            progress: 60,
            apiRequestsUsed: summary.api_requests_made || 0,
            details: {
              webinars_synced: summary.webinars_synced,
              webinars_found: summary.webinars_found,
              comprehensive_coverage: 'Basic sync complete, detailed processing in background'
            }
          });
        }
      } else {
        console.error('Fast comprehensive sync failed with result:', result);
        throw new Error(result?.error || 'Unknown error occurred during fast comprehensive sync');
      }

      // Refresh logs and jobs after sync starts
      refreshLogs();
      refreshJobs();
      
    } catch (error: any) {
      console.error('Fast comprehensive sync error:', error);
      
      setSyncProgress({ stage: 'error', message: 'Comprehensive sync failed', progress: 0 });
      setSyncing(false);
      
      // Check if it's a permissions error
      if (error.message && error.message.includes('scopes')) {
        toast({
          title: "Permissions Issue",
          description: "Your Zoom connection needs updated permissions. Please reconnect your Zoom account to enable comprehensive data sync.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync Failed",
          description: error.message || "Failed to sync comprehensive webinar data. Please check your Zoom connection and try again.",
          variant: "destructive",
        });
      }

      // Reset progress after error
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
