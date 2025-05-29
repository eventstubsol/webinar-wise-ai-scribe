
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ZoomConnectionCard from './ZoomConnectionCard';
import ZoomConnectionWizard from './ZoomConnectionWizard';
import SyncProgressIndicator from './SyncProgressIndicator';
import { useZoomIntegration } from '@/hooks/useZoomIntegration';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, AlertCircle, CheckCircle } from "lucide-react";
import { useJobProcessor } from '@/hooks/useJobProcessor';
import PollsDebugger from './PollsDebugger';

const ZoomIntegration = () => {
  const {
    zoomConnection,
    loading,
    syncing,
    syncProgress,
    isConnected,
    syncWebinarData,
    disconnectZoom,
    refreshConnection,
    syncLogs,
    syncJobs,
    refreshLogs,
    refreshJobs,
  } = useZoomIntegration();

  const { processing, processJobs } = useJobProcessor();

  const handleRefresh = async () => {
    await Promise.all([refreshConnection(), refreshLogs(), refreshJobs()]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="sync">Sync Control</TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          <TabsTrigger value="jobs">Sync Jobs</TabsTrigger>
          <TabsTrigger value="debug">Debug Polls</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          {!isConnected ? (
            <ZoomConnectionWizard onConnectionComplete={refreshConnection} />
          ) : (
            <ZoomConnectionCard 
              connection={zoomConnection} 
              onDisconnect={disconnectZoom}
              onRefresh={refreshConnection}
              loading={loading}
            />
          )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5" />
                <span>Webinar Data Sync</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {syncing && <SyncProgressIndicator progress={syncProgress} />}
              
              <div className="flex space-x-4">
                <Button 
                  onClick={syncWebinarData} 
                  disabled={syncing || !isConnected || loading}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Enhanced Sync'}</span>
                </Button>
                
                <Button 
                  onClick={processJobs}
                  disabled={processing || !isConnected}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Play className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
                  <span>{processing ? 'Processing...' : 'Process Jobs'}</span>
                </Button>
                
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </Button>
              </div>
              
              {!isConnected && (
                <p className="text-sm text-muted-foreground">
                  Please connect to Zoom first to enable data synchronization.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
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
                            {new Date(job.created_at).toLocaleString()}
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
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <PollsDebugger />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ZoomIntegration;
