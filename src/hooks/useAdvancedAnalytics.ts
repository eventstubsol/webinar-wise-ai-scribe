
import { useState } from 'react';
import { useAnalyticsSummary } from './useAnalyticsSummary';
import { useEngagementTimeline } from './useEngagementTimeline';
import { useComparativeAnalytics } from './useComparativeAnalytics';
import { useAnalyticsGenerator } from './useAnalyticsGenerator';
import type { AnalyticsPeriod } from '@/types/analytics';

export const useAdvancedAnalytics = () => {
  const [selectedWebinarId, setSelectedWebinarId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>({
    type: 'monthly',
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const { data: analyticsSummary, isLoading: summaryLoading } = useAnalyticsSummary(selectedWebinarId);
  const { data: engagementTimeline, isLoading: timelineLoading } = useEngagementTimeline(selectedWebinarId);
  const { data: comparativeAnalytics, isLoading: comparativeLoading } = useComparativeAnalytics(selectedPeriod);
  
  const generateAnalyticsMutation = useAnalyticsGenerator();

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
