
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import UserProfileCard from "@/components/UserProfileCard";
import ZoomConnectionCard from "@/components/ZoomConnectionCard";
import RecentActivityCard from "@/components/RecentActivityCard";
import { useAuth } from "@/hooks/useAuth";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";

const AccountDashboard = () => {
  const { user } = useAuth();
  const { zoomConnection, syncLogs } = useZoomIntegration();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-[calc(100vh-80px)]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Dashboard</h1>
              <p className="text-gray-600">Manage your account settings and Zoom integration</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <UserProfileCard user={user} />
              <ZoomConnectionCard 
                zoomConnection={zoomConnection} 
                isConnected={!!zoomConnection}
              />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <RecentActivityCard syncLogs={syncLogs} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AccountDashboard;
