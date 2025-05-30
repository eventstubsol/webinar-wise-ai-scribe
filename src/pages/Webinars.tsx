import React from 'react';
import ZoomConnectionCard from "@/components/ZoomConnectionCard";
import { useAuth } from "@/hooks/useAuth";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import HistoricalDataStatus from "@/components/HistoricalDataStatus";

const Webinars = () => {
  const { user } = useAuth();
  const { 
    zoomConnection, 
    isConnected,
  } = useZoomIntegration();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Webinar Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor your webinar performance and sync data from Zoom
          </p>
        </div>

        <div className="space-y-6">
          {/* Historical Data Status */}
          <HistoricalDataStatus />
          
          {/* Zoom Integration Card */}
          <ZoomConnectionCard 
            zoomConnection={zoomConnection} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
};

export default Webinars;
