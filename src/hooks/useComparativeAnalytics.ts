
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { ComparativeAnalytics, AnalyticsPeriod } from '@/types/analytics';

export const useComparativeAnalytics = (selectedPeriod: AnalyticsPeriod) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['comparative-analytics', selectedPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webinar_comparative_analytics')
        .select('*')
        .eq('period_type', selectedPeriod.type)
        .eq('period_start', selectedPeriod.start)
        .eq('period_end', selectedPeriod.end)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as ComparativeAnalytics | null;
    },
    enabled: !!user
  });
};
