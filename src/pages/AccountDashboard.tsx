
import { useAuth } from "@/hooks/useAuth";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import UserProfileCard from "@/components/UserProfileCard";
import ZoomConnectionCard from "@/components/ZoomConnectionCard";
import RecentActivityCard from "@/components/RecentActivityCard";
import RealtimeDashboard from "@/components/RealtimeDashboard";
import WebhookTestingPanel from "@/components/WebhookTestingPanel";

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
              <p className="text-gray-600">Manage your account settings and enhanced Zoom integration with comprehensive data collection</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <UserProfileCard user={user} />
              <ZoomConnectionCard 
                zoomConnection={zoomConnection} 
                isConnected={!!zoomConnection && zoomConnection.connection_status === 'active'}
              />
            </div>

            {/* Enhanced Features Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🚀 Enhanced Data Collection Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">📋 Webinar Templates</h4>
                  <p className="text-sm text-blue-600">Sync and track webinar templates, branding, and source tracking</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">📝 Registration Analytics</h4>
                  <p className="text-sm text-blue-600">Enhanced registration questions and detailed response tracking</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">🎥 Recording Analytics</h4>
                  <p className="text-sm text-blue-600">View counts, transcripts, and detailed recording usage data</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">👥 Participant Insights</h4>
                  <p className="text-sm text-blue-600">Attention scores, engagement timelines, and interaction analytics</p>
                </div>
              </div>
            </div>

            {/* Real-time Dashboard */}
            <div className="mb-6">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-green-900 mb-3">⚡ Real-time Monitoring (Phase 2)</h3>
                <p className="text-green-700 mb-4">
                  Live webinar tracking, real-time participant analytics, and instant event notifications
                </p>
              </div>
              <RealtimeDashboard />
            </div>

            {/* Webhook Testing Panel */}
            <div className="mb-6">
              <WebhookTestingPanel />
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
