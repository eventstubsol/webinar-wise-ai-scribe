
import { syncCompleteWebinarWithAllInstances } from './syncCompleteWebinar.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkedResyncProgress {
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

export async function handleChunkedMassResync(req: Request, supabase: any, user: any, credentials: any) {
  const CHUNK_SIZE = 3; // Reduced chunk size to prevent timeouts
  
  try {
    const body = await req.json();
    const { chunk = 0, job_id } = body;

    console.log(`[chunkedMassResync] Starting chunk ${chunk}, job_id: ${job_id || 'new'}`);

    // Get or create job tracking record
    let progressRecord: any;
    
    if (job_id) {
      // Get existing job
      const { data: existingJob, error: jobError } = await supabase
        .from('mass_resync_jobs')
        .select('*')
        .eq('id', job_id)
        .eq('user_id', user.id)
        .single();
      
      if (jobError) {
        console.error('[chunkedMassResync] Job fetch error:', jobError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Job not found or access denied',
          chunk_failed: true 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      progressRecord = existingJob;
    } else {
      // Create new job - get all webinars first
      const { data: webinars, error: webinarsError } = await supabase
        .from('webinars')
        .select('zoom_webinar_id, title')
        .eq('user_id', user.id)
        .not('zoom_webinar_id', 'is', null)
        .limit(100); // Limit to prevent massive jobs
      
      if (webinarsError) {
        console.error('[chunkedMassResync] Webinars fetch error:', webinarsError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to fetch webinars: ${webinarsError.message}`,
          chunk_failed: true 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!webinars || webinars.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No webinars found to sync',
          chunk_failed: true 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const totalWebinars = webinars.length;
      const totalChunks = Math.ceil(totalWebinars / CHUNK_SIZE);
      
      // Create job record
      const { data: newJob, error: createError } = await supabase
        .from('mass_resync_jobs')
        .insert({
          user_id: user.id,
          organization_id: user.organization_id,
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
        console.error('[chunkedMassResync] Job creation error:', createError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to create job: ${createError.message}`,
          chunk_failed: true 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      progressRecord = newJob;
    }

    // Validate chunk bounds
    if (chunk >= progressRecord.total_chunks) {
      return new Response(JSON.stringify({
        success: true,
        job_id: progressRecord.id,
        chunk_completed: true,
        progress: {
          current_chunk: progressRecord.total_chunks,
          total_chunks: progressRecord.total_chunks,
          processed_webinars: progressRecord.processed_webinars,
          total_webinars: progressRecord.total_webinars,
          successful_webinars: progressRecord.successful_webinars,
          failed_webinars: progressRecord.failed_webinars,
          is_completed: true,
          progress_percentage: 100
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get webinars for current chunk
    const webinarList = progressRecord.webinar_list || [];
    const startIndex = chunk * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, webinarList.length);
    const currentChunkWebinars = webinarList.slice(startIndex, endIndex);

    console.log(`[chunkedMassResync] Processing chunk ${chunk + 1}/${progressRecord.total_chunks}: ${currentChunkWebinars.length} webinars`);

    // Process current chunk with timeout protection
    const chunkResults = {
      successful: 0,
      failed: 0,
      errors: [],
      processed_count: 0,
      total_participants_synced: 0
    };

    for (const webinar of currentChunkWebinars) {
      try {
        console.log(`[chunkedMassResync] Processing webinar: ${webinar.title} (${webinar.zoom_webinar_id})`);
        
        // Add timeout protection for individual webinar sync
        const syncPromise = syncCompleteWebinarWithAllInstances(
          webinar.zoom_webinar_id,
          credentials,
          supabase,
          user
        );
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Webinar sync timeout')), 30000)
        );
        
        const webinarResult = await Promise.race([syncPromise, timeoutPromise]);
        
        chunkResults.successful++;
        chunkResults.total_participants_synced += (webinarResult.total_registrants + webinarResult.total_attendees);
        
        // Add small delay between webinars to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (webinarError) {
        console.error(`[chunkedMassResync] Error processing webinar ${webinar.zoom_webinar_id}:`, webinarError);
        chunkResults.failed++;
        chunkResults.errors.push({
          webinar_id: webinar.zoom_webinar_id,
          topic: webinar.title,
          error: webinarError.message
        });
      }
      
      chunkResults.processed_count++;
    }

    // Update job progress
    const newProcessedCount = progressRecord.processed_webinars + chunkResults.processed_count;
    const newSuccessfulCount = progressRecord.successful_webinars + chunkResults.successful;
    const newFailedCount = progressRecord.failed_webinars + chunkResults.failed;
    const allErrors = [...(progressRecord.errors || []), ...chunkResults.errors];
    
    const isCompleted = newProcessedCount >= progressRecord.total_webinars;
    const newStatus = isCompleted ? 'completed' : 'running';

    const { error: updateError } = await supabase
      .from('mass_resync_jobs')
      .update({
        processed_webinars: newProcessedCount,
        current_chunk: chunk + 1,
        successful_webinars: newSuccessfulCount,
        failed_webinars: newFailedCount,
        status: newStatus,
        errors: allErrors,
        completed_at: isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', progressRecord.id);

    if (updateError) {
      console.error('[chunkedMassResync] Failed to update job progress:', updateError);
    }

    // Return chunk results with proper CORS headers
    return new Response(JSON.stringify({
      success: true,
      job_id: progressRecord.id,
      chunk_completed: true,
      chunk_results: chunkResults,
      progress: {
        job_id: progressRecord.id,
        current_chunk: chunk + 1,
        total_chunks: progressRecord.total_chunks,
        processed_webinars: newProcessedCount,
        total_webinars: progressRecord.total_webinars,
        successful_webinars: newSuccessfulCount,
        failed_webinars: newFailedCount,
        is_completed: isCompleted,
        progress_percentage: Math.round((newProcessedCount / progressRecord.total_webinars) * 100)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[chunkedMassResync] Critical error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      chunk_failed: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function getChunkedResyncStatus(req: Request, supabase: any, user: any) {
  try {
    const body = await req.json();
    const { job_id } = body;
    
    if (!job_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'job_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: job, error } = await supabase
      .from('mass_resync_jobs')
      .select('*')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('[getChunkedResyncStatus] Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found or access denied'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      job: job
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[getChunkedResyncStatus] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
