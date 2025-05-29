
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

const AttendeeRecoveryInfo = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Attendee Recovery Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-2">
          <div className="font-medium">What this attendee recovery does:</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Uses the correct Zoom API endpoint (/past_webinars/) for reliable data fetching</li>
            <li>Implements fallback to metrics API if needed for maximum compatibility</li>
            <li>Fetches ALL participant data with proper pagination</li>
            <li>Enhanced deduplication and data validation</li>
            <li>Calculates accurate engagement scores and analytics</li>
            <li>Updates webinar attendee counts automatically</li>
          </ul>
        </div>
        
        <div className="text-sm space-y-2">
          <div className="font-medium">Key improvements over previous implementation:</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Fixed API endpoint usage (was using wrong /metrics/ endpoint)</li>
            <li>Enhanced error handling and retry logic</li>
            <li>Better participant filtering and bot detection</li>
            <li>Comprehensive progress tracking and logging</li>
            <li>Batch processing optimized for attendee data volume</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendeeRecoveryInfo;
