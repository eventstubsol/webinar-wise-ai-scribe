
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export const useJobRecovery = () => {
  const { user } = useAuth();
  const [recovering, setRecovering] = useState(false);

  const restartStuckJobs = async () => {
    if (!user?.id) return;

    setRecovering(true);
    try {
      console.log('Attempting to restart stuck jobs...');

      // Find jobs stuck in pending/running state for more than 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: stuckJobs, error: fetchError } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'running'])
        .lt('started_at', thirtyMinutesAgo);

      if (fetchError) {
        console.error('Error fetching stuck jobs:', fetchError);
        throw fetchError;
      }

      if (!stuckJobs || stuckJobs.length === 0) {
        toast({
          title: "No Stuck Jobs",
          description: "All jobs are running normally.",
        });
        return { restarted: 0 };
      }

      console.log(`Found ${stuckJobs.length} potentially stuck jobs`);

      // Reset stuck jobs to pending with updated timestamp
      const { error: updateError } = await supabase
        .from('sync_jobs')
        .update({
          status: 'pending',
          started_at: new Date().toISOString(),
          error_message: null,
          metadata: {
            ...(stuckJobs[0]?.metadata || {}),
            restarted_at: new Date().toISOString(),
            restart_reason: 'Automatic recovery from stuck state'
          }
        })
        .in('id', stuckJobs.map(job => job.id));

      if (updateError) {
        console.error('Error updating stuck jobs:', updateError);
        throw updateError;
      }

      // Trigger job processor to handle the restarted jobs
      console.log('Triggering job processor for restarted jobs...');
      const { error: processError } = await supabase.functions.invoke('zoom-job-processor', {
        body: { 
          source: 'job_recovery',
          user_id: user.id,
          force_process: true
        }
      });

      if (processError) {
        console.warn('Job processor trigger warning:', processError);
        // Don't throw here as the jobs are restarted, processor will pick them up
      }

      toast({
        title: "Jobs Restarted",
        description: `Successfully restarted ${stuckJobs.length} stuck jobs.`,
      });

      return { restarted: stuckJobs.length };

    } catch (error: any) {
      console.error('Job recovery error:', error);
      toast({
        title: "Recovery Failed",
        description: error.message || "Failed to restart stuck jobs.",
        variant: "destructive",
      });
      return { restarted: 0 };
    } finally {
      setRecovering(false);
    }
  };

  const cleanupCompletedJobs = async () => {
    if (!user?.id) return;

    try {
      // Archive jobs completed more than 24 hours ago
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('sync_jobs')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .lt('completed_at', oneDayAgo);

      if (error) throw error;

      console.log('Cleaned up old completed jobs');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  return {
    recovering,
    restartStuckJobs,
    cleanupCompletedJobs
  };
};
