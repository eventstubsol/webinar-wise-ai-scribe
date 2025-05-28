
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Settings } from "lucide-react";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import ZoomConnectionWizard from "./ZoomConnectionWizard";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface ZoomConnectionCardProps {
  zoomConnection: any;
  isConnected: boolean;
}

const ZoomConnectionCard = ({ zoomConnection, isConnected }: ZoomConnectionCardProps) => {
  const { disconnectZoom, syncing, syncWebinarData } = useZoomIntegration();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const navigate = useNavigate();

  const handleWizardSuccess = () => {
    navigate('/account');
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Link2 className="w-5 h-5" />
            <span>Zoom Integration</span>
          </CardTitle>
          {isConnected ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 mb-2">
                    Connected
                  </Badge>
                  <p className="text-sm text-gray-600">
                    Connected as: {zoomConnection?.zoom_email}
                  </p>
                  <p className="text-xs text-gray-500">
                    Since: {zoomConnection?.created_at ? new Date(zoomConnection.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={syncWebinarData} 
                  disabled={syncing}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Data'}</span>
                </Button>
                
                <Button 
                  onClick={disconnectZoom}
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <Badge variant="outline" className="bg-gray-100 text-gray-800 mb-3">
                  Not Connected
                </Badge>
                <p className="text-sm text-gray-600 mb-6">
                  Connect your Zoom account to automatically sync webinar data, attendee information, 
                  and engagement metrics.
                </p>
                <Button 
                  onClick={() => setIsWizardOpen(true)}
                  className="flex items-center space-x-2"
                  size="lg"
                >
                  <Settings className="w-4 h-4" />
                  <span>Setup Zoom Integration</span>
                </Button>
              </div>
            </>
          )}

          <div className="pt-2 border-t">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <AlertTriangle className="w-3 h-3" />
              <span>Your Zoom credentials are stored securely and only accessible by you</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ZoomConnectionWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleWizardSuccess}
      />
    </>
  );
};

export default ZoomConnectionCard;
