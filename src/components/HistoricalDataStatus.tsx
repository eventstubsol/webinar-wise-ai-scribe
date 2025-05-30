
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Archive, Calendar, TrendingUp } from "lucide-react";
import { useHistoricalData } from "@/hooks/useHistoricalData";
import { toast } from "@/hooks/use-toast";

const HistoricalDataStatus = () => {
  const { stats, loading, fetchHistoricalStats, markOldDataAsHistorical, getDataRetentionSummary } = useHistoricalData();
  const retentionSummary = getDataRetentionSummary();

  const handleMarkOldData = async () => {
    const result = await markOldDataAsHistorical(90);
    
    if (result?.success) {
      toast({
        title: "Data Archival Complete",
        description: "Old data has been marked as historical for preservation.",
      });
    } else {
      toast({
        title: "Archival Failed",
        description: result?.error || "Failed to mark old data as historical.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading historical data status...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Archive className="w-5 h-5" />
          <span>Historical Data Preservation</span>
        </CardTitle>
        {retentionSummary.dataPreservationWorking && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Active
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-2xl font-bold text-blue-600">
              <Database className="w-5 h-5" />
              <span>{stats.totalRecords.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-600">Total Records</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-2xl font-bold text-green-600">
              <TrendingUp className="w-5 h-5" />
              <span>{stats.currentRecords.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-600">Current Data</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-2xl font-bold text-orange-600">
              <Archive className="w-5 h-5" />
              <span>{stats.historicalRecords.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-600">Historical Records</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-2xl font-bold text-purple-600">
              <Calendar className="w-5 h-5" />
              <span>{stats.dataRetentionDays}</span>
            </div>
            <p className="text-sm text-gray-600">Days Retained</p>
          </div>
        </div>

        {retentionSummary.hasDataBeyondZoomRetention && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Success
              </Badge>
              <span className="text-green-800 font-medium">
                Data preserved beyond Zoom's 90-day window
              </span>
            </div>
            <p className="text-green-700 text-sm mt-1">
              You have {retentionSummary.daysBeyondZoomRetention} days of historical data that would have been lost without this preservation system.
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Historical Data Preservation Features</h4>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Data is never deleted, only marked as historical when changed</li>
            <li>• Multiple attendance sessions per person are preserved</li>
            <li>• Change detection prevents duplicate storage</li>
            <li>• Historical records remain accessible indefinitely</li>
            <li>• Sync timestamps track data freshness</li>
          </ul>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={fetchHistoricalStats}
            variant="outline"
            size="sm"
          >
            Refresh Stats
          </Button>
          
          <Button 
            onClick={handleMarkOldData}
            variant="outline" 
            size="sm"
          >
            Archive Old Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricalDataStatus;
