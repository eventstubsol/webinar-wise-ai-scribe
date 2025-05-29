
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Trash2 } from 'lucide-react';

interface AttendeeRecoveryLogsProps {
  logs: string[];
  onClearLogs: () => void;
}

const AttendeeRecoveryLogs = ({ logs, onClearLogs }: AttendeeRecoveryLogsProps) => {
  if (logs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendee Recovery Logs
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClearLogs}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear Logs
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full border rounded-md p-4">
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="text-xs font-mono">
                {log}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AttendeeRecoveryLogs;
