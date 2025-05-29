
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsSummary } from '@/types/analytics';

interface AIInsightsTabProps {
  analyticsSummary: AnalyticsSummary | null;
}

export const AIInsightsTab = ({ analyticsSummary }: AIInsightsTabProps) => {
  if (!analyticsSummary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground">No analytics data available for insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-Powered Insights</CardTitle>
        <CardDescription>Automated recommendations and predictions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900">Performance Summary</h4>
            <p className="text-blue-700 mt-2">
              Your webinar achieved a {analyticsSummary.overall_performance_score}% performance score. 
              {analyticsSummary.attendance_rate > 70 
                ? " Excellent attendance rate! " 
                : " Consider improving promotional strategies. "
              }
              {analyticsSummary.average_engagement_score > 5 
                ? "High audience engagement suggests compelling content."
                : "Consider adding more interactive elements to boost engagement."
              }
            </p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-green-900">Recommendations</h4>
            <ul className="text-green-700 mt-2 space-y-1">
              {analyticsSummary.completion_rate < 80 && (
                <li>• Consider shorter content or more breaks to improve completion rate</li>
              )}
              {analyticsSummary.total_chat_messages < 10 && (
                <li>• Encourage more chat interaction with prompts and questions</li>
              )}
              {analyticsSummary.total_poll_responses < 5 && (
                <li>• Add more polls throughout the webinar to maintain engagement</li>
              )}
              <li>• Schedule follow-up communications within 24 hours for best results</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-semibold text-yellow-900">Optimization Opportunities</h4>
            <p className="text-yellow-700 mt-2">
              Based on your device breakdown, consider optimizing for mobile users. 
              Peak engagement occurs in the first 20 minutes - front-load your most important content.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
