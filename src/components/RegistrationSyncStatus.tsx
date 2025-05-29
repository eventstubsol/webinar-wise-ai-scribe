
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Trash2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { useRegistrationSync } from '@/hooks/useRegistrationSync';
import { format } from 'date-fns';

const RegistrationSyncStatus = () => {
  const { syncJobs, loading, getJobStatus, clearCompletedJobs } = useRegistrationSync();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Registration Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading sync status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Registration Sync Status
        </CardTitle>
        {syncJobs.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearCompletedJobs}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Completed
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {syncJobs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No registration sync jobs found</p>
            <p className="text-sm">Sync webinar data to see registration sync status</p>
          </div>
        ) : (
          <div className="space-y-4">
            {syncJobs.map((job) => {
              const jobStatus = getJobStatus(job);
              
              return (
                <div key={job.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(jobStatus.status)}
                      <span className="font-medium">Webinar {job.zoom_webinar_id}</span>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>{jobStatus.message}</p>
                    {jobStatus.details && typeof jobStatus.details === 'object' && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Approved: {jobStatus.details.approved || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-yellow-500" />
                          <span>Pending: {jobStatus.details.pending || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" />
                          <span>Denied: {jobStatus.details.denied || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-gray-500" />
                          <span>Cancelled: {jobStatus.details.cancelled || 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Started: {job.started_at 
                        ? format(new Date(job.started_at), 'MMM d, HH:mm')
                        : 'Not started'
                      }
                    </span>
                    {job.completed_at && (
                      <span>
                        Completed: {format(new Date(job.completed_at), 'MMM d, HH:mm')}
                      </span>
                    )}
                  </div>
                  
                  {job.error_count > 0 && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>{job.error_count} errors occurred during sync</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistrationSyncStatus;
