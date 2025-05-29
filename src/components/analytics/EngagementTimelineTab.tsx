
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import type { EngagementTimelinePoint } from '@/types/analytics';

interface EngagementTimelineTabProps {
  engagementTimeline: EngagementTimelinePoint[] | undefined;
}

export const EngagementTimelineTab = ({ engagementTimeline }: EngagementTimelineTabProps) => {
  // Transform timeline data for charts
  const timelineChartData = engagementTimeline?.map(point => ({
    time: `${point.time_interval}min`,
    engagement: point.engagement_level,
    attendees: point.active_attendees,
    chat: point.chat_activity,
    polls: point.poll_activity,
    qa: point.qa_activity
  })) || [];

  if (!engagementTimeline || engagementTimeline.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground">No engagement timeline data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Engagement Timeline</CardTitle>
          <CardDescription>Track audience engagement throughout the webinar</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={timelineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="engagement" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              <Area type="monotone" dataKey="attendees" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interaction Activity</CardTitle>
          <CardDescription>Chat, polls, and Q&A activity over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="chat" fill="#8884d8" name="Chat" />
              <Bar dataKey="polls" fill="#82ca9d" name="Polls" />
              <Bar dataKey="qa" fill="#ffc658" name="Q&A" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
