
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { AggregatedBusinessMetrics } from '@/types/business';

export const useAggregatedBusinessMetrics = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['aggregated-business-metrics'],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('webinar_business_metrics')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate aggregated metrics
      const totalCost = data.reduce((sum, m) => sum + (m.total_cost || 0), 0);
      const totalRevenue = data.reduce((sum, m) => sum + (m.direct_revenue || 0) + (m.attributed_revenue || 0), 0);
      const totalLeads = data.reduce((sum, m) => sum + (m.leads_generated || 0), 0);
      const totalQualifiedLeads = data.reduce((sum, m) => sum + (m.qualified_leads || 0), 0);
      const averageROI = data.length > 0 
        ? data.reduce((sum, m) => sum + (m.roi_percentage || 0), 0) / data.length 
        : 0;
      const averageConversionRate = data.length > 0
        ? data.reduce((sum, m) => sum + (m.conversion_rate || 0), 0) / data.length
        : 0;

      return {
        totalCost,
        totalRevenue,
        totalLeads,
        totalQualifiedLeads,
        averageROI,
        averageConversionRate,
        totalWebinars: data.length,
        netProfit: totalRevenue - totalCost,
        overallROI: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0
      } as AggregatedBusinessMetrics;
    },
    enabled: !!user
  });
};
