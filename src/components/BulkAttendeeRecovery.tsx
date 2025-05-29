
import React from 'react';
import { useBulkAttendeeRecovery } from '@/hooks/useBulkAttendeeRecovery';
import AttendeeRecoveryControlPanel from '@/components/attendee-recovery/AttendeeRecoveryControlPanel';
import AttendeeRecoveryProgress from '@/components/attendee-recovery/AttendeeRecoveryProgress';
import AttendeeRecoveryResults from '@/components/attendee-recovery/AttendeeRecoveryResults';
import AttendeeRecoveryLogs from '@/components/attendee-recovery/AttendeeRecoveryLogs';
import AttendeeRecoveryInfo from '@/components/attendee-recovery/AttendeeRecoveryInfo';

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
    </div>
  );
};

export default BulkAttendeeRecovery;
