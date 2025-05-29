
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import KPICards from "@/components/KPICards";
import Charts from "@/components/Charts";
import AttendeeTable from "@/components/AttendeeTable";
import ZoomIntegration from "@/components/ZoomIntegration";
import { useWebinarData } from "@/hooks/useWebinarData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Settings } from "lucide-react";

const Index = () => {
  const { webinars } = useWebinarData();
  const latestWebinar = webinars[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-[calc(100vh-80px)]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {latestWebinar?.title || "Welcome to Webinar Wise"}
              </h2>
              {latestWebinar && (
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Host: {latestWebinar.host_name || "Unknown"}</span>
                  <span>•</span>
                  <span>
                    {latestWebinar.start_time 
                      ? new Date(latestWebinar.start_time).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : "Date not available"
                    }
                  </span>
                  <span>•</span>
                  <span>ID: {latestWebinar.id.slice(0, 12)}...</span>
                </div>
              )}
            </div>
            
            <Tabs defaultValue="dashboard" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="attendees" className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Attendees</span>
                </TabsTrigger>
                <TabsTrigger value="integration" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Zoom Integration</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-6">
                <KPICards />
                <Charts />
              </TabsContent>

              <TabsContent value="attendees">
                <AttendeeTable />
              </TabsContent>

              <TabsContent value="integration">
                <ZoomIntegration />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
