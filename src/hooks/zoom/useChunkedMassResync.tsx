
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ChunkedResyncProgress {
  job_id: string;
  current_chunk: number;
  total_chunks: number;
  processed_webinars: number;
  total_webinars: number;
  successful_webinars: number;
  failed_webinars: number;
  is_completed: boolean;
  progress_percentage: number;
}

export function useChunkedMassResync() {
  const { user } = useAuth();
  const [isResyncing, setIsResyncing] = useState(false);
  const [progress, setProgress] = useState<ChunkedResyncProgress | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const processNextChunk = useCallback(async (jobId: string, chunkIndex: number): Promise<boolean> => {
    try {
      console.log(`[useChunkedMassResync] Processing chunk ${chunkIndex + 1}...`);
      
      const { data, error: chunkError } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'chunked_mass_resync',
          job_id: jobId,
          chunk: chunkIndex
        }
      });
      
      if (chunkError) {
        console.error('[useChunkedMassResync] Chunk error:', chunkError);
        throw new Error(chunkError.message || 'Failed to process chunk');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Chunk processing failed');
      }
      
      // Update progress
      if (data.progress) {
        setProgress(data.progress);
      }
      
      console.log(`[useChunkedMassResync] Chunk ${chunkIndex + 1} completed:`, data.chunk_results);
      
      return data.progress?.is_completed || false;
    } catch (err) {
      console.error(`[useChunkedMassResync] Chunk ${chunkIndex} error:`, err);
      throw err;
    }
  }, []);
  
  const startChunkedMassResync = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }
    
    setIsResyncing(true);
    setError(null);
    setResults(null);
    setProgress(null);
    
    try {
      console.log('[useChunkedMassResync] Starting chunked mass re-sync...');
      
      toast({
        title: "Chunked Mass Re-sync Started",
        description: "Starting chunked historical data recovery for all webinars...",
      });

      // Start the first chunk (this creates the job)
      const { data: firstChunkData, error: firstChunkError } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'chunked_mass_resync',
          chunk: 0
        }
      });
      
      if (firstChunkError) {
        throw new Error(firstChunkError.message || 'Failed to start chunked resync');
      }
      
      if (!firstChunkData.success) {
        throw new Error(firstChunkData.error || 'Failed to start chunked resync');
      }
      
      const jobId = firstChunkData.job_id;
      let currentProgress = firstChunkData.progress;
      setProgress(currentProgress);
      
      // If completed in first chunk, we're done
      if (currentProgress.is_completed) {
        const finalResults = {
          total_webinars: currentProgress.total_webinars,
          successful_webinars: currentProgress.successful_webinars,
          failed_webinars: currentProgress.failed_webinars,
          errors: []
        };
        
        setResults(finalResults);
        
        toast({
          title: "Chunked Mass Re-sync Completed",
          description: `Successfully processed ${finalResults.successful_webinars}/${finalResults.total_webinars} webinars.`,
        });
        
        return;
      }
      
      // Continue processing chunks until completed
      let chunkIndex = 1;
      while (!currentProgress.is_completed && chunkIndex < currentProgress.total_chunks) {
        console.log(`[useChunkedMassResync] Processing chunk ${chunkIndex + 1}/${currentProgress.total_chunks}`);
        
        // Add delay between chunks to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const isCompleted = await processNextChunk(jobId, chunkIndex);
        
        if (isCompleted) {
          break;
        }
        
        chunkIndex++;
        
        // Safety check to prevent infinite loops
        if (chunkIndex > 50) {
          throw new Error('Maximum chunk limit reached');
        }
      }
      
      // Get final results
      const { data: statusData, error: statusError } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'get_resync_status',
          job_id: jobId
        }
      });
      
      if (!statusError && statusData?.success && statusData.job) {
        const finalResults = {
          total_webinars: statusData.job.total_webinars,
          successful_webinars: statusData.job.successful_webinars,
          failed_webinars: statusData.job.failed_webinars,
          errors: statusData.job.errors || []
        };
        
        setResults(finalResults);
        
        toast({
          title: "Chunked Mass Re-sync Completed",
          description: `Successfully processed ${finalResults.successful_webinars}/${finalResults.total_webinars} webinars.`,
        });
      } else {
        // Fallback if status fetch fails
        const fallbackResults = {
          total_webinars: currentProgress.total_webinars,
          successful_webinars: currentProgress.successful_webinars,
          failed_webinars: currentProgress.failed_webinars,
          errors: []
        };
        
        setResults(fallbackResults);
        
        toast({
          title: "Chunked Mass Re-sync Completed",
          description: `Processing completed. Check results for details.`,
        });
      }
      
      console.log('[useChunkedMassResync] Chunked mass re-sync completed successfully');
      
    } catch (err) {
      console.error('[useChunkedMassResync] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Chunked Mass Re-sync Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResyncing(false);
    }
  };
  
  return {
    isResyncing,
    progress,
    results,
    error,
    startChunkedMassResync
  };
}
