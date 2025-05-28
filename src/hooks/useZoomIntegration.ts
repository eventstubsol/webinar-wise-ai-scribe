
import { useZoomConnection } from './useZoomConnection';
import { useZoomSync } from './useZoomSync';

export const useZoomIntegration = () => {
  const {
    zoomConnection,
    loading,
    isConnected,
    initializeZoomOAuth,
    disconnectZoom,
    refreshConnection,
  } = useZoomConnection();

  const {
    syncLogs,
    syncing,
    syncProgress,
    syncWebinarData,
    refreshLogs,
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
    loading,
    syncing,
    syncProgress,
    isConnected,
    initializeZoomOAuth,
    syncWebinarData: handleSyncWebinarData,
    disconnectZoom,
    refreshConnection,
    refreshLogs,
  };
};
