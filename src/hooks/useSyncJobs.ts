
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SyncJob } from '@/types/sync';

export const useSyncJobs = () => {
  const { user } = useAuth();
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);

  useEffect(() => {
    if (user) {
      fetchSyncJobs();
    }
  }, [user]);

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

  return {
    syncJobs,
    fetchSyncJobs,
    refreshJobs: fetchSyncJobs
  };
};
