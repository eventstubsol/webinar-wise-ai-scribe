
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, BarChart3, HelpCircle } from 'lucide-react';
import type { AnalyticsSummary } from '@/types/analytics';

interface InteractionBreakdownProps {
  analyticsSummary: AnalyticsSummary;
}

export const InteractionBreakdown = ({ analyticsSummary }: InteractionBreakdownProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{analyticsSummary.total_chat_messages}</div>
          <p className="text-sm text-muted-foreground">Total messages sent</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Poll Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">{analyticsSummary.total_poll_responses}</div>
          <p className="text-sm text-muted-foreground">Poll interactions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Q&A Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-600">{analyticsSummary.total_qa_questions}</div>
          <p className="text-sm text-muted-foreground">Questions asked</p>
        </CardContent>
      </Card>
    </div>
  );
};
