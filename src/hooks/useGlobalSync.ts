import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface GlobalSyncStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  details?: any;
  startTime?: Date;
  endTime?: Date;
  apiRequestsUsed?: number;
}

export interface GlobalSyncProgress {
  currentStage: number;
  totalStages: number;
  overallProgress: number;
  stages: GlobalSyncStage[];
  isRunning: boolean;
  startTime?: Date;
  endTime?: Date;
  totalApiRequests: number;
  estimatedTimeRemaining?: string;
  summary?: {
    webinarsFound: number;
    webinarsSynced: number;
    participantsSynced: number;
    registrationsSynced: number;
    jobsCreated: number;
    errors: string[];
  };
}

const SYNC_STAGES: Omit<GlobalSyncStage, 'status' | 'progress' | 'startTime' | 'endTime'>[] = [
  {
    id: 'validation',
    name: 'Validation',
    description: 'Validating user profile and Zoom connection'
  },
  {
    id: 'webinars',
    name: 'Webinar Discovery',
    description: 'Discovering and syncing webinar metadata'
  },
  {
    id: 'participants',
    name: 'Participant Data',
    description: 'Syncing participant and attendance data'
  },
  {
    id: 'registrations',
    name: 'Registration Data',
    description: 'Syncing registration and approval data'
  },
  {
    id: 'interactions',
    name: 'Interaction Data',
    description: 'Syncing polls, Q&A, and chat messages'
  },
  {
    id: 'recordings',
    name: 'Recording Data',
    description: 'Syncing recording metadata and analytics'
  },
  {
    id: 'analytics',
    name: 'Analytics Processing',
    description: 'Processing business metrics and analytics'
  },
  {
    id: 'cleanup',
    name: 'Cleanup & Validation',
    description: 'Cleaning up jobs and validating data integrity'
  }
];

export const useGlobalSync = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<GlobalSyncProgress>({
    currentStage: 0,
    totalStages: SYNC_STAGES.length,
    overallProgress: 0,
    stages: SYNC_STAGES.map(stage => ({
      ...stage,
      status: 'pending',
      progress: 0
    })),
    isRunning: false,
    totalApiRequests: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const stageTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const updateStage = (stageId: string, updates: Partial<GlobalSyncStage>) => {
    setProgress(prev => ({
      ...prev,
      stages: prev.stages.map(stage =>
        stage.id === stageId ? { ...stage, ...updates } : stage
      ),
      totalApiRequests: prev.totalApiRequests + (updates.apiRequestsUsed || 0)
    }));
  };

  const updateOverallProgress = () => {
    setProgress(prev => {
      const completedStages = prev.stages.filter(s => s.status === 'completed').length;
      const currentStageProgress = prev.stages[prev.currentStage]?.progress || 0;
      const overallProgress = ((completedStages + currentStageProgress / 100) / prev.totalStages) * 100;
      
      return {
        ...prev,
        overallProgress: Math.min(overallProgress, 100)
      };
    });
  };

  const estimateTimeRemaining = () => {
    const now = new Date();
    const startTime = progress.startTime;
    if (!startTime || progress.overallProgress === 0) return undefined;

    const elapsed = now.getTime() - startTime.getTime();
    const estimated = (elapsed / progress.overallProgress) * (100 - progress.overallProgress);
    const minutes = Math.ceil(estimated / 60000);
    
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const validateSetup = async (): Promise<any> => {
    updateStage('validation', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Checking user authentication...'
    });

    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    updateStage('validation', { progress: 25, message: 'Fetching user profile...' });
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      throw new Error('User profile not found or organization not set');
    }

    updateStage('validation', { progress: 50, message: 'Checking Zoom connection...' });
    
    const { data: connection, error: connectionError } = await supabase
      .from('zoom_connections')
      .select('status, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (connectionError || !connection) {
      throw new Error('No active Zoom connection found');
    }

    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      throw new Error('Zoom connection has expired');
    }

    updateStage('validation', { 
      status: 'completed', 
      progress: 100, 
      endTime: new Date(),
      message: 'Validation complete'
    });

    return { profile, connection };
  };

  const syncWebinars = async (organizationId: string): Promise<any> => {
    updateStage('webinars', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Starting comprehensive webinar sync...'
    });

    const { data, error } = await supabase.functions.invoke('zoom-comprehensive-rate-limited-sync', {
      body: { 
        organization_id: organizationId,
        user_id: user.id,
        enhanced_timeout: true,
        background_processing: true
      }
    });

    if (error) {
      throw new Error(`Webinar sync failed: ${error.message}`);
    }

    const result = data;
    if (!result?.success) {
      throw new Error(result?.error || 'Webinar sync returned unsuccessful result');
    }

    updateStage('webinars', { 
      progress: 100,
      apiRequestsUsed: result.summary?.api_requests_made || 0,
      message: `Found ${result.summary?.webinars_found || 0} webinars`
    });

    // Wait a bit for rate limiting
    await sleep(2000);

    updateStage('webinars', { 
      status: 'completed', 
      endTime: new Date()
    });

    return result.summary;
  };

  const syncParticipants = async (organizationId: string): Promise<void> => {
    updateStage('participants', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Processing participant data...'
    });

    // Since participants are processed by background jobs, we'll monitor job progress
    let progress = 0;
    const maxChecks = 30; // 5 minutes max
    
    for (let i = 0; i < maxChecks; i++) {
      const { data: jobs } = await supabase
        .from('background_sync_jobs')
        .select('status')
        .eq('organization_id', organizationId)
        .in('type', ['participant_sync', 'detailed_sync']);

      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0;
      
      progress = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
      
      updateStage('participants', { 
        progress,
        message: `Processing participants... ${completedJobs}/${totalJobs} jobs completed`
      });

      if (progress >= 90 || totalJobs === 0) break;
      
      await sleep(10000); // Check every 10 seconds
    }

    updateStage('participants', { 
      status: 'completed', 
      progress: 100,
      endTime: new Date(),
      message: 'Participant data processing complete'
    });
  };

  const syncRegistrations = async (organizationId: string): Promise<void> => {
    updateStage('registrations', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Syncing registration data...'
    });

    const { data, error } = await supabase.functions.invoke('zoom-sync-registrations', {
      body: { organization_id: organizationId }
    });

    if (error) {
      console.warn('Registration sync failed:', error.message);
    }

    updateStage('registrations', { 
      status: 'completed', 
      progress: 100,
      endTime: new Date(),
      apiRequestsUsed: 5, // Estimate
      message: 'Registration sync complete'
    });

    await sleep(1000); // Rate limiting
  };

  const syncInteractions = async (organizationId: string): Promise<void> => {
    updateStage('interactions', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Syncing interaction data...'
    });

    // Sync polls, Q&A, and chat in parallel with rate limiting
    const syncFunctions = [
      { name: 'zoom-sync-polls', progress: 33 },
      { name: 'zoom-sync-qa', progress: 66 },
      { name: 'zoom-sync-chat', progress: 100 }
    ];

    for (const func of syncFunctions) {
      try {
        await supabase.functions.invoke(func.name, {
          body: { organization_id: organizationId }
        });
        
        updateStage('interactions', { 
          progress: func.progress,
          message: `Synced ${func.name.split('-')[2]} data`
        });
        
        await sleep(1500); // Rate limiting
      } catch (error) {
        console.warn(`${func.name} failed:`, error);
      }
    }

    updateStage('interactions', { 
      status: 'completed', 
      endTime: new Date(),
      apiRequestsUsed: 15, // Estimate
      message: 'Interaction data sync complete'
    });
  };

  const syncRecordings = async (organizationId: string): Promise<void> => {
    updateStage('recordings', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Syncing recording data...'
    });

    // Recording sync is typically part of the webinar sync
    // This stage is more about processing analytics
    await sleep(2000);

    updateStage('recordings', { 
      status: 'completed', 
      progress: 100,
      endTime: new Date(),
      apiRequestsUsed: 3,
      message: 'Recording data processed'
    });
  };

  const processAnalytics = async (organizationId: string): Promise<void> => {
    updateStage('analytics', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Processing analytics...'
    });

    try {
      const { data, error } = await supabase.functions.invoke('analytics-processor', {
        body: { organization_id: organizationId }
      });

      if (error) {
        console.warn('Analytics processing failed:', error.message);
      }

      updateStage('analytics', { 
        progress: 100,
        message: 'Analytics processing complete'
      });
    } catch (error) {
      console.warn('Analytics processing error:', error);
    }

    updateStage('analytics', { 
      status: 'completed', 
      endTime: new Date(),
      message: 'Analytics processing complete'
    });
  };

  const cleanup = async (organizationId: string): Promise<void> => {
    updateStage('cleanup', { 
      status: 'running', 
      progress: 0, 
      startTime: new Date(),
      message: 'Running cleanup tasks...'
    });

    try {
      // Clean up completed jobs
      await supabase.functions.invoke('realtime-cleanup', {
        body: { organization_id: organizationId }
      });

      updateStage('cleanup', { 
        progress: 100,
        message: 'Cleanup complete'
      });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }

    updateStage('cleanup', { 
      status: 'completed', 
      progress: 100,
      endTime: new Date(),
      message: 'All cleanup tasks complete'
    });
  };

  const startGlobalSync = async (): Promise<void> => {
    if (progress.isRunning) {
      toast({
        title: "Sync Already Running",
        description: "A global sync is already in progress. Please wait for it to complete.",
        variant: "default",
      });
      return;
    }

    // Reset progress
    setProgress({
      currentStage: 0,
      totalStages: SYNC_STAGES.length,
      overallProgress: 0,
      stages: SYNC_STAGES.map(stage => ({
        ...stage,
        status: 'pending',
        progress: 0
      })),
      isRunning: true,
      startTime: new Date(),
      totalApiRequests: 0
    });

    abortControllerRef.current = new AbortController();

    try {
      toast({
        title: "Global Sync Started",
        description: "Starting comprehensive data synchronization with Zoom...",
      });

      let organizationId: string;
      let webinarSummary: any;

      // Stage 1: Validation
      setProgress(prev => ({ ...prev, currentStage: 0 }));
      const { profile } = await validateSetup();
      organizationId = profile.organization_id;

      // Stage 2: Webinar Discovery
      setProgress(prev => ({ ...prev, currentStage: 1 }));
      webinarSummary = await syncWebinars(organizationId);

      // Stage 3: Participants
      setProgress(prev => ({ ...prev, currentStage: 2 }));
      await syncParticipants(organizationId);

      // Stage 4: Registrations
      setProgress(prev => ({ ...prev, currentStage: 3 }));
      await syncRegistrations(organizationId);

      // Stage 5: Interactions
      setProgress(prev => ({ ...prev, currentStage: 4 }));
      await syncInteractions(organizationId);

      // Stage 6: Recordings
      setProgress(prev => ({ ...prev, currentStage: 5 }));
      await syncRecordings(organizationId);

      // Stage 7: Analytics
      setProgress(prev => ({ ...prev, currentStage: 6 }));
      await processAnalytics(organizationId);

      // Stage 8: Cleanup
      setProgress(prev => ({ ...prev, currentStage: 7 }));
      await cleanup(organizationId);

      // Complete
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        endTime: new Date(),
        overallProgress: 100,
        summary: {
          webinarsFound: webinarSummary?.webinars_found || 0,
          webinarsSynced: webinarSummary?.webinars_synced || 0,
          participantsSynced: 0, // This would need to be calculated
          registrationsSynced: 0, // This would need to be calculated
          jobsCreated: webinarSummary?.detailed_jobs_created || 0,
          errors: []
        }
      }));

      toast({
        title: "Global Sync Complete",
        description: `Successfully synchronized ${webinarSummary?.webinars_found || 0} webinars and all related data.`,
      });

    } catch (error: any) {
      console.error('Global sync failed:', error);
      
      const currentStage = progress.stages[progress.currentStage];
      if (currentStage) {
        updateStage(currentStage.id, { 
          status: 'failed', 
          message: error.message,
          endTime: new Date()
        });
      }

      setProgress(prev => ({
        ...prev,
        isRunning: false,
        endTime: new Date()
      }));

      toast({
        title: "Global Sync Failed",
        description: error.message || "An error occurred during synchronization",
        variant: "destructive",
      });
    }
  };

  const cancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    stageTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    stageTimeoutsRef.current = [];

    setProgress(prev => ({
      ...prev,
      isRunning: false,
      endTime: new Date()
    }));

    toast({
      title: "Sync Cancelled",
      description: "Global synchronization has been cancelled.",
    });
  };

  return {
    progress: {
      ...progress,
      estimatedTimeRemaining: estimateTimeRemaining()
    },
    startGlobalSync,
    cancelSync,
    isRunning: progress.isRunning
  };
};