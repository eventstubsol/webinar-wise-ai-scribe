
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
  credentials_stored_at?: string;
}

export const useZoomConnection = () => {
  const { user } = useAuth();
  const [zoomConnection, setZoomConnection] = useState<ZoomConnection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchZoomConnection();
    }
  }, [user]);

  const fetchZoomConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('zoom_connections')
        .select('*')
        .eq('user_id', user?.id)
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

      const { data, error } = await supabase.functions.invoke('zoom-oauth-initiate');

      if (error) {
        throw new Error(error.message);
      }

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize Zoom OAuth",
        variant: "destructive",
      });
      console.error('OAuth initialization error:', error);
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
    loading,
    isConnected: !!zoomConnection && zoomConnection.connection_status === 'active',
    initializeZoomOAuth,
    disconnectZoom,
    refreshConnection: fetchZoomConnection,
  };
};
