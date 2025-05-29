
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RegistrationSyncJob {
  id: string;
  webinar_id: string;
  organization_id: string;
  zoom_webinar_id: string;
  status: string;
  total_expected: number;
  total_fetched: number;
  total_stored: number;
  error_count: number;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  metadata: any;
}

export const useRegistrationSync = () => {
  const { user } = useAuth();
  const [syncJobs, setSyncJobs] = useState<RegistrationSyncJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSyncJobs();
    }
  }, [user]);

  const fetchSyncJobs = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get user's organization_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) return;

      const { data, error } = await supabase
        .from('registration_sync_jobs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncJobs(data || []);
    } catch (error: any) {
      console.error('Error fetching registration sync jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getJobStatus = (job: RegistrationSyncJob) => {
    if (job.status === 'completed') {
      const successRate = job.total_fetched > 0 
        ? ((job.total_stored / job.total_fetched) * 100).toFixed(1)
        : '0';
      return {
        status: 'success',
        message: `${job.total_stored}/${job.total_fetched} registrations synced (${successRate}% success rate)`,
        details: job.metadata?.status_breakdown
      };
    } else if (job.status === 'failed') {
      return {
        status: 'error',
        message: job.last_error || 'Sync failed',
        details: null
      };
    } else if (job.status === 'running') {
      return {
        status: 'loading',
        message: `Syncing... ${job.total_fetched || 0} registrations fetched`,
        details: job.metadata?.current_status ? `Processing ${job.metadata.current_status} registrations` : null
      };
    } else {
      return {
        status: 'pending',
        message: 'Waiting to start...',
        details: null
      };
    }
  };

  const clearCompletedJobs = async () => {
    if (!user?.id) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) return;

      const { error } = await supabase
        .from('registration_sync_jobs')
        .delete()
        .eq('organization_id', profile.organization_id)
        .in('status', ['completed', 'failed']);

      if (error) throw error;
      
      await fetchSyncJobs();
    } catch (error: any) {
      console.error('Error clearing completed jobs:', error);
    }
  };

  return {
    syncJobs,
    loading,
    fetchSyncJobs,
    getJobStatus,
    clearCompletedJobs
  };
};
