
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple decryption function using built-in Web Crypto API
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
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
  
  // Decode base64 and extract IV and encrypted data
  const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )
  
  return decoder.decode(decrypted)
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

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function processWebinarComprehensiveData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any) {
  console.log(`Processing comprehensive data for webinar: ${webinarData.topic}`)
  
  try {
    // Process recurrence data
    if (webinarData.recurrence) {
      await supabaseClient
        .from('webinar_recurrence')
        .upsert({
          webinar_id,
          organization_id,
          recurrence_type: webinarData.recurrence.type,
          repeat_interval: webinarData.recurrence.repeat_interval,
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
    }

    // Process settings data
    if (webinarData.settings) {
      const settings = webinarData.settings
      await supabaseClient
        .from('webinar_settings')
        .upsert({
          webinar_id,
          organization_id,
          approval_type: settings.approval_type,
          registration_type: settings.registration_type,
          audio: settings.audio,
          auto_recording: settings.auto_recording,
          host_video: settings.host_video,
          panelists_video: settings.panelists_video,
          practice_session: settings.practice_session,
          hd_video: settings.hd_video,
          hd_video_for_attendees: settings.hd_video_for_attendees,
          send_1080p_video_to_attendees: settings.send_1080p_video_to_attendees,
          on_demand: settings.on_demand,
          post_webinar_survey: settings.post_webinar_survey,
          survey_url: settings.survey_url,
          show_share_button: settings.show_share_button,
          allow_multiple_devices: settings.allow_multiple_devices,
          alternative_hosts: settings.alternative_hosts,
          alternative_host_update_polls: settings.alternative_host_update_polls,
          contact_name: settings.contact_name,
          contact_email: settings.contact_email,
          email_language: settings.email_language,
          registrants_restrict_number: settings.registrants_restrict_number,
          registrants_confirmation_email: settings.registrants_confirmation_email,
          registrants_email_notification: settings.registrants_email_notification,
          notify_registrants: settings.notify_registrants,
          panelists_invitation_email_notification: settings.panelists_invitation_email_notification,
          enable_session_branding: settings.enable_session_branding,
          allow_host_control_participant_mute_state: settings.allow_host_control_participant_mute_state,
          email_in_attendee_report: settings.email_in_attendee_report,
          add_watermark: settings.add_watermark,
          add_audio_watermark: settings.add_audio_watermark,
          audio_conference_info: settings.audio_conference_info,
          global_dial_in_countries: settings.global_dial_in_countries,
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
          meeting_authentication: settings.meeting_authentication,
          panelist_authentication: settings.panelist_authentication,
          authentication_option: settings.authentication_option,
          authentication_name: settings.authentication_name,
          authentication_domains: settings.authentication_domains,
          enforce_login: settings.enforce_login,
          enforce_login_domains: settings.enforce_login_domains,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'webinar_id'
        })

      // Process notification settings
      const attendeesReminder = settings.attendees_and_panelists_reminder_email_notification || {}
      const followUpAttendees = settings.follow_up_attendees_email_notification || {}
      const followUpAbsentees = settings.follow_up_absentees_email_notification || {}
      
      await supabaseClient
        .from('webinar_notifications')
        .upsert({
          webinar_id,
          organization_id,
          attendees_reminder_enable: attendeesReminder.enable,
          attendees_reminder_type: attendeesReminder.type,
          follow_up_attendees_enable: followUpAttendees.enable,
          follow_up_attendees_type: followUpAttendees.type,
          follow_up_absentees_enable: followUpAbsentees.enable,
          follow_up_absentees_type: followUpAbsentees.type,
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
            enable: qa.enable,
            allow_submit_questions: qa.allow_submit_questions,
            allow_anonymous_questions: qa.allow_anonymous_questions,
            answer_questions: qa.answer_questions,
            attendees_can_comment: qa.attendees_can_comment,
            attendees_can_upvote: qa.attendees_can_upvote,
            allow_auto_reply: qa.allow_auto_reply,
            auto_reply_text: qa.auto_reply_text,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'webinar_id'
          })
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
      }
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

    // Process occurrences (for recurring webinars)
    if (webinarData.occurrences && webinarData.occurrences.length > 0) {
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
            status: occurrence.status
          })
      }
    }

    console.log(`  - Comprehensive data processed successfully`)
    
  } catch (error) {
    console.error(`Error processing comprehensive data:`, error)
    throw error
  }
}

serve(async (req) => {
  console.log('zoom-sync-all function called with method:', req.method)
  
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

    console.log('Starting comprehensive sync for user:', user_id, 'org:', organization_id)

    // Create master sync job
    const { data: syncJob, error: syncJobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_sync',
        status: 'running',
        metadata: { started_at: new Date().toISOString() }
      })
      .select()
      .single()

    if (syncJobError) {
      console.error('Error creating sync job:', syncJobError)
      throw new Error('Failed to create sync job')
    }

    console.log('Created master sync job:', syncJob?.id)

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Step 1: Sync webinars with comprehensive data
    console.log('Step 1: Syncing webinars with comprehensive data...')
    await supabaseClient
      .from('sync_jobs')
      .update({ progress: 10, current_item: 1 })
      .eq('id', syncJob?.id)

    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    // Fetch webinars with pagination
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

      const response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Zoom API error:', errorData)
        throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
      }

      const webinarsData = await response.json()
      const webinars = webinarsData.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = webinarsData.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
      
      if (nextPageToken && pageCount < 10) {
        await delay(1000)
      }
      
    } while (nextPageToken && pageCount < 10)

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Process webinars in batches with comprehensive data
    const batchSize = 3
    let processedCount = 0

    for (let i = 0; i < allWebinars.length; i += batchSize) {
      const batch = allWebinars.slice(i, i + batchSize)
      
      for (const webinar of batch) {
        try {
          console.log(`Processing webinar: ${webinar.topic}`)
          
          // Get detailed webinar data
          const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinar.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })

          let detailedWebinar = webinar
          if (detailResponse.ok) {
            detailedWebinar = await detailResponse.json()
          }

          // Upsert comprehensive webinar data
          const { data: webinarRecord, error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: detailedWebinar.id?.toString(),
              organization_id,
              user_id,
              title: detailedWebinar.topic,
              host_name: detailedWebinar.host_email,
              host_id: detailedWebinar.host_id,
              uuid: detailedWebinar.uuid,
              start_time: detailedWebinar.start_time,
              duration_minutes: detailedWebinar.duration,
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
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })
            .select()
            .single()

          if (upsertError) {
            console.error('Error upserting webinar:', upsertError)
          } else if (webinarRecord) {
            // Process comprehensive data for this webinar
            await processWebinarComprehensiveData(detailedWebinar, webinarRecord.id, organization_id, supabaseClient)
            processedCount++
          }

          await delay(500) // Rate limiting
          
        } catch (error) {
          console.error(`Error processing webinar ${webinar.topic}:`, error)
        }
      }

      // Update progress
      const progress = 10 + Math.round((i + batch.length) / allWebinars.length * 60)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress,
          current_item: i + batch.length,
          total_items: allWebinars.length
        })
        .eq('id', syncJob?.id)

      if (i + batchSize < allWebinars.length) {
        await delay(2000)
      }
    }

    // Step 2: Sync detailed engagement data for recent webinars
    const recentWebinars = allWebinars.slice(0, 3)
    console.log(`Step 2: Syncing engagement data for ${recentWebinars.length} recent webinars...`)

    let totalRegistrations = 0
    let syncErrors: string[] = []

    for (let i = 0; i < recentWebinars.length; i++) {
      const webinar = recentWebinars[i]
      console.log(`Processing engagement data for webinar ${i + 1}/${recentWebinars.length}: ${webinar.topic}`)

      try {
        // Get webinar record from database
        const { data: webinarRecord } = await supabaseClient
          .from('webinars')
          .select('id')
          .eq('zoom_webinar_id', webinar.id?.toString())
          .single()

        if (!webinarRecord) continue

        const webinar_id = webinarRecord.id

        // Sync registrations
        console.log('  - Syncing registrations...')
        const registrationsResult = await supabaseClient.functions.invoke('zoom-sync-registrations', {
          body: {
            organization_id,
            user_id,
            webinar_id,
            zoom_webinar_id: webinar.id,
          }
        })

        if (registrationsResult.data?.registrations_synced) {
          totalRegistrations += registrationsResult.data.registrations_synced
        }

        await delay(2000)

        // Update progress
        const progress = 70 + Math.round((i + 1) / recentWebinars.length * 25)
        await supabaseClient
          .from('sync_jobs')
          .update({ progress })
          .eq('id', syncJob?.id)

      } catch (error) {
        console.error(`Error syncing engagement data for webinar ${webinar.topic}:`, error)
        syncErrors.push(`${webinar.topic}: ${error.message}`)
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
          webinars_synced: processedCount,
          registrations_synced: totalRegistrations,
          webinars_detailed: recentWebinars.length,
          errors: syncErrors,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', syncJob?.id)

    console.log('Comprehensive sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary: {
          webinars_synced: processedCount,
          registrations_synced: totalRegistrations,
          webinars_detailed: recentWebinars.length,
          errors: syncErrors.length
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
