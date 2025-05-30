
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface MassResyncResults {
  total_webinars: number;
  successful_webinars: number;
  failed_webinars: number;
  total_participants_synced: number;
  total_instances_processed: number;
  errors: any[];
  detailed_results: any[];
}

export const useMassResync = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<MassResyncResults | null>(null);

  const startMassResync = async () => {
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
        description: "A mass re-sync is already running. Please wait for it to complete.",
        variant: "default",
      });
      return;
    }

    setSyncing(true);
    setResults(null);
    
    try {
      console.log('Starting mass re-sync for user:', user.id);
      
      toast({
        title: "Mass Re-sync Started",
        description: "Starting complete historical data recovery for all webinars...",
      });

      const { data, error } = await supabase.functions.invoke('zoom-api', {
        body: { 
          action: 'mass_resync'
        }
      });

      if (error) {
        console.error('Mass re-sync error:', error);
        throw new Error(error.message || 'Mass re-sync failed');
      }

      const result = data;
      console.log('Mass re-sync result:', result);

      if (result && result.success) {
        setResults(result.results);
        
        toast({
          title: "Mass Re-sync Completed",
          description: `Successfully processed ${result.results.successful_webinars}/${result.results.total_webinars} webinars with ${result.results.total_participants_synced} total participants.`,
        });
      } else {
        throw new Error(result?.error || 'Unknown error occurred during mass re-sync');
      }
      
    } catch (error: any) {
      console.error('Mass re-sync failed:', error);
      
      toast({
        title: "Mass Re-sync Failed",
        description: error.message || "Failed to complete mass re-sync",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncing,
    results,
    startMassResync
  };
};
