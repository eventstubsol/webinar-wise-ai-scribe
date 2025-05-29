
export const calculateEstimatedTime = (processed: number, total: number, startTime: Date): string => {
  if (processed === 0) return 'Calculating...';
  
  const elapsed = Date.now() - startTime.getTime();
  const avgTimePerWebinar = elapsed / processed;
  const remaining = (total - processed) * avgTimePerWebinar;
  
  const minutes = Math.ceil(remaining / 60000);
  return `~${minutes} minutes`;
};

export const addLogEntry = (message: string, setLogs: (updater: (prev: string[]) => string[]) => void): void => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  setLogs(prev => [...prev, logEntry]);
  console.log(logEntry);
};
