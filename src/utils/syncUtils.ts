
export const calculateEstimatedTime = (progress: number, startedAt: string): string => {
  if (progress <= 0) return 'Calculating...';
  
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const totalEstimated = (elapsed / progress) * 100;
  const remaining = totalEstimated - elapsed;
  
  if (remaining <= 0) return 'Almost done...';
  
  const minutes = Math.ceil(remaining / (1000 * 60));
  return `~${minutes} min remaining`;
};
