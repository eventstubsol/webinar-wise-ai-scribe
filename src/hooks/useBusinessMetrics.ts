
import { useState } from 'react';
import { useIndividualBusinessMetrics } from './useIndividualBusinessMetrics';
import { useAggregatedBusinessMetrics } from './useAggregatedBusinessMetrics';
import { useBusinessMetricsMutations } from './useBusinessMetricsMutations';
import { calculateROI, calculatePaybackPeriod } from '@/utils/businessCalculations';

export const useBusinessMetrics = () => {
  const [selectedWebinarId, setSelectedWebinarId] = useState<string | null>(null);

  const { data: businessMetrics, isLoading } = useIndividualBusinessMetrics(selectedWebinarId);
  const { data: aggregatedMetrics } = useAggregatedBusinessMetrics();
  const { saveMetrics, saving } = useBusinessMetricsMutations();

  return {
    selectedWebinarId,
    setSelectedWebinarId,
    businessMetrics,
    aggregatedMetrics,
    isLoading,
    saving,
    saveMetrics,
    calculateROI,
    calculatePaybackPeriod
  };
};
