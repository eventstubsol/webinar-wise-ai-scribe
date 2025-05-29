
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Trash2,
  RefreshCw,
  Database
} from 'lucide-react';
import { useBulkAttendeeRecovery } from '@/hooks/useBulkAttendeeRecovery';

const BulkAttendeeRecovery = () => {
  const {
    recoveryProgress,
    recoveryResults,
    recoveryLogs,
    startBulkAttendeeRecovery,
    clearRecoveryLogs
  } = useBulkAttendeeRecovery();

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getProgressPercentage = () => {
    if (recoveryProgress.totalWebinars === 0) return 0;
    return Math.round((recoveryProgress.processedWebinars / recoveryProgress.totalWebinars) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Attendee Recovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Recover all missing attendee data from Zoom API across all webinars
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This will systematically process all webinars using the correct Zoom API endpoints
              </p>
            </div>
            <Button 
              onClick={startBulkAttendeeRecovery}
              disabled={recoveryProgress.isRunning}
              className="flex items-center gap-2"
            >
              {recoveryProgress.isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {recoveryProgress.isRunning ? 'Recovery Running...' : 'Start Attendee Recovery'}
            </Button>
          </div>

          {/* Progress Display */}
          {recoveryProgress.isRunning && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Attendee Recovery Progress</span>
                <span className="text-sm text-muted-foreground">
                  {recoveryProgress.processedWebinars}/{recoveryProgress.totalWebinars} webinars
                </span>
              </div>
              
              <Progress value={getProgressPercentage()} className="w-full" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-medium">{recoveryProgress.processedWebinars}</div>
                  <div className="text-muted-foreground">Processed</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{recoveryProgress.totalAttendees}</div>
                  <div className="text-muted-foreground">Recovered</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{recoveryProgress.errors}</div>
                  <div className="text-muted-foreground">Errors</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{recoveryProgress.estimatedTimeRemaining || 'Calculating...'}</div>
                  <div className="text-muted-foreground">Remaining</div>
                </div>
              </div>

              {recoveryProgress.currentWebinar && (
                <div className="text-sm text-center">
                  <span className="text-muted-foreground">Currently processing: </span>
                  <span className="font-medium">{recoveryProgress.currentWebinar}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery Results */}
      {recoveryResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Attendee Recovery Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recoveryResults.map((result) => (
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
      )}

      {/* Recovery Logs */}
      {recoveryLogs.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attendee Recovery Logs
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearRecoveryLogs}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Logs
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full border rounded-md p-4">
              <div className="space-y-1">
                {recoveryLogs.map((log, index) => (
                  <div key={index} className="text-xs font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Information Panel */}
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
    </div>
  );
};

export default BulkAttendeeRecovery;
