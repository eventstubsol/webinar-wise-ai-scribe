
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_processed: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  progress: number;
  total_items: number;
  current_item: number;
  error_message: string | null;
  metadata: any;
  started_at: string;
  completed_at: string | null;
}

interface SyncProgress {
  stage: 'idle' | 'webinars' | 'webinar_details' | 'participants' | 'chat' | 'polls' | 'qa' | 'registrations' | 'completed' | 'error';
  message: string;
  progress: number;
  details?: any;
  apiRequestsUsed?: number;
  estimatedTimeRemaining?: string;
}

export const useZoomSync = () => {
  const { user } = useAuth();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });

  useEffect(() => {
    if (user) {
      fetchSyncLogs();
      fetchSyncJobs();
    }
  }, [user]);

  useEffect(() => {
    if (syncing) {
      // Poll for sync job updates while syncing
      const interval = setInterval(() => {
        fetchSyncJobs();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [syncing]);

  // Update progress based on latest sync job
  useEffect(() => {
    if (syncJobs.length > 0) {
      const latestJob = syncJobs[0];
      if (latestJob.status === 'running' && latestJob.job_type === 'comprehensive_rate_limited_sync') {
        const metadata = latestJob.metadata || {};
        setSyncProgress({
          stage: metadata.current_stage || 'webinars',
          message: metadata.stage_message || 'Processing...',
          progress: latestJob.progress || 0,
          details: {
            webinars_found: metadata.webinars_found,
            webinars_synced: metadata.webinars_synced,
            detailed_sync_count: metadata.detailed_sync_count
          },
          apiRequestsUsed: metadata.api_requests_made,
          estimatedTimeRemaining: calculateEstimatedTime(latestJob.progress, latestJob.started_at)
        });
      } else if (latestJob.status === 'completed' && syncing) {
        setSyncProgress({
          stage: 'completed',
          message: 'Comprehensive sync completed successfully!',
          progress: 100,
          details: latestJob.metadata
        });
        setSyncing(false);
      } else if (latestJob.status === 'failed' && syncing) {
        setSyncProgress({
          stage: 'error',
          message: latestJob.error_message || 'Sync failed',
          progress: 0
        });
        setSyncing(false);
      }
    }
  }, [syncJobs, syncing]);

  const calculateEstimatedTime = (progress: number, startedAt: string): string => {
    if (progress <= 0) return 'Calculating...';
    
    const elapsed = Date.now() - new Date(startedAt).getTime();
    const totalEstimated = (elapsed / progress) * 100;
    const remaining = totalEstimated - elapsed;
    
    if (remaining <= 0) return 'Almost done...';
    
    const minutes = Math.ceil(remaining / (1000 * 60));
    return `~${minutes} min remaining`;
  };

  const fetchSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching sync logs:', error);
    }
  };

  const fetchSyncJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncJobs(data || []);
    } catch (error: any) {
      console.error('Error fetching sync jobs:', error);
    }
  };

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
      message: 'Starting comprehensive rate-limited sync...', 
      progress: 5,
      apiRequestsUsed: 0
    });
    
    try {
      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Unable to get organization information');

      // Check if user has an active Zoom connection
      const { data: connection } = await supabase
        .from('zoom_connections')
        .select('connection_status')
        .eq('user_id', user.id)
        .eq('connection_status', 'active')
        .single();

      if (!connection) {
        throw new Error('No active Zoom connection found. Please connect your Zoom account first.');
      }

      setSyncProgress({ 
        stage: 'webinars', 
        message: 'Starting comprehensive rate-limited sync...', 
        progress: 10,
        apiRequestsUsed: 0
      });

      // Start comprehensive rate-limited sync
      const syncResponse = await supabase.functions.invoke('zoom-comprehensive-sync', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      if (syncResponse.error) {
        throw new Error(syncResponse.error.message);
      }

      const result = syncResponse.data;
      console.log('Comprehensive rate-limited sync result:', result);

      // Success message will be handled by the useEffect that monitors sync jobs
      toast({
        title: "Comprehensive Sync Started",
        description: "Your data sync is running with intelligent rate limiting. This may take several minutes for large datasets.",
      });

      // Refresh logs after sync starts
      fetchSyncLogs();
      fetchSyncJobs();
      
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
    refreshLogs: fetchSyncLogs,
    refreshJobs: fetchSyncJobs,
  };
};
