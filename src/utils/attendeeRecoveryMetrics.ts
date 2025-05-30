
import { WebinarAttendeeResult } from '@/types/attendeeRecovery';

export interface RecoveryMetrics {
  successfulWebinars: number;
  failedWebinars: number;
  webinarsWithErrors: number;
  averageFoundPerWebinar: number;
  averageStoredPerWebinar: number;
  dataRecoveryRate: number;
}

export const calculateRecoveryMetrics = (
  results: WebinarAttendeeResult[],
  totalFound: number,
  totalAttendees: number,
  successfulRecoveries: number,
  failedRecoveries: number
): RecoveryMetrics => {
  const webinarsWithErrors = results.filter(r => r.errors > 0).length;
  const averageFoundPerWebinar = successfulRecoveries > 0 ? Math.round(totalFound / successfulRecoveries) : 0;
  const averageStoredPerWebinar = successfulRecoveries > 0 ? Math.round(totalAttendees / successfulRecoveries) : 0;
  const dataRecoveryRate = totalFound > 0 ? Math.round((totalAttendees / totalFound) * 100) : 0;

  return {
    successfulWebinars: successfulRecoveries,
    failedWebinars: failedRecoveries,
    webinarsWithErrors,
    averageFoundPerWebinar,
    averageStoredPerWebinar,
    dataRecoveryRate
  };
};

export const logFinalSummary = (
  metrics: RecoveryMetrics,
  totalWebinars: number,
  totalFound: number,
  totalAttendees: number,
  totalErrors: number,
  addLog: (message: string) => void
): void => {
  addLog(`\n🎉 ENHANCED BULK ATTENDEE RECOVERY COMPLETED!`);
  addLog(`📈 Comprehensive Results Summary:`);
  addLog(`  📊 PROCESSING METRICS:`);
  addLog(`     • Webinars processed: ${totalWebinars}`);
  addLog(`     • Successful recoveries: ${metrics.successfulWebinars}`);
  addLog(`     • Complete failures: ${metrics.failedWebinars}`);
  addLog(`     • Had errors/warnings: ${metrics.webinarsWithErrors}`);
  addLog(`  🎯 DATA RECOVERY METRICS:`);
  addLog(`     • Total attendees FOUND in Zoom: ${totalFound.toLocaleString()}`);
  addLog(`     • Total attendees STORED: ${totalAttendees.toLocaleString()}`);
  addLog(`     • Data recovery efficiency: ${metrics.dataRecoveryRate}%`);
  addLog(`     • Average found per webinar: ${metrics.averageFoundPerWebinar}`);
  addLog(`     • Average stored per webinar: ${metrics.averageStoredPerWebinar}`);
  addLog(`     • Total errors handled: ${totalErrors}`);
  addLog(`  🚀 RECOVERY PERFORMANCE:`);
  addLog(`     • Successful webinars: ${metrics.successfulWebinars}/${totalWebinars}`);
  addLog(`     • Success rate: ${Math.round((metrics.successfulWebinars / totalWebinars) * 100)}%`);
};
