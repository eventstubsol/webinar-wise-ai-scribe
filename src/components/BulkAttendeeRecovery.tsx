
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBulkAttendeeRecovery } from '@/hooks/useBulkAttendeeRecovery';
import AttendeeRecoveryControlPanel from '@/components/attendee-recovery/AttendeeRecoveryControlPanel';
import AttendeeRecoveryProgress from '@/components/attendee-recovery/AttendeeRecoveryProgress';
import AttendeeRecoveryResults from '@/components/attendee-recovery/AttendeeRecoveryResults';
import AttendeeRecoveryLogs from '@/components/attendee-recovery/AttendeeRecoveryLogs';
import AttendeeRecoveryInfo from '@/components/attendee-recovery/AttendeeRecoveryInfo';
import AttendeeRecoveryDiagnosticsComponent from '@/components/attendee-recovery/AttendeeRecoveryDiagnostics';

const BulkAttendeeRecovery = () => {
  const {
    recoveryProgress,
    recoveryResults,
    recoveryLogs,
    startBulkAttendeeRecovery,
    clearRecoveryLogs
  } = useBulkAttendeeRecovery();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Recovery</TabsTrigger>
          <TabsTrigger value="diagnostics">Advanced Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-6">
          <AttendeeRecoveryControlPanel 
            isRunning={recoveryProgress.isRunning}
            onStartRecovery={startBulkAttendeeRecovery}
          />

          <AttendeeRecoveryProgress progress={recoveryProgress} />

          <AttendeeRecoveryResults results={recoveryResults} />

          <AttendeeRecoveryLogs 
            logs={recoveryLogs}
            onClearLogs={clearRecoveryLogs}
          />

          <AttendeeRecoveryInfo />
        </TabsContent>
        
        <TabsContent value="diagnostics">
          <AttendeeRecoveryDiagnosticsComponent />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkAttendeeRecovery;
