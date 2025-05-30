
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { useJobRecovery } from '@/hooks/useJobRecovery';

interface BackgroundJobStatusProps {
  backgroundProcessing: boolean;
  syncJobs: any[];
  onManualCheck: () => void;
  onRefreshJobs: () => void;
}

const BackgroundJobStatus = ({ 
  backgroundProcessing, 
  syncJobs, 
  onManualCheck, 
  onRefreshJobs 
}: BackgroundJobStatusProps) => {
  const { recovering, restartStuckJobs } = useJobRecovery();

  if (!backgroundProcessing && syncJobs.length === 0) return null;

  const activeJobs = syncJobs.filter(job => job.status === 'running' || job.status === 'pending');
  const completedJobs = syncJobs.filter(job => job.status === 'completed');
  const failedJobs = syncJobs.filter(job => job.status === 'failed');

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Background Processing Status</span>
          </div>
          {backgroundProcessing && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              {activeJobs.length} Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {backgroundProcessing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700">
                Processing continues in background...
              </span>
              <span className="text-blue-600">
                Large dataset detected
              </span>
            </div>
            
            {activeJobs.length > 0 && (
              <div className="space-y-2">
                {activeJobs.slice(0, 3).map((job, index) => (
                  <div key={job.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">
                        {job.job_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                      <span>{job.progress || 0}%</span>
                    </div>
                    <Progress value={job.progress || 0} className="h-1" />
                  </div>
                ))}
                {activeJobs.length > 3 && (
                  <p className="text-xs text-gray-600">
                    +{activeJobs.length - 3} more jobs processing...
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span>Background processing complete</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="font-medium text-green-600">{completedJobs.length}</div>
            <div className="text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-blue-600">{activeJobs.length}</div>
            <div className="text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-red-600">{failedJobs.length}</div>
            <div className="text-gray-500">Failed</div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={onManualCheck} 
            size="sm" 
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Check Status
          </Button>
          
          {activeJobs.length === 0 && failedJobs.length > 0 && (
            <Button 
              onClick={restartStuckJobs} 
              size="sm" 
              variant="outline"
              disabled={recovering}
              className="flex-1"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              {recovering ? 'Restarting...' : 'Restart Failed'}
            </Button>
          )}
        </div>

        {backgroundProcessing && (
          <div className="text-xs text-gray-600 bg-white p-2 rounded border">
            <strong>Note:</strong> Large webinar datasets are processed in background jobs 
            to prevent timeouts. You can safely navigate away - processing will continue 
            and you'll be notified when complete.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BackgroundJobStatus;
