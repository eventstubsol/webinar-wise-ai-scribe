
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { useWebinarData } from '@/hooks/useWebinarData';
import { KPICards } from './analytics/KPICards';
import { InteractionBreakdown } from './analytics/InteractionBreakdown';
import { EngagementTimelineTab } from './analytics/EngagementTimelineTab';
import { AudienceAnalyticsTab } from './analytics/AudienceAnalyticsTab';
import { ComparativeAnalyticsTab } from './analytics/ComparativeAnalyticsTab';
import { AIInsightsTab } from './analytics/AIInsightsTab';

const AdvancedAnalyticsDashboard = () => {
  const {
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
    generating,
    generateWebinarAnalytics,
    generateComparativeAnalytics
  } = useAdvancedAnalytics();

  const { webinars, loading: webinarsLoading } = useWebinarData();

  const handleWebinarSelect = async (webinarId: string) => {
    setSelectedWebinarId(webinarId);
    await generateWebinarAnalytics(webinarId);
  };

  const handlePeriodChange = (period: any) => {
    setSelectedPeriod(period);
    generateComparativeAnalytics();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics & Insights</h1>
          <p className="text-gray-600 mt-2">Deep dive into webinar performance and audience engagement</p>
        </div>
        
        <div className="flex gap-4">
          <Select value={selectedWebinarId || ""} onValueChange={handleWebinarSelect}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a webinar" />
            </SelectTrigger>
            <SelectContent>
              {webinars?.map((webinar) => (
                <SelectItem key={webinar.id} value={webinar.id}>
                  {webinar.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {generating && (
            <Button disabled>
              Generating Analytics...
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="comparative">Comparative</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {analyticsSummary && (
            <>
              <KPICards analyticsSummary={analyticsSummary} />
              <InteractionBreakdown analyticsSummary={analyticsSummary} />
            </>
          )}

          {!analyticsSummary && !summaryLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground">Select a webinar to view detailed analytics</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <EngagementTimelineTab engagementTimeline={engagementTimeline} />
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          <AudienceAnalyticsTab analyticsSummary={analyticsSummary} />
        </TabsContent>

        <TabsContent value="comparative" className="space-y-6">
          <ComparativeAnalyticsTab 
            comparativeAnalytics={comparativeAnalytics}
            selectedPeriod={selectedPeriod}
            generating={generating}
            onPeriodChange={handlePeriodChange}
            onGenerateReport={generateComparativeAnalytics}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <AIInsightsTab analyticsSummary={analyticsSummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
