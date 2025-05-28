
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

async function cleanupBrokenJobs(supabaseClient: any) {
  console.log('Starting cleanup of broken jobs...')
  
  // Find jobs with incomplete metadata
  const { data: brokenJobs, error } = await supabaseClient
    .from('sync_jobs')
    .select('id, metadata')
    .eq('status', 'pending')
    .eq('job_type', 'detailed_webinar_sync')

  if (brokenJobs && brokenJobs.length > 0) {
    const jobsToDelete = brokenJobs.filter(job => {
      const metadata = job.metadata || {}
      // Check if job is missing critical metadata
      return !metadata.webinar_id || !metadata.webinar_zoom_id || !metadata.organization_id || !metadata.user_id
    })

    if (jobsToDelete.length > 0) {
      console.log(`Deleting ${jobsToDelete.length} broken jobs with incomplete metadata`)
      
      await supabaseClient
        .from('sync_jobs')
        .delete()
        .in('id', jobsToDelete.map(job => job.id))
      
      console.log('Broken jobs cleaned up successfully')
    }
  }
}

async function processDetailedSyncJob(job: SyncJob, supabaseClient: any) {
  console.log(`Processing job: ${job.id} - ${job.job_type}`)
  
  try {
    // Extract metadata with validation
    const { 
      webinar_zoom_id, 
      organization_id, 
      user_id, 
      webinar_id,
      sync_types = ['participants', 'registrations', 'polls', 'qa'],
      webinar_status
    } = job.metadata || {}

    // Use job-level IDs as fallback
    const finalOrgId = organization_id || job.organization_id
    const finalUserId = user_id || job.user_id

    console.log(`Job ${job.id} processing:`, {
      webinar_zoom_id,
      finalOrgId,
      finalUserId,
      webinar_id,
      sync_types,
      hasMetadata: !!job.metadata
    })

    // Validate required fields
    if (!webinar_zoom_id || !finalOrgId || !finalUserId) {
      const errorMsg = `Job ${job.id} missing critical metadata: webinar_zoom_id=${webinar_zoom_id}, org_id=${finalOrgId}, user_id=${finalUserId}`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    // Update job status to running
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString(),
        progress: 10
      })
      .eq('id', job.id)

    // Find webinar record with improved lookup
    let webinar
    console.log(`Looking up webinar - webinar_id: ${webinar_id}, zoom_webinar_id: ${webinar_zoom_id}`)
    
    if (webinar_id) {
      const { data: webinarData, error: webinarError } = await supabaseClient
        .from('webinars')
        .select('id, status, start_time, title, zoom_webinar_id')
        .eq('id', webinar_id)
        .single()
      
      if (!webinarError && webinarData) {
        webinar = webinarData
        console.log(`Found webinar by ID: ${webinar.id} (${webinar.title})`)
      } else {
        console.log(`Webinar lookup by ID failed: ${webinarError?.message}`)
      }
    }

    // Fallback to lookup by zoom_webinar_id
    if (!webinar) {
      console.log(`Looking up webinar by zoom_webinar_id: ${webinar_zoom_id}`)
      const { data: webinarData, error: webinarError } = await supabaseClient
        .from('webinars')
        .select('id, status, start_time, title, zoom_webinar_id')
        .eq('zoom_webinar_id', webinar_zoom_id)
        .eq('organization_id', finalOrgId)
        .single()

      if (!webinarError && webinarData) {
        webinar = webinarData
        console.log(`Found webinar by zoom_webinar_id: ${webinar.id} (${webinar.title})`)
      } else {
        console.error(`Webinar lookup failed for zoom_webinar_id: ${webinar_zoom_id}`, webinarError)
        throw new Error(`Webinar not found: ${webinar_zoom_id}`)
      }
    }

    const finalWebinarId = webinar.id
    const results = {
      participants: { success: false, count: 0, error: null },
      registrations: { success: false, count: 0, error: null },
      polls: { success: false, count: 0, error: null },
      qa: { success: false, count: 0, error: null },
      chat: { success: false, count: 0, error: null, skipped: false }
    }

    await supabaseClient.from('sync_jobs').update({ progress: 20 }).eq('id', job.id)

    // Process each sync type with improved error handling
    for (const syncType of sync_types) {
      try {
        console.log(`Processing ${syncType}...`)
        
        if (syncType === 'participants') {
          const participantsResult = await Promise.race([
            supabaseClient.functions.invoke('zoom-sync-participants', {
              body: {
                organization_id: finalOrgId,
                user_id: finalUserId,
                webinar_id: finalWebinarId,
                zoom_webinar_id: webinar_zoom_id,
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Participants sync timeout')), 45000))
          ])

          if (participantsResult.data?.success) {
            results.participants.success = true
            results.participants.count = participantsResult.data.participants_synced || 0
            console.log(`✓ Participants synced: ${results.participants.count}`)
          } else {
            results.participants.error = participantsResult.error?.message || 'Unknown error'
            console.log(`❌ Participants sync failed: ${results.participants.error}`)
          }
        }

        if (syncType === 'registrations') {
          const registrationsResult = await Promise.race([
            supabaseClient.functions.invoke('zoom-sync-registrations', {
              body: {
                organization_id: finalOrgId,
                user_id: finalUserId,
                webinar_id: finalWebinarId,
                zoom_webinar_id: webinar_zoom_id,
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Registrations sync timeout')), 45000))
          ])

          if (registrationsResult.data?.success) {
            results.registrations.success = true
            results.registrations.count = registrationsResult.data.registrations_synced || 0
            console.log(`✓ Registrations synced: ${results.registrations.count}`)
          } else {
            results.registrations.error = registrationsResult.error?.message || 'Unknown error'
            console.log(`❌ Registrations sync failed: ${results.registrations.error}`)
          }
        }

        if (syncType === 'polls') {
          const pollsResult = await Promise.race([
            supabaseClient.functions.invoke('zoom-sync-polls', {
              body: {
                organization_id: finalOrgId,
                user_id: finalUserId,
                webinar_id: finalWebinarId,
                zoom_webinar_id: webinar_zoom_id,
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Polls sync timeout')), 45000))
          ])

          if (pollsResult.data?.success) {
            results.polls.success = true
            results.polls.count = pollsResult.data.polls_synced || 0
            console.log(`✓ Polls synced: ${results.polls.count}`)
          } else {
            results.polls.error = pollsResult.error?.message || 'Unknown error'
            console.log(`❌ Polls sync failed: ${results.polls.error}`)
          }
        }

        if (syncType === 'qa') {
          const qaResult = await Promise.race([
            supabaseClient.functions.invoke('zoom-sync-qa', {
              body: {
                organization_id: finalOrgId,
                user_id: finalUserId,
                webinar_id: finalWebinarId,
                zoom_webinar_id: webinar_zoom_id,
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('QA sync timeout')), 45000))
          ])

          if (qaResult.data?.success) {
            results.qa.success = true
            results.qa.count = qaResult.data.qa_synced || 0
            console.log(`✓ Q&A synced: ${results.qa.count}`)
          } else {
            results.qa.error = qaResult.error?.message || 'Unknown error'
            console.log(`❌ Q&A sync failed: ${results.qa.error}`)
          }
        }

        if (syncType === 'chat') {
          console.log(`Processing chat for webinar status: ${webinar.status}`)
          
          const chatResult = await Promise.race([
            supabaseClient.functions.invoke('zoom-sync-chat', {
              body: {
                organization_id: finalOrgId,
                user_id: finalUserId,
                webinar_id: finalWebinarId,
                zoom_webinar_id: webinar_zoom_id,
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Chat sync timeout')), 45000))
          ])

          if (chatResult.data?.success) {
            results.chat.success = true
            results.chat.count = chatResult.data.messages_synced || 0
            results.chat.skipped = chatResult.data.skipped || false
            if (results.chat.skipped) {
              console.log(`⏭️ Chat sync skipped: ${chatResult.data.reason}`)
            } else {
              console.log(`✓ Chat synced: ${results.chat.count} messages`)
            }
          } else {
            results.chat.error = chatResult.error?.message || 'Unknown error'
            console.log(`❌ Chat sync failed: ${results.chat.error}`)
          }
        }

        // Update progress
        const progress = 20 + (sync_types.indexOf(syncType) + 1) * (60 / sync_types.length)
        await supabaseClient.from('sync_jobs').update({ progress: Math.round(progress) }).eq('id', job.id)
        
        // Delay between sync operations
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`Error processing ${syncType}:`, error.message)
        results[syncType].error = error.message
      }
    }

    // Update attendee count if participants were synced
    if (results.participants.success && results.participants.count > 0) {
      await supabaseClient
        .from('webinars')
        .update({ attendees_count: results.participants.count })
        .eq('id', finalWebinarId)
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
          completed_at: new Date().toISOString(),
          webinar_status: webinar.status
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

async function cleanupHangingJobs(supabaseClient: any) {
  // Find jobs that have been "running" for more than 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  
  const { data: hangingJobs, error } = await supabaseClient
    .from('sync_jobs')
    .select('id')
    .eq('status', 'running')
    .lt('started_at', fifteenMinutesAgo)

  if (hangingJobs && hangingJobs.length > 0) {
    console.log(`Found ${hangingJobs.length} hanging sync jobs, marking as failed`)
    
    await supabaseClient
      .from('sync_jobs')
      .update({
        status: 'failed',
        error_message: 'Job timed out after 15 minutes',
        completed_at: new Date().toISOString()
      })
      .in('id', hangingJobs.map(job => job.id))
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

    // Clean up hanging and broken jobs first
    await cleanupHangingJobs(supabaseClient)
    await cleanupBrokenJobs(supabaseClient)

    // Get pending detailed sync jobs
    const { data: pendingJobs, error: jobsError } = await supabaseClient
      .from('sync_jobs')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'detailed_webinar_sync')
      .order('created_at', { ascending: true })
      .limit(2) // Process fewer jobs at once

    if (jobsError) {
      throw new Error(`Failed to fetch pending jobs: ${jobsError.message}`)
    }

    console.log(`Found ${pendingJobs?.length || 0} pending detailed_webinar_sync jobs`)

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
    
    // Process each job with comprehensive error handling
    for (const job of pendingJobs) {
      try {
        console.log(`Starting processing of job ${job.id}`)
        
        // Set a timeout for each job (3 minutes max)
        const jobPromise = processDetailedSyncJob(job, supabaseClient)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job timeout after 3 minutes')), 3 * 60 * 1000)
        )
        
        const result = await Promise.race([jobPromise, timeoutPromise])
        results.push({
          job_id: job.id,
          webinar_zoom_id: job.metadata?.webinar_zoom_id,
          ...result
        })
      } catch (error) {
        console.error(`Job ${job.id} failed or timed out:`, error)
        
        // Mark job as failed if it timed out
        await supabaseClient
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)
        
        results.push({
          job_id: job.id,
          webinar_zoom_id: job.metadata?.webinar_zoom_id,
          success: false,
          error: error.message
        })
      }
      
      // Delay between jobs
      await new Promise(resolve => setTimeout(resolve, 1000))
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
