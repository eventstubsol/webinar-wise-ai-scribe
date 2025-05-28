
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
import { useChunkedSync } from './useChunkedSync';
import { SyncProgress } from '@/types/sync';

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

  // Use chunked sync for improved reliability
  const chunkedSync = useChunkedSync();

  // Use sync status manager to handle job status changes
  useSyncStatusManager(syncJobs, syncing, syncTimeout, setSyncing, clearSyncTimeout);

  // Legacy sync method (fallback)
  const syncWebinarDataLegacy = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

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
      message: 'Initializing legacy sync process...', 
      progress: 5,
      apiRequestsUsed: 0
    });
    
    try {
      console.log('Starting legacy sync for user:', user.id);
      
      // Validate user profile and zoom connection
      const profile = await validateUserProfile(user.id);
      console.log('Found organization:', profile.organization_id);

      await validateZoomConnection(user.id);
      console.log('Active Zoom connection confirmed');

      setSyncProgress({ 
        stage: 'webinars', 
        message: 'Starting legacy comprehensive sync...', 
        progress: 10,
        apiRequestsUsed: 0
      });

      console.log('Calling legacy sync function...');

      // Call the legacy sync function
      const syncResponse = await supabase.functions.invoke('zoom-comprehensive-rate-limited-sync', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      console.log('Legacy sync response:', syncResponse);

      if (syncResponse.error) {
        console.error('Sync function error:', syncResponse.error);
        throw new Error(syncResponse.error.message || 'Legacy sync function failed');
      }

      const result = syncResponse.data;
      console.log('Legacy sync result:', result);

      if (result && result.success) {
        console.log('Legacy sync started successfully');
        
        toast({
          title: "Legacy Sync Started",
          description: "Webinar data sync is running with legacy method.",
        });

        if (result.summary) {
          const summary = result.summary;
          console.log('Sync summary:', summary);
          
          setSyncProgress({ 
            stage: 'background_processing', 
            message: 'Legacy sync complete. Processing continues in background...', 
            progress: 60,
            apiRequestsUsed: summary.api_requests_made || 0,
            details: {
              webinars_synced: summary.webinars_synced,
              webinars_found: summary.webinars_found,
              comprehensive_coverage: 'Legacy sync complete, detailed processing continues'
            }
          });
        }

        startSyncTimeout();
      } else {
        console.error('Legacy sync failed with result:', result);
        throw new Error(result?.error || 'Unknown error occurred during legacy sync');
      }

      await Promise.all([refreshLogs(), refreshJobs()]);
      
    } catch (error: any) {
      handleSyncError(error, setSyncProgress, setSyncing, clearSyncTimeout);
    }
  };

  // Main sync method - use chunked sync by default
  const syncWebinarData = async () => {
    console.log('Starting webinar data sync...');
    
    try {
      // Use chunked sync for better reliability
      await chunkedSync.startChunkedSync();
      
      // Refresh logs and jobs after chunked sync
      await Promise.all([refreshLogs(), refreshJobs()]);
    } catch (error: any) {
      console.error('Chunked sync failed, falling back to legacy sync:', error);
      
      toast({
        title: "Switching to Legacy Sync",
        description: "Chunked sync failed, trying legacy method...",
        variant: "default",
      });
      
      // Fallback to legacy sync if chunked sync fails
      await syncWebinarDataLegacy();
    }
  };

  // Create unified progress object that matches SyncProgress interface
  const unifiedSyncProgress: SyncProgress = chunkedSync.syncing ? {
    stage: 'webinars',
    message: `Processing chunk ${chunkedSync.currentChunk} - ${chunkedSync.totalProcessed} webinars synced`,
    progress: chunkedSync.progress,
    details: {
      webinars_synced: chunkedSync.syncStats.processed,
      webinars_found: chunkedSync.syncStats.totalFound,
      detailed_sync_count: chunkedSync.syncStats.chunks,
      comprehensive_coverage: 'Chunked sync in progress with enhanced reliability'
    },
    apiRequestsUsed: 0,
    estimatedTimeRemaining: `Chunk ${chunkedSync.currentChunk} of estimated ${Math.ceil(chunkedSync.syncStats.totalFound / 5)}`
  } : syncProgress;

  return {
    syncLogs,
    syncJobs,
    syncing: syncing || chunkedSync.syncing,
    syncProgress: unifiedSyncProgress,
    syncWebinarData,
    refreshLogs,
    refreshJobs,
    // Expose chunked sync stats for debugging
    chunkedSyncStats: chunkedSync.syncStats,
    currentChunk: chunkedSync.currentChunk
  };
};
