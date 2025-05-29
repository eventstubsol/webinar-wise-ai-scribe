
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { AnalyticsSummary } from '@/types/analytics';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

interface AudienceAnalyticsTabProps {
  analyticsSummary: AnalyticsSummary | null;
}

export const AudienceAnalyticsTab = ({ analyticsSummary }: AudienceAnalyticsTabProps) => {
  if (!analyticsSummary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground">No audience analytics data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform device breakdown for pie chart
  const deviceChartData = analyticsSummary.device_breakdown 
    ? Object.entries(analyticsSummary.device_breakdown).map(([device, count]) => ({
        name: device,
        value: count
      }))
    : [];

  // Transform geographic data
  const geoChartData = analyticsSummary.geographic_breakdown
    ? Object.entries(analyticsSummary.geographic_breakdown).map(([location, count]) => ({
        location,
        attendees: count
      }))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Device Breakdown</CardTitle>
          <CardDescription>How attendees joined the webinar</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={deviceChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {deviceChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geographic Distribution</CardTitle>
          <CardDescription>Where your attendees are located</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={geoChartData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="location" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="attendees" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
