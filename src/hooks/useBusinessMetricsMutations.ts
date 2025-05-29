
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { BusinessMetricsInput } from '@/types/business';

export const useBusinessMetricsMutations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const saveMetricsMutation = useMutation({
    mutationFn: async (metrics: BusinessMetricsInput) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      // Calculate derived metrics
      const totalCost = (metrics.production_cost || 0) + (metrics.marketing_cost || 0) + (metrics.platform_cost || 0);
      const totalRevenue = (metrics.direct_revenue || 0) + (metrics.attributed_revenue || 0);
      const conversionRate = metrics.leads_generated && metrics.qualified_leads 
        ? (metrics.qualified_leads / metrics.leads_generated) * 100 
        : 0;
      const roiPercentage = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

      // Get attendee count for cost calculations
      const { data: attendeesCount } = await supabase
        .from('attendees')
        .select('id', { count: 'exact' })
        .eq('webinar_id', metrics.webinar_id);

      const costPerAttendee = totalCost > 0 && attendeesCount 
        ? totalCost / attendeesCount.length 
        : 0;
      const costPerLead = totalCost > 0 && metrics.leads_generated 
        ? totalCost / metrics.leads_generated 
        : 0;

      const fullMetrics = {
        ...metrics,
        organization_id: profile.organization_id,
        total_cost: totalCost,
        conversion_rate: conversionRate,
        roi_percentage: roiPercentage,
        cost_per_attendee: costPerAttendee,
        cost_per_lead: costPerLead,
        attribution_model: metrics.attribution_model || 'last_touch',
        attribution_window_days: metrics.attribution_window_days || 30
      };

      // Check if metrics already exist
      const { data: existing } = await supabase
        .from('webinar_business_metrics')
        .select('id')
        .eq('webinar_id', metrics.webinar_id)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('webinar_business_metrics')
          .update(fullMetrics)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('webinar_business_metrics')
          .insert(fullMetrics)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated-business-metrics'] });
    }
  });

  return {
    saveMetrics: saveMetricsMutation.mutate,
    saving: saveMetricsMutation.isPending
  };
};
