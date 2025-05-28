
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

export const useZoomSync = () => {
  const { user } = useAuth();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);

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
    setSyncing(true);
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user?.id)
        .single();

      if (!profile) throw new Error('Unable to get organization information');

      const webinarsResponse = await supabase.functions.invoke('zoom-sync-webinars', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user?.id 
        }
      });

      if (webinarsResponse.error) {
        throw new Error(webinarsResponse.error.message);
      }

      const { data: webinars } = await supabase
        .from('webinars')
        .select('id, zoom_webinar_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      for (const webinar of webinars || []) {
        if (webinar.zoom_webinar_id) {
          await supabase.functions.invoke('zoom-sync-participants', {
            body: {
              organization_id: profile.organization_id,
              user_id: user?.id,
              webinar_id: webinar.id,
              zoom_webinar_id: webinar.zoom_webinar_id,
            }
          });
        }
      }

      toast({
        title: "Success",
        description: "Webinar data synchronized successfully",
      });

      fetchSyncLogs();
      
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync webinar data",
        variant: "destructive",
      });
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncLogs,
    syncing,
    syncWebinarData,
    refreshLogs: fetchSyncLogs,
  };
};
