
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Database, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useChunkedMassResync } from '@/hooks/zoom/useChunkedMassResync';

export function ChunkedMassResyncDialog() {
  const { isResyncing, progress, results, error, startChunkedMassResync } = useChunkedMassResync();
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full flex items-center space-x-2">
          <Database className="w-4 h-4" />
          <span>Chunked Mass Re-sync</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Chunked Mass Re-sync</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              This will re-sync ALL webinars using a chunked approach to prevent timeouts. 
              Processing happens in small batches with progress tracking.
            </AlertDescription>
          </Alert>
          
          {isResyncing && progress && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>
                  Processing chunk {progress.current_chunk}/{progress.total_chunks} 
                  ({progress.processed_webinars}/{progress.total_webinars} webinars)
                </span>
              </div>
              <Progress value={progress.progress_percentage} className="w-full" />
              
              <div className="grid grid-cols-3 gap-4 text-xs bg-gray-50 p-3 rounded">
                <div className="text-center">
                  <div className="font-medium text-green-600">{progress.successful_webinars}</div>
                  <div className="text-gray-500">Successful</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-red-600">{progress.failed_webinars}</div>
                  <div className="text-gray-500">Failed</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{progress.progress_percentage}%</div>
                  <div className="text-gray-500">Complete</div>
                </div>
              </div>
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
                  ✅ Chunked re-sync completed successfully!
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
              onClick={startChunkedMassResync} 
              disabled={isResyncing}
              className="w-full flex items-center space-x-2"
            >
              {isResyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Chunks...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Start Chunked Re-sync</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
