
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { useMassResync } from '@/hooks/zoom/useMassResync';

export function MassResyncDialog() {
  const { isResyncing, progress, results, error, startMassResync } = useMassResync();
  
  // Calculate progress percentage if progress is an object
  const progressValue = typeof progress === 'object' && progress ? 
    Math.round((progress.processedWebinars / progress.totalWebinars) * 100) : 
    (typeof progress === 'number' ? progress : 0);
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full flex items-center space-x-2">
          <Database className="w-4 h-4" />
          <span>Mass Re-sync All Webinars</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Mass Re-sync All Webinars</span>
          </DialogTitle>
          <DialogDescription>
            Re-sync all webinars with their complete data including registrations, attendees, and analytics.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              This will re-sync ALL webinars with comprehensive data recovery. 
              This may take several minutes for large datasets.
            </AlertDescription>
          </Alert>
          
          {isResyncing && (
            <div className="space-y-3">
              <Progress value={progressValue} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {typeof progress === 'object' && progress ? (
                  <>
                    Processing webinars... {progress.processedWebinars}/{progress.totalWebinars} 
                    ({progressValue}% complete)
                    {progress.currentWebinar && (
                      <><br />Current: {progress.currentWebinar}</>
                    )}
                  </>
                ) : (
                  `Processing webinars... ${progressValue}% complete`
                )}
              </p>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {results && (
            <div className="space-y-2">
              <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  ✅ Mass re-sync completed successfully!
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Total Webinars:</strong> {results.total_webinars}
                </div>
                <div>
                  <strong>Successful:</strong> <span className="text-green-600">{results.successful_webinars}</span>
                </div>
                <div>
                  <strong>Failed:</strong> <span className="text-red-600">{results.failed_webinars}</span>
                </div>
                <div>
                  <strong>Success Rate:</strong> {((results.successful_webinars / results.total_webinars) * 100).toFixed(1)}%
                </div>
              </div>
              
              {results.errors && results.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    View Errors ({results.errors.length})
                  </summary>
                  <div className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
                    {results.errors.map((error: any, index: number) => (
                      <div key={index} className="p-2 bg-red-50 rounded">
                        <strong>{error.topic}:</strong> {error.error}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button 
              onClick={startMassResync} 
              disabled={isResyncing}
              className="w-full flex items-center space-x-2"
            >
              {isResyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Re-syncing...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Start Mass Re-sync</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
