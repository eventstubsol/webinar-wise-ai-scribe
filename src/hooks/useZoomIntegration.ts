
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ZoomConnection {
  id: string;
  zoom_user_id: string;
  zoom_email: string;
  connection_status: string;
  created_at: string;
  user_id: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_processed: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export const useZoomIntegration = () => {
  const { user } = useAuth();
  const [zoomConnection, setZoomConnection] = useState<ZoomConnection | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchZoomConnection();
      fetchSyncLogs();
    }
  }, [user]);

  const fetchZoomConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('zoom_connections')
        .select('*')
        .eq('user_id', user?.id)
        .eq('connection_status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setZoomConnection(data);
    } catch (error: any) {
      console.error('Error fetching Zoom connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching sync logs:', error);
    }
  };

  const initializeZoomOAuth = async () => {
    try {
      if (!user?.id) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Encode user ID in state parameter for user-level OAuth
      const state = btoa(user.id);
      const clientId = 'YOUR_ZOOM_CLIENT_ID'; // This should come from environment
      const redirectUri = `${window.location.origin}/functions/v1/zoom-oauth-callback`;
      
      const scope = 'webinar:read:admin meeting:read:admin user:read:admin';
      
      const authUrl = `https://zoom.us/oauth/authorize?` + 
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}`;

      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to initialize Zoom OAuth",
        variant: "destructive",
      });
      console.error('OAuth initialization error:', error);
    }
  };

  const syncWebinarData = async () => {
    if (!zoomConnection) {
      toast({
        title: "Error",
        description: "Please connect to Zoom first",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    
    try {
      // Get user's organization ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user?.id)
        .single();

      if (!profile) throw new Error('Unable to get organization information');

      // Sync webinars for this user
      const webinarsResponse = await supabase.functions.invoke('zoom-sync-webinars', {
        body: { 
          organization_id: profile.organization_id,
          user_id: user?.id 
        }
      });

      if (webinarsResponse.error) {
        throw new Error(webinarsResponse.error.message);
      }

      // Get latest webinars to sync participants
      const { data: webinars } = await supabase
        .from('webinars')
        .select('id, zoom_webinar_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Sync participants for each webinar
      for (const webinar of webinars || []) {
        if (webinar.zoom_webinar_id) {
          await supabase.functions.invoke('zoom-sync-participants', {
            body: {
              organization_id: profile.organization_id,
              user_id: user?.id,
              webinar_id: webinar.id,
              zoom_webinar_id: webinar.zoom_webinar_id,
            }
          });
        }
      }

      toast({
        title: "Success",
        description: "Webinar data synchronized successfully",
      });

      // Refresh sync logs
      fetchSyncLogs();
      
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync webinar data",
        variant: "destructive",
      });
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const disconnectZoom = async () => {
    try {
      if (zoomConnection) {
        const { error } = await supabase
          .from('zoom_connections')
          .update({ connection_status: 'revoked' })
          .eq('id', zoomConnection.id)
          .eq('user_id', user?.id);

        if (error) throw error;

        // Clear tokens from user profile
        await supabase
          .from('profiles')
          .update({
            zoom_access_token: null,
            zoom_refresh_token: null,
            zoom_token_expires_at: null,
          })
          .eq('id', user?.id);

        setZoomConnection(null);
        
        toast({
          title: "Disconnected",
          description: "Zoom integration has been disconnected",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to disconnect Zoom integration",
        variant: "destructive",
      });
      console.error('Disconnect error:', error);
    }
  };

  return {
    zoomConnection,
    syncLogs,
    loading,
    syncing,
    isConnected: !!zoomConnection,
    initializeZoomOAuth,
    syncWebinarData,
    disconnectZoom,
    refreshConnection: fetchZoomConnection,
    refreshLogs: fetchSyncLogs,
  };
};
