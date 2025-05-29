
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { AttendeeRecoveryProgress, WebinarAttendeeResult } from '@/types/attendeeRecovery';
import { calculateEstimatedTime, addLogEntry } from '@/utils/attendeeRecoveryUtils';
import { 
  clearStuckAttendeeJobs, 
  getWebinarsForAttendeeRecovery, 
  recoverWebinarAttendees 
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

      addLog('🚀 Starting bulk attendee recovery with fixed database constraints...');

      // Step 1: Clear any stuck jobs
      try {
        addLog('Clearing any stuck sync jobs...');
        await clearStuckAttendeeJobs(user.id);
        addLog('Successfully cleared any stuck sync jobs');
      } catch (error: any) {
        addLog(`Warning: ${error.message}`);
      }

      // Step 2: Get webinars to process
      const { webinars, organization_id } = await getWebinarsForAttendeeRecovery(user.id);
      
      const zeroAttendeeCount = webinars.filter(w => (w.attendees_count || 0) === 0).length;
      addLog(`Found ${webinars.length} webinars to process (${zeroAttendeeCount} with 0 attendees will be prioritized)`);
      
      setRecoveryProgress(prev => ({ 
        ...prev, 
        totalWebinars: webinars.length,
        processedWebinars: 0,
        totalAttendees: 0,
        errors: 0
      }));

      // Step 3: Process webinars in small batches
      const batchSize = 3;
      const results: WebinarAttendeeResult[] = [];
      let totalAttendees = 0;
      let totalErrors = 0;

      for (let i = 0; i < webinars.length; i += batchSize) {
        const batch = webinars.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(webinars.length / batchSize);
        
        addLog(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} webinars)...`);

        // Process batch in parallel
        const batchPromises = batch.map(webinar => 
          recoverWebinarAttendees(webinar, organization_id, user.id)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update progress
        const processed = i + batch.length;
        const batchAttendees = batchResults.reduce((sum, r) => sum + r.attendees_stored, 0);
        const batchErrors = batchResults.reduce((sum, r) => sum + r.errors, 0);
        
        totalAttendees += batchAttendees;
        totalErrors += batchErrors;

        setRecoveryProgress(prev => ({
          ...prev,
          processedWebinars: processed,
          totalAttendees,
          errors: totalErrors,
          currentWebinar: batch[batch.length - 1]?.title || '',
          estimatedTimeRemaining: calculateEstimatedTime(processed, webinars.length, startTime)
        }));

        setRecoveryResults([...results]);

        // Log results for each webinar
        batchResults.forEach(result => {
          if (result.attendees_stored > 0) {
            addLog(`✅ Success: ${result.title} - Stored ${result.attendees_stored} attendees`);
          } else {
            addLog(`⚠️ No data: ${result.title} - Found ${result.attendees_found} but stored ${result.attendees_stored}`);
          }
        });

        addLog(`📊 Batch ${batchNum} complete: +${batchAttendees} attendees, ${batchErrors} errors`);

        // Short delay between batches
        if (i + batchSize < webinars.length) {
          addLog('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Final summary
      const successfulWebinars = results.filter(r => r.success && r.attendees_stored > 0).length;
      const failedWebinars = results.filter(r => !r.success || r.attendees_stored === 0).length;
      const totalFound = results.reduce((sum, r) => sum + r.attendees_found, 0);

      addLog(`\n🎉 Bulk attendee recovery completed!`);
      addLog(`📈 Final Results:`);
      addLog(`  • Webinars processed: ${webinars.length}`);
      addLog(`  • Successful recoveries: ${successfulWebinars}`);
      addLog(`  • Failed/empty recoveries: ${failedWebinars}`);
      addLog(`  • Total attendees found: ${totalFound}`);
      addLog(`  • Total attendees stored: ${totalAttendees}`);

      const message = totalAttendees > 0 
        ? `Successfully recovered ${totalAttendees} attendees from ${successfulWebinars} webinars!`
        : `Recovery completed but no attendees were stored. Check individual webinar results for details.`;

      toast({
        title: totalAttendees > 0 ? "Recovery Successful!" : "Recovery Completed",
        description: message,
        variant: totalAttendees > 0 ? "default" : "destructive",
      });

    } catch (error: any) {
      addLog(`❌ Bulk attendee recovery failed: ${error.message}`);
      toast({
        title: "Recovery Failed",
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
