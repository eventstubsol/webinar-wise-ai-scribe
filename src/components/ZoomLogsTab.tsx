
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { SyncLog } from '@/types/sync';

interface ZoomLogsTabProps {
  syncLogs: SyncLog[] | null;
}

const ZoomLogsTab = ({ syncLogs }: ZoomLogsTabProps) => {
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
          <CardTitle>Recent Sync Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-2">
              {syncLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <p className="font-medium">{log.sync_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(log.status)}>
                      {log.status}
                    </Badge>
                    {log.records_processed && (
                      <Badge variant="outline">
                        {log.records_processed} records
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No sync logs available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ZoomLogsTab;
