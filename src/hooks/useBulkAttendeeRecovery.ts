
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

      addLog('🚀 Starting ENHANCED bulk attendee recovery with maximum data recovery...');
      addLog('📊 Improvements: Transaction-based processing, improved error handling, enhanced data validation');

      // Step 1: Clear any stuck jobs
      try {
        addLog('🧹 Clearing any stuck sync jobs...');
        await clearStuckAttendeeJobs(user.id);
        addLog('✅ Successfully cleared any stuck sync jobs');
      } catch (error: any) {
        addLog(`⚠️ Warning clearing stuck jobs: ${error.message}`);
      }

      // Step 2: Get webinars to process with enhanced prioritization
      const { webinars, organization_id } = await getWebinarsForAttendeeRecovery(user.id);
      
      const zeroAttendeeCount = webinars.filter(w => (w.attendees_count || 0) === 0).length;
      const lowDataCount = webinars.filter(w => {
        const current = w.attendees_count || 0;
        const expected = w.registrants_count || Math.max(50, current * 1.5);
        return current < expected * 0.7; // Less than 70% of expected
      }).length;
      
      addLog(`🎯 Found ${webinars.length} webinars to process:`);
      addLog(`  • ${zeroAttendeeCount} with ZERO attendees (highest priority)`);
      addLog(`  • ${lowDataCount} with suspected data gaps`);
      addLog(`  • Enhanced prioritization applied based on data gap severity`);
      
      setRecoveryProgress(prev => ({ 
        ...prev, 
        totalWebinars: webinars.length,
        processedWebinars: 0,
        totalAttendees: 0,
        errors: 0
      }));

      // Step 3: Process webinars in optimized batches with enhanced error handling
      const batchSize = 1; // Process one at a time for maximum reliability
      const results: WebinarAttendeeResult[] = [];
      let totalAttendees = 0;
      let totalErrors = 0;
      let totalFound = 0;
      let successfulRecoveries = 0;
      let failedRecoveries = 0;

      for (let i = 0; i < webinars.length; i += batchSize) {
        const batch = webinars.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(webinars.length / batchSize);
        
        addLog(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} webinars) with ENHANCED recovery...`);

        // Process batch with comprehensive error handling
        const batchPromises = batch.map(webinar => 
          recoverWebinarAttendees(webinar, organization_id, user.id)
        );

        try {
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // Enhanced progress tracking with detailed metrics
          const processed = i + batch.length;
          const batchAttendees = batchResults.reduce((sum, r) => sum + r.attendees_stored, 0);
          const batchFound = batchResults.reduce((sum, r) => sum + r.attendees_found, 0);
          const batchErrors = batchResults.reduce((sum, r) => sum + r.errors, 0);
          
          totalAttendees += batchAttendees;
          totalFound += batchFound;
          totalErrors += batchErrors;

          // Update current batch successful/failed counts
          const batchSuccessful = batchResults.filter(r => r.success && r.attendees_stored > 0).length;
          const batchFailed = batchResults.filter(r => !r.success).length;
          
          successfulRecoveries += batchSuccessful;
          failedRecoveries += batchFailed;

          setRecoveryProgress(prev => ({
            ...prev,
            processedWebinars: processed,
            totalAttendees,
            errors: totalErrors,
            currentWebinar: batch[batch.length - 1]?.title || '',
            estimatedTimeRemaining: calculateEstimatedTime(processed, webinars.length, startTime)
          }));

          setRecoveryResults([...results]);

          // Enhanced logging for each webinar with comprehensive statistics
          batchResults.forEach(result => {
            const { recovery_stats } = result;
            
            if (result.attendees_stored > 0) {
              const efficiency = result.attendees_found > 0 ? 
                Math.round((result.attendees_stored / result.attendees_found) * 100) : 100;
              
              addLog(`✅ SUCCESS: ${result.title}`);
              addLog(`   📊 Found: ${result.attendees_found}, Stored: ${result.attendees_stored} (${efficiency}% efficiency)`);
              
              if (result.errors > 0) {
                addLog(`   ⚠️ Issues handled: ${result.errors} errors (${recovery_stats?.database_errors || 0} DB, ${recovery_stats?.validation_errors || 0} validation, ${recovery_stats?.constraint_violations || 0} constraints)`);
              }
              
              addLog(`   🔧 API: ${result.api_used}, Pages: ${recovery_stats?.total_pages_processed || '?'}`);
            } else if (result.success) {
              addLog(`ℹ️ EMPTY: ${result.title} - ${result.error_message || 'No attendees found in Zoom'}`);
            } else {
              addLog(`❌ FAILED: ${result.title} - ${result.error_message || 'Unknown error'}`);
            }
          });

          addLog(`📊 Batch ${batchNum} results: +${batchAttendees} stored, ${batchFound} found, ${batchErrors} errors`);

        } catch (batchError: any) {
          // Enhanced batch error handling - continue with next batch
          addLog(`⚠️ Batch ${batchNum} encountered an error: ${batchError.message}`);
          addLog(`🔄 Continuing with next batch...`);
          failedRecoveries += batch.length;
        }

        // Short delay between batches
        if (i + batchSize < webinars.length) {
          addLog('⏳ Brief pause before next enhanced batch...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Comprehensive final summary with detailed analytics
      const successfulWebinars = successfulRecoveries;
      const failedWebinars = failedRecoveries;
      const webinarsWithErrors = results.filter(r => r.errors > 0).length;
      const averageFoundPerWebinar = successfulWebinars > 0 ? Math.round(totalFound / successfulWebinars) : 0;
      const averageStoredPerWebinar = successfulWebinars > 0 ? Math.round(totalAttendees / successfulWebinars) : 0;
      const dataRecoveryRate = totalFound > 0 ? Math.round((totalAttendees / totalFound) * 100) : 0;

      addLog(`\n🎉 ENHANCED BULK ATTENDEE RECOVERY COMPLETED!`);
      addLog(`📈 Comprehensive Results Summary:`);
      addLog(`  📊 PROCESSING METRICS:`);
      addLog(`     • Webinars processed: ${webinars.length}`);
      addLog(`     • Successful recoveries: ${successfulWebinars}`);
      addLog(`     • Complete failures: ${failedWebinars}`);
      addLog(`     • Had errors/warnings: ${webinarsWithErrors}`);
      addLog(`  🎯 DATA RECOVERY METRICS:`);
      addLog(`     • Total attendees FOUND in Zoom: ${totalFound.toLocaleString()}`);
      addLog(`     • Total attendees STORED: ${totalAttendees.toLocaleString()}`);
      addLog(`     • Data recovery efficiency: ${dataRecoveryRate}%`);
      addLog(`     • Average found per webinar: ${averageFoundPerWebinar}`);
      addLog(`     • Average stored per webinar: ${averageStoredPerWebinar}`);
      addLog(`     • Total errors handled: ${totalErrors}`);
      addLog(`  🚀 RECOVERY PERFORMANCE:`);
      addLog(`     • Successful webinars: ${successfulWebinars}/${webinars.length}`);
      addLog(`     • Success rate: ${Math.round((successfulWebinars / webinars.length) * 100)}%`);

      const message = totalAttendees > 0 
        ? `🎯 ENHANCED RECOVERY SUCCESS! Found ${totalFound.toLocaleString()} attendees in Zoom, stored ${totalAttendees.toLocaleString()} (${dataRecoveryRate}% efficiency). ${totalErrors > 0 ? `Handled ${totalErrors} errors.` : 'No errors!'}`
        : `⚠️ Recovery completed but no attendees were stored. This may indicate data isn't available in Zoom for these webinars. Check individual results for details.`;

      toast({
        title: totalAttendees > 0 ? "🎉 Enhanced Recovery Success!" : "⚠️ Recovery Completed",
        description: totalAttendees > 0 
          ? `Recovered ${totalAttendees.toLocaleString()} attendees from ${successfulWebinars} webinars!`
          : "No attendees were recovered. Check logs for details.",
        variant: totalAttendees > 0 ? "default" : "destructive",
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
