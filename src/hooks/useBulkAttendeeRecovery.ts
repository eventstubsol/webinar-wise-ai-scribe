
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { AttendeeRecoveryProgress, WebinarAttendeeResult } from '@/types/attendeeRecovery';
import { calculateEstimatedTime, addLogEntry } from '@/utils/attendeeRecoveryUtils';
import { processBatch, calculateBatchMetrics } from '@/utils/attendeeRecoveryBatchProcessor';
import { calculateRecoveryMetrics, logFinalSummary } from '@/utils/attendeeRecoveryMetrics';
import { logRecoveryInitialization, clearStuckJobsWithLogging } from '@/utils/attendeeRecoveryInitializer';
import { 
  clearStuckAttendeeJobs, 
  getWebinarsForAttendeeRecovery 
} from '@/services/attendeeRecoveryService';

export const useBulkAttendeeRecovery = () => {
  const { user } = useAuth();
  const [recoveryProgress, setRecoveryProgress] = useState<AttendeeRecoveryProgress>({
    totalWebinars: 0,
    processedWebinars: 0,
    currentWebinar: '',
    totalAttendees: 0,
    errors: 0,
    isRunning: false
  });
  const [recoveryResults, setRecoveryResults] = useState<WebinarAttendeeResult[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    addLogEntry(message, setRecoveryLogs);
  };

  const startBulkAttendeeRecovery = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    try {
      const startTime = new Date();
      setRecoveryProgress(prev => ({ ...prev, isRunning: true, startTime }));
      setRecoveryResults([]);
      setRecoveryLogs([]);

      // Step 1: Clear any stuck jobs
      await clearStuckJobsWithLogging(clearStuckAttendeeJobs, user.id, addLog);

      // Step 2: Get webinars to process with enhanced prioritization
      const { webinars, organization_id } = await getWebinarsForAttendeeRecovery(user.id);
      
      logRecoveryInitialization(webinars, addLog);
      
      setRecoveryProgress(prev => ({ 
        ...prev, 
        totalWebinars: webinars.length,
        processedWebinars: 0,
        totalAttendees: 0,
        errors: 0
      }));

      // Step 3: Process webinars in optimized batches
      const batchSize = 1;
      const allResults: WebinarAttendeeResult[] = [];
      let cumulativeMetrics = {
        totalAttendees: 0,
        totalFound: 0,
        totalErrors: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0
      };

      for (let i = 0; i < webinars.length; i += batchSize) {
        const batch = webinars.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(webinars.length / batchSize);
        
        try {
          const batchResults = await processBatch(
            batch, 
            organization_id, 
            user.id, 
            batchNum, 
            totalBatches, 
            addLog
          );
          
          allResults.push(...batchResults);
          
          // Calculate cumulative metrics
          const batchMetrics = calculateBatchMetrics(batchResults);
          cumulativeMetrics.totalAttendees += batchMetrics.totalAttendees;
          cumulativeMetrics.totalFound += batchMetrics.totalFound;
          cumulativeMetrics.totalErrors += batchMetrics.totalErrors;
          cumulativeMetrics.successfulRecoveries += batchMetrics.successfulRecoveries;
          cumulativeMetrics.failedRecoveries += batchMetrics.failedRecoveries;

          // Update progress
          const processed = i + batch.length;
          setRecoveryProgress(prev => ({
            ...prev,
            processedWebinars: processed,
            totalAttendees: cumulativeMetrics.totalAttendees,
            errors: cumulativeMetrics.totalErrors,
            currentWebinar: batch[batch.length - 1]?.title || '',
            estimatedTimeRemaining: calculateEstimatedTime(processed, webinars.length, startTime)
          }));

          setRecoveryResults([...allResults]);

        } catch (batchError: any) {
          cumulativeMetrics.failedRecoveries += batch.length;
        }

        // Short delay between batches
        if (i + batchSize < webinars.length) {
          addLog('⏳ Brief pause before next enhanced batch...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Final summary
      const metrics = calculateRecoveryMetrics(
        allResults,
        cumulativeMetrics.totalFound,
        cumulativeMetrics.totalAttendees,
        cumulativeMetrics.successfulRecoveries,
        cumulativeMetrics.failedRecoveries
      );

      logFinalSummary(
        metrics,
        webinars.length,
        cumulativeMetrics.totalFound,
        cumulativeMetrics.totalAttendees,
        cumulativeMetrics.totalErrors,
        addLog
      );

      const message = cumulativeMetrics.totalAttendees > 0 
        ? `🎯 ENHANCED RECOVERY SUCCESS! Found ${cumulativeMetrics.totalFound.toLocaleString()} attendees in Zoom, stored ${cumulativeMetrics.totalAttendees.toLocaleString()} (${metrics.dataRecoveryRate}% efficiency). ${cumulativeMetrics.totalErrors > 0 ? `Handled ${cumulativeMetrics.totalErrors} errors.` : 'No errors!'}`
        : `⚠️ Recovery completed but no attendees were stored. This may indicate data isn't available in Zoom for these webinars. Check individual results for details.`;

      toast({
        title: cumulativeMetrics.totalAttendees > 0 ? "🎉 Enhanced Recovery Success!" : "⚠️ Recovery Completed",
        description: cumulativeMetrics.totalAttendees > 0 
          ? `Recovered ${cumulativeMetrics.totalAttendees.toLocaleString()} attendees from ${metrics.successfulWebinars} webinars!`
          : "No attendees were recovered. Check logs for details.",
        variant: cumulativeMetrics.totalAttendees > 0 ? "default" : "destructive",
      });

    } catch (error: any) {
      addLog(`❌ ENHANCED bulk attendee recovery failed: ${error.message}`);
      toast({
        title: "🚨 Enhanced Recovery Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRecoveryProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const clearRecoveryLogs = () => {
    setRecoveryLogs([]);
  };

  return {
    recoveryProgress,
    recoveryResults,
    recoveryLogs,
    startBulkAttendeeRecovery,
    clearRecoveryLogs
  };
};
