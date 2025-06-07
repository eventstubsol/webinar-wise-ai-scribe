import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Loader2, 
  Clock,
  Database,
  Users,
  BarChart3,
  Settings,
  FileText,
  MessageSquare,
  Video,
  Shield,
  X
} from 'lucide-react';
import { GlobalSyncProgress as GlobalSyncProgressType, GlobalSyncStage } from '@/hooks/useGlobalSync';

interface GlobalSyncProgressProps {
  progress: GlobalSyncProgressType;
  onCancel: () => void;
}

const getStageIcon = (stageId: string) => {
  const icons: Record<string, React.ReactNode> = {
    validation: <Shield className="h-4 w-4" />,
    webinars: <Database className="h-4 w-4" />,
    participants: <Users className="h-4 w-4" />,
    registrations: <FileText className="h-4 w-4" />,
    interactions: <MessageSquare className="h-4 w-4" />,
    recordings: <Video className="h-4 w-4" />,
    analytics: <BarChart3 className="h-4 w-4" />,
    cleanup: <Settings className="h-4 w-4" />
  };
  return icons[stageId] || <Circle className="h-4 w-4" />;
};

const getStatusIcon = (status: GlobalSyncStage['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-300" />;
  }
};

const getStatusBadge = (status: GlobalSyncStage['status']) => {
  const variants = {
    pending: 'secondary',
    running: 'default',
    completed: 'default',
    failed: 'destructive'
  } as const;

  const colors = {
    pending: 'text-gray-500',
    running: 'text-blue-600',
    completed: 'text-green-600',
    failed: 'text-red-600'
  };

  return (
    <Badge variant={variants[status]} className={colors[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const formatDuration = (start?: Date, end?: Date) => {
  if (!start) return '';
  const endTime = end || new Date();
  const duration = endTime.getTime() - start.getTime();
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};

export const GlobalSyncProgress: React.FC<GlobalSyncProgressProps> = ({ 
  progress, 
  onCancel 
}) => {
  const currentStage = progress.stages[progress.currentStage];
  const completedStages = progress.stages.filter(s => s.status === 'completed').length;
  const failedStages = progress.stages.filter(s => s.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Overall Progress Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Global Sync Progress
            </CardTitle>
            {progress.isRunning && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCancel}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {progress.isRunning ? 'Synchronizing...' : 'Sync Complete'}
              </span>
              <span className="text-gray-500">
                {Math.round(progress.overallProgress)}%
              </span>
            </div>
            <Progress value={progress.overallProgress} className="h-2" />
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Circle className="h-3 w-3 text-gray-400" />
              <span>Total Stages: {progress.totalStages}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>Completed: {completedStages}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-blue-500" />
              <span>
                Duration: {formatDuration(progress.startTime, progress.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3 w-3 text-purple-500" />
              <span>API Calls: {progress.totalApiRequests}</span>
            </div>
          </div>

          {/* Time Estimation */}
          {progress.isRunning && progress.estimatedTimeRemaining && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Clock className="h-4 w-4" />
                <span>Estimated time remaining: {progress.estimatedTimeRemaining}</span>
              </div>
            </div>
          )}

          {/* Current Stage Info */}
          {progress.isRunning && currentStage && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                {getStageIcon(currentStage.id)}
                <span>Current: {currentStage.name}</span>
              </div>
              <p className="text-sm text-gray-600">{currentStage.message}</p>
              {currentStage.progress > 0 && (
                <Progress value={currentStage.progress} className="h-1 mt-2" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Stage Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progress.stages.map((stage, index) => (
              <div 
                key={stage.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  index === progress.currentStage && progress.isRunning
                    ? 'border-blue-200 bg-blue-50'
                    : stage.status === 'completed'
                    ? 'border-green-200 bg-green-50'
                    : stage.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Stage Icon & Status */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {getStageIcon(stage.id)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{stage.name}</h4>
                      {getStatusBadge(stage.status)}
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{stage.description}</p>
                    {stage.message && (
                      <p className="text-xs text-gray-500">{stage.message}</p>
                    )}
                  </div>
                </div>

                {/* Progress & Status */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {stage.status === 'running' && stage.progress > 0 && (
                    <div className="w-16">
                      <Progress value={stage.progress} className="h-1" />
                    </div>
                  )}
                  {stage.apiRequestsUsed && stage.apiRequestsUsed > 0 && (
                    <div className="text-xs text-gray-500 min-w-fit">
                      {stage.apiRequestsUsed} API calls
                    </div>
                  )}
                  {stage.startTime && (
                    <div className="text-xs text-gray-500 min-w-fit">
                      {formatDuration(stage.startTime, stage.endTime)}
                    </div>
                  )}
                  <div className="flex-shrink-0">
                    {getStatusIcon(stage.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Results */}
      {progress.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">
                  {progress.summary.webinarsFound}
                </div>
                <div className="text-sm text-blue-700">Webinars Found</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">
                  {progress.summary.webinarsSynced}
                </div>
                <div className="text-sm text-green-700">Webinars Synced</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-600">
                  {progress.summary.jobsCreated}
                </div>
                <div className="text-sm text-purple-700">Background Jobs</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-orange-600">
                  {progress.summary.participantsSynced}
                </div>
                <div className="text-sm text-orange-700">Participants</div>
              </div>
              <div className="bg-teal-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-teal-600">
                  {progress.summary.registrationsSynced}
                </div>
                <div className="text-sm text-teal-700">Registrations</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-600">
                  {progress.totalApiRequests}
                </div>
                <div className="text-sm text-gray-700">Total API Calls</div>
              </div>
            </div>

            {progress.summary.errors.length > 0 && (
              <div className="mt-4 bg-red-50 rounded-lg p-3">
                <h4 className="font-medium text-red-800 mb-2">Errors Encountered:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {progress.summary.errors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};