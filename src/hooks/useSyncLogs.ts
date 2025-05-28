
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SyncLog } from '@/types/sync';

export const useSyncLogs = () => {
  const { user } = useAuth();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

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
        .limit(20);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching sync logs:', error);
    }
  };

  return {
    syncLogs,
    fetchSyncLogs,
    refreshLogs: fetchSyncLogs
  };
};
