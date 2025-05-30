
import { 
  createResyncJob, 
  getResyncJob, 
  updateResyncJobProgress, 
  processWebinarChunk, 
  createProgressResponse, 
  createErrorResponse, 
  createSuccessResponse 
} from '../utils/jobManager.ts';
import { validateUserAndOrganization, getWebinarsForResync } from '../utils/userValidation.ts';

const CHUNK_SIZE = 3; // Reduced chunk size to prevent timeouts

export async function handleChunkedMassResync(body: any, supabase: any, user: any, credentials: any) {
  try {
    const { chunk = 0, job_id } = body;

    console.log(`[chunkedMassResync] Starting chunk ${chunk}, job_id: ${job_id || 'new'}`);

    const organizationId = await validateUserAndOrganization(supabase, user);
    
    // Get or create job tracking record
    let progressRecord: any;
    
    if (job_id) {
      // Get existing job
      progressRecord = await getResyncJob(supabase, job_id, user.id);
    } else {
      // Create new job - get all webinars first
      const webinars = await getWebinarsForResync(supabase, user.id, organizationId);
      progressRecord = await createResyncJob(supabase, user, organizationId, webinars, CHUNK_SIZE);
    }

    // Validate chunk bounds
    if (chunk >= progressRecord.total_chunks) {
      const progress = createProgressResponse(
        progressRecord.id,
        progressRecord.total_chunks,
        progressRecord.total_chunks,
        progressRecord.processed_webinars,
        progressRecord.total_webinars,
        progressRecord.successful_webinars,
        progressRecord.failed_webinars,
        true
      );

      return createSuccessResponse({
        job_id: progressRecord.id,
        chunk_completed: true,
        progress: progress
      });
    }

    // Get webinars for current chunk
    const webinarList = progressRecord.webinar_list || [];
    const startIndex = chunk * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, webinarList.length);
    const currentChunkWebinars = webinarList.slice(startIndex, endIndex);

    console.log(`[chunkedMassResync] Processing chunk ${chunk + 1}/${progressRecord.total_chunks}: ${currentChunkWebinars.length} webinars`);

    // Process current chunk with enhanced error handling
    const chunkResults = await processWebinarChunk(
      currentChunkWebinars,
      credentials,
      supabase,
      user
    );

    // Update job progress
    const newProcessedCount = progressRecord.processed_webinars + chunkResults.processed_count;
    const newSuccessfulCount = progressRecord.successful_webinars + chunkResults.successful;
    const newFailedCount = progressRecord.failed_webinars + chunkResults.failed;
    const allErrors = [...(progressRecord.errors || []), ...chunkResults.errors];
    
    const isCompleted = newProcessedCount >= progressRecord.total_webinars;
    const newStatus = isCompleted ? 'completed' : 'running';

    await updateResyncJobProgress(supabase, progressRecord.id, {
      processed_webinars: newProcessedCount,
      current_chunk: chunk + 1,
      successful_webinars: newSuccessfulCount,
      failed_webinars: newFailedCount,
      errors: allErrors,
      status: newStatus,
      ...(isCompleted && { completed_at: new Date().toISOString() })
    });

    console.log(`[chunkedMassResync] Chunk ${chunk + 1} completed: ${chunkResults.successful} successful, ${chunkResults.failed} failed, ${chunkResults.total_participants_synced} participants synced`);

    const progress = createProgressResponse(
      progressRecord.id,
      chunk + 1,
      progressRecord.total_chunks,
      newProcessedCount,
      progressRecord.total_webinars,
      newSuccessfulCount,
      newFailedCount,
      isCompleted
    );

    return createSuccessResponse({
      job_id: progressRecord.id,
      chunk_completed: true,
      chunk_results: chunkResults,
      progress: progress
    });

  } catch (error) {
    console.error('[chunkedMassResync] Critical error:', error);
    return createErrorResponse(error.message || 'Unknown error occurred', true);
  }
}

export async function getChunkedResyncStatus(body: any, supabase: any, user: any) {
  try {
    const { job_id } = body;
    
    if (!job_id) {
      return createErrorResponse('job_id is required');
    }

    const job = await getResyncJob(supabase, job_id, user.id);

    return createSuccessResponse({ job: job });

  } catch (error) {
    console.error('[getChunkedResyncStatus] Error:', error);
    return createErrorResponse(error.message || 'Unknown error occurred');
  }
}
