
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Settings, LogOut, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import { GlobalSyncButton } from "./GlobalSyncButton";

const Header = () => {
  const { signOut, user } = useAuth();
  const { isConnected, zoomConnection } = useZoomIntegration();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Webinar Wise
            </h1>
          </div>
          
          {/* Zoom Status Indicator */}
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-gray-400" />
            <Badge 
              variant={isConnected ? "secondary" : "outline"} 
              className={isConnected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
            >
              {isConnected ? `Zoom: ${zoomConnection?.zoom_email?.split('@')[0]}` : 'Zoom: Not Connected'}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Welcome, {user?.user_metadata?.first_name || user?.email}
          </span>
          <GlobalSyncButton variant="outline" size="sm" />
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
