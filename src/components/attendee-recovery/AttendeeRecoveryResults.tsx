
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Database } from 'lucide-react';
import { WebinarAttendeeResult } from '@/types/attendeeRecovery';

interface AttendeeRecoveryResultsProps {
  results: WebinarAttendeeResult[];
}

const AttendeeRecoveryResults = ({ results }: AttendeeRecoveryResultsProps) => {
  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  if (results.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Attendee Recovery Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.webinar_id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(result.success)}
                <div>
                  <div className="font-medium text-sm">{result.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Webinar ID: {result.zoom_webinar_id}
                    {result.api_used && <span className="ml-2">• API: {result.api_used}</span>}
                  </div>
                  {result.error_message && (
                    <div className="text-xs text-red-600 mt-1">
                      Error: {result.error_message}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.attendees_stored} stored
                </Badge>
                {result.attendees_found > result.attendees_stored && (
                  <Badge variant="outline">
                    {result.attendees_found} found
                  </Badge>
                )}
                {result.errors > 0 && (
                  <Badge variant="outline" className="text-red-600">
                    {result.errors} errors
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendeeRecoveryResults;
