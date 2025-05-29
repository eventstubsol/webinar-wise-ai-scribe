
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Play, RefreshCw } from 'lucide-react';

interface AttendeeRecoveryControlPanelProps {
  isRunning: boolean;
  onStartRecovery: () => void;
}

const AttendeeRecoveryControlPanel = ({ isRunning, onStartRecovery }: AttendeeRecoveryControlPanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Bulk Attendee Recovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Recover all missing attendee data from Zoom API across all webinars
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This will systematically process all webinars using the correct Zoom API endpoints
            </p>
          </div>
          <Button 
            onClick={onStartRecovery}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? 'Recovery Running...' : 'Start Attendee Recovery'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendeeRecoveryControlPanel;
