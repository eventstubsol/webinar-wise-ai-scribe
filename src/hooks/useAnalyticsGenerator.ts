
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface GenerateAnalyticsParams {
  webinar_id?: string;
  analytics_type: 'summary' | 'timeline' | 'comparative';
  period_start?: string;
  period_end?: string;
  period_type?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export const useAnalyticsGenerator = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateAnalyticsParams) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      const { data, error } = await supabase.functions.invoke('analytics-processor', {
        body: {
          organization_id: profile.organization_id,
          ...params
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('Analytics generated successfully:', data);
      
      // Invalidate relevant queries
      if (variables.analytics_type === 'summary' && variables.webinar_id) {
        queryClient.invalidateQueries({ queryKey: ['analytics-summary', variables.webinar_id] });
      }
      if (variables.analytics_type === 'timeline' && variables.webinar_id) {
        queryClient.invalidateQueries({ queryKey: ['engagement-timeline', variables.webinar_id] });
      }
      if (variables.analytics_type === 'comparative') {
        queryClient.invalidateQueries({ queryKey: ['comparative-analytics'] });
      }
    }
  });
};
