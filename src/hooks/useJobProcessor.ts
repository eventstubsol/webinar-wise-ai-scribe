
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export const useJobProcessor = () => {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const processJobs = async (forceProcess = false) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      console.log('Triggering enhanced job processor...');
      
      const { data, error } = await supabase.functions.invoke('zoom-job-processor', {
        body: { 
          source: forceProcess ? 'manual_forced' : 'manual',
          user_id: user.id,
          force_process: forceProcess,
          enhanced_processing: true
        }
      });

      if (error) {
        console.error('Job processor error:', error);
        throw new Error(error.message || 'Job processor failed');
      }

      console.log('Enhanced job processor result:', data);

      if (data?.success) {
        const { jobs_processed, successful_jobs, failed_jobs, pending_jobs } = data;
        
        if (jobs_processed === 0 && pending_jobs === 0) {
          toast({
            title: "No Jobs to Process",
            description: "All sync jobs are already complete.",
          });
        } else if (pending_jobs > 0) {
          toast({
            title: "Jobs Processing",
            description: `Started processing ${pending_jobs} pending jobs. Background processing continues automatically.`,
          });
        } else {
          toast({
            title: "Jobs Processed",
            description: `Processed ${jobs_processed} jobs: ${successful_jobs} successful, ${failed_jobs} failed.`,
          });
        }
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }

    } catch (error: any) {
      console.error('Job processing failed:', error);
      toast({
        title: "Job Processing Failed",
        description: error.message || "Failed to process sync jobs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const forceProcessStuckJobs = async () => {
    console.log('Force processing stuck jobs...');
    await processJobs(true);
  };

  return {
    processing,
    processJobs,
    forceProcessStuckJobs
  };
};
