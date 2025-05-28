
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
      } else if (latestJob.status === 'failed' && syncing) {
        setSyncing(false);
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
      message: 'Starting comprehensive sync...', 
      progress: 5,
      apiRequestsUsed: 0
    });
    
    try {
      console.log('Starting sync for user:', user.id);
      
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
        throw new Error('No active Zoom connection found. Please connect your Zoom account first.');
      }

      console.log('Active Zoom connection found');

      setSyncProgress({ 
        stage: 'webinars', 
        message: 'Starting comprehensive sync...', 
        progress: 10,
        apiRequestsUsed: 0
      });

      console.log('Calling zoom-sync-all function...');

      // Start comprehensive sync using the existing zoom-sync-all function
      const syncResponse = await supabase.functions.invoke('zoom-sync-all', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      console.log('Sync response:', syncResponse);

      if (syncResponse.error) {
        console.error('Sync function error:', syncResponse.error);
        throw new Error(syncResponse.error.message || 'Sync function failed');
      }

      const result = syncResponse.data;
      console.log('Comprehensive sync result:', result);

      // Handle the response structure properly
      if (result && result.success) {
        toast({
          title: "Comprehensive Sync Started",
          description: "Your data sync is running. This may take several minutes for large datasets.",
        });

        // Show summary if available
        if (result.summary) {
          const summary = result.summary;
          console.log('Sync summary:', summary);
          
          // Optional: Show additional success details
          if (summary.webinars_synced !== undefined) {
            console.log(`Webinars synced: ${summary.webinars_synced}`);
          }
        }
      } else {
        console.error('Sync failed with result:', result);
        throw new Error(result?.error || 'Unknown error occurred during sync');
      }

      // Refresh logs after sync starts
      refreshLogs();
      refreshJobs();
      
    } catch (error: any) {
      console.error('Sync error:', error);
      
      setSyncProgress({ stage: 'error', message: 'Sync failed', progress: 0 });
      setSyncing(false);
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync webinar data. Please check your Zoom connection and try again.",
        variant: "destructive",
      });

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
