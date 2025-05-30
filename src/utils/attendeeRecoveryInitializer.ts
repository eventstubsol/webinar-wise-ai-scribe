
export const logRecoveryInitialization = (
  webinars: any[],
  addLog: (message: string) => void
): void => {
  const zeroAttendeeCount = webinars.filter(w => (w.attendees_count || 0) === 0).length;
  const lowDataCount = webinars.filter(w => {
    const current = w.attendees_count || 0;
    const expected = w.registrants_count || Math.max(50, current * 1.5);
    return current < expected * 0.7; // Less than 70% of expected
  }).length;
  
  addLog('🚀 Starting ENHANCED bulk attendee recovery with maximum data recovery...');
  addLog('📊 Improvements: Transaction-based processing, improved error handling, enhanced data validation');
  addLog(`🎯 Found ${webinars.length} webinars to process:`);
  addLog(`  • ${zeroAttendeeCount} with ZERO attendees (highest priority)`);
  addLog(`  • ${lowDataCount} with suspected data gaps`);
  addLog(`  • Enhanced prioritization applied based on data gap severity`);
};

export const clearStuckJobsWithLogging = async (
  clearStuckJobsFunction: (userId: string) => Promise<void>,
  userId: string,
  addLog: (message: string) => void
): Promise<void> => {
  try {
    addLog('🧹 Clearing any stuck sync jobs...');
    await clearStuckJobsFunction(userId);
    addLog('✅ Successfully cleared any stuck sync jobs');
  } catch (error: any) {
    addLog(`⚠️ Warning clearing stuck jobs: ${error.message}`);
  }
};
