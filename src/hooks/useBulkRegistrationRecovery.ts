
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { RecoveryProgress, WebinarRecoveryResult } from '@/types/registrationRecovery';
import { calculateEstimatedTime, addLogEntry } from '@/utils/registrationRecoveryUtils';
import { 
  clearStuckRegistrationJobs, 
  getWebinarsForRegistrationRecovery, 
  recoverWebinarRegistrations 
} from '@/services/registrationRecoveryService';

export const useBulkRegistrationRecovery = () => {
  const { user } = useAuth();
  const [recoveryProgress, setRecoveryProgress] = useState<RecoveryProgress>({
    totalWebinars: 0,
    processedWebinars: 0,
    currentWebinar: '',
    totalRegistrations: 0,
    errors: 0,
    isRunning: false
  });
  const [recoveryResults, setRecoveryResults] = useState<WebinarRecoveryResult[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    addLogEntry(message, setRecoveryLogs);
  };

  const startBulkRecovery = async () => {
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

      addLog('🚀 Starting bulk registration recovery process...');

      // Step 1: Clear stuck jobs
      try {
        addLog('Clearing stuck registration sync jobs...');
        await clearStuckRegistrationJobs(user.id);
        addLog('Stuck jobs cleared successfully');
      } catch (error: any) {
        addLog(`Warning: Failed to clear stuck jobs: ${error.message}`);
      }

      // Step 2: Get webinars to recover
      const { webinars, organization_id } = await getWebinarsForRegistrationRecovery(user.id);
      
      setRecoveryProgress(prev => ({ 
        ...prev, 
        totalWebinars: webinars.length,
        processedWebinars: 0,
        totalRegistrations: 0,
        errors: 0
      }));

      addLog(`📋 Processing ${webinars.length} webinars in batches of 3...`);

      // Step 3: Process webinars in batches
      const batchSize = 3;
      const results: WebinarRecoveryResult[] = [];
      let totalRegistrations = 0;
      let totalErrors = 0;

      for (let i = 0; i < webinars.length; i += batchSize) {
        const batch = webinars.slice(i, i + batchSize);
        addLog(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(webinars.length / batchSize)}...`);

        // Process batch in parallel
        const batchPromises = batch.map(webinar => 
          recoverWebinarRegistrations(webinar, organization_id, user.id)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update progress
        const processed = i + batch.length;
        const batchRegistrations = batchResults.reduce((sum, r) => sum + r.registrations_stored, 0);
        const batchErrors = batchResults.reduce((sum, r) => sum + r.errors, 0);
        
        totalRegistrations += batchRegistrations;
        totalErrors += batchErrors;

        setRecoveryProgress(prev => ({
          ...prev,
          processedWebinars: processed,
          totalRegistrations,
          errors: totalErrors,
          currentWebinar: batch[batch.length - 1]?.title || '',
          estimatedTimeRemaining: calculateEstimatedTime(processed, webinars.length, startTime)
        }));

        setRecoveryResults([...results]);

        // Log results for each webinar
        batchResults.forEach(result => {
          if (result.registrations_stored > 0) {
            addLog(`✅ Successfully recovered ${result.registrations_stored} registrations for ${result.title}`);
          } else {
            addLog(`❌ Failed to recover ${result.title}: ${result.error_message || 'Unknown error'}`);
          }
        });

        addLog(`📊 Batch complete: ${batchRegistrations} registrations recovered, ${batchErrors} errors`);

        // Delay between batches to respect rate limits
        if (i + batchSize < webinars.length) {
          addLog('⏱️ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Step 4: Final summary
      const successfulWebinars = results.filter(r => r.success).length;
      const failedWebinars = results.filter(r => !r.success).length;

      addLog(`\n🎉 Bulk recovery completed!`);
      addLog(`📈 Summary:`);
      addLog(`  - Webinars processed: ${webinars.length}`);
      addLog(`  - Successful recoveries: ${successfulWebinars}`);
      addLog(`  - Failed recoveries: ${failedWebinars}`);
      addLog(`  - Total registrations recovered: ${totalRegistrations}`);
      addLog(`  - Total errors: ${totalErrors}`);

      toast({
        title: "Recovery Complete!",
        description: `Recovered ${totalRegistrations} registrations from ${successfulWebinars}/${webinars.length} webinars.`,
      });

    } catch (error: any) {
      addLog(`❌ Bulk recovery failed: ${error.message}`);
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
    startBulkRecovery,
    clearRecoveryLogs
  };
};
