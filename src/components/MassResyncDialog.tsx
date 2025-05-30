
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { useMassResync } from '@/hooks/zoom/useMassResync';

export function MassResyncDialog() {
  const { isResyncing, results, error, startMassResync } = useMassResync();
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full flex items-center space-x-2">
          <Database className="w-4 h-4" />
          <span>Complete Historical Re-sync</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Complete Historical Webinar Re-sync</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              This will re-sync ALL webinars and their participants from Zoom. 
              This process may take several minutes depending on your webinar history.
              All existing participant data will be refreshed with the latest information from Zoom.
            </AlertDescription>
          </Alert>
          
          {isResyncing && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Re-syncing webinars and participants...</span>
              </div>
              <Progress value={undefined} className="w-full" />
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
                <AlertDescription>
                  ✅ Re-sync completed successfully!
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Webinars Processed:</strong> {results.successful_webinars}/{results.total_webinars}
                </div>
                <div>
                  <strong>Total Participants:</strong> {results.total_participants_synced.toLocaleString()}
                </div>
                <div>
                  <strong>Instances Processed:</strong> {results.total_instances_processed}
                </div>
                <div>
                  <strong>Failed Webinars:</strong> {results.failed_webinars}
                </div>
              </div>
              
              {results.errors && results.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    View Errors ({results.errors.length})
                  </summary>
                  <div className="mt-2 space-y-1 text-xs">
                    {results.errors.map((error: any, index: number) => (
                      <div key={index} className="p-2 bg-red-50 rounded">
                        <strong>{error.topic} ({error.webinar_id}):</strong> {error.error}
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
                  <span>Start Complete Re-sync</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
