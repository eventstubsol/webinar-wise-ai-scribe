
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import WebinarsList from "@/components/WebinarsList";
import WebinarsFilters from "@/components/WebinarsFilters";
import { useState } from "react";

const WebinarsPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    dateRange: { from: undefined, to: undefined },
    status: "all"
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-[calc(100vh-80px)]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Webinars</h1>
              <p className="text-gray-600">View and manage your Zoom webinars</p>
            </div>

            <div className="space-y-6">
              <WebinarsFilters filters={filters} onFiltersChange={setFilters} />
              <WebinarsList filters={filters} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WebinarsPage;
