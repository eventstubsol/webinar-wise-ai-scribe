
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useZoomIntegration } from '@/hooks/useZoomIntegration';
import { useJobProcessor } from '@/hooks/useJobProcessor';
import ZoomConnectionTab from './ZoomConnectionTab';
import ZoomSyncTab from './ZoomSyncTab';
import ZoomLogsTab from './ZoomLogsTab';
import ZoomJobsTab from './ZoomJobsTab';
import PollsDebugger from './PollsDebugger';

const ZoomIntegration = () => {
  const {
    zoomConnection,
    loading,
    syncing,
    syncProgress,
    isConnected,
    syncWebinarData,
    refreshConnection,
    syncLogs,
    syncJobs,
    refreshLogs,
    refreshJobs,
    chunkedSyncStats,
    currentChunk,
  } = useZoomIntegration();

  const { processing, processJobs } = useJobProcessor();

  const handleRefresh = async () => {
    await Promise.all([refreshConnection(), refreshLogs(), refreshJobs()]);
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

        <TabsContent value="connection">
          <ZoomConnectionTab 
            isConnected={isConnected}
            zoomConnection={zoomConnection}
          />
        </TabsContent>

        <TabsContent value="sync">
          <ZoomSyncTab
            syncing={syncing}
            processing={processing}
            isConnected={isConnected}
            loading={loading}
            syncProgress={syncProgress}
            currentChunk={currentChunk}
            chunkedSyncStats={chunkedSyncStats}
            onSyncWebinarData={syncWebinarData}
            onProcessJobs={processJobs}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="logs">
          <ZoomLogsTab syncLogs={syncLogs} />
        </TabsContent>

        <TabsContent value="jobs">
          <ZoomJobsTab syncJobs={syncJobs} />
        </TabsContent>

        <TabsContent value="debug">
          <PollsDebugger />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ZoomIntegration;
