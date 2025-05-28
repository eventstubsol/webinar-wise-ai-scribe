
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Panelist {
  id: string;
  webinar_id: string;
  zoom_panelist_id?: string;
  email: string;
  name?: string;
  status: string;
  joined_at?: string;
  left_at?: string;
  duration_minutes: number;
  invited_at?: string;
  created_at: string;
  updated_at: string;
}

export const usePanelistData = (webinarId?: string) => {
  const { user } = useAuth();
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPanelists = async () => {
    if (!user || !webinarId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('webinar_panelists')
        .select('*')
        .eq('webinar_id', webinarId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching panelists:', fetchError);
        throw fetchError;
      }

      setPanelists(data || []);
      console.log(`Fetched ${data?.length || 0} panelists for webinar ${webinarId}`);
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch panelist data';
      setError(errorMessage);
      console.error('Error fetching panelist data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanelists();
  }, [user, webinarId]);

  const refreshData = async () => {
    await fetchPanelists();
  };

  return { 
    panelists, 
    loading, 
    error, 
    refreshData,
    totalCount: panelists.length,
    joinedCount: panelists.filter(p => p.status === 'joined').length,
    totalDuration: panelists.reduce((sum, p) => sum + p.duration_minutes, 0)
  };
};
