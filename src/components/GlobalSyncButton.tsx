import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  Database, 
  AlertTriangle, 
  Info,
  Clock,
  Zap
} from 'lucide-react';
import { useGlobalSync } from '@/hooks/useGlobalSync';
import { GlobalSyncProgress } from './GlobalSyncProgress';
import { useZoomConnection } from '@/hooks/useZoomConnection';

interface GlobalSyncButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showProgress?: boolean;
  className?: string;
}

export const GlobalSyncButton: React.FC<GlobalSyncButtonProps> = ({
  variant = 'default',
  size = 'default',
  showProgress = true,
  className = ''
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);
  const { progress, startGlobalSync, cancelSync, isRunning } = useGlobalSync();
  const { isConnected } = useZoomConnection();

  const handleSyncClick = () => {
    if (isRunning) {
      setDialogOpen(true);
      return;
    }

    if (!isConnected) {
      setDialogOpen(true);
      return;
    }

    if (!confirmSync) {
      setDialogOpen(true);
      return;
    }

    startGlobalSync();
    setDialogOpen(true);
  };

  const handleConfirmSync = () => {
    setConfirmSync(true);
    startGlobalSync();
  };

  const getButtonText = () => {
    if (isRunning) {
      const currentStage = progress.stages[progress.currentStage];
      return `Syncing ${currentStage?.name || ''}...`;
    }
    return 'Global Sync';
  };

  const getButtonIcon = () => {
    if (isRunning) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    return <Zap className="h-4 w-4" />;
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleSyncClick}
        disabled={isRunning && !showProgress}
        className={`${className} ${isRunning ? 'animate-pulse' : ''}`}
      >
        {getButtonIcon()}
        <span className="ml-2">{getButtonText()}</span>
        {isRunning && (
          <span className="ml-2 text-xs">
            {Math.round(progress.overallProgress)}%
          </span>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {isRunning ? 'Global Sync in Progress' : 'Global Data Synchronization'}
            </DialogTitle>
            <DialogDescription>
              {isRunning 
                ? 'Monitor the progress of your comprehensive data synchronization.' 
                : 'Start a complete synchronization of all your Zoom webinar data including webinars, participants, registrations, polls, Q&A, chat, recordings, and analytics.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Connection Status Check */}
            {!isConnected && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No active Zoom connection found. Please connect to Zoom first before starting a sync.
                </AlertDescription>
              </Alert>
            )}

            {/* Sync Information */}
            {!isRunning && isConnected && !confirmSync && (
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This will perform a comprehensive synchronization of all your Zoom webinar data including:
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Data Types
                    </h4>
                    <ul className="space-y-1 text-gray-600 ml-6">
                      <li>• Webinar metadata and settings</li>
                      <li>• Participant attendance data</li>
                      <li>• Registration information</li>
                      <li>• Poll responses and Q&A</li>
                      <li>• Chat messages and interactions</li>
                      <li>• Recording metadata</li>
                      <li>• Business analytics and metrics</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Process Details
                    </h4>
                    <ul className="space-y-1 text-gray-600 ml-6">
                      <li>• Rate-limited API calls</li>
                      <li>• Background job processing</li>
                      <li>• Real-time progress tracking</li>
                      <li>• Automatic error handling</li>
                      <li>• Data integrity validation</li>
                      <li>• Estimated time: 5-15 minutes</li>
                    </ul>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Important:</strong> This process will make multiple API calls to Zoom and may take several minutes to complete. 
                    The sync respects rate limits and uses background processing for large datasets.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmSync} className="bg-blue-600 hover:bg-blue-700">
                    <Zap className="h-4 w-4 mr-2" />
                    Start Global Sync
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Display */}
            {(isRunning || (confirmSync && isConnected)) && showProgress && (
              <GlobalSyncProgress 
                progress={progress} 
                onCancel={cancelSync}
              />
            )}

            {/* Completion Actions */}
            {!isRunning && progress.overallProgress === 100 && (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <Info className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Global sync completed successfully! All your Zoom webinar data has been synchronized.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      setConfirmSync(false);
                      setDialogOpen(false);
                      window.location.reload(); // Refresh to show new data
                    }}
                  >
                    View Updated Data
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
