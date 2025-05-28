
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomWebinar {
  id: string
  topic: string
  host_id: string
  host_email: string
  start_time: string
  duration: number
  join_url: string
  registrants_count?: number
  created_at: string
  status?: string
  type?: number
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
  
  // Get the zoom connection with encrypted credentials
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

  // Create decryption key (same as used in zoom-store-credentials)
  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
  try {
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    
    console.log('Decrypted credentials successfully')
    
    // Get access token using account credentials (server-to-server OAuth)
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=account_credentials&account_id=' + encodeURIComponent(await decryptCredential(connection.encrypted_account_id, encryptionKey)),
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

// Map Zoom webinar status to our enum
function mapZoomStatusToOurs(zoomWebinar: ZoomWebinar): string {
  const now = new Date()
  const startTime = zoomWebinar.start_time ? new Date(zoomWebinar.start_time) : null
  
  // If Zoom provides explicit status, use it
  if (zoomWebinar.status) {
    switch (zoomWebinar.status.toLowerCase()) {
      case 'waiting':
      case 'started':
        return 'live'
      case 'ended':
        return 'completed'
      default:
        break
    }
  }
  
  // Fallback to time-based logic
  if (!startTime) return 'scheduled'
  if (startTime > now) return 'upcoming'
  
  // For past webinars, check if they have duration (indicating they happened)
  if (startTime <= now) {
    return zoomWebinar.duration && zoomWebinar.duration > 0 ? 'completed' : 'scheduled'
  }
  
  return 'scheduled'
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

    console.log('Starting comprehensive webinar sync for user:', user_id, 'org:', organization_id)

    // Get access token using the new token management
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        user_id,
        sync_type: 'webinars_comprehensive',
        status: 'started',
      })
      .select()
      .single()

    console.log('Created sync log:', syncLog?.id)

    // Fetch webinars from Zoom API
    let allWebinars: ZoomWebinar[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching page ${pageCount} of webinars...`)
      
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

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Zoom API error:', data)
        throw new Error(`Zoom API error: ${data.message || data.error}`)
      }

      const webinars = data.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = data.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
      
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } while (nextPageToken && pageCount < 10) // Safety limit

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Process and store webinars with comprehensive data
    let processedCount = 0
    let errorCount = 0
    
    for (const zoomWebinar of allWebinars) {
      try {
        // Get detailed webinar info including comprehensive settings
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Map Zoom status to our status
          const webinarStatus = mapZoomStatusToOurs(detailData)
          
          // Upsert main webinar data with status
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
              duration_minutes: detailData.duration || zoomWebinar.duration,
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
              status: webinarStatus, // Set the mapped status
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })
            .select()
            .single()

          if (!upsertError && webinarRecord) {
            // Process comprehensive settings data with proper error handling
            await processWebinarComprehensiveData(detailData, webinarRecord.id, organization_id, supabaseClient)
            processedCount++
            
            if (processedCount % 10 === 0) {
              console.log(`Processed ${processedCount} webinars with comprehensive data...`)
            }
          } else {
            console.error('Error upserting webinar:', upsertError)
            errorCount++
          }
        } else {
          console.warn(`Failed to get details for webinar ${zoomWebinar.id}`)
          errorCount++
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        errorCount++
      }
    }

    console.log(`Comprehensive webinar sync completed: ${processedCount} processed, ${errorCount} errors`)

    // Update sync log
    const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
    const errorMessage = errorCount > 0 ? `${errorCount} webinars failed to process` : null
    
    await supabaseClient
      .from('sync_logs')
      .update({
        status: syncStatus,
        records_processed: processedCount,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        webinars_synced: processedCount,
        total_found: allWebinars.length,
        errors: errorCount,
        comprehensive_data: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Comprehensive webinar sync error:', error)
    
    // Try to update sync log with error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { user_id } = await req.json().catch(() => ({}))
      
      if (user_id) {
        await supabaseClient
          .from('sync_logs')
          .insert({
            organization_id: 'unknown',
            user_id,
            sync_type: 'webinars',
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function processWebinarComprehensiveData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any) {
  console.log(`Processing comprehensive data for webinar: ${webinarData.topic}`)
  
  try {
    // Process recurrence data with better error handling
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

    // Process settings data with proper null handling
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
          // Delete existing interpreters for this webinar
          await supabaseClient
            .from('webinar_interpreters')
            .delete()
            .eq('webinar_id', webinar_id)
            .eq('interpreter_type', 'language')

          // Insert new interpreters
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
          // Delete existing sign language interpreters for this webinar
          await supabaseClient
            .from('webinar_interpreters')
            .delete()
            .eq('webinar_id', webinar_id)
            .eq('interpreter_type', 'sign_language')

          // Insert new interpreters
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
        console.log(`  - Tracking fields processed`)
      } catch (error) {
        console.error(`  - Error processing tracking fields:`, error)
      }
    }

    // Process occurrences (for recurring webinars)
    if (webinarData.occurrences && webinarData.occurrences.length > 0) {
      try {
        // Delete existing occurrences for this webinar
        await supabaseClient
          .from('webinar_occurrences')
          .delete()
          .eq('webinar_id', webinar_id)

        // Insert new occurrences
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

    console.log(`  - Comprehensive data processed successfully`)
    
  } catch (error) {
    console.error(`Error processing comprehensive data:`, error)
    // Don't throw here - we want to continue processing other webinars
  }
}
