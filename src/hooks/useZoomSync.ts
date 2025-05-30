
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useSyncLogs } from './useSyncLogs';
import { useSyncJobs } from './useSyncJobs';
import { useSyncProgress } from './useSyncProgress';
import { useEnhancedSyncTimeout } from './useEnhancedSyncTimeout';
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
  
  // Enhanced timeout handling with background processing support
  const {
    backgroundProcessing,
    startEnhancedSyncTimeout,
    clearSyncTimeout,
    manualStatusCheck,
    timeoutMinutes
  } = useEnhancedSyncTimeout(
    syncing,
    refreshJobs,
    syncJobs,
    setSyncProgress,
    setSyncing,
    syncProgress.details?.webinars_found
  );

  const { validateUserProfile, validateZoomConnection } = useSyncValidation();
  const { handleSyncError } = useSyncErrorHandler();

  // Use chunked sync for improved reliability
  const chunkedSync = useChunkedSync();

  // Use sync status manager to handle job status changes
  useSyncStatusManager(syncJobs, syncing, null, setSyncing, clearSyncTimeout);

  // Enhanced sync method with better timeout handling
  const syncWebinarDataEnhanced = async () => {
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
      message: 'Initializing enhanced sync with timeout protection...', 
      progress: 5,
      apiRequestsUsed: 0,
      details: {
        enhanced_processing: true,
        timeout_protection: `${timeoutMinutes} minutes`
      }
    });
    
    try {
      console.log('Starting enhanced sync for user:', user.id);
      
      // Validate user profile and zoom connection
      const profile = await validateUserProfile(user.id);
      console.log('Found organization:', profile.organization_id);

      await validateZoomConnection(user.id);
      console.log('Active Zoom connection confirmed');

      setSyncProgress({ 
        stage: 'webinars', 
        message: 'Starting enhanced comprehensive sync with background processing...', 
        progress: 10,
        apiRequestsUsed: 0,
        details: {
          enhanced_processing: true,
          background_support: true
        }
      });

      console.log('Calling enhanced sync function...');

      // Call the enhanced sync function
      const syncResponse = await supabase.functions.invoke('zoom-comprehensive-rate-limited-sync', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id,
          enhanced_timeout: true,
          background_processing: true
        }
      });

      console.log('Enhanced sync response:', syncResponse);

      if (syncResponse.error) {
        console.error('Sync function error:', syncResponse.error);
        throw new Error(syncResponse.error.message || 'Enhanced sync function failed');
      }

      const result = syncResponse.data;
      console.log('Enhanced sync result:', result);

      if (result && result.success) {
        console.log('Enhanced sync started successfully');
        
        toast({
          title: "Enhanced Sync Started",
          description: `Webinar data sync is running with ${timeoutMinutes}-minute timeout protection.`,
        });

        if (result.summary) {
          const summary = result.summary;
          console.log('Sync summary:', summary);
          
          setSyncProgress({ 
            stage: 'background_processing', 
            message: 'Enhanced sync active - large datasets processed in background...', 
            progress: 60,
            apiRequestsUsed: summary.api_requests_made || 0,
            details: {
              webinars_synced: summary.webinars_synced,
              webinars_found: summary.webinars_found,
              enhanced_processing: true,
              background_jobs: summary.detailed_jobs_created || 0,
              comprehensive_coverage: 'Enhanced sync with timeout protection and background processing'
            }
          });
        }

        startEnhancedSyncTimeout();
      } else {
        console.error('Enhanced sync failed with result:', result);
        throw new Error(result?.error || 'Unknown error occurred during enhanced sync');
      }

      await Promise.all([refreshLogs(), refreshJobs()]);
      
    } catch (error: any) {
      handleSyncError(error, setSyncProgress, setSyncing, clearSyncTimeout);
    }
  };

  // Main sync method - enhanced version with fallback
  const syncWebinarData = async () => {
    console.log('Starting enhanced webinar data sync...');
    
    try {
      // Use enhanced sync method
      await syncWebinarDataEnhanced();
    } catch (error: any) {
      console.error('Enhanced sync failed, trying chunked sync fallback:', error);
      
      toast({
        title: "Switching to Chunked Sync",
        description: "Enhanced sync failed, trying chunked method...",
        variant: "default",
      });
      
      // Fallback to chunked sync if enhanced sync fails
      try {
        await chunkedSync.startChunkedSync();
        await Promise.all([refreshLogs(), refreshJobs()]);
      } catch (chunkedError: any) {
        console.error('Both enhanced and chunked sync failed:', chunkedError);
        
        toast({
          title: "Sync Failed",
          description: "Both enhanced and fallback sync methods failed. Please try again.",
          variant: "destructive",
        });
        
        setSyncing(false);
        clearSyncTimeout();
      }
    }
  };

  // Create unified progress object with enhanced features
  const unifiedSyncProgress: SyncProgress = chunkedSync.syncing ? {
    stage: 'webinars',
    message: `Enhanced chunked processing: ${chunkedSync.totalProcessed} webinars synced`,
    progress: chunkedSync.progress,
    details: {
      webinars_synced: chunkedSync.syncStats.processed,
      webinars_found: chunkedSync.syncStats.totalFound,
      detailed_sync_count: chunkedSync.syncStats.chunks,
      enhanced_processing: true,
      background_support: true,
      comprehensive_coverage: 'Enhanced chunked sync with improved reliability and timeout protection'
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
    // Enhanced features
    backgroundProcessing,
    manualStatusCheck,
    timeoutMinutes,
    // Expose chunked sync stats for debugging
    chunkedSyncStats: chunkedSync.syncStats,
    currentChunk: chunkedSync.currentChunk
  };
};
