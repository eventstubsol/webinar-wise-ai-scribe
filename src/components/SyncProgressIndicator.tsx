
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";

interface SyncProgressProps {
  syncing: boolean;
  progress: number;
  currentChunk?: number;
  totalProcessed?: number;
  syncStats?: {
    totalFound: number;
    processed: number;
    errors: number;
    chunks: number;
  };
  stage?: string;
  message?: string;
}

const SyncProgressIndicator = ({ 
  syncing, 
  progress, 
  currentChunk, 
  totalProcessed, 
  syncStats,
  stage,
  message 
}: SyncProgressProps) => {
  if (!syncing && progress === 0) {
    return null;
  }

  const getStatusIcon = () => {
    if (syncing) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    } else if (progress === 100) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    }
  };

  const getStatusText = () => {
    if (syncing) {
      return "Syncing in Progress";
    } else if (progress === 100) {
      return "Sync Complete";
    } else {
      return "Sync Paused";
    }
  };

  const getStatusColor = () => {
    if (syncing) {
      return "bg-blue-100 text-blue-800";
    } else if (progress === 100) {
      return "bg-green-100 text-green-800";
    } else {
      return "bg-orange-100 text-orange-800";
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>Sync Status</span>
          </div>
          <Badge variant="secondary" className={getStatusColor()}>
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {message && (
          <p className="text-sm text-gray-600">{message}</p>
        )}

        {currentChunk && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-3 h-3" />
            <span>Processing chunk {currentChunk}</span>
          </div>
        )}

        {syncStats && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Webinars Found:</span>
              <span className="ml-2 font-medium">{syncStats.totalFound}</span>
            </div>
            <div>
              <span className="text-gray-500">Processed:</span>
              <span className="ml-2 font-medium">{syncStats.processed}</span>
            </div>
            <div>
              <span className="text-gray-500">Chunks:</span>
              <span className="ml-2 font-medium">{syncStats.chunks}</span>
            </div>
            <div>
              <span className="text-gray-500">Errors:</span>
              <span className="ml-2 font-medium text-red-600">{syncStats.errors}</span>
            </div>
          </div>
        )}

        {totalProcessed && totalProcessed > 0 && (
          <div className="text-sm">
            <span className="text-gray-500">Total Processed:</span>
            <span className="ml-2 font-medium text-green-600">{totalProcessed}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncProgressIndicator;
