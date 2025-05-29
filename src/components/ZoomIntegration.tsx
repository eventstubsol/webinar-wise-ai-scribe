
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useZoomIntegration } from '@/hooks/useZoomIntegration';
import { useJobProcessor } from '@/hooks/useJobProcessor';
import ZoomConnectionTab from './ZoomConnectionTab';
import ZoomSyncTab from './ZoomSyncTab';
import ZoomLogsTab from './ZoomLogsTab';
import ZoomJobsTab from './ZoomJobsTab';
import PollsDebugger from './PollsDebugger';

const ZoomIntegration = () => {
  const [searchParams] = useSearchParams();
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

  // Get subtab from URL parameters, default to "connection"
  const subtabFromUrl = searchParams.get('subtab') || 'connection';
  const [activeSubtab, setActiveSubtab] = useState(subtabFromUrl);

  // Update subtab when URL changes
  useEffect(() => {
    const subtabFromUrl = searchParams.get('subtab') || 'connection';
    setActiveSubtab(subtabFromUrl);
  }, [searchParams]);

  const handleRefresh = async () => {
    await Promise.all([refreshConnection(), refreshLogs(), refreshJobs()]);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeSubtab} onValueChange={setActiveSubtab} className="w-full">
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
