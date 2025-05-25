
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import KPICards from "@/components/KPICards";
import Charts from "@/components/Charts";
import AttendeeTable from "@/components/AttendeeTable";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-[calc(100vh-80px)]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                "Future of AI in Marketing" Webinar Analysis
              </h2>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>Host: Sarah Wilson</span>
                <span>•</span>
                <span>March 15, 2024 at 2:00 PM EST</span>
                <span>•</span>
                <span>ID: 892-456-123</span>
              </div>
            </div>
            
            <KPICards />
            <Charts />
            <AttendeeTable />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
