
import { toast } from '@/hooks/use-toast';

export const useSyncErrorHandler = () => {
  const handleSyncError = (
    error: any,
    setSyncProgress: (progress: any) => void,
    setSyncing: (syncing: boolean) => void,
    clearSyncTimeout: () => void
  ) => {
    console.error('Robust sync error:', error);
    
    setSyncProgress({ 
      stage: 'error', 
      message: 'Sync failed - please try again', 
      progress: 0 
    });
    setSyncing(false);
    
    clearSyncTimeout();
    
    // Provide specific error messages
    let errorMessage = "Failed to sync webinar data. Please try again.";
    
    if (error.message && error.message.includes('scopes')) {
      errorMessage = "Your Zoom connection needs updated permissions. Please reconnect your Zoom account.";
    } else if (error.message && error.message.includes('organization')) {
      errorMessage = "Unable to access your organization. Please check your account settings.";
    } else if (error.message && error.message.includes('connection')) {
      errorMessage = "Zoom connection issue. Please check your connection and try again.";
    }
    
    toast({
      title: "Sync Failed",
      description: errorMessage,
      variant: "destructive",
    });

    // Reset progress after error display
    setTimeout(() => {
      setSyncProgress({ stage: 'idle', message: '', progress: 0 });
    }, 5000);
  };

  return { handleSyncError };
};
