
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncProgress {
  webinars_synced: number
  detailed_sync_count: number
  api_requests_made: number
  current_stage: string
  stage_message: string
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
  console.log('Getting Zoom access token for user:', userId)
  
  const { data: connection, error: connectionError } = await supabaseClient
    .from('zoom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single()

  if (connectionError || !connection) {
    console.error('No active Zoom connection found:', connectionError)
    throw new Error('No active Zoom connection found')
  }

  if (!connection.encrypted_client_id || !connection.encrypted_client_secret) {
    throw new Error('Zoom credentials not found')
  }

  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
  try {
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)
    
    console.log('Decrypted credentials successfully')
    
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=account_credentials&account_id=' + encodeURIComponent(accountId),
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('Token request failed:', tokenData)
      throw new Error(`Failed to get access token: ${tokenData.error || tokenData.message}`)
    }

    console.log('Successfully obtained access token')
    return tokenData.access_token
    
  } catch (error) {
    console.error('Error getting access token:', error)
    throw error
  }
}

// Rate limiting helper
async function rateLimitedDelay(requestCount: number) {
  // Zoom allows up to 80 requests per second
  // We'll be conservative and do max 40 requests per second
  if (requestCount % 10 === 0) {
    await new Promise(resolve => setTimeout(resolve, 250)) // 250ms delay every 10 requests
  } else {
    await new Promise(resolve => setTimeout(resolve, 25)) // 25ms between each request
  }
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

    const { organization_id, user_id } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting rate-limited comprehensive sync for user:', user_id, 'org:', organization_id)

    // Create master sync job
    const { data: syncJob } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_rate_limited_sync',
        status: 'running',
        progress: 5,
        metadata: { 
          started_at: new Date().toISOString(),
          current_stage: 'webinars',
          stage_message: 'Starting webinar sync...',
          api_requests_made: 0
        }
      })
      .select()
      .single()

    console.log('Created master sync job:', syncJob?.id)

    const progress: SyncProgress = {
      webinars_synced: 0,
      detailed_sync_count: 0,
      api_requests_made: 0,
      current_stage: 'webinars',
      stage_message: 'Starting webinar sync...'
    }

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    progress.api_requests_made++

    // Step 1: Sync webinars with rate limiting
    console.log('Step 1: Rate-limited webinar sync...')
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 10,
        metadata: {
          ...progress,
          stage_message: 'Fetching webinars from Zoom...'
        }
      })
      .eq('id', syncJob?.id)

    // Fetch webinars with pagination and rate limiting
    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching page ${pageCount} of webinars...`)
      
      const params = new URLSearchParams({
        page_size: '30', // Smaller page size for better rate limiting
        type: 'past',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      await rateLimitedDelay(progress.api_requests_made)

      const response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      progress.api_requests_made++

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Zoom API error:', errorData)
        throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
      }

      const data = await response.json()
      const webinars = data.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = data.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
      
      // Update progress
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress: 10 + (pageCount * 5),
          metadata: {
            ...progress,
            stage_message: `Fetched ${allWebinars.length} webinars so far...`,
            webinars_found: allWebinars.length
          }
        })
        .eq('id', syncJob?.id)
      
    } while (nextPageToken && pageCount < 20) // Safety limit

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Process webinars in batches
    const BATCH_SIZE = 5
    let processedCount = 0

    for (let i = 0; i < allWebinars.length; i += BATCH_SIZE) {
      const batch = allWebinars.slice(i, i + BATCH_SIZE)
      
      for (const zoomWebinar of batch) {
        try {
          await rateLimitedDelay(progress.api_requests_made)

          // Get detailed webinar info
          const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinar.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          progress.api_requests_made++

          if (detailResponse.ok) {
            const detailData = await detailResponse.json()
            
            // Check if webinar already exists
            const { data: existingWebinar } = await supabaseClient
              .from('webinars')
              .select('id')
              .eq('zoom_webinar_id', zoomWebinar.id)
              .eq('organization_id', organization_id)
              .maybeSingle()

            if (existingWebinar) {
              // Update existing webinar
              await supabaseClient
                .from('webinars')
                .update({
                  title: zoomWebinar.topic,
                  host_name: detailData.host_email || zoomWebinar.host_email,
                  start_time: zoomWebinar.start_time,
                  duration_minutes: zoomWebinar.duration,
                  registrants_count: detailData.registrants_count || 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingWebinar.id)
            } else {
              // Insert new webinar
              await supabaseClient
                .from('webinars')
                .insert({
                  zoom_webinar_id: zoomWebinar.id,
                  organization_id,
                  user_id,
                  title: zoomWebinar.topic,
                  host_name: detailData.host_email || zoomWebinar.host_email,
                  start_time: zoomWebinar.start_time,
                  duration_minutes: zoomWebinar.duration,
                  registrants_count: detailData.registrants_count || 0,
                  updated_at: new Date().toISOString(),
                })
            }

            processedCount++
            progress.webinars_synced = processedCount
            
            if (processedCount % 5 === 0) {
              console.log(`Processed ${processedCount}/${allWebinars.length} webinars...`)
              
              // Update progress
              const progressPercent = Math.min(95, 30 + Math.round((processedCount / allWebinars.length) * 60))
              await supabaseClient
                .from('sync_jobs')
                .update({ 
                  progress: progressPercent,
                  metadata: {
                    ...progress,
                    stage_message: `Processed ${processedCount}/${allWebinars.length} webinars...`,
                  }
                })
                .eq('id', syncJob?.id)
            }
          }
        } catch (error) {
          console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        }
      }
    }

    // Final update
    progress.current_stage = 'completed'
    progress.stage_message = 'Comprehensive sync completed successfully!'

    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: progress
      })
      .eq('id', syncJob?.id)

    console.log('Rate-limited comprehensive sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary: {
          webinars_synced: progress.webinars_synced,
          api_requests_made: progress.api_requests_made,
          total_found: allWebinars.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Rate-limited comprehensive sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
