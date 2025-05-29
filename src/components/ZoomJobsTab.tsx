
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { SyncJob } from '@/types/sync';

interface ZoomJobsTabProps {
  syncJobs: SyncJob[] | null;
}

const ZoomJobsTab = ({ syncJobs }: ZoomJobsTabProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sync Jobs Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {syncJobs && syncJobs.length > 0 ? (
            <div className="space-y-2">
              {syncJobs.slice(0, 10).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.job_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(job.started_at || new Date()).toLocaleString()}
                      </p>
                      {job.metadata?.webinar_title && (
                        <p className="text-xs text-muted-foreground">
                          {job.metadata.webinar_title}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                    {job.progress > 0 && (
                      <Badge variant="outline">
                        {job.progress}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No sync jobs in queue
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ZoomJobsTab;
