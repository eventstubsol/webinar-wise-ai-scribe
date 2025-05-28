import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncProgress {
  webinars_synced: number
  detailed_sync_count: number
  participants_synced: number
  panelists_synced: number
  polls_synced: number
  qa_synced: number
  registrations_synced: number
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
  // Aggressive rate limiting to prevent issues
  const delay = requestCount % 5 === 0 ? 1000 : 200
  await new Promise(resolve => setTimeout(resolve, delay))
}

// Map Zoom webinar type to our database enum
function mapWebinarType(zoomType: number): string {
  switch (zoomType) {
    case 1: return 'webinar'
    case 5: return 'recurring_webinar'
    case 6: return 'webinar_pac'
    case 9: return 'recurring_webinar_pac'
    default: return 'webinar'
  }
}

// Calculate end time from start time and duration
function calculateEndTime(startTime: string, durationMinutes: number): string | null {
  if (!startTime || !durationMinutes) return null
  const start = new Date(startTime)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return end.toISOString()
}

// Sync webinar panelists function with fixed constraint handling
async function syncWebinarPanelists(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    console.log(`Syncing panelists for webinar: ${webinarId}`)
    
    // Fetch panelist list
    const panelistsResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/panelists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    progress.api_requests_made++
    
    // Fetch panelist participation data
    await rateLimitedDelay(progress.api_requests_made)
    const participationResponse = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/panelists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    progress.api_requests_made++

    let panelists = []
    let participationData = []

    if (panelistsResponse.ok) {
      const data = await panelistsResponse.json()
      panelists = data.panelists || []
      console.log(`  - Found ${panelists.length} invited panelists`)
    } else {
      console.log(`  - No panelist list found (${panelistsResponse.status})`)
    }

    if (participationResponse.ok) {
      const data = await participationResponse.json()
      participationData = data.panelists || []
      console.log(`  - Found ${participationData.length} panelist participation records`)
    } else {
      console.log(`  - No panelist participation found (${participationResponse.status})`)
    }

    if (panelists.length === 0 && participationData.length === 0) {
      console.log(`  - No panelist data found for webinar ${webinarId}`)
      return
    }

    // Create participation lookup map
    const participationMap = new Map()
    participationData.forEach(p => {
      participationMap.set(p.email, p)
    })

    // Process each invited panelist
    for (const panelist of panelists) {
      try {
        const participation = participationMap.get(panelist.email)
        
        let durationMinutes = 0
        if (participation?.duration) {
          durationMinutes = Math.round(participation.duration / 60)
        }

        let status = 'invited'
        if (participation?.join_time) {
          status = 'joined'
        }

        const panelistRecord = {
          webinar_id,
          organization_id,
          zoom_panelist_id: panelist.id,
          email: panelist.email,
          name: panelist.name || participation?.name || null,
          join_url: panelist.join_url || null,
          virtual_background_id: panelist.virtual_background_id || null,
          status,
          invited_at: new Date().toISOString(),
          joined_at: participation?.join_time || null,
          left_at: participation?.leave_time || null,
          duration_minutes: durationMinutes,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabaseClient
          .from('webinar_panelists')
          .upsert(panelistRecord, {
            onConflict: 'webinar_id,email'
          })

        if (error) {
          console.error(`  - Error upserting panelist ${panelist.email}:`, error)
        } else {
          progress.panelists_synced++
          console.log(`  - Processed panelist: ${panelist.email}`)
        }

      } catch (error) {
        console.error(`  - Error processing panelist ${panelist.email}:`, error)
      }
    }

    // Process any participation data without corresponding panelist records
    for (const participation of participationData) {
      if (!panelists.find(p => p.email === participation.email)) {
        try {
          const durationMinutes = participation.duration ? Math.round(participation.duration / 60) : 0

          const participantRecord = {
            webinar_id,
            organization_id,
            zoom_panelist_id: participation.id || `participant_${participation.email}`,
            email: participation.email,
            name: participation.name || null,
            status: participation.join_time ? 'joined' : 'invited',
            joined_at: participation.join_time || null,
            left_at: participation.leave_time || null,
            duration_minutes: durationMinutes,
            updated_at: new Date().toISOString(),
          }

          const { error } = await supabaseClient
            .from('webinar_panelists')
            .upsert(participantRecord, {
              onConflict: 'webinar_id,email'
            })

          if (error) {
            console.error(`  - Error upserting participation record ${participation.email}:`, error)
          } else {
            progress.panelists_synced++
            console.log(`  - Processed participation record: ${participation.email}`)
          }

        } catch (error) {
          console.error(`  - Error processing participation record ${participation.email}:`, error)
        }
      }
    }

    console.log(`  - Successfully processed ${progress.panelists_synced} panelist records`)
    
  } catch (error) {
    console.error(`Error syncing panelists for webinar ${webinarId}:`, error)
  }
}

// Background processing function for detailed sync
async function processDetailedSync(
  webinars: any[], 
  organization_id: string, 
  user_id: string, 
  syncJobId: string,
  supabaseClient: any
) {
  console.log(`Starting background detailed sync for ${webinars.length} webinars`)
  
  try {
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    const progress: SyncProgress = {
      webinars_synced: 0,
      detailed_sync_count: 0,
      participants_synced: 0,
      panelists_synced: 0,
      polls_synced: 0,
      qa_synced: 0,
      registrations_synced: 0,
      api_requests_made: 0,
      current_stage: 'detailed_processing',
      stage_message: 'Processing detailed webinar data...'
    }

    // Process webinars in small batches to avoid overwhelming the API
    const BATCH_SIZE = 2
    const pastWebinars = webinars.filter(w => w.webinar_category === 'past').slice(0, 10) // Limit to 10 most recent
    
    for (let i = 0; i < pastWebinars.length; i += BATCH_SIZE) {
      const batch = pastWebinars.slice(i, i + BATCH_SIZE)
      
      for (const webinar of batch) {
        try {
          console.log(`Processing detailed data for: ${webinar.topic}`)
          
          // Update progress
          progress.current_stage = 'participants'
          progress.stage_message = `Processing participants for: ${webinar.topic}`
          
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              progress: 60 + Math.round((i / pastWebinars.length) * 35),
              metadata: progress
            })
            .eq('id', syncJobId)

          // Get webinar record
          const { data: webinarRecord } = await supabaseClient
            .from('webinars')
            .select('id')
            .eq('zoom_webinar_id', webinar.id)
            .single()

          if (!webinarRecord) {
            console.log(`  - Webinar record not found for ${webinar.id}`)
            continue
          }

          // Sync participants
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarParticipants(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
          
          // Sync panelists
          progress.current_stage = 'panelists'
          progress.stage_message = `Processing panelists for: ${webinar.topic}`
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarPanelists(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
          
          // Sync polls
          progress.current_stage = 'polls'
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarPolls(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
          
          // Sync Q&A
          progress.current_stage = 'qa'
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarQA(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
          
          progress.detailed_sync_count++
          
        } catch (error) {
          console.error(`Error in detailed processing for webinar ${webinar.id}:`, error)
        }
      }
      
      // Longer delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Final update
    progress.current_stage = 'completed'
    progress.stage_message = `Background sync completed successfully! Processed ${progress.panelists_synced} panelists.`
    
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: progress
      })
      .eq('id', syncJobId)

    console.log(`Background detailed sync completed successfully. Final stats:`)
    console.log(`  - Participants: ${progress.participants_synced}`)
    console.log(`  - Panelists: ${progress.panelists_synced}`)
    console.log(`  - Polls: ${progress.polls_synced}`)
    console.log(`  - Q&A: ${progress.qa_synced}`)
    
  } catch (error) {
    console.error('Background detailed sync error:', error)
    
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncJobId)
  }
}

async function syncWebinarParticipants(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/participants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++

    if (response.ok) {
      const data = await response.json()
      const participants = data.participants || []
      
      for (const participant of participants) {
        try {
          await supabaseClient
            .from('attendees')
            .upsert({
              webinar_id,
              organization_id,
              name: participant.name || 'Unknown',
              email: participant.email || '',
              zoom_user_id: participant.user_id,
              join_time: participant.join_time,
              leave_time: participant.leave_time,
              duration_minutes: participant.duration || 0,
              engagement_score: calculateEngagementScore(participant),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'webinar_id,email'
            })
          
          progress.participants_synced++
        } catch (error) {
          console.error(`Error inserting participant:`, error)
        }
      }
    }
  } catch (error) {
    console.error(`Error syncing participants for webinar ${webinarId}:`, error)
  }
}

async function syncWebinarPolls(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/polls`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++

    if (response.ok) {
      const data = await response.json()
      const polls = data.polls || []
      
      for (const poll of polls) {
        try {
          await supabaseClient
            .from('zoom_polls')
            .upsert({
              webinar_id,
              organization_id,
              zoom_poll_id: poll.id,
              title: poll.title || 'Untitled Poll',
              question: poll.question || '',
              options: poll.questions?.[0]?.answers || [],
              results: poll.results || {},
              total_responses: poll.total_responses || 0,
              poll_type: poll.type || 'single',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'webinar_id,zoom_poll_id'
            })
          
          progress.polls_synced++
        } catch (error) {
          console.error(`Error inserting poll:`, error)
        }
      }
    }
  } catch (error) {
    console.error(`Error syncing polls for webinar ${webinarId}:`, error)
  }
}

async function syncWebinarQA(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/qa`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++

    if (response.ok) {
      const data = await response.json()
      const questions = data.questions || []
      
      for (const qa of questions) {
        try {
          await supabaseClient
            .from('zoom_qa_sessions')
            .upsert({
              webinar_id,
              organization_id,
              zoom_qa_id: qa.id,
              question: qa.question || '',
              answer: qa.answer || null,
              asker_name: qa.name || 'Anonymous',
              asker_email: qa.email || null,
              answered_by: qa.answered_by || null,
              timestamp: qa.date_time || new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'webinar_id,zoom_qa_id'
            })
          
          progress.qa_synced++
        } catch (error) {
          console.error(`Error inserting Q&A:`, error)
        }
      }
    }
  } catch (error) {
    console.error(`Error syncing Q&A for webinar ${webinarId}:`, error)
  }
}

function calculateEngagementScore(participant: any): number {
  let score = 0
  
  // Base score for attending
  score += 10
  
  // Duration bonus (up to 40 points)
  if (participant.duration) {
    score += Math.min(40, Math.round(participant.duration / 60 * 40))
  }
  
  return Math.min(100, score)
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

    console.log('Starting FAST comprehensive sync for user:', user_id, 'org:', organization_id)

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
          stage_message: 'Starting FAST comprehensive sync...',
          api_requests_made: 0
        }
      })
      .select()
      .single()

    console.log('Created master sync job:', syncJob?.id)

    const progress: SyncProgress = {
      webinars_synced: 0,
      detailed_sync_count: 0,
      participants_synced: 0,
      panelists_synced: 0,
      polls_synced: 0,
      qa_synced: 0,
      registrations_synced: 0,
      api_requests_made: 0,
      current_stage: 'webinars',
      stage_message: 'Fetching webinar data...'
    }

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    progress.api_requests_made++

    // PHASE 1: Quick webinar sync (return response after this)
    console.log('PHASE 1: Quick webinar discovery...')
    
    // Fetch past webinars (limited to prevent timeout)
    let allWebinars: any[] = []
    const params = new URLSearchParams({
      page_size: '30',
      type: 'past',
    })

    const response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    progress.api_requests_made++

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
    }

    const data = await response.json()
    const webinars = data.webinars || []
    allWebinars = allWebinars.concat(webinars.map(w => ({ ...w, webinar_category: 'past' })))

    console.log(`Found ${allWebinars.length} webinars for basic sync`)

    // Process basic webinar data quickly (first 20 to prevent timeout)
    const webinarsToProcess = allWebinars.slice(0, 20)
    
    for (const zoomWebinar of webinarsToProcess) {
      try {
        await rateLimitedDelay(progress.api_requests_made)

        // Get basic webinar details
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        progress.api_requests_made++

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Calculate end_time
          const endTime = calculateEndTime(detailData.start_time, detailData.duration)
          
          // Map webinar type correctly
          const mappedWebinarType = mapWebinarType(detailData.type || 1)
          
          // Upsert basic webinar data
          const { data: webinarRecord, error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: detailData.id?.toString(),
              organization_id,
              user_id,
              title: detailData.topic,
              host_name: detailData.host_email || zoomWebinar.host_email,
              host_id: detailData.host_id,
              uuid: detailData.uuid,
              start_time: detailData.start_time || zoomWebinar.start_time,
              end_time: endTime,
              duration_minutes: detailData.duration || zoomWebinar.duration,
              registrants_count: 0, // Will be updated in background
              attendees_count: 0, // Will be updated in background
              join_url: detailData.join_url,
              password: detailData.password,
              timezone: detailData.timezone,
              agenda: detailData.agenda,
              created_at_zoom: detailData.created_at,
              webinar_number: parseInt(detailData.id),
              is_simulive: detailData.is_simulive || false,
              webinar_type: mappedWebinarType,
              start_url: detailData.start_url,
              encrypted_passcode: detailData.encrypted_passcode,
              h323_passcode: detailData.h323_passcode,
              transition_to_live: detailData.transition_to_live || false,
              creation_source: detailData.creation_source,
              has_recording: false, // Will be updated in background
              recording_count: 0, // Will be updated in background
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })
            .select()
            .single()

          if (!upsertError && webinarRecord) {
            progress.webinars_synced++
            console.log(`Quick sync: ${webinarRecord.title}`)
          }
        }
      } catch (error) {
        console.error(`Error in quick sync for webinar ${zoomWebinar.id}:`, error)
      }
    }

    // Update progress to 60% (basic sync complete)
    progress.current_stage = 'basic_complete'
    progress.stage_message = `Basic sync complete: ${progress.webinars_synced} webinars synced`
    
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 60,
        metadata: progress
      })
      .eq('id', syncJob?.id)

    // PHASE 2: Start background processing for detailed data
    console.log('Starting background detailed processing...')
    
    // Use EdgeRuntime.waitUntil to process detailed data in background
    const backgroundTask = processDetailedSync(allWebinars, organization_id, user_id, syncJob?.id, supabaseClient)
    
    // Use waitUntil to ensure the background task continues even after we return the response
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask)
    } else {
      // Fallback: start background task without awaiting
      backgroundTask.catch(error => console.error('Background task error:', error))
    }

    // Return immediate success response (prevents timeout)
    console.log('Returning immediate success response')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        message: 'Basic sync completed, detailed processing in background',
        summary: {
          webinars_synced: progress.webinars_synced,
          webinars_found: allWebinars.length,
          basic_sync_complete: true,
          detailed_processing: 'in_background',
          api_requests_made: progress.api_requests_made
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
