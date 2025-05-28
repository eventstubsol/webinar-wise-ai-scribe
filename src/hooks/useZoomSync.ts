
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

interface SyncProgress {
  stage: 'idle' | 'webinars' | 'participants' | 'completed' | 'error';
  message: string;
  progress: number;
}

export const useZoomSync = () => {
  const { user } = useAuth();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });

  useEffect(() => {
    if (user) {
      fetchSyncLogs();
    }
  }, [user]);

  const fetchSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching sync logs:', error);
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
    setSyncProgress({ stage: 'webinars', message: 'Starting webinar sync...', progress: 10 });
    
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

      setSyncProgress({ stage: 'webinars', message: 'Syncing webinars from Zoom...', progress: 25 });

      // Sync webinars
      const webinarsResponse = await supabase.functions.invoke('zoom-sync-webinars', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user.id 
        }
      });

      if (webinarsResponse.error) {
        throw new Error(webinarsResponse.error.message);
      }

      const webinarsResult = webinarsResponse.data;
      console.log('Webinars sync result:', webinarsResult);

      setSyncProgress({ stage: 'participants', message: 'Getting webinar list...', progress: 50 });

      // Get recently synced webinars for participant sync
      const { data: webinars } = await supabase
        .from('webinars')
        .select('id, zoom_webinar_id, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5); // Sync participants for 5 most recent webinars

      setSyncProgress({ stage: 'participants', message: 'Syncing participant data...', progress: 60 });

      let participantsSynced = 0;
      const totalWebinars = webinars?.length || 0;

      // Sync participants for each webinar
      for (let i = 0; i < totalWebinars; i++) {
        const webinar = webinars![i];
        
        if (webinar.zoom_webinar_id) {
          setSyncProgress({ 
            stage: 'participants', 
            message: `Syncing participants for "${webinar.title}"...`, 
            progress: 60 + (i / totalWebinars) * 30 
          });

          try {
            const participantsResponse = await supabase.functions.invoke('zoom-sync-participants', {
              body: {
                organization_id: profile.organization_id,
                user_id: user.id,
                webinar_id: webinar.id,
                zoom_webinar_id: webinar.zoom_webinar_id,
              }
            });

            if (participantsResponse.data?.participants_synced) {
              participantsSynced += participantsResponse.data.participants_synced;
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error(`Error syncing participants for webinar ${webinar.id}:`, error);
            // Continue with other webinars even if one fails
          }
        }
      }

      setSyncProgress({ stage: 'completed', message: 'Sync completed successfully!', progress: 100 });

      // Show success message with details
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${webinarsResult.webinars_synced || 0} webinars and ${participantsSynced} participants.`,
      });

      // Refresh logs after successful sync
      setTimeout(() => {
        fetchSyncLogs();
        setSyncProgress({ stage: 'idle', message: '', progress: 0 });
      }, 2000);
      
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
    syncing,
    syncProgress,
    syncWebinarData,
    refreshLogs: fetchSyncLogs,
  };
};
