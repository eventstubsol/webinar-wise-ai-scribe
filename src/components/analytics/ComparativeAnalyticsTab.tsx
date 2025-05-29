
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ComparativeAnalytics, AnalyticsPeriod } from '@/types/analytics';

interface ComparativeAnalyticsTabProps {
  comparativeAnalytics: ComparativeAnalytics | null;
  selectedPeriod: AnalyticsPeriod;
  generating: boolean;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onGenerateReport: () => void;
}

export const ComparativeAnalyticsTab = ({ 
  comparativeAnalytics, 
  selectedPeriod, 
  generating, 
  onPeriodChange, 
  onGenerateReport 
}: ComparativeAnalyticsTabProps) => {
  const handlePeriodTypeChange = (type: string) => {
    onPeriodChange({ ...selectedPeriod, type: type as 'weekly' | 'monthly' | 'quarterly' | 'yearly' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Period Comparison</CardTitle>
        <CardDescription>Compare performance across different time periods</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <Select value={selectedPeriod.type} onValueChange={handlePeriodTypeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={onGenerateReport} disabled={generating}>
            Generate Report
          </Button>
        </div>

        {comparativeAnalytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{comparativeAnalytics.total_webinars}</div>
                <p className="text-sm text-muted-foreground">Total Webinars</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{comparativeAnalytics.average_attendance_rate}%</div>
                <p className="text-sm text-muted-foreground">Avg Attendance Rate</p>
                <div className="flex items-center mt-2">
                  {comparativeAnalytics.attendance_trend >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm ml-1 ${comparativeAnalytics.attendance_trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(comparativeAnalytics.attendance_trend)}%
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{comparativeAnalytics.average_engagement_score}</div>
                <p className="text-sm text-muted-foreground">Avg Engagement</p>
                <div className="flex items-center mt-2">
                  {comparativeAnalytics.engagement_trend >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm ml-1 ${comparativeAnalytics.engagement_trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(comparativeAnalytics.engagement_trend)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
