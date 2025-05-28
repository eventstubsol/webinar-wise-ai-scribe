
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
  stage: 'idle' | 'webinars' | 'participants' | 'chat' | 'polls' | 'qa' | 'registrations' | 'completed' | 'error';
  message: string;
  progress: number;
  details?: any;
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
    setSyncProgress({ stage: 'webinars', message: 'Starting comprehensive sync...', progress: 5 });
    
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

      setSyncProgress({ stage: 'webinars', message: 'Starting comprehensive data sync...', progress: 10 });

      // Start comprehensive sync
      const syncResponse = await supabase.functions.invoke('zoom-sync-all', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      if (syncResponse.error) {
        throw new Error(syncResponse.error.message);
      }

      const result = syncResponse.data;
      console.log('Comprehensive sync result:', result);

      setSyncProgress({ stage: 'completed', message: 'Comprehensive sync completed!', progress: 100, details: result.summary });

      // Show success message with details
      const summary = result.summary;
      toast({
        title: "Comprehensive Sync Completed",
        description: `Synced ${summary.webinars_synced} webinars with detailed data: ${summary.participants_synced} participants, ${summary.chat_messages_synced} messages, ${summary.polls_synced} polls, ${summary.qa_synced} Q&As, ${summary.registrations_synced} registrations.`,
      });

      // Refresh logs after successful sync
      setTimeout(() => {
        fetchSyncLogs();
        fetchSyncJobs();
        setSyncProgress({ stage: 'idle', message: '', progress: 0 });
      }, 3000);
      
    } catch (error: any) {
      console.error('Sync error:', error);
      
      setSyncProgress({ stage: 'error', message: 'Sync failed', progress: 0 });
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync webinar data. Please check your Zoom connection and try again.",
        variant: "destructive",
      });

      // Reset progress after error
      setTimeout(() => {
        setSyncProgress({ stage: 'idle', message: '', progress: 0 });
      }, 3000);
      
    } finally {
      setSyncing(false);
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
