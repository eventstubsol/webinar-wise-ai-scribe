
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface AttendeeRecoveryProgress {
  totalWebinars: number;
  processedWebinars: number;
  currentWebinar: string;
  totalAttendees: number;
  errors: number;
  isRunning: boolean;
  startTime?: Date;
  estimatedTimeRemaining?: string;
}

interface WebinarAttendeeResult {
  webinar_id: string;
  zoom_webinar_id: string;
  title: string;
  attendees_found: number;
  attendees_stored: number;
  errors: number;
  success: boolean;
  api_used?: string;
  error_message?: string;
}

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
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setRecoveryLogs(prev => [...prev, logEntry]);
    console.log(logEntry);
  };

  const calculateEstimatedTime = (processed: number, total: number, startTime: Date) => {
    if (processed === 0) return 'Calculating...';
    
    const elapsed = Date.now() - startTime.getTime();
    const avgTimePerWebinar = elapsed / processed;
    const remaining = (total - processed) * avgTimePerWebinar;
    
    const minutes = Math.ceil(remaining / 60000);
    return `~${minutes} minutes`;
  };

  const clearStuckJobs = async () => {
    try {
      addLog('Clearing any stuck sync jobs...');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Clear old sync logs that are stuck
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { error: clearError } = await supabase
        .from('sync_logs')
        .delete()
        .eq('organization_id', profile.organization_id)
        .eq('sync_type', 'participants')
        .eq('status', 'started')
        .lt('started_at', thirtyMinutesAgo);

      if (clearError) {
        addLog(`Warning: Failed to clear stuck jobs: ${clearError.message}`);
      } else {
        addLog('Successfully cleared any stuck sync jobs');
      }
    } catch (error: any) {
      addLog(`Error clearing stuck jobs: ${error.message}`);
    }
  };

  const getWebinarsToProcess = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Get webinars, prioritizing those with 0 attendees
      const { data: webinars, error } = await supabase
        .from('webinars')
        .select('id, zoom_webinar_id, title, attendees_count, start_time')
        .eq('organization_id', profile.organization_id)
        .not('zoom_webinar_id', 'is', null)
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Sort to prioritize webinars with 0 attendees
      const prioritized = webinars?.sort((a, b) => {
        const aCount = a.attendees_count || 0;
        const bCount = b.attendees_count || 0;
        if (aCount === 0 && bCount > 0) return -1;
        if (aCount > 0 && bCount === 0) return 1;
        return 0;
      }) || [];

      const zeroAttendeeCount = prioritized.filter(w => (w.attendees_count || 0) === 0).length;
      addLog(`Found ${prioritized.length} webinars to process (${zeroAttendeeCount} with 0 attendees will be prioritized)`);

      return { webinars: prioritized, organization_id: profile.organization_id };
    } catch (error: any) {
      addLog(`Error fetching webinars: ${error.message}`);
      throw error;
    }
  };

  const recoverWebinarAttendees = async (webinar: any, organizationId: string): Promise<WebinarAttendeeResult> => {
    try {
      addLog(`🔄 Processing: ${webinar.title} (${webinar.zoom_webinar_id})`);

      const { data, error } = await supabase.functions.invoke('zoom-sync-participants', {
        body: {
          organization_id: organizationId,
          user_id: user!.id,
          webinar_id: webinar.id,
          zoom_webinar_id: webinar.zoom_webinar_id
        }
      });

      if (error) {
        addLog(`❌ Failed: ${webinar.title} - ${error.message}`);
        return {
          webinar_id: webinar.id,
          zoom_webinar_id: webinar.zoom_webinar_id,
          title: webinar.title,
          attendees_found: 0,
          attendees_stored: 0,
          errors: 1,
          success: false,
          error_message: error.message
        };
      }

      const result = data as any;
      const attendeesSynced = result.participants_synced || 0;
      const attendeesFound = result.total_found || 0;
      
      if (attendeesSynced > 0) {
        addLog(`✅ Success: ${webinar.title} - Stored ${attendeesSynced} attendees`);
      } else {
        addLog(`⚠️ No data: ${webinar.title} - Found ${attendeesFound} but stored ${attendeesSynced}`);
      }

      return {
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        title: webinar.title,
        attendees_found: attendeesFound,
        attendees_stored: attendeesSynced,
        errors: result.errors || 0,
        success: result.success || false,
        api_used: result.api_used,
        error_message: result.error_summary
      };
    } catch (error: any) {
      addLog(`❌ Exception: ${webinar.title} - ${error.message}`);
      return {
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        title: webinar.title,
        attendees_found: 0,
        attendees_stored: 0,
        errors: 1,
        success: false,
        error_message: error.message
      };
    }
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
      await clearStuckJobs();

      // Step 2: Get webinars to process
      const { webinars, organization_id } = await getWebinarsToProcess();
      
      setRecoveryProgress(prev => ({ 
        ...prev, 
        totalWebinars: webinars.length,
        processedWebinars: 0,
        totalAttendees: 0,
        errors: 0
      }));

      // Step 3: Process webinars in small batches
      const batchSize = 3; // Small batches for better monitoring
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
          recoverWebinarAttendees(webinar, organization_id)
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
