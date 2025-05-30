
import { syncCompleteWebinarWithAllInstances } from '../handlers/syncCompleteWebinar.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface ChunkedResyncProgress {
  job_id: string;
  total_webinars: number;
  processed_webinars: number;
  current_chunk: number;
  total_chunks: number;
  successful_webinars: number;
  failed_webinars: number;
  status: 'running' | 'completed' | 'failed';
  errors: any[];
}

export async function createResyncJob(supabase: any, user: any, organizationId: string, webinars: any[], chunkSize: number) {
  const totalWebinars = webinars.length;
  const totalChunks = Math.ceil(totalWebinars / chunkSize);
  
  const { data: newJob, error: createError } = await supabase
    .from('mass_resync_jobs')
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      total_webinars: totalWebinars,
      processed_webinars: 0,
      current_chunk: 0,
      total_chunks: totalChunks,
      successful_webinars: 0,
      failed_webinars: 0,
      status: 'running',
      errors: [],
      webinar_list: webinars,
      started_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (createError) {
    console.error('[jobManager] Job creation error:', createError);
    throw new Error(`Failed to create job: ${createError.message}`);
  }
  
  return newJob;
}

export async function getResyncJob(supabase: any, jobId: string, userId: string) {
  const { data: existingJob, error: jobError } = await supabase
    .from('mass_resync_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();
  
  if (jobError) {
    console.error('[jobManager] Job fetch error:', jobError);
    throw new Error('Job not found or access denied');
  }
  
  return existingJob;
}

export async function updateResyncJobProgress(
  supabase: any, 
  jobId: string, 
  updates: {
    processed_webinars: number;
    current_chunk: number;
    successful_webinars: number;
    failed_webinars: number;
    errors: any[];
    status?: string;
    completed_at?: string;
  }
) {
  const { error: updateError } = await supabase
    .from('mass_resync_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (updateError) {
    console.error('[jobManager] Failed to update job progress:', updateError);
  }
}

export async function processWebinarChunk(
  webinars: any[], 
  credentials: any, 
  supabase: any, 
  user: any
) {
  const chunkResults = {
    successful: 0,
    failed: 0,
    errors: [],
    processed_count: 0,
    total_participants_synced: 0
  };

  for (const webinar of webinars) {
    try {
      console.log(`[jobManager] Processing webinar: ${webinar.title} (${webinar.zoom_webinar_id})`);
      
      // Clear any existing participant data for this webinar to avoid duplicates
      await supabase
        .from('zoom_webinar_instance_participants')
        .delete()
        .eq('user_id', user.id)
        .eq('webinar_id', webinar.zoom_webinar_id);
      
      // Add timeout protection for individual webinar sync
      const syncPromise = syncCompleteWebinarWithAllInstances(
        webinar.zoom_webinar_id,
        credentials,
        supabase,
        user
      );
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Webinar sync timeout')), 45000)
      );
      
      const webinarResult = await Promise.race([syncPromise, timeoutPromise]);
      
      chunkResults.successful++;
      chunkResults.total_participants_synced += (webinarResult.total_registrants + webinarResult.total_attendees);
      
      console.log(`[jobManager] Successfully synced webinar ${webinar.zoom_webinar_id}: ${webinarResult.total_registrants + webinarResult.total_attendees} participants`);
      
      // Add delay between webinars to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (webinarError) {
      console.error(`[jobManager] Error processing webinar ${webinar.zoom_webinar_id}:`, webinarError);
      chunkResults.failed++;
      chunkResults.errors.push({
        webinar_id: webinar.zoom_webinar_id,
        topic: webinar.title,
        error: webinarError.message || 'Unknown error'
      });
    }
    
    chunkResults.processed_count++;
  }

  return chunkResults;
}

export function createProgressResponse(
  jobId: string,
  currentChunk: number,
  totalChunks: number,
  processedWebinars: number,
  totalWebinars: number,
  successfulWebinars: number,
  failedWebinars: number,
  isCompleted: boolean
) {
  return {
    job_id: jobId,
    current_chunk: currentChunk,
    total_chunks: totalChunks,
    processed_webinars: processedWebinars,
    total_webinars: totalWebinars,
    successful_webinars: successfulWebinars,
    failed_webinars: failedWebinars,
    is_completed: isCompleted,
    progress_percentage: Math.round((processedWebinars / totalWebinars) * 100)
  };
}

export function createErrorResponse(error: string, chunkFailed: boolean = false) {
  return new Response(JSON.stringify({
    success: false,
    error: error,
    chunk_failed: chunkFailed
  }), {
    status: chunkFailed ? 500 : 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export function createSuccessResponse(data: any) {
  return new Response(JSON.stringify({
    success: true,
    ...data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
