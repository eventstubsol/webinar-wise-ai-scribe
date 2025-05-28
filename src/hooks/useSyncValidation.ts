
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useSyncValidation = () => {
  const validateUserProfile = async (userId: string) => {
    let profile;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .single();

        if (profileError) {
          throw profileError;
        }
        
        profile = profileData;
        break;
      } catch (error) {
        retryCount++;
        console.log(`Profile fetch attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          throw new Error('Unable to get organization information after multiple attempts');
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (!profile) {
      throw new Error('Unable to get organization information');
    }

    return profile;
  };

  const validateZoomConnection = async (userId: string) => {
    let connection;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { data: connectionData, error: connectionError } = await supabase
          .from('zoom_connections')
          .select('connection_status')
          .eq('user_id', userId)
          .eq('connection_status', 'active')
          .single();

        if (connectionError) {
          throw connectionError;
        }
        
        connection = connectionData;
        break;
      } catch (error) {
        retryCount++;
        console.log(`Connection check attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          throw new Error('No active Zoom connection found. Please reconnect your Zoom account with the updated permissions.');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    return connection;
  };

  return {
    validateUserProfile,
    validateZoomConnection
  };
};
