
import { WebinarAttendeeResult } from '@/types/attendeeRecovery';
import { recoverWebinarAttendees } from '@/services/attendeeRecoveryService';

export interface BatchProcessingResult {
  results: WebinarAttendeeResult[];
  totalAttendees: number;
  totalFound: number;
  totalErrors: number;
  successfulRecoveries: number;
  failedRecoveries: number;
}

export const processBatch = async (
  batch: any[],
  organizationId: string,
  userId: string,
  batchNum: number,
  totalBatches: number,
  addLog: (message: string) => void
): Promise<WebinarAttendeeResult[]> => {
  addLog(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} webinars) with ENHANCED recovery...`);

  const batchPromises = batch.map(webinar => 
    recoverWebinarAttendees(webinar, organizationId, userId)
  );

  try {
    const batchResults = await Promise.all(batchPromises);
    
    // Log detailed results for each webinar
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
        
        addLog(`   🔧 API: ${result.api_used}, Pages: ${recovery_stats?.pages_processed || '?'}`);
      } else if (result.success) {
        addLog(`ℹ️ EMPTY: ${result.title} - ${result.error_message || 'No attendees found in Zoom'}`);
      } else {
        addLog(`❌ FAILED: ${result.title} - ${result.error_message || 'Unknown error'}`);
      }
    });

    const batchAttendees = batchResults.reduce((sum, r) => sum + r.attendees_stored, 0);
    const batchFound = batchResults.reduce((sum, r) => sum + r.attendees_found, 0);
    const batchErrors = batchResults.reduce((sum, r) => sum + r.errors, 0);
    
    addLog(`📊 Batch ${batchNum} results: +${batchAttendees} stored, ${batchFound} found, ${batchErrors} errors`);
    
    return batchResults;
  } catch (batchError: any) {
    addLog(`⚠️ Batch ${batchNum} encountered an error: ${batchError.message}`);
    addLog(`🔄 Continuing with next batch...`);
    throw batchError;
  }
};

export const calculateBatchMetrics = (results: WebinarAttendeeResult[]): BatchProcessingResult => {
  const totalAttendees = results.reduce((sum, r) => sum + r.attendees_stored, 0);
  const totalFound = results.reduce((sum, r) => sum + r.attendees_found, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  const successfulRecoveries = results.filter(r => r.success && r.attendees_stored > 0).length;
  const failedRecoveries = results.filter(r => !r.success).length;

  return {
    results,
    totalAttendees,
    totalFound,
    totalErrors,
    successfulRecoveries,
    failedRecoveries
  };
};
