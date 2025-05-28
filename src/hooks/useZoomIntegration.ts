
import { useZoomConnection } from './useZoomConnection';
import { useZoomSync } from './useZoomSync';

export const useZoomIntegration = () => {
  const {
    zoomConnection,
    loading,
    isConnected,
    disconnectZoom,
    refreshConnection,
  } = useZoomConnection();

  const {
    syncLogs,
    syncJobs,
    syncing,
    syncProgress,
    syncWebinarData,
    refreshLogs,
    refreshJobs,
  } = useZoomSync();

  // Guard against sync when not connected
  const handleSyncWebinarData = async () => {
    if (!isConnected) {
      // This validation is now handled in the sync hook, but keeping for backwards compatibility
      return;
    }
    await syncWebinarData();
  };

  return {
    zoomConnection,
    syncLogs,
    syncJobs,
    loading,
    syncing,
    syncProgress,
    isConnected,
    syncWebinarData: handleSyncWebinarData,
    disconnectZoom,
    refreshConnection,
    refreshLogs,
    refreshJobs,
  };
};
