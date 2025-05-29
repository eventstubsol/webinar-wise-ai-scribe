
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncJob {
  id: string
  job_type: string
  status: string
  metadata: any
  organization_id: string
  user_id: string
  created_at: string
}

async function processDetailedSyncJob(job: SyncJob, supabaseClient: any) {
  console.log(`Processing job: ${job.id} - ${job.job_type}`)
  
  const { webinar_zoom_id, organization_id, user_id } = job.metadata

  if (!webinar_zoom_id || !organization_id || !user_id) {
    throw new Error('Missing required job metadata')
  }

  try {
    // Update job status to running
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString(),
        progress: 10
      })
      .eq('id', job.id)

    // Get webinar record to get the internal webinar_id
    const { data: webinar, error: webinarError } = await supabaseClient
      .from('webinars')
      .select('id')
      .eq('zoom_webinar_id', webinar_zoom_id)
      .eq('organization_id', organization_id)
      .single()

    if (webinarError || !webinar) {
      throw new Error(`Webinar not found: ${webinar_zoom_id}`)
    }

    const webinar_id = webinar.id
    const results = {
      participants: { success: false, count: 0, error: null },
      registrations: { success: false, count: 0, error: null },
      polls: { success: false, count: 0, error: null },
      qa: { success: false, count: 0, error: null },
      chat: { success: false, count: 0, error: null }
    }

    // Update progress
    await supabaseClient
      .from('sync_jobs')
      .update({ progress: 20 })
      .eq('id', job.id)

    // Process participants
    try {
      console.log('Processing participants...')
      const participantsResult = await supabaseClient.functions.invoke('zoom-sync-participants', {
        body: {
          organization_id,
          user_id,
          webinar_id,
          zoom_webinar_id: webinar_zoom_id,
        }
      })

      if (participantsResult.data?.success) {
        results.participants.success = true
        results.participants.count = participantsResult.data.participants_synced || 0
        console.log(`✓ Participants synced: ${results.participants.count}`)
      } else {
        results.participants.error = participantsResult.error?.message || 'Unknown error'
        console.log(`❌ Participants sync failed: ${results.participants.error}`)
      }
    } catch (error) {
      results.participants.error = error.message
      console.log(`❌ Participants sync error: ${error.message}`)
    }

    await supabaseClient.from('sync_jobs').update({ progress: 40 }).eq('id', job.id)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Process registrations
    try {
      console.log('Processing registrations...')
      const registrationsResult = await supabaseClient.functions.invoke('zoom-sync-registrations', {
        body: {
          organization_id,
          user_id,
          webinar_id,
          zoom_webinar_id: webinar_zoom_id,
        }
      })

      if (registrationsResult.data?.success) {
        results.registrations.success = true
        results.registrations.count = registrationsResult.data.registrations_synced || 0
        console.log(`✓ Registrations synced: ${results.registrations.count}`)
      } else {
        results.registrations.error = registrationsResult.error?.message || 'Unknown error'
        console.log(`❌ Registrations sync failed: ${results.registrations.error}`)
      }
    } catch (error) {
      results.registrations.error = error.message
      console.log(`❌ Registrations sync error: ${error.message}`)
    }

    await supabaseClient.from('sync_jobs').update({ progress: 60 }).eq('id', job.id)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Process polls
    try {
      console.log('Processing polls...')
      const pollsResult = await supabaseClient.functions.invoke('zoom-sync-polls', {
        body: {
          organization_id,
          user_id,
          webinar_id,
          zoom_webinar_id: webinar_zoom_id,
        }
      })

      if (pollsResult.data?.success) {
        results.polls.success = true
        results.polls.count = pollsResult.data.polls_synced || 0
        console.log(`✓ Polls synced: ${results.polls.count}`)
      } else {
        results.polls.error = pollsResult.error?.message || 'Unknown error'
        console.log(`❌ Polls sync failed: ${results.polls.error}`)
      }
    } catch (error) {
      results.polls.error = error.message
      console.log(`❌ Polls sync error: ${error.message}`)
    }

    await supabaseClient.from('sync_jobs').update({ progress: 80 }).eq('id', job.id)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Process Q&A
    try {
      console.log('Processing Q&A...')
      const qaResult = await supabaseClient.functions.invoke('zoom-sync-qa', {
        body: {
          organization_id,
          user_id,
          webinar_id,
          zoom_webinar_id: webinar_zoom_id,
        }
      })

      if (qaResult.data?.success) {
        results.qa.success = true
        results.qa.count = qaResult.data.qa_synced || 0
        console.log(`✓ Q&A synced: ${results.qa.count}`)
      } else {
        results.qa.error = qaResult.error?.message || 'Unknown error'
        console.log(`❌ Q&A sync failed: ${results.qa.error}`)
      }
    } catch (error) {
      results.qa.error = error.message
      console.log(`❌ Q&A sync error: ${error.message}`)
    }

    await supabaseClient.from('sync_jobs').update({ progress: 90 }).eq('id', job.id)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Process chat
    try {
      console.log('Processing chat...')
      const chatResult = await supabaseClient.functions.invoke('zoom-sync-chat', {
        body: {
          organization_id,
          user_id,
          webinar_id,
          zoom_webinar_id: webinar_zoom_id,
        }
      })

      if (chatResult.data?.success) {
        results.chat.success = true
        results.chat.count = chatResult.data.messages_synced || 0
        console.log(`✓ Chat synced: ${results.chat.count}`)
      } else {
        results.chat.error = chatResult.error?.message || 'Unknown error'
        console.log(`❌ Chat sync failed: ${results.chat.error}`)
      }
    } catch (error) {
      results.chat.error = error.message
      console.log(`❌ Chat sync error: ${error.message}`)
    }

    // Update attendee count in webinar table if participants were synced
    if (results.participants.success && results.participants.count > 0) {
      await supabaseClient
        .from('webinars')
        .update({ attendees_count: results.participants.count })
        .eq('id', webinar_id)
    }

    // Mark job as completed
    await supabaseClient
      .from('sync_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          ...job.metadata,
          results,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', job.id)

    console.log(`Job ${job.id} completed successfully:`, results)
    return { success: true, results }

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error)
    
    // Mark job as failed
    await supabaseClient
      .from('sync_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id)

    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  console.log('Job processor called with method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get pending detailed sync jobs
    const { data: pendingJobs, error: jobsError } = await supabaseClient
      .from('sync_jobs')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'detailed_sync')
      .order('created_at', { ascending: true })
      .limit(5) // Process max 5 jobs at a time

    if (jobsError) {
      throw new Error(`Failed to fetch pending jobs: ${jobsError.message}`)
    }

    console.log(`Found ${pendingJobs?.length || 0} pending detailed sync jobs`)

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending jobs to process',
          jobs_processed: 0,
          processing_time_ms: Date.now() - startTime
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const results = []
    
    // Process each job
    for (const job of pendingJobs) {
      const result = await processDetailedSyncJob(job, supabaseClient)
      results.push({
        job_id: job.id,
        webinar_zoom_id: job.metadata?.webinar_zoom_id,
        ...result
      })
      
      // Small delay between jobs
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const processingTime = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    
    console.log(`Job processing completed: ${successCount}/${results.length} jobs successful`)

    return new Response(
      JSON.stringify({
        success: true,
        jobs_processed: results.length,
        successful_jobs: successCount,
        failed_jobs: results.length - successCount,
        results,
        processing_time_ms: processingTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Job processor error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processing_time_ms: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
