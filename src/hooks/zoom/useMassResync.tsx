
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useMassResync() {
  const { user } = useAuth();
  const [isResyncing, setIsResyncing] = useState(false);
  const [progress, setProgress] = useState<{
    processedWebinars: number;
    totalWebinars: number;
    currentWebinar: string;
    totalParticipants: number;
  } | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const startMassResync = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }
    
    setIsResyncing(true);
    setError(null);
    setResults(null);
    setProgress(null);
    
    try {
      console.log('[useMassResync] Starting mass re-sync...');
      
      const { data, error: resyncError } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'mass_resync'
        }
      });
      
      if (resyncError) {
        throw new Error(resyncError.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setResults(data.results);
      console.log('[useMassResync] Mass re-sync completed successfully:', data.results);
      
    } catch (err) {
      console.error('[useMassResync] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsResyncing(false);
    }
  };
  
  const validateSyncResults = async () => {
    if (!user) return null;
    
    try {
      // Get sync validation data
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('sync_type', 'mass_resync_all')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useMassResync] Error fetching validation data:', error);
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('[useMassResync] Validation error:', err);
      return null;
    }
  };
  
  return {
    isResyncing,
    progress,
    results,
    error,
    startMassResync,
    validateSyncResults
  };
}
