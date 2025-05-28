
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Link2, Unlink, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";

const ZoomIntegration = () => {
  const {
    zoomConnection,
    syncLogs,
    loading,
    syncing,
    isConnected,
    initializeZoomOAuth,
    syncWebinarData,
    disconnectZoom,
  } = useZoomIntegration();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading Zoom integration status...</span>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'started':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'started':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Link2 className="w-5 h-5" />
            <span>Zoom Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Connected
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {zoomConnection?.zoom_email}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Connected on {new Date(zoomConnection?.created_at || '').toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectZoom}
                  className="text-red-600 hover:text-red-700"
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>

              <Separator />

              <div className="flex items-center space-x-4">
                <Button
                  onClick={syncWebinarData}
                  disabled={syncing}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Webinar Data'}</span>
                </Button>
                <p className="text-sm text-gray-600">
                  Sync your latest webinar data from Zoom
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div>
                <Badge variant="outline" className="bg-gray-100 text-gray-800">
                  Not Connected
                </Badge>
                <p className="text-sm text-gray-600 mt-2">
                  Connect your Zoom account to sync webinar data automatically
                </p>
              </div>
              <Button onClick={initializeZoomOAuth} className="flex items-center space-x-2">
                <Link2 className="w-4 h-4" />
                <span>Connect to Zoom</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Sync History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium capitalize">{log.sync_type}</span>
                        <Badge variant="outline" className={getStatusColor(log.status)}>
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {new Date(log.started_at).toLocaleString()}
                        {log.records_processed !== null && (
                          <span className="ml-2">• {log.records_processed} records</span>
                        )}
                      </p>
                      {log.error_message && (
                        <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {log.completed_at ? (
                      `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                    ) : (
                      'In progress...'
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ZoomIntegration;
