import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RateLimiter {
  requestCount: number
  dailyLimit: number
  lastReset: Date
  requestQueue: Array<() => Promise<any>>
  processing: boolean
}

interface SyncConfig {
  webinarBatchSize: number
  webinarDelay: number
  participantsBatchSize: number
  participantsDelay: number
  chatBatchSize: number
  chatDelay: number
  pollsBatchSize: number
  pollsDelay: number
  qaBatchSize: number
  qaDelay: number
  registrationsBatchSize: number
  registrationsDelay: number
  maxRetries: number
  baseBackoff: number
}

const DEFAULT_CONFIG: SyncConfig = {
  webinarBatchSize: 10,
  webinarDelay: 500,
  participantsBatchSize: 5,
  participantsDelay: 1000,
  chatBatchSize: 8,
  chatDelay: 300,
  pollsBatchSize: 8,
  pollsDelay: 300,
  qaBatchSize: 8,
  qaDelay: 300,
  registrationsBatchSize: 8,
  registrationsDelay: 300,
  maxRetries: 3,
  baseBackoff: 1000
}

class ZoomRateLimiter {
  private limiter: RateLimiter

  constructor() {
    this.limiter = {
      requestCount: 0,
      dailyLimit: 1000, // Conservative daily limit
      lastReset: new Date(),
      requestQueue: [],
      processing: false
    }
  }

  async makeRequest<T>(requestFn: () => Promise<T>, retryCount = 0): Promise<T> {
    // Check if we need to reset daily counter
    const now = new Date()
    if (now.getDate() !== this.limiter.lastReset.getDate()) {
      this.limiter.requestCount = 0
      this.limiter.lastReset = now
    }

    // Check daily limit
    if (this.limiter.requestCount >= this.limiter.dailyLimit) {
      throw new Error('Daily rate limit reached. Please try again tomorrow.')
    }

    try {
      this.limiter.requestCount++
      const response = await requestFn()
      return response
    } catch (error: any) {
      if (error.message?.includes('429') || error.status === 429) {
        if (retryCount < DEFAULT_CONFIG.maxRetries) {
          const backoffDelay = DEFAULT_CONFIG.baseBackoff * Math.pow(2, retryCount)
          console.log(`Rate limited, backing off for ${backoffDelay}ms (attempt ${retryCount + 1})`)
          await this.delay(backoffDelay)
          return this.makeRequest(requestFn, retryCount + 1)
        }
        throw new Error('Rate limit exceeded after maximum retries')
      }
      throw error
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number,
    delayMs: number,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(
        batch.map(item => this.makeRequest(() => processor(item)))
      )
      
      results.push(...batchResults)
      
      if (progressCallback) {
        progressCallback(i + batch.length, items.length)
      }
      
      // Add delay between batches (except for the last batch)
      if (i + batchSize < items.length) {
        await this.delay(delayMs)
      }
    }
    
    return results
  }
}

// Token management functions
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    )
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credential')
  }
}

async function getZoomAccessToken(userId: string, supabaseClient: any): Promise<string> {
  const { data: connection, error: connectionError } = await supabaseClient
    .from('zoom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single()

  if (connectionError || !connection) {
    throw new Error('No active Zoom connection found')
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
    throw new Error(`Failed to get access token: ${tokenData.error || tokenData.message}`)
  }

  return tokenData.access_token
}

function getDateRange(daysBack: number = 180): { from: string; to: string } {
  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - daysBack)
  
  // Format dates as yyyy-MM-dd for Zoom API
  const from = fromDate.toISOString().split('T')[0]
  const to = today.toISOString().split('T')[0]
  
  return { from, to }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id, config = DEFAULT_CONFIG, days_back = 180 } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log(`Starting comprehensive rate-limited sync for user: ${user_id}, fetching ${days_back} days back`)

    const rateLimiter = new ZoomRateLimiter()
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Create master sync job
    const { data: syncJob } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_rate_limited_sync',
        status: 'running',
        metadata: { 
          started_at: new Date().toISOString(),
          config,
          days_back
        }
      })
      .select()
      .single()

    console.log('Created comprehensive sync job:', syncJob?.id)

    // Stage 1: Fetch webinars with rate limiting and extended date range
    console.log(`Stage 1: Fetching webinars from ${days_back} days back...`)
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 10, 
        metadata: { 
          ...syncJob?.metadata, 
          current_stage: 'webinars',
          stage_message: `Fetching webinar list for past ${days_back} days...`
        }
      })
      .eq('id', syncJob?.id)

    // Get date range for extended lookback
    const { from, to } = getDateRange(days_back)
    console.log(`Fetching webinars from ${from} to ${to}`)

    // Get webinars with pagination and rate limiting
    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching webinars page ${pageCount}...`)
      
      const webinarsData = await rateLimiter.makeRequest(async () => {
        const params = new URLSearchParams({
          page_size: '50', // Smaller page size for rate limiting
          type: 'past',
          from,
          to,
        })
        
        if (nextPageToken) {
          params.append('next_page_token', nextPageToken)
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

        return response.json()
      })

      const webinars = webinarsData.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = webinarsData.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
      
      // Rate limiting delay between pages
      if (nextPageToken && pageCount < 50) { // Increased safety limit for larger date range
        await rateLimiter.delay(config.webinarDelay)
      }
      
    } while (nextPageToken && pageCount < 50)

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Stage 2: Process webinar details with rate limiting
    console.log('Stage 2: Processing webinar details...')
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 20,
        total_items: allWebinars.length,
        metadata: { 
          ...syncJob?.metadata, 
          current_stage: 'webinar_details',
          stage_message: `Processing ${allWebinars.length} webinars...`,
          webinars_found: allWebinars.length
        }
      })
      .eq('id', syncJob?.id)

    let processedWebinars = 0

    const webinarResults = await rateLimiter.batchProcess(
      allWebinars,
      async (webinar) => {
        try {
          // Get detailed webinar info
          const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinar.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (detailResponse.ok) {
            const detailData = await detailResponse.json()
            
            // Upsert webinar data
            const { error: upsertError } = await supabaseClient
              .from('webinars')
              .upsert({
                zoom_webinar_id: webinar.id,
                organization_id,
                user_id,
                title: webinar.topic,
                host_name: detailData.host_email || webinar.host_email,
                start_time: webinar.start_time,
                duration_minutes: webinar.duration,
                registrants_count: detailData.registrants_count || 0,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'zoom_webinar_id',
              })

            if (upsertError) {
              console.error('Error upserting webinar:', upsertError)
              return { success: false, error: upsertError.message }
            }

            return { success: true, webinar_id: webinar.id }
          } else {
            console.warn(`Failed to get details for webinar ${webinar.id}`)
            return { success: false, error: 'Failed to fetch details' }
          }
        } catch (error: any) {
          console.error(`Error processing webinar ${webinar.id}:`, error)
          return { success: false, error: error.message }
        }
      },
      config.webinarBatchSize,
      config.webinarDelay,
      (processed, total) => {
        processedWebinars = processed
        const progress = 20 + Math.round((processed / total) * 60) // 20-80% for webinar processing
        supabaseClient
          .from('sync_jobs')
          .update({ 
            progress,
            current_item: processed,
            metadata: { 
              ...syncJob?.metadata, 
              current_stage: 'webinar_details',
              stage_message: `Processed ${processed}/${total} webinars...`
            }
          })
          .eq('id', syncJob?.id)
      }
    )

    const successfulWebinars = webinarResults.filter(r => r.success)
    console.log(`Processed ${successfulWebinars.length}/${allWebinars.length} webinars successfully`)

    // Stage 3: Sync detailed data for recent webinars
    const recentWebinars = allWebinars.slice(0, 10) // Sync detailed data for 10 most recent
    
    if (recentWebinars.length > 0) {
      console.log(`Stage 3: Syncing detailed data for ${recentWebinars.length} recent webinars...`)
      
      let detailsProcessed = 0
      const detailsTotal = recentWebinars.length * 5 // 5 operations per webinar
      
      for (const webinar of recentWebinars) {
        try {
          // Get webinar record from database
          const { data: webinarRecord } = await supabaseClient
            .from('webinars')
            .select('id')
            .eq('zoom_webinar_id', webinar.id)
            .single()

          if (!webinarRecord) continue

          const webinar_id = webinarRecord.id

          // Sync participants
          console.log(`  - Syncing participants for ${webinar.topic}...`)
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              progress: 80 + Math.round((detailsProcessed / detailsTotal) * 15),
              metadata: { 
                ...syncJob?.metadata, 
                current_stage: 'participants',
                stage_message: `Syncing participants for: ${webinar.topic}`
              }
            })
            .eq('id', syncJob?.id)

          const participantsResult = await supabaseClient.functions.invoke('zoom-sync-participants', {
            body: {
              organization_id,
              user_id,
              webinar_id,
              zoom_webinar_id: webinar.id,
            }
          })
          detailsProcessed++

          // Add delay between operations
          await rateLimiter.delay(config.participantsDelay)

          // Sync chat
          console.log(`  - Syncing chat for ${webinar.topic}...`)
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              metadata: { 
                ...syncJob?.metadata, 
                current_stage: 'chat',
                stage_message: `Syncing chat for: ${webinar.topic}`
              }
            })
            .eq('id', syncJob?.id)

          const chatResult = await supabaseClient.functions.invoke('zoom-sync-chat', {
            body: {
              organization_id,
              user_id,
              webinar_id,
              zoom_webinar_id: webinar.id,
            }
          })
          detailsProcessed++
          await rateLimiter.delay(config.chatDelay)

          // Sync polls
          console.log(`  - Syncing polls for ${webinar.topic}...`)
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              metadata: { 
                ...syncJob?.metadata, 
                current_stage: 'polls',
                stage_message: `Syncing polls for: ${webinar.topic}`
              }
            })
            .eq('id', syncJob?.id)

          const pollsResult = await supabaseClient.functions.invoke('zoom-sync-polls', {
            body: {
              organization_id,
              user_id,
              webinar_id,
              zoom_webinar_id: webinar.id,
            }
          })
          detailsProcessed++
          await rateLimiter.delay(config.pollsDelay)

          // Sync Q&A
          console.log(`  - Syncing Q&A for ${webinar.topic}...`)
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              metadata: { 
                ...syncJob?.metadata, 
                current_stage: 'qa',
                stage_message: `Syncing Q&A for: ${webinar.topic}`
              }
            })
            .eq('id', syncJob?.id)

          const qaResult = await supabaseClient.functions.invoke('zoom-sync-qa', {
            body: {
              organization_id,
              user_id,
              webinar_id,
              zoom_webinar_id: webinar.id,
            }
          })
          detailsProcessed++
          await rateLimiter.delay(config.qaDelay)

          // Sync registrations
          console.log(`  - Syncing registrations for ${webinar.topic}...`)
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              metadata: { 
                ...syncJob?.metadata, 
                current_stage: 'registrations',
                stage_message: `Syncing registrations for: ${webinar.topic}`
              }
            })
            .eq('id', syncJob?.id)

          const registrationsResult = await supabaseClient.functions.invoke('zoom-sync-registrations', {
            body: {
              organization_id,
              user_id,
              webinar_id,
              zoom_webinar_id: webinar.id,
            }
          })
          detailsProcessed++
          await rateLimiter.delay(config.registrationsDelay)

        } catch (error) {
          console.error(`Error syncing detailed data for webinar ${webinar.topic}:`, error)
          detailsProcessed += 5 // Skip this webinar
        }
      }
    }

    // Final update
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          webinars_synced: successfulWebinars.length,
          webinars_found: allWebinars.length,
          detailed_sync_count: recentWebinars.length,
          api_requests_made: rateLimiter.limiter.requestCount,
          days_back,
          rate_limit_hits: 0 // TODO: Track this
        }
      })
      .eq('id', syncJob?.id)

    console.log('Comprehensive rate-limited sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary: {
          webinars_synced: successfulWebinars.length,
          webinars_found: allWebinars.length,
          detailed_sync_count: recentWebinars.length,
          api_requests_made: rateLimiter.limiter.requestCount,
          days_back,
          rate_limit_hits: 0 // TODO: Track this
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Comprehensive sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
