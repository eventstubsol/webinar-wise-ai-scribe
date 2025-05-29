
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import UserProfileCard from '@/components/UserProfileCard';
import ZoomConnectionCard from '@/components/ZoomConnectionCard';
import { useZoomConnection } from '@/hooks/useZoomConnection';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';

const AccountDashboard = () => {
  const navigate = useNavigate();
  const { zoomConnection, isConnected } = useZoomConnection();

  const navigateToDebugPolls = () => {
    navigate('/?tab=integration&subtab=debug');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-[calc(100vh-80px)]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
              {isConnected && (
                <Button 
                  onClick={navigateToDebugPolls}
                  className="flex items-center space-x-2"
                  variant="outline"
                >
                  <Bug className="w-4 h-4" />
                  <span>Debug Polls</span>
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UserProfileCard />
              <ZoomConnectionCard 
                zoomConnection={zoomConnection}
                isConnected={isConnected}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AccountDashboard;
