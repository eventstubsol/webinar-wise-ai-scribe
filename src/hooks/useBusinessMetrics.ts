
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface BusinessMetrics {
  id: string;
  webinar_id: string;
  organization_id: string;
  production_cost: number;
  marketing_cost: number;
  platform_cost: number;
  total_cost: number;
  direct_revenue: number;
  attributed_revenue: number;
  pipeline_value: number;
  leads_generated: number;
  qualified_leads: number;
  conversion_rate: number;
  roi_percentage: number;
  cost_per_attendee: number;
  cost_per_lead: number;
  attribution_model: string;
  attribution_window_days: number;
  created_at: string;
  updated_at: string;
}

interface BusinessMetricsInput {
  webinar_id: string;
  production_cost?: number;
  marketing_cost?: number;
  platform_cost?: number;
  direct_revenue?: number;
  attributed_revenue?: number;
  pipeline_value?: number;
  leads_generated?: number;
  qualified_leads?: number;
  attribution_model?: string;
  attribution_window_days?: number;
}

export const useBusinessMetrics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWebinarId, setSelectedWebinarId] = useState<string | null>(null);

  // Fetch business metrics for a specific webinar
  const { data: businessMetrics, isLoading } = useQuery({
    queryKey: ['business-metrics', selectedWebinarId],
    queryFn: async () => {
      if (!selectedWebinarId) return null;
      
      const { data, error } = await supabase
        .from('webinar_business_metrics')
        .select('*')
        .eq('webinar_id', selectedWebinarId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as BusinessMetrics | null;
    },
    enabled: !!selectedWebinarId && !!user
  });

  // Fetch aggregated business metrics for organization
  const { data: aggregatedMetrics } = useQuery({
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
      };
    },
    enabled: !!user
  });

  // Create or update business metrics
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

  // Calculate ROI for specific metrics
  const calculateROI = (revenue: number, cost: number): number => {
    if (cost === 0) return 0;
    return ((revenue - cost) / cost) * 100;
  };

  // Calculate payback period
  const calculatePaybackPeriod = (cost: number, monthlyRevenue: number): number => {
    if (monthlyRevenue === 0) return Infinity;
    return cost / monthlyRevenue;
  };

  return {
    selectedWebinarId,
    setSelectedWebinarId,
    businessMetrics,
    aggregatedMetrics,
    isLoading,
    saving: saveMetricsMutation.isPending,
    saveMetrics: saveMetricsMutation.mutate,
    calculateROI,
    calculatePaybackPeriod
  };
};
