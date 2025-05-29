
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChunkConfig {
  webinarBatchSize: number
  maxProcessingTime: number
  detailBatchSize: number
}

const DEFAULT_CONFIG: ChunkConfig = {
  webinarBatchSize: 5, // Process 5 webinars per chunk
  maxProcessingTime: 25000, // 25 seconds max per chunk
  detailBatchSize: 3 // Process details for 3 webinars max per chunk
}

// Enhanced decryption with better error handling
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)))
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    )
    
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt credentials')
  }
}

async function getZoomAccessToken(userId: string, supabaseClient: any): Promise<string> {
  const { data: connection, error: connectionError } = await supabaseClient
    .from('zoom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single()

  if (connectionError) {
    throw new Error(`No active Zoom connection: ${connectionError.message}`)
  }

  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
  try {
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)
    
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenData.error || tokenData.message}`)
    }

    return tokenData.access_token
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`)
  }
}

async function fetchWebinarsChunk(accessToken: string, pageToken?: string): Promise<{ webinars: any[], nextPageToken?: string }> {
  const params = new URLSearchParams({
    page_size: '30',
    type: 'past',
  })
  
  if (pageToken) {
    params.append('next_page_token', pageToken)
  }

  const response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
  }

  const data = await response.json()
  return {
    webinars: data.webinars || [],
    nextPageToken: data.next_page_token
  }
}

async function processWebinarChunk(
  webinars: any[], 
  accessToken: string, 
  supabaseClient: any, 
  organizationId: string, 
  userId: string
): Promise<{ processed: number, errors: number }> {
  let processed = 0
  let errors = 0
  
  for (const webinar of webinars) {
    try {
      // Get basic webinar details with timeout
      let detailedWebinar = webinar
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
        
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (detailResponse.ok) {
          detailedWebinar = await detailResponse.json()
        }
      } catch (error) {
        console.log(`Failed to get details for webinar ${webinar.id}, using basic data`)
      }

      // Determine status
      let webinarStatus = 'past'
      if (detailedWebinar.start_time) {
        const startTime = new Date(detailedWebinar.start_time)
        const now = new Date()
        webinarStatus = startTime > now ? 'upcoming' : 'completed'
      }

      // Upsert webinar with retry logic
      let upsertSuccess = false
      let retryCount = 0
      
      while (!upsertSuccess && retryCount < 3) {
        try {
          const { error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: detailedWebinar.id?.toString(),
              organization_id: organizationId,
              user_id: userId,
              title: detailedWebinar.topic,
              host_name: detailedWebinar.host_email || webinar.host_email,
              host_id: detailedWebinar.host_id,
              uuid: detailedWebinar.uuid,
              start_time: detailedWebinar.start_time || webinar.start_time,
              duration_minutes: detailedWebinar.duration || webinar.duration,
              registrants_count: detailedWebinar.registrants_count || 0,
              join_url: detailedWebinar.join_url,
              password: detailedWebinar.password,
              encrypted_passcode: detailedWebinar.encrypted_passcode,
              h323_passcode: detailedWebinar.h323_passcode,
              start_url: detailedWebinar.start_url,
              timezone: detailedWebinar.timezone,
              agenda: detailedWebinar.agenda,
              created_at_zoom: detailedWebinar.created_at,
              webinar_number: detailedWebinar.id,
              is_simulive: detailedWebinar.is_simulive || false,
              record_file_id: detailedWebinar.record_file_id,
              transition_to_live: detailedWebinar.transition_to_live || false,
              creation_source: detailedWebinar.creation_source,
              webinar_type: detailedWebinar.type?.toString() || 'past',
              status: webinarStatus,
              registration_url: detailedWebinar.registration_url,
              host_email: detailedWebinar.host_email,
              pstn_password: detailedWebinar.pstn_password,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })

          if (!upsertError) {
            upsertSuccess = true
            processed++
          } else {
            throw upsertError
          }
        } catch (error) {
          retryCount++
          if (retryCount >= 3) {
            console.error(`Failed to upsert webinar ${webinar.id} after 3 retries:`, error)
            errors++
          } else {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          }
        }
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 300))
      
    } catch (error) {
      console.error(`Error processing webinar ${webinar.id}:`, error)
      errors++
    }
  }
  
  return { processed, errors }
}

async function scheduleDetailedSyncChunk(
  webinarIds: string[], 
  supabaseClient: any, 
  organizationId: string, 
  userId: string
): Promise<void> {
  // Schedule background sync for detailed data (participants, polls, etc.)
  for (const webinarId of webinarIds.slice(0, 3)) { // Limit to 3 webinars for detailed sync
    try {
      await supabaseClient
        .from('sync_jobs')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          job_type: 'detailed_webinar_sync',
          status: 'pending',
          metadata: {
            webinar_zoom_id: webinarId,
            sync_types: ['participants', 'registrations', 'polls'],
            scheduled_at: new Date().toISOString()
          }
        })
    } catch (error) {
      console.error(`Failed to schedule detailed sync for webinar ${webinarId}:`, error)
    }
  }
}

serve(async (req) => {
  console.log('Chunked sync called with method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id, chunk_token, config = DEFAULT_CONFIG } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting chunked sync for user:', user_id, 'chunk_token:', chunk_token)

    // Get or create sync job
    let syncJob
    if (!chunk_token) {
      // First chunk - create new sync job
      const { data: newJob, error: jobError } = await supabaseClient
        .from('sync_jobs')
        .insert({
          organization_id,
          user_id,
          job_type: 'chunked_comprehensive_sync',
          status: 'running',
          progress: 0,
          metadata: { 
            started_at: new Date().toISOString(),
            chunked_processing: true,
            total_webinars: 0,
            processed_webinars: 0
          }
        })
        .select()
        .single()

      if (jobError) {
        throw new Error('Failed to create sync job')
      }
      
      syncJob = newJob
    } else {
      // Continuing chunk - get existing job
      const { data: existingJob } = await supabaseClient
        .from('sync_jobs')
        .select('*')
        .eq('id', chunk_token)
        .single()
      
      syncJob = existingJob
    }

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Fetch webinars chunk
    const currentPageToken = syncJob?.metadata?.next_page_token
    const { webinars, nextPageToken } = await fetchWebinarsChunk(accessToken, currentPageToken)
    
    console.log(`Fetched ${webinars.length} webinars for processing`)

    // Process webinars chunk
    const { processed, errors } = await processWebinarChunk(
      webinars.slice(0, config.webinarBatchSize),
      accessToken,
      supabaseClient,
      organization_id,
      user_id
    )

    // Update job progress
    const currentProgress = syncJob?.metadata?.processed_webinars || 0
    const totalFound = (syncJob?.metadata?.total_webinars || 0) + webinars.length
    const newProcessed = currentProgress + processed
    const progressPercentage = totalFound > 0 ? Math.min(Math.round((newProcessed / totalFound) * 100), 95) : 0

    const updatedMetadata = {
      ...syncJob.metadata,
      processed_webinars: newProcessed,
      total_webinars: totalFound,
      next_page_token: nextPageToken,
      last_chunk_processed: new Date().toISOString(),
      chunk_errors: errors
    }

    // Schedule detailed sync for recently processed webinars
    const recentWebinarIds = webinars.slice(0, config.detailBatchSize).map(w => w.id)
    if (recentWebinarIds.length > 0) {
      // Use background task to avoid blocking response
      const detailedSyncPromise = scheduleDetailedSyncChunk(
        recentWebinarIds, 
        supabaseClient, 
        organization_id, 
        user_id
      )
      
      // Don't await - let it run in background
      detailedSyncPromise.catch(error => 
        console.error('Background detailed sync scheduling failed:', error)
      )
    }

    // Determine if sync is complete
    const isComplete = !nextPageToken
    const finalStatus = isComplete ? 'completed' : 'running'
    const finalProgress = isComplete ? 100 : progressPercentage

    await supabaseClient
      .from('sync_jobs')
      .update({
        status: finalStatus,
        progress: finalProgress,
        metadata: updatedMetadata,
        completed_at: isComplete ? new Date().toISOString() : null
      })
      .eq('id', syncJob.id)

    const processingTime = Date.now() - startTime
    console.log(`Chunk completed in ${processingTime}ms: processed=${processed}, errors=${errors}`)

    // Return response with next chunk info
    return new Response(
      JSON.stringify({
        success: true,
        chunk_completed: true,
        job_id: syncJob.id,
        processed_count: processed,
        error_count: errors,
        total_processed: newProcessed,
        total_found: totalFound,
        progress_percentage: finalProgress,
        has_next_chunk: !isComplete,
        next_chunk_token: isComplete ? null : syncJob.id,
        processing_time_ms: processingTime,
        summary: {
          webinars_in_chunk: webinars.length,
          webinars_processed: processed,
          detailed_sync_scheduled: recentWebinarIds.length,
          is_final_chunk: isComplete
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Chunked sync error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        processing_time_ms: Date.now() - startTime
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
