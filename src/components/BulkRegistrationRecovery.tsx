
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  AlertTriangle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useBulkRegistrationRecovery } from '@/hooks/useBulkRegistrationRecovery';

const BulkRegistrationRecovery = () => {
  const {
    recoveryProgress,
    recoveryResults,
    recoveryLogs,
    startBulkRecovery,
    clearRecoveryLogs
  } = useBulkRegistrationRecovery();

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
            <Download className="h-5 w-5" />
            Bulk Registration Recovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Recover all missing registration data from Zoom API across all webinars
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This will systematically process all webinars and fetch complete registration data
              </p>
            </div>
            <Button 
              onClick={startBulkRecovery}
              disabled={recoveryProgress.isRunning}
              className="flex items-center gap-2"
            >
              {recoveryProgress.isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {recoveryProgress.isRunning ? 'Recovery Running...' : 'Start Recovery'}
            </Button>
          </div>

          {/* Progress Display */}
          {recoveryProgress.isRunning && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Recovery Progress</span>
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
                  <div className="font-medium">{recoveryProgress.totalRegistrations}</div>
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
              <Users className="h-5 w-5" />
              Recovery Results
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
                      {result.registrations_stored} recovered
                    </Badge>
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
              Recovery Logs
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
            Recovery Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <div className="font-medium">What this recovery does:</div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Fetches ALL registration statuses (approved, pending, denied, cancelled)</li>
              <li>Uses proper pagination to ensure no data is missed</li>
              <li>Implements retry logic for failed API calls</li>
              <li>Updates webinar registration counts automatically</li>
              <li>Processes webinars in batches to respect API rate limits</li>
            </ul>
          </div>
          
          <div className="text-sm space-y-2">
            <div className="font-medium">Safety measures:</div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Clears stuck sync jobs before starting</li>
              <li>Comprehensive error handling and logging</li>
              <li>Progress tracking with time estimates</li>
              <li>Batch processing to avoid overwhelming the API</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkRegistrationRecovery;
