
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play } from "lucide-react";
import SyncProgressIndicator from './SyncProgressIndicator';
import { SyncProgress } from '@/types/sync';

interface ZoomSyncTabProps {
  syncing: boolean;
  processing: boolean;
  isConnected: boolean;
  loading: boolean;
  syncProgress: SyncProgress | null;
  currentChunk?: number;
  chunkedSyncStats?: any;
  onSyncWebinarData: () => void;
  onProcessJobs: () => void;
  onRefresh: () => void;
}

const ZoomSyncTab = ({
  syncing,
  processing,
  isConnected,
  loading,
  syncProgress,
  currentChunk,
  chunkedSyncStats,
  onSyncWebinarData,
  onProcessJobs,
  onRefresh
}: ZoomSyncTabProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Webinar Data Sync</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncing && (
            <SyncProgressIndicator 
              syncing={syncing}
              progress={syncProgress?.progress || 0}
              currentChunk={currentChunk}
              syncStats={chunkedSyncStats}
              stage={syncProgress?.stage}
              message={syncProgress?.message}
            />
          )}
          
          <div className="flex space-x-4">
            <Button 
              onClick={onSyncWebinarData} 
              disabled={syncing || !isConnected || loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Enhanced Sync'}</span>
            </Button>
            
            <Button 
              onClick={onProcessJobs}
              disabled={processing || !isConnected}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Play className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
              <span>{processing ? 'Processing...' : 'Process Jobs'}</span>
            </Button>
            
            <Button 
              onClick={onRefresh}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>
          
          {!isConnected && (
            <p className="text-sm text-muted-foreground">
              Please connect to Zoom first to enable data synchronization.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ZoomSyncTab;
