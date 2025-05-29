
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Target, Clock, Award } from 'lucide-react';
import type { AnalyticsSummary } from '@/types/analytics';

interface KPICardsProps {
  analyticsSummary: AnalyticsSummary;
}

export const KPICards = ({ analyticsSummary }: KPICardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analyticsSummary.attendance_rate}%</div>
          <p className="text-xs text-muted-foreground">
            {analyticsSummary.total_attendees} of {analyticsSummary.total_registrants} registered
          </p>
          <Progress value={analyticsSummary.attendance_rate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analyticsSummary.average_engagement_score}</div>
          <p className="text-xs text-muted-foreground">
            Average interactions per attendee
          </p>
          <Badge variant={analyticsSummary.average_engagement_score > 5 ? "default" : "secondary"} className="mt-2">
            {analyticsSummary.average_engagement_score > 5 ? "High" : "Moderate"} Engagement
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analyticsSummary.completion_rate}%</div>
          <p className="text-xs text-muted-foreground">
            Average: {Math.round(analyticsSummary.average_watch_time_minutes)}min watch time
          </p>
          <Progress value={analyticsSummary.completion_rate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analyticsSummary.overall_performance_score}</div>
          <p className="text-xs text-muted-foreground">
            Overall webinar performance
          </p>
          <Badge variant={analyticsSummary.overall_performance_score > 75 ? "default" : "secondary"} className="mt-2">
            {analyticsSummary.overall_performance_score > 75 ? "Excellent" : "Good"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};
