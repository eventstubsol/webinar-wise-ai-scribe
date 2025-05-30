
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

interface ChunkResult {
  successful: number;
  failed: number;
  errors: any[];
  processed_count: number;
  total_participants_synced: number;
}

export function useChunkedMassResync() {
  const { user } = useAuth();
  const [isResyncing, setIsResyncing] = useState(false);
  const [progress, setProgress] = useState<ChunkedResyncProgress | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const processNextChunk = useCallback(async (jobId: string, chunkIndex: number): Promise<boolean> => {
    try {
      const { data, error: chunkError } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'chunked_mass_resync',
          job_id: jobId,
          chunk: chunkIndex
        }
      });
      
      if (chunkError) {
        throw new Error(chunkError.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update progress
      setProgress(data.progress);
      
      console.log(`[useChunkedMassResync] Chunk ${chunkIndex + 1} completed:`, data.chunk_results);
      
      return data.progress.is_completed;
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
        throw new Error(firstChunkError.message);
      }
      
      if (firstChunkData.error) {
        throw new Error(firstChunkData.error);
      }
      
      const jobId = firstChunkData.job_id;
      let currentProgress = firstChunkData.progress;
      setProgress(currentProgress);
      
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
      }
      
      // Get final results
      const { data: statusData, error: statusError } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'get_resync_status',
          job_id: jobId
        }
      });
      
      if (!statusError && statusData.success) {
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
      }
      
      console.log('[useChunkedMassResync] Chunked mass re-sync completed successfully');
      
    } catch (err) {
      console.error('[useChunkedMassResync] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      
      toast({
        title: "Chunked Mass Re-sync Failed",
        description: err instanceof Error ? err.message : "Failed to complete chunked mass re-sync",
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
