
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ChunkResponse {
  success: boolean;
  chunk_completed: boolean;
  job_id: string;
  processed_count: number;
  error_count: number;
  total_processed: number;
  total_found: number;
  progress_percentage: number;
  has_next_chunk: boolean;
  next_chunk_token: string | null;
  processing_time_ms: number;
  summary: {
    webinars_in_chunk: number;
    webinars_processed: number;
    detailed_sync_scheduled: number;
    is_final_chunk: boolean;
  };
}

export const useChunkedSync = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [syncStats, setSyncStats] = useState<{
    totalFound: number;
    processed: number;
    errors: number;
    chunks: number;
  }>({
    totalFound: 0,
    processed: 0,
    errors: 0,
    chunks: 0
  });

  const processChunk = useCallback(async (chunkToken?: string): Promise<ChunkResponse | null> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Get user profile for organization_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Unable to get organization information');
    }

    const response = await supabase.functions.invoke('zoom-chunked-sync', {
      body: {
        organization_id: profile.organization_id,
        user_id: user.id,
        chunk_token: chunkToken
      }
    });

    if (response.error) {
      throw new Error(response.error.message || 'Chunk processing failed');
    }

    return response.data as ChunkResponse;
  }, [user?.id]);

  const startChunkedSync = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    if (syncing) {
      toast({
        title: "Sync in Progress",
        description: "A sync is already running. Please wait for it to complete.",
        variant: "default",
      });
      return;
    }

    setSyncing(true);
    setProgress(0);
    setCurrentChunk(0);
    setTotalProcessed(0);
    setSyncStats({
      totalFound: 0,
      processed: 0,
      errors: 0,
      chunks: 0
    });

    try {
      let chunkToken: string | null = null;
      let hasNextChunk = true;
      let chunkNumber = 0;
      
      toast({
        title: "Sync Started",
        description: "Starting chunked webinar data sync...",
      });

      while (hasNextChunk) {
        chunkNumber++;
        setCurrentChunk(chunkNumber);
        
        console.log(`Processing chunk ${chunkNumber}...`);
        
        const chunkResult = await processChunk(chunkToken);
        
        if (!chunkResult) {
          throw new Error('Failed to process chunk');
        }

        // Update progress and stats
        setProgress(chunkResult.progress_percentage);
        setTotalProcessed(chunkResult.total_processed);
        setSyncStats(prev => ({
          totalFound: chunkResult.total_found,
          processed: chunkResult.total_processed,
          errors: prev.errors + chunkResult.error_count,
          chunks: chunkNumber
        }));

        // Check if there's another chunk
        hasNextChunk = chunkResult.has_next_chunk;
        chunkToken = chunkResult.next_chunk_token;

        console.log(`Chunk ${chunkNumber} completed:`, {
          processed: chunkResult.processed_count,
          errors: chunkResult.error_count,
          progress: chunkResult.progress_percentage,
          hasNext: hasNextChunk
        });

        // Small delay between chunks to prevent overwhelming
        if (hasNextChunk) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Sync completed
      setSyncing(false);
      setProgress(100);

      toast({
        title: "Sync Complete",
        description: `Successfully synced ${totalProcessed} webinars across ${chunkNumber} chunks.`,
      });

    } catch (error: any) {
      console.error('Chunked sync error:', error);
      setSyncing(false);
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync webinar data. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.id, syncing, processChunk, totalProcessed]);

  return {
    syncing,
    progress,
    currentChunk,
    totalProcessed,
    syncStats,
    startChunkedSync
  };
};
