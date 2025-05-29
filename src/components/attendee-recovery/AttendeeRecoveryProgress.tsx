
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { AttendeeRecoveryProgress as ProgressType } from '@/types/attendeeRecovery';

interface AttendeeRecoveryProgressProps {
  progress: ProgressType;
}

const AttendeeRecoveryProgress = ({ progress }: AttendeeRecoveryProgressProps) => {
  const getProgressPercentage = () => {
    if (progress.totalWebinars === 0) return 0;
    return Math.round((progress.processedWebinars / progress.totalWebinars) * 100);
  };

  if (!progress.isRunning) return null;

  return (
    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Attendee Recovery Progress</span>
        <span className="text-sm text-muted-foreground">
          {progress.processedWebinars}/{progress.totalWebinars} webinars
        </span>
      </div>
      
      <Progress value={getProgressPercentage()} className="w-full" />
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="font-medium">{progress.processedWebinars}</div>
          <div className="text-muted-foreground">Processed</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{progress.totalAttendees}</div>
          <div className="text-muted-foreground">Recovered</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{progress.errors}</div>
          <div className="text-muted-foreground">Errors</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{progress.estimatedTimeRemaining || 'Calculating...'}</div>
          <div className="text-muted-foreground">Remaining</div>
        </div>
      </div>

      {progress.currentWebinar && (
        <div className="text-sm text-center">
          <span className="text-muted-foreground">Currently processing: </span>
          <span className="font-medium">{progress.currentWebinar}</span>
        </div>
      )}
    </div>
  );
};

export default AttendeeRecoveryProgress;
