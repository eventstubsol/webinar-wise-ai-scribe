
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AnalyticsSummary {
  id: string;
  webinar_id: string;
  organization_id: string;
  analytics_date: string;
  total_registrants: number;
  total_attendees: number;
  attendance_rate: number;
  peak_attendance: number;
  average_attendance: number;
  average_engagement_score: number;
  total_chat_messages: number;
  total_poll_responses: number;
  total_qa_questions: number;
  actual_duration_minutes: number;
  average_watch_time_minutes: number;
  completion_rate: number;
  device_breakdown: Record<string, number>;
  geographic_breakdown: Record<string, number>;
  overall_performance_score: number;
  engagement_performance_score: number;
  retention_performance_score: number;
  created_at: string;
  updated_at: string;
}

interface EngagementTimelinePoint {
  id: string;
  webinar_id: string;
  organization_id: string;
  time_interval: number;
  active_attendees: number;
  engagement_level: number;
  chat_activity: number;
  poll_activity: number;
  qa_activity: number;
  significant_events: any[];
  created_at: string;
}

interface ComparativeAnalytics {
  id: string;
  organization_id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  total_webinars: number;
  total_registrants: number;
  total_attendees: number;
  average_attendance_rate: number;
  average_engagement_score: number;
  attendance_trend: number;
  engagement_trend: number;
  registration_trend: number;
  top_performing_webinars: any[];
  engagement_hotspots: any[];
  created_at: string;
  updated_at: string;
}

export const useAdvancedAnalytics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWebinarId, setSelectedWebinarId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{
    type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    start: string;
    end: string;
  }>({
    type: 'monthly',
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Fetch analytics summary for a specific webinar
  const { data: analyticsSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary', selectedWebinarId],
    queryFn: async () => {
      if (!selectedWebinarId) return null;
      
      const { data, error } = await supabase
        .from('webinar_analytics_summary')
        .select('*')
        .eq('webinar_id', selectedWebinarId)
        .order('analytics_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as AnalyticsSummary | null;
    },
    enabled: !!selectedWebinarId && !!user
  });

  // Fetch engagement timeline for a specific webinar
  const { data: engagementTimeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['engagement-timeline', selectedWebinarId],
    queryFn: async () => {
      if (!selectedWebinarId) return [];
      
      const { data, error } = await supabase
        .from('webinar_engagement_timeline')
        .select('*')
        .eq('webinar_id', selectedWebinarId)
        .order('time_interval', { ascending: true });

      if (error) throw error;
      return data as EngagementTimelinePoint[];
    },
    enabled: !!selectedWebinarId && !!user
  });

  // Fetch comparative analytics
  const { data: comparativeAnalytics, isLoading: comparativeLoading } = useQuery({
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

  // Generate analytics mutation
  const generateAnalyticsMutation = useMutation({
    mutationFn: async (params: {
      webinar_id?: string;
      analytics_type: 'summary' | 'timeline' | 'comparative';
      period_start?: string;
      period_end?: string;
      period_type?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    }) => {
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

  // Auto-generate analytics for selected webinar
  const generateWebinarAnalytics = async (webinarId: string) => {
    try {
      await generateAnalyticsMutation.mutateAsync({
        webinar_id: webinarId,
        analytics_type: 'summary'
      });

      await generateAnalyticsMutation.mutateAsync({
        webinar_id: webinarId,
        analytics_type: 'timeline'
      });
    } catch (error) {
      console.error('Error generating webinar analytics:', error);
    }
  };

  // Generate comparative analytics
  const generateComparativeAnalytics = async () => {
    try {
      await generateAnalyticsMutation.mutateAsync({
        analytics_type: 'comparative',
        period_type: selectedPeriod.type,
        period_start: selectedPeriod.start,
        period_end: selectedPeriod.end
      });
    } catch (error) {
      console.error('Error generating comparative analytics:', error);
    }
  };

  return {
    selectedWebinarId,
    setSelectedWebinarId,
    selectedPeriod,
    setSelectedPeriod,
    analyticsSummary,
    engagementTimeline,
    comparativeAnalytics,
    summaryLoading,
    timelineLoading,
    comparativeLoading,
    generating: generateAnalyticsMutation.isPending,
    generateWebinarAnalytics,
    generateComparativeAnalytics,
    generateAnalytics: generateAnalyticsMutation.mutate
  };
};
