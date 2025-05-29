
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface RecoveryProgress {
  totalWebinars: number;
  processedWebinars: number;
  currentWebinar: string;
  totalRegistrations: number;
  errors: number;
  isRunning: boolean;
  startTime?: Date;
  estimatedTimeRemaining?: string;
}

interface WebinarRecoveryResult {
  webinar_id: string;
  zoom_webinar_id: string;
  title: string;
  registrations_found: number;
  registrations_stored: number;
  errors: number;
  success: boolean;
  error_message?: string;
}

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
      addLog('Clearing stuck registration sync jobs...');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Clear stuck registration sync jobs
      const { error: clearError } = await supabase
        .from('registration_sync_jobs')
        .delete()
        .eq('organization_id', profile.organization_id)
        .in('status', ['running', 'pending'])
        .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes old

      if (clearError) {
        addLog(`Warning: Failed to clear stuck jobs: ${clearError.message}`);
      } else {
        addLog('Stuck jobs cleared successfully');
      }
    } catch (error: any) {
      addLog(`Error clearing stuck jobs: ${error.message}`);
    }
  };

  const getWebinarsToRecover = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Get all webinars for this organization
      const { data: webinars, error } = await supabase
        .from('webinars')
        .select('id, zoom_webinar_id, title, registrants_count')
        .eq('organization_id', profile.organization_id)
        .not('zoom_webinar_id', 'is', null)
        .order('start_time', { ascending: false });

      if (error) throw error;

      addLog(`Found ${webinars?.length || 0} webinars to process`);
      
      // Prioritize webinars with 0 registrants_count first
      const prioritized = webinars?.sort((a, b) => {
        if (a.registrants_count === 0 && b.registrants_count > 0) return -1;
        if (a.registrants_count > 0 && b.registrants_count === 0) return 1;
        return 0;
      }) || [];

      return { webinars: prioritized, organization_id: profile.organization_id };
    } catch (error: any) {
      addLog(`Error fetching webinars: ${error.message}`);
      throw error;
    }
  };

  const recoverWebinarRegistrations = async (webinar: any, organizationId: string): Promise<WebinarRecoveryResult> => {
    try {
      addLog(`Starting recovery for webinar: ${webinar.title} (${webinar.zoom_webinar_id})`);

      const { data, error } = await supabase.functions.invoke('zoom-sync-registrations', {
        body: {
          organization_id: organizationId,
          user_id: user!.id,
          webinar_id: webinar.id,
          zoom_webinar_id: webinar.zoom_webinar_id
        }
      });

      if (error) {
        addLog(`❌ Failed to recover ${webinar.title}: ${error.message}`);
        return {
          webinar_id: webinar.id,
          zoom_webinar_id: webinar.zoom_webinar_id,
          title: webinar.title,
          registrations_found: 0,
          registrations_stored: 0,
          errors: 1,
          success: false,
          error_message: error.message
        };
      }

      const result = data as any;
      addLog(`✅ Successfully recovered ${result.registrations_synced || 0} registrations for ${webinar.title}`);

      return {
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        title: webinar.title,
        registrations_found: result.total_found || 0,
        registrations_stored: result.registrations_synced || 0,
        errors: result.errors || 0,
        success: result.success || false,
        error_message: result.error
      };
    } catch (error: any) {
      addLog(`❌ Exception during recovery for ${webinar.title}: ${error.message}`);
      return {
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        title: webinar.title,
        registrations_found: 0,
        registrations_stored: 0,
        errors: 1,
        success: false,
        error_message: error.message
      };
    }
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
      await clearStuckJobs();

      // Step 2: Get webinars to recover
      const { webinars, organization_id } = await getWebinarsToRecover();
      
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
          recoverWebinarRegistrations(webinar, organization_id)
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
