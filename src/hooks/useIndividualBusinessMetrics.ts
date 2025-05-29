
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { BusinessMetrics } from '@/types/business';

export const useIndividualBusinessMetrics = (webinarId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['business-metrics', webinarId],
    queryFn: async () => {
      if (!webinarId) return null;
      
      const { data, error } = await supabase
        .from('webinar_business_metrics')
        .select('*')
        .eq('webinar_id', webinarId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as BusinessMetrics | null;
    },
    enabled: !!webinarId && !!user
  });
};
