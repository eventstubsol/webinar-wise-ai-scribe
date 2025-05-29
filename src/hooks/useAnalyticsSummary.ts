
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { AnalyticsSummary } from '@/types/analytics';

export const useAnalyticsSummary = (webinarId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics-summary', webinarId],
    queryFn: async () => {
      if (!webinarId) return null;
      
      const { data, error } = await supabase
        .from('webinar_analytics_summary')
        .select('*')
        .eq('webinar_id', webinarId)
        .order('analytics_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as AnalyticsSummary | null;
    },
    enabled: !!webinarId && !!user
  });
};
