
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
      dailyLimit: 1000,
      lastReset: new Date(),
      requestQueue: [],
      processing: false
    }
  }

  async makeRequest<T>(requestFn: () => Promise<T>, retryCount = 0): Promise<T> {
    const now = new Date()
    if (now.getDate() !== this.limiter.lastReset.getDate()) {
      this.limiter.requestCount = 0
      this.limiter.lastReset = now
    }

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

// Comprehensive data processing function
async function processWebinarComprehensiveData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any, accessToken?: string) {
  console.log(`Processing comprehensive data for webinar: ${webinarData.topic}`)
  
  try {
    // Process recurrence data
    if (webinarData.recurrence) {
      try {
        await supabaseClient
          .from('webinar_recurrence')
          .upsert({
            webinar_id,
            organization_id,
            recurrence_type: webinarData.recurrence.type || 1,
            repeat_interval: webinarData.recurrence.repeat_interval || 1,
            weekly_days: webinarData.recurrence.weekly_days,
            monthly_day: webinarData.recurrence.monthly_day,
            monthly_week: webinarData.recurrence.monthly_week,
            monthly_week_day: webinarData.recurrence.monthly_week_day,
            end_date_time: webinarData.recurrence.end_date_time,
            end_times: webinarData.recurrence.end_times,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'webinar_id'
          })
        console.log(`  - Recurrence data processed`)
      } catch (error) {
        console.error(`  - Error processing recurrence data:`, error)
      }
    }

    // Process settings data
    if (webinarData.settings) {
      try {
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
            hd_video_for_attendees: settings.hd_video_for_attendees || false,
            send_1080p_video_to_attendees: settings.send_1080p_video_to_attendees || false,
            on_demand: settings.on_demand || false,
            post_webinar_survey: settings.post_webinar_survey || false,
            survey_url: settings.survey_url,
            show_share_button: settings.show_share_button !== undefined ? settings.show_share_button : true,
            allow_multiple_devices: settings.allow_multiple_devices !== undefined ? settings.allow_multiple_devices : true,
            alternative_hosts: settings.alternative_hosts,
            alternative_host_update_polls: settings.alternative_host_update_polls || false,
            contact_name: settings.contact_name,
            contact_email: settings.contact_email,
            email_language: settings.email_language || 'en-US',
            registrants_restrict_number: settings.registrants_restrict_number || 0,
            registrants_confirmation_email: settings.registrants_confirmation_email !== undefined ? settings.registrants_confirmation_email : true,
            registrants_email_notification: settings.registrants_email_notification !== undefined ? settings.registrants_email_notification : true,
            notify_registrants: settings.notify_registrants !== undefined ? settings.notify_registrants : true,
            panelists_invitation_email_notification: settings.panelists_invitation_email_notification !== undefined ? settings.panelists_invitation_email_notification : true,
            enable_session_branding: settings.enable_session_branding || false,
            allow_host_control_participant_mute_state: settings.allow_host_control_participant_mute_state || false,
            email_in_attendee_report: settings.email_in_attendee_report !== undefined ? settings.email_in_attendee_report : true,
            add_watermark: settings.add_watermark || false,
            add_audio_watermark: settings.add_audio_watermark || false,
            audio_conference_info: settings.audio_conference_info,
            global_dial_in_countries: settings.global_dial_in_countries,
            close_registration: settings.close_registration || false,
            request_permission_to_unmute: settings.request_permission_to_unmute || false,
            language: settings.language || 'en-US',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'webinar_id'
          })
        console.log(`  - Settings data processed`)

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
            authentication_domains: settings.authentication_domains,
            enforce_login: settings.enforce_login || false,
            enforce_login_domains: settings.enforce_login_domains,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'webinar_id'
          })
        console.log(`  - Authentication data processed`)

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
        console.log(`  - Notifications data processed`)

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
          console.log(`  - Q&A settings processed`)
        }

        // Process language interpreters
        if (settings.language_interpretation?.enable && settings.language_interpretation.interpreters) {
          await supabaseClient
            .from('webinar_interpreters')
            .delete()
            .eq('webinar_id', webinar_id)
            .eq('interpreter_type', 'language')

          for (const interpreter of settings.language_interpretation.interpreters) {
            await supabaseClient
              .from('webinar_interpreters')
              .insert({
                webinar_id,
                organization_id,
                interpreter_type: 'language',
                email: interpreter.email,
                languages: interpreter.interpreter_languages || interpreter.languages
              })
          }
          console.log(`  - Language interpreters processed`)
        }

        // Process sign language interpreters
        if (settings.sign_language_interpretation?.enable && settings.sign_language_interpretation.interpreters) {
          await supabaseClient
            .from('webinar_interpreters')
            .delete()
            .eq('webinar_id', webinar_id)
            .eq('interpreter_type', 'sign_language')

          for (const interpreter of settings.sign_language_interpretation.interpreters) {
            await supabaseClient
              .from('webinar_interpreters')
              .insert({
                webinar_id,
                organization_id,
                interpreter_type: 'sign_language',
                email: interpreter.email,
                sign_language: interpreter.sign_language
              })
          }
          console.log(`  - Sign language interpreters processed`)
        }
      } catch (error) {
        console.error(`  - Error processing settings data:`, error)
      }
    }

    // Process tracking fields
    if (webinarData.tracking_fields && webinarData.tracking_fields.length > 0) {
      try {
        await supabaseClient
          .from('webinar_tracking_fields')
          .delete()
          .eq('webinar_id', webinar_id)

        for (const field of webinarData.tracking_fields) {
          await supabaseClient
            .from('webinar_tracking_fields')
            .insert({
              webinar_id,
              organization_id,
              field_name: field.field,
              field_value: field.value,
              visible: field.visible !== undefined ? field.visible : true
            })
        }
        console.log(`  - Tracking fields processed`)
      } catch (error) {
        console.error(`  - Error processing tracking fields:`, error)
      }
    }

    // Process occurrences
    if (webinarData.occurrences && webinarData.occurrences.length > 0) {
      try {
        await supabaseClient
          .from('webinar_occurrences')
          .delete()
          .eq('webinar_id', webinar_id)

        for (const occurrence of webinarData.occurrences) {
          await supabaseClient
            .from('webinar_occurrences')
            .insert({
              webinar_id,
              organization_id,
              occurrence_id: occurrence.occurrence_id,
              start_time: occurrence.start_time,
              duration: occurrence.duration,
              status: occurrence.status || 'available'
            })
        }
        console.log(`  - Occurrences processed`)
      } catch (error) {
        console.error(`  - Error processing occurrences:`, error)
      }
    }

    // Process panelist data if access token is provided
    if (accessToken) {
      await processPanelistData(webinarData, webinar_id, organization_id, supabaseClient, accessToken)
    }

    console.log(`  - Comprehensive data processed successfully`)
    
  } catch (error) {
    console.error(`Error processing comprehensive data:`, error)
  }
}

// Panelist processing function with proper conflict resolution
async function processPanelistData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any, accessToken: string) {
  console.log(`Processing panelist data for webinar: ${webinarData.topic}`)
  
  try {
    const [panelistsResponse, participationResponse] = await Promise.allSettled([
      fetch(`https://api.zoom.us/v2/webinars/${webinarData.id}/panelists`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(`https://api.zoom.us/v2/past_webinars/${webinarData.id}/panelists`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
    ])

    let panelists = []
    let participationData = []

    if (panelistsResponse.status === 'fulfilled' && panelistsResponse.value.ok) {
      const panelistData = await panelistsResponse.value.json()
      panelists = panelistData.panelists || []
    }

    if (participationResponse.status === 'fulfilled' && participationResponse.value.ok) {
      const participation = await participationResponse.value.json()
      participationData = participation.panelists || []
    }

    if (panelists.length === 0 && participationData.length === 0) {
      console.log(`  - No panelist data found`)
      return
    }

    const participationMap = new Map()
    participationData.forEach(p => {
      participationMap.set(p.email, p)
    })

    // Process each panelist with proper conflict resolution using email
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

        await supabaseClient
          .from('webinar_panelists')
          .upsert({
            webinar_id,
            organization_id,
            zoom_panelist_id: panelist.id,
            email: panelist.email,
            name: panelist.name || participation?.name,
            join_url: panelist.join_url,
            virtual_background_id: panelist.virtual_background_id,
            status,
            invited_at: new Date().toISOString(),
            joined_at: participation?.join_time || null,
            left_at: participation?.leave_time || null,
            duration_minutes: durationMinutes,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,email'
          })

      } catch (error) {
        console.error(`  - Error processing panelist ${panelist.email}:`, error)
      }
    }

    // Process participation data without corresponding panelist records
    for (const participation of participationData) {
      if (!panelists.find(p => p.email === participation.email)) {
        try {
          const durationMinutes = participation.duration ? Math.round(participation.duration / 60) : 0

          await supabaseClient
            .from('webinar_panelists')
            .upsert({
              webinar_id,
              organization_id,
              zoom_panelist_id: participation.id,
              email: participation.email,
              name: participation.name,
              status: participation.join_time ? 'joined' : 'invited',
              joined_at: participation.join_time || null,
              left_at: participation.leave_time || null,
              duration_minutes: durationMinutes,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'webinar_id,email'
            })

        } catch (error) {
          console.error(`  - Error processing participation record ${participation.email}:`, error)
        }
      }
    }

    console.log(`  - Processed ${panelists.length} panelists and ${participationData.length} participation records`)
    
  } catch (error) {
    console.error(`Error processing panelist data:`, error)
  }
}

// Status mapping function
function mapZoomStatusToOurs(webinarData: any): string {
  if (!webinarData.start_time) return 'scheduled'
  
  const now = new Date()
  const startTime = new Date(webinarData.start_time)
  
  if (startTime > now) return 'upcoming'
  
  if (webinarData.end_time) {
    const endTime = new Date(webinarData.end_time)
    if (endTime <= now) return 'completed'
  } else if (webinarData.duration) {
    const estimatedEndTime = new Date(startTime.getTime() + (webinarData.duration * 60000))
    if (estimatedEndTime <= now) return 'completed'
  }
  
  return 'live'
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

    const { organization_id, user_id, config = DEFAULT_CONFIG } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting comprehensive rate-limited sync for user:', user_id)

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
          config 
        }
      })
      .select()
      .single()

    console.log('Created comprehensive sync job:', syncJob?.id)

    // Stage 1: Fetch webinars with rate limiting
    console.log('Stage 1: Fetching webinars...')
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 10, 
        metadata: { 
          ...syncJob?.metadata, 
          current_stage: 'webinars',
          stage_message: 'Fetching webinar list...'
        }
      })
      .eq('id', syncJob?.id)

    // Get webinars with pagination and rate limiting
    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching webinars page ${pageCount}...`)
      
      const webinarsData = await rateLimiter.makeRequest(async () => {
        const params = new URLSearchParams({
          page_size: '50',
          type: 'past',
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
      
      if (nextPageToken && pageCount < 20) {
        await rateLimiter.delay(config.webinarDelay)
      }
      
    } while (nextPageToken && pageCount < 20)

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Stage 2: Process webinar details with comprehensive data
    console.log('Stage 2: Processing webinar details with comprehensive data...')
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 20,
        total_items: allWebinars.length,
        metadata: { 
          ...syncJob?.metadata, 
          current_stage: 'webinar_details',
          stage_message: `Processing ${allWebinars.length} webinars with comprehensive data...`,
          webinars_found: allWebinars.length
        }
      })
      .eq('id', syncJob?.id)

    let processedWebinars = 0
    let comprehensiveDataProcessed = 0

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
            
            // Map status
            const webinarStatus = mapZoomStatusToOurs(detailData)
            
            // Upsert webinar data with all comprehensive fields
            const { data: webinarRecord, error: upsertError } = await supabaseClient
              .from('webinars')
              .upsert({
                zoom_webinar_id: detailData.id?.toString(),
                organization_id,
                user_id,
                title: detailData.topic,
                host_name: detailData.host_email || webinar.host_email,
                host_id: detailData.host_id,
                uuid: detailData.uuid,
                start_time: detailData.start_time || webinar.start_time,
                duration_minutes: detailData.duration || webinar.duration,
                registrants_count: detailData.registrants_count || 0,
                join_url: detailData.join_url,
                password: detailData.password,
                encrypted_passcode: detailData.encrypted_passcode,
                h323_passcode: detailData.h323_passcode,
                start_url: detailData.start_url,
                timezone: detailData.timezone,
                agenda: detailData.agenda,
                created_at_zoom: detailData.created_at,
                webinar_number: detailData.id,
                is_simulive: detailData.is_simulive || false,
                record_file_id: detailData.record_file_id,
                transition_to_live: detailData.transition_to_live || false,
                creation_source: detailData.creation_source,
                webinar_type: detailData.type?.toString() || 'past',
                status: webinarStatus,
                // New comprehensive fields
                registration_url: detailData.registration_url,
                host_email: detailData.host_email,
                pstn_password: detailData.pstn_password,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'zoom_webinar_id',
              })
              .select()
              .single()

            if (!upsertError && webinarRecord) {
              // Process comprehensive data including panelists
              await processWebinarComprehensiveData(detailData, webinarRecord.id, organization_id, supabaseClient, accessToken)
              comprehensiveDataProcessed++
              return { success: true, webinar_id: webinar.id, comprehensive: true }
            } else {
              console.error('Error upserting webinar:', upsertError)
              return { success: false, error: upsertError?.message || 'Upsert failed' }
            }
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
        const progress = 20 + Math.round((processed / total) * 60)
        supabaseClient
          .from('sync_jobs')
          .update({ 
            progress,
            current_item: processed,
            metadata: { 
              ...syncJob?.metadata, 
              current_stage: 'webinar_details',
              stage_message: `Processed ${processed}/${total} webinars with comprehensive data...`,
              comprehensive_data_processed: comprehensiveDataProcessed
            }
          })
          .eq('id', syncJob?.id)
      }
    )

    const successfulWebinars = webinarResults.filter(r => r.success)
    console.log(`Processed ${successfulWebinars.length}/${allWebinars.length} webinars successfully`)
    console.log(`Comprehensive data processed for ${comprehensiveDataProcessed} webinars`)

    // Stage 3: Sync detailed participant/poll/qa data for recent webinars
    const recentWebinars = allWebinars.slice(0, 10)
    
    if (recentWebinars.length > 0) {
      console.log(`Stage 3: Syncing detailed engagement data for ${recentWebinars.length} recent webinars...`)
      
      let detailsProcessed = 0
      const detailsTotal = recentWebinars.length * 5
      
      for (const webinar of recentWebinars) {
        try {
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
          await rateLimiter.delay(config.participantsDelay)

          // Sync chat
          console.log(`  - Syncing chat for ${webinar.topic}...`)
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
          detailsProcessed += 5
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
          comprehensive_data_synced: comprehensiveDataProcessed,
          detailed_sync_count: recentWebinars.length,
          api_requests_made: rateLimiter.limiter.requestCount,
          completed_at: new Date().toISOString(),
          current_stage: 'completed',
          stage_message: 'Comprehensive sync completed successfully with all webinar data!'
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
          comprehensive_data_synced: comprehensiveDataProcessed,
          detailed_sync_count: recentWebinars.length,
          api_requests_made: rateLimiter.limiter.requestCount,
          rate_limit_hits: 0
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
