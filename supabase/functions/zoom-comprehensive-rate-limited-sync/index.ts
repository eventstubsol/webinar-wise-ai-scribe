
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
  if (requestCount % 10 === 0) {
    await new Promise(resolve => setTimeout(resolve, 250))
  } else {
    await new Promise(resolve => setTimeout(resolve, 25))
  }
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

// Fetch webinar recordings
async function fetchWebinarRecordings(webinarId: string, accessToken: string, progress: SyncProgress): Promise<{ has_recording: boolean, recording_count: number }> {
  try {
    console.log(`Fetching recordings for webinar ${webinarId}`)
    
    const response = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/recordings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++

    if (response.ok) {
      const data = await response.json()
      const recordings = data.recording_files || []
      return {
        has_recording: recordings.length > 0,
        recording_count: recordings.length
      }
    } else if (response.status === 404) {
      // No recordings found - this is normal
      return { has_recording: false, recording_count: 0 }
    } else {
      console.warn(`Failed to fetch recordings for webinar ${webinarId}: ${response.status}`)
      return { has_recording: false, recording_count: 0 }
    }
  } catch (error) {
    console.error(`Error fetching recordings for webinar ${webinarId}:`, error)
    return { has_recording: false, recording_count: 0 }
  }
}

// Fetch webinar registrants count
async function fetchRegistrantsCount(webinarId: string, accessToken: string, progress: SyncProgress): Promise<number> {
  try {
    console.log(`Fetching registrants for webinar ${webinarId}`)
    
    const response = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/registrants?page_size=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++

    if (response.ok) {
      const data = await response.json()
      return data.total_records || 0
    } else {
      console.warn(`Failed to fetch registrants for webinar ${webinarId}: ${response.status}`)
      return 0
    }
  } catch (error) {
    console.error(`Error fetching registrants for webinar ${webinarId}:`, error)
    return 0
  }
}

// Fetch webinar participants count (for past webinars)
async function fetchParticipantsCount(webinarId: string, accessToken: string, progress: SyncProgress): Promise<number> {
  try {
    console.log(`Fetching participants count for webinar ${webinarId}`)
    
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/participants?page_size=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++

    if (response.ok) {
      const data = await response.json()
      return data.total_records || 0
    } else {
      console.warn(`Failed to fetch participants for webinar ${webinarId}: ${response.status}`)
      return 0
    }
  } catch (error) {
    console.error(`Error fetching participants for webinar ${webinarId}:`, error)
    return 0
  }
}

// Comprehensive data processing functions
async function processComprehensiveWebinarData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any) {
  console.log(`Processing comprehensive data for webinar: ${webinarData.topic}`)
  
  try {
    // Process webinar settings
    if (webinarData.settings) {
      const settings = webinarData.settings
      await supabaseClient
        .from('webinar_settings')
        .upsert({
          webinar_id,
          organization_id,
          approval_type: settings.approval_type || 2,
          registration_type: settings.registration_type || 1,
          audio: settings.audio || 'both',
          auto_recording: settings.auto_recording || 'none',
          host_video: settings.host_video !== undefined ? settings.host_video : true,
          panelists_video: settings.panelists_video !== undefined ? settings.panelists_video : true,
          practice_session: settings.practice_session || false,
          hd_video: settings.hd_video || false,
          on_demand: settings.on_demand || false,
          post_webinar_survey: settings.post_webinar_survey || false,
          survey_url: settings.survey_url,
          allow_multiple_devices: settings.allow_multiple_devices !== undefined ? settings.allow_multiple_devices : true,
          alternative_hosts: settings.alternative_hosts,
          contact_name: settings.contact_name,
          contact_email: settings.contact_email,
          email_language: settings.email_language || 'en-US',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'webinar_id'
        })

      // Process authentication settings
      await supabaseClient
        .from('webinar_authentication')
        .upsert({
          webinar_id,
          organization_id,
          meeting_authentication: settings.meeting_authentication || false,
          panelist_authentication: settings.panelist_authentication || false,
          authentication_option: settings.authentication_option,
          authentication_name: settings.authentication_name,
          enforce_login: settings.enforce_login || false,
          enforce_login_domains: settings.enforce_login_domains,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'webinar_id'
        })

      // Process Q&A settings
      if (settings.question_and_answer) {
        const qa = settings.question_and_answer
        await supabaseClient
          .from('webinar_qa_settings')
          .upsert({
            webinar_id,
            organization_id,
            enable: qa.enable || false,
            allow_submit_questions: qa.allow_submit_questions !== undefined ? qa.allow_submit_questions : true,
            allow_anonymous_questions: qa.allow_anonymous_questions !== undefined ? qa.allow_anonymous_questions : true,
            answer_questions: qa.answer_questions || 'all',
            attendees_can_comment: qa.attendees_can_comment !== undefined ? qa.attendees_can_comment : true,
            attendees_can_upvote: qa.attendees_can_upvote !== undefined ? qa.attendees_can_upvote : true,
            allow_auto_reply: qa.allow_auto_reply || false,
            auto_reply_text: qa.auto_reply_text,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'webinar_id'
          })
      }

      // Process notification settings
      const attendeesReminder = settings.attendees_and_panelists_reminder_email_notification || {}
      const followUpAttendees = settings.follow_up_attendees_email_notification || {}
      const followUpAbsentees = settings.follow_up_absentees_email_notification || {}
      
      await supabaseClient
        .from('webinar_notifications')
        .upsert({
          webinar_id,
          organization_id,
          attendees_reminder_enable: attendeesReminder.enable || false,
          attendees_reminder_type: attendeesReminder.type || 0,
          follow_up_attendees_enable: followUpAttendees.enable || false,
          follow_up_attendees_type: followUpAttendees.type || 0,
          follow_up_absentees_enable: followUpAbsentees.enable || false,
          follow_up_absentees_type: followUpAbsentees.type || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'webinar_id'
        })
    }

    // Process recurrence data
    if (webinarData.recurrence) {
      await supabaseClient
        .from('webinar_recurrence')
        .upsert({
          webinar_id,
          organization_id,
          recurrence_type: webinarData.recurrence.type || 1,
          repeat_interval: webinarData.recurrence.repeat_interval || 1,
          weekly_days: webinarData.recurrence.weekly_days,
          monthly_day: webinarData.recurrence.monthly_day,
          end_date_time: webinarData.recurrence.end_date_time,
          end_times: webinarData.recurrence.end_times,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'webinar_id'
        })
    }

    // Process tracking fields
    if (webinarData.tracking_fields && webinarData.tracking_fields.length > 0) {
      // Delete existing tracking fields for this webinar
      await supabaseClient
        .from('webinar_tracking_fields')
        .delete()
        .eq('webinar_id', webinar_id)

      // Insert new tracking fields
      for (const field of webinarData.tracking_fields) {
        await supabaseClient
          .from('webinar_tracking_fields')
          .insert({
            webinar_id,
            organization_id,
            field_name: field.field,
            field_value: field.value
          })
      }
    }

    console.log(`  - Comprehensive data processed successfully`)
    
  } catch (error) {
    console.error(`Error processing comprehensive data:`, error)
  }
}

async function syncWebinarParticipants(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    console.log(`Syncing participants for webinar ${webinarId}`)
    
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
      
      console.log(`  - Synced ${participants.length} participants`)
    }
  } catch (error) {
    console.error(`Error syncing participants for webinar ${webinarId}:`, error)
  }
}

async function syncWebinarPolls(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    console.log(`Syncing polls for webinar ${webinarId}`)
    
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
      
      console.log(`  - Synced ${polls.length} polls`)
    }
  } catch (error) {
    console.error(`Error syncing polls for webinar ${webinarId}:`, error)
  }
}

async function syncWebinarQA(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress) {
  try {
    console.log(`Syncing Q&A for webinar ${webinarId}`)
    
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
      
      console.log(`  - Synced ${questions.length} Q&A sessions`)
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

    console.log('Starting ENHANCED comprehensive sync for user:', user_id, 'org:', organization_id)

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
          stage_message: 'Starting ENHANCED comprehensive sync...',
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
      polls_synced: 0,
      qa_synced: 0,
      registrations_synced: 0,
      api_requests_made: 0,
      current_stage: 'webinars',
      stage_message: 'Starting webinar sync...'
    }

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    progress.api_requests_made++

    // Step 1: Sync BOTH past and upcoming webinars with complete data
    console.log('Step 1: ENHANCED webinar sync with complete data...')
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 10,
        metadata: {
          ...progress,
          stage_message: 'Fetching past and upcoming webinars...'
        }
      })
      .eq('id', syncJob?.id)

    // Fetch past webinars
    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    // First, get past webinars
    do {
      pageCount++
      console.log(`Fetching page ${pageCount} of PAST webinars...`)
      
      const params = new URLSearchParams({
        page_size: '30',
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
      allWebinars = allWebinars.concat(webinars.map(w => ({ ...w, webinar_category: 'past' })))
      nextPageToken = data.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} past webinars`)
      
    } while (nextPageToken && pageCount < 10)

    // Then, get upcoming webinars
    nextPageToken = ''
    pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching page ${pageCount} of UPCOMING webinars...`)
      
      const params = new URLSearchParams({
        page_size: '30',
        type: 'upcoming',
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
        console.error('Zoom API error for upcoming webinars:', errorData)
        // Don't throw error for upcoming webinars as some accounts might not have access
        break
      }

      const data = await response.json()
      const webinars = data.webinars || []
      allWebinars = allWebinars.concat(webinars.map(w => ({ ...w, webinar_category: 'upcoming' })))
      nextPageToken = data.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} upcoming webinars`)
      
    } while (nextPageToken && pageCount < 5)

    console.log(`Total webinars found: ${allWebinars.length} (past + upcoming)`)

    // Process webinars with COMPLETE data collection
    const BATCH_SIZE = 3
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
            
            // Fetch additional data for complete mapping
            console.log(`Fetching complete data for webinar: ${detailData.topic}`)
            
            // Get recordings info
            const recordingInfo = await fetchWebinarRecordings(zoomWebinar.id, accessToken, progress)
            
            // Get registrants count
            const registrantsCount = await fetchRegistrantsCount(zoomWebinar.id, accessToken, progress)
            
            // Get participants count (for past webinars only)
            let attendeesCount = 0
            if (zoomWebinar.webinar_category === 'past') {
              attendeesCount = await fetchParticipantsCount(zoomWebinar.id, accessToken, progress)
            }
            
            // Calculate end_time
            const endTime = calculateEndTime(detailData.start_time, detailData.duration)
            
            // Map webinar type correctly
            const mappedWebinarType = mapWebinarType(detailData.type || 1)
            
            console.log(`Mapping complete data for webinar ${zoomWebinar.id}:`, {
              type: detailData.type,
              mappedType: mappedWebinarType,
              duration: detailData.duration,
              endTime,
              registrantsCount,
              attendeesCount,
              recordings: recordingInfo
            })
            
            // Upsert main webinar data with ALL FIELDS PROPERLY MAPPED
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
                end_time: endTime, // CALCULATED END TIME
                duration_minutes: detailData.duration || zoomWebinar.duration,
                registrants_count: registrantsCount, // ACTUAL REGISTRANTS COUNT
                attendees_count: attendeesCount, // ACTUAL ATTENDEES COUNT  
                join_url: detailData.join_url,
                password: detailData.password,
                timezone: detailData.timezone,
                agenda: detailData.agenda,
                created_at_zoom: detailData.created_at,
                webinar_number: parseInt(detailData.id), // ACTUAL WEBINAR NUMBER
                is_simulive: detailData.is_simulive || false,
                webinar_type: mappedWebinarType, // PROPERLY MAPPED TYPE
                start_url: detailData.start_url, // START URL
                encrypted_passcode: detailData.encrypted_passcode, // ENCRYPTED PASSCODE
                h323_passcode: detailData.h323_passcode, // H323 PASSCODE
                transition_to_live: detailData.transition_to_live || false,
                creation_source: detailData.creation_source, // CREATION SOURCE
                has_recording: recordingInfo.has_recording, // ACTUAL RECORDING STATUS
                recording_count: recordingInfo.recording_count, // ACTUAL RECORDING COUNT
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'zoom_webinar_id',
              })
              .select()
              .single()

            if (!upsertError && webinarRecord) {
              console.log(`Successfully upserted webinar with complete data: ${webinarRecord.title}`)
              
              // Process comprehensive settings data
              await processComprehensiveWebinarData(detailData, webinarRecord.id, organization_id, supabaseClient)
              
              // Sync additional data sources (only for past webinars)
              if (zoomWebinar.webinar_category === 'past') {
                progress.current_stage = 'participants'
                await syncWebinarParticipants(zoomWebinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
                
                await rateLimitedDelay(progress.api_requests_made)
                
                progress.current_stage = 'polls'
                await syncWebinarPolls(zoomWebinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
                
                await rateLimitedDelay(progress.api_requests_made)
                
                progress.current_stage = 'qa'
                await syncWebinarQA(zoomWebinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress)
              }
              
              processedCount++
              progress.webinars_synced = processedCount
              progress.detailed_sync_count = processedCount
              
              if (processedCount % 5 === 0) {
                console.log(`ENHANCED processing: ${processedCount}/${allWebinars.length} webinars with complete data...`)
                
                // Update progress
                const progressPercent = Math.min(95, 30 + Math.round((processedCount / allWebinars.length) * 60))
                progress.current_stage = 'webinars'
                progress.stage_message = `Enhanced processed ${processedCount}/${allWebinars.length} webinars with complete data...`
                
                await supabaseClient
                  .from('sync_jobs')
                  .update({ 
                    progress: progressPercent,
                    metadata: progress
                  })
                  .eq('id', syncJob?.id)
              }
            } else {
              console.error('Failed to upsert webinar:', upsertError)
            }
          } else {
            console.warn(`Failed to get details for webinar ${zoomWebinar.id}: ${detailResponse.status}`)
          }
        } catch (error) {
          console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        }
      }
    }

    // Final update
    progress.current_stage = 'completed'
    progress.stage_message = 'ENHANCED comprehensive sync completed successfully!'

    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: progress
      })
      .eq('id', syncJob?.id)

    console.log('ENHANCED comprehensive sync completed successfully')
    console.log(`Final stats: ${progress.webinars_synced} webinars, ${progress.participants_synced} participants, ${progress.polls_synced} polls, ${progress.qa_synced} Q&A sessions`)

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary: {
          webinars_synced: progress.webinars_synced,
          participants_synced: progress.participants_synced,
          polls_synced: progress.polls_synced,
          qa_synced: progress.qa_synced,
          api_requests_made: progress.api_requests_made,
          total_found: allWebinars.length,
          comprehensive_coverage: `${Math.round((progress.detailed_sync_count / allWebinars.length) * 100)}%`,
          enhancement: 'Complete field mapping with recordings, registrants, and participants data'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('ENHANCED comprehensive sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
