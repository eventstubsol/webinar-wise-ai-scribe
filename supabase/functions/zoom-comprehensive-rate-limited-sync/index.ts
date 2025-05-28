
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncMetrics {
  participants: { success: number; failed: number; skipped: number };
  panelists: { success: number; failed: number; skipped: number };
  polls: { success: number; failed: number; skipped: number };
  qa: { success: number; failed: number; skipped: number };
  registrations: { success: number; failed: number; skipped: number };
  chat: { success: number; failed: number; skipped: number };
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

// Robust token retrieval with retry logic
async function getZoomAccessToken(userId: string, supabaseClient: any): Promise<string> {
  const maxRetries = 3
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
      lastError = error as Error
      console.error(`Token attempt ${attempt} failed:`, error)
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }
  
  throw lastError || new Error('Failed to get access token after all retries')
}

// Robust database operations with deadlock prevention
async function safeUpsert(supabaseClient: any, table: string, data: any, conflictColumn: string, maxRetries = 3) {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: result, error } = await supabaseClient
        .from(table)
        .upsert(data, { onConflict: conflictColumn })
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      return result
    } catch (error: any) {
      lastError = error
      
      // Check for deadlock or serialization failure
      if (error.message && (
        error.message.includes('deadlock') || 
        error.message.includes('serialization') ||
        error.message.includes('could not serialize')
      )) {
        console.log(`Database conflict on attempt ${attempt}, retrying...`)
        
        if (attempt < maxRetries) {
          // Random delay to reduce contention
          const delay = Math.random() * 1000 * attempt
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      // For non-deadlock errors, don't retry
      throw error
    }
  }
  
  throw lastError || new Error('Database operation failed after all retries')
}

// Enhanced delay with jitter
async function smartDelay(baseMs: number): Promise<void> {
  const jitter = Math.random() * 500 // Add up to 500ms random jitter
  return new Promise(resolve => setTimeout(resolve, baseMs + jitter))
}

serve(async (req) => {
  console.log('Enhanced comprehensive rate-limited sync called with method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let syncJobId: string | null = null

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting enhanced comprehensive rate-limited sync for user:', user_id, 'org:', organization_id)

    // Clean up any stuck jobs first with better error handling
    try {
      console.log('Cleaning up stuck jobs...')
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { error: cleanupError } = await supabaseClient
        .from('sync_jobs')
        .update({ 
          status: 'failed',
          error_message: 'Job timed out and was automatically cleaned up',
          completed_at: new Date().toISOString()
        })
        .eq('user_id', user_id)
        .eq('status', 'running')
        .lt('started_at', fiveMinutesAgo)

      if (cleanupError) {
        console.error('Cleanup error (non-fatal):', cleanupError)
      } else {
        console.log('Stuck jobs cleaned up successfully')
      }
    } catch (error) {
      console.error('Cleanup failed (continuing anyway):', error)
    }

    // Create sync job with enhanced metadata
    const { data: syncJob, error: syncJobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_rate_limited_sync',
        status: 'running',
        progress: 0,
        metadata: { 
          started_at: new Date().toISOString(),
          enhanced_sync: true,
          retry_logic: true
        }
      })
      .select()
      .single()

    if (syncJobError) {
      console.error('Error creating sync job:', syncJobError)
      throw new Error('Failed to create sync job')
    }

    syncJobId = syncJob?.id
    console.log('Created enhanced sync job:', syncJobId)

    // Get access token with enhanced error handling
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    console.log('\n=== PHASE 1: Reliable Basic Sync ===')

    // Update job progress
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 5,
        metadata: { 
          ...syncJob.metadata,
          current_stage: 'fetching_webinars',
          stage_message: 'Fetching webinars from Zoom...'
        }
      })
      .eq('id', syncJobId)

    // Fetch webinars with better pagination and error handling
    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    const maxPages = 15 // Reasonable limit
    
    do {
      pageCount++
      console.log(`Fetching webinars page ${pageCount}...`)
      
      const params = new URLSearchParams({
        page_size: '30',
        type: 'past',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      let response
      let retryCount = 0
      const maxRetries = 3
      
      // Retry logic for API calls
      while (retryCount < maxRetries) {
        try {
          response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            break
          } else if (response.status === 429) {
            // Rate limit hit, wait longer
            const retryAfter = response.headers.get('Retry-After')
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000
            console.log(`Rate limited, waiting ${waitTime}ms...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            retryCount++
          } else {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
          }
        } catch (error) {
          retryCount++
          if (retryCount >= maxRetries) {
            throw error
          }
          console.log(`API call attempt ${retryCount} failed, retrying...`)
          await smartDelay(2000 * retryCount)
        }
      }

      if (!response || !response.ok) {
        throw new Error('Failed to fetch webinars after all retries')
      }

      const webinarsData = await response.json()
      const webinars = webinarsData.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = webinarsData.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars (total: ${allWebinars.length})`)
      
      // Update progress
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress: Math.min(5 + (pageCount * 5), 25),
          metadata: { 
            ...syncJob.metadata,
            current_stage: 'fetching_webinars',
            stage_message: `Fetched ${allWebinars.length} webinars...`,
            webinars_found: allWebinars.length
          }
        })
        .eq('id', syncJobId)
      
      if (nextPageToken && pageCount < maxPages) {
        await smartDelay(1500) // Rate limiting with jitter
      }
      
    } while (nextPageToken && pageCount < maxPages)

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Process webinars with improved batching and error handling
    const batchSize = 5 // Smaller batches for better reliability
    let processedCount = 0
    let errorCount = 0

    for (let i = 0; i < allWebinars.length; i += batchSize) {
      const batch = allWebinars.slice(i, i + batchSize)
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allWebinars.length/batchSize)}...`)
      
      for (const webinar of batch) {
        try {
          console.log(`Processing webinar: ${webinar.topic}`)
          
          // Get detailed webinar data with retry logic
          let detailedWebinar = webinar
          let detailRetries = 0
          
          while (detailRetries < 3) {
            try {
              const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinar.id}`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              })

              if (detailResponse.ok) {
                detailedWebinar = await detailResponse.json()
                break
              } else if (detailResponse.status === 429) {
                const retryAfter = detailResponse.headers.get('Retry-After')
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 3000
                console.log(`Detail API rate limited, waiting ${waitTime}ms...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
                detailRetries++
              } else {
                console.log(`Detail API returned ${detailResponse.status}, using basic data`)
                break
              }
            } catch (error) {
              detailRetries++
              if (detailRetries >= 3) {
                console.log('Failed to get detailed data, using basic webinar data')
                break
              }
              await smartDelay(1000 * detailRetries)
            }
          }

          // Determine webinar status
          let webinarStatus = 'past'
          if (detailedWebinar.start_time) {
            const startTime = new Date(detailedWebinar.start_time)
            const now = new Date()
            if (startTime > now) {
              webinarStatus = 'upcoming'
            } else {
              webinarStatus = 'completed'
            }
          }

          // Safe upsert with deadlock prevention
          const webinarRecord = await safeUpsert(supabaseClient, 'webinars', {
            zoom_webinar_id: detailedWebinar.id?.toString(),
            organization_id,
            user_id,
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
          }, 'zoom_webinar_id')

          if (webinarRecord) {
            processedCount++
            console.log(`  ✓ Processed webinar successfully (${processedCount}/${allWebinars.length})`)
          }

          // Smart delay between webinars
          await smartDelay(800)
          
        } catch (error) {
          console.error(`Error processing webinar ${webinar.id}:`, error)
          errorCount++
        }
      }

      // Update progress after each batch
      const progress = Math.min(25 + Math.round((i + batchSize) / allWebinars.length * 35), 60)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress,
          current_item: Math.min(i + batchSize, allWebinars.length),
          total_items: allWebinars.length,
          metadata: {
            ...syncJob.metadata,
            current_stage: 'processing_webinars',
            stage_message: `Processed ${processedCount} of ${allWebinars.length} webinars...`,
            webinars_found: allWebinars.length,
            webinars_synced: processedCount
          }
        })
        .eq('id', syncJobId)

      // Longer delay between batches for stability
      if (i + batchSize < allWebinars.length) {
        await smartDelay(2000)
      }
    }

    console.log(`Basic sync completed: ${processedCount} webinars processed, ${errorCount} errors`)

    // Update to 60% completion
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 60,
        metadata: {
          ...syncJob.metadata,
          current_stage: 'basic_complete',
          stage_message: 'Basic sync complete. Starting detailed sync...',
          webinars_found: allWebinars.length,
          webinars_synced: processedCount,
          errors: errorCount
        }
      })
      .eq('id', syncJobId)

    console.log('\n=== PHASE 2: Enhanced Background Detailed Sync ===')
    
    // Select recent webinars for detailed sync (limit for reliability)
    const recentWebinars = allWebinars
      .filter(w => w.start_time)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, 5) // Process top 5 most recent

    console.log(`Selected ${recentWebinars.length} recent webinars for detailed sync`)

    // Initialize detailed sync metrics
    const syncMetrics: SyncMetrics = {
      participants: { success: 0, failed: 0, skipped: 0 },
      panelists: { success: 0, failed: 0, skipped: 0 },
      polls: { success: 0, failed: 0, skipped: 0 },
      qa: { success: 0, failed: 0, skipped: 0 },
      registrations: { success: 0, failed: 0, skipped: 0 },
      chat: { success: 0, failed: 0, skipped: 0 }
    }

    console.log('\nStarting detailed sync for', recentWebinars.length, 'webinars...')

    for (let i = 0; i < recentWebinars.length; i++) {
      const webinar = recentWebinars[i]
      console.log(`\nProcessing detailed data for webinar ${i + 1}/${recentWebinars.length}: ${webinar.topic}`)

      try {
        // Get webinar record from database
        const { data: webinarRecord, error: recordError } = await supabaseClient
          .from('webinars')
          .select('id')
          .eq('zoom_webinar_id', webinar.id?.toString())
          .single()

        if (recordError || !webinarRecord) {
          console.log('  Webinar record not found in database, skipping...')
          continue
        }

        const webinar_id = webinarRecord.id
        const detailProgress = 60 + Math.round((i + 1) / recentWebinars.length * 35)

        // Update progress
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: detailProgress,
            metadata: {
              ...syncJob.metadata,
              current_stage: 'detailed_sync',
              stage_message: `Processing detailed data for webinar ${i + 1}/${recentWebinars.length}...`,
              webinars_found: allWebinars.length,
              webinars_synced: processedCount,
              detailed_sync_count: i + 1
            }
          })
          .eq('id', syncJobId)

        // Process each data type with enhanced error handling
        const dataTypes = [
          { name: 'registrations', endpoint: 'zoom-sync-registrations' },
          { name: 'participants', endpoint: 'zoom-sync-participants' },
          { name: 'panelists', endpoint: 'zoom-sync-panelists' },
          { name: 'polls', endpoint: 'zoom-sync-polls' },
          { name: 'qa', endpoint: 'zoom-sync-qa' },
          { name: 'chat', endpoint: 'zoom-sync-chat' }
        ]

        for (const dataType of dataTypes) {
          try {
            console.log(`  - Syncing ${dataType.name}...`)
            
            const result = await supabaseClient.functions.invoke(dataType.endpoint, {
              body: {
                organization_id,
                user_id,
                webinar_id,
                zoom_webinar_id: webinar.id,
              }
            })

            if (result.error) {
              console.error(`  ❌ ${dataType.name} sync failed:`, result.error)
              syncMetrics[dataType.name as keyof SyncMetrics].failed++
            } else {
              console.log(`  ✓ ${dataType.name} synced successfully`)
              syncMetrics[dataType.name as keyof SyncMetrics].success++
            }
          } catch (error) {
            console.error(`  ❌ ${dataType.name} sync error:`, error)
            syncMetrics[dataType.name as keyof SyncMetrics].failed++
          }

          // Short delay between data types
          await smartDelay(1000)
        }

        // Delay between webinars for rate limiting
        if (i < recentWebinars.length - 1) {
          await smartDelay(3000)
        }

      } catch (error) {
        console.error(`Error processing detailed data for webinar ${webinar.topic}:`, error)
      }
    }

    console.log('\nDetailed sync completed!')
    console.log('Final metrics:', syncMetrics)

    // Final job completion
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)

    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          ...syncJob.metadata,
          current_stage: 'completed',
          stage_message: 'Enhanced comprehensive sync completed successfully!',
          webinars_found: allWebinars.length,
          webinars_synced: processedCount,
          detailed_sync_count: recentWebinars.length,
          sync_metrics: syncMetrics,
          duration_seconds: duration,
          enhanced_completion: true
        }
      })
      .eq('id', syncJobId)

    console.log('Enhanced comprehensive sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJobId,
        summary: {
          webinars_found: allWebinars.length,
          webinars_synced: processedCount,
          detailed_sync_count: recentWebinars.length,
          sync_metrics: syncMetrics,
          duration_seconds: duration,
          enhanced_reliability: true
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Enhanced comprehensive sync error:', error)
    
    // Update job status to failed if we have a job ID
    if (syncJobId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
            metadata: {
              error_type: 'sync_failure',
              error_details: error.message,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', syncJobId)
      } catch (updateError) {
        console.error('Failed to update job status:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        enhanced_error_handling: true 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
