import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncProgress {
  stage: string
  message: string
  progress: number
  apiRequestsUsed?: number
  details?: {
    webinars_found?: number
    webinars_synced?: number
    detailed_sync_count?: number
    participants_synced?: number
    panelists_synced?: number
    polls_synced?: number
    qa_synced?: number
    registrations_synced?: number
    chat_synced?: number
    comprehensive_coverage?: string
  }
}

interface DetailedMetrics {
  participants: { success: number, failed: number, skipped: number }
  panelists: { success: number, failed: number, skipped: number }
  polls: { success: number, failed: number, skipped: number }
  qa: { success: number, failed: number, skipped: number }
  registrations: { success: number, failed: number, skipped: number }
  chat: { success: number, failed: number, skipped: number }
}

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

async function processParticipants(
  webinarId: string,
  webinar_id: string,
  organization_id: string,
  accessToken: string,
  supabaseClient: any,
  metrics: DetailedMetrics
): Promise<void> {
  console.log(`  - Processing participants for webinar ${webinarId}...`)
  
  try {
    let allParticipants: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`    Fetching participants page ${pageCount}...`)
      
      const params = new URLSearchParams({
        page_size: '300',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/metrics/webinars/${webinarId}/participants?${params}`, {
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
      const participants = data.participants || []
      allParticipants = allParticipants.concat(participants)
      nextPageToken = data.next_page_token || ''
      
      console.log(`    Page ${pageCount}: Found ${participants.length} participants`)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } while (nextPageToken && pageCount < 10)

    console.log(`    Total participants found: ${allParticipants.length}`)

    const participantMap = new Map<string, any>()
    
    for (const participant of allParticipants) {
      const email = participant.user_email?.toLowerCase() || `unknown_${participant.id}`
      const existing = participantMap.get(email)
      
      if (!existing || new Date(participant.join_time) < new Date(existing.join_time)) {
        participantMap.set(email, {
          ...participant,
          duration: existing ? existing.duration + participant.duration : participant.duration
        })
      } else if (existing) {
        existing.duration += participant.duration
      }
    }

    const deduplicatedParticipants = Array.from(participantMap.values())
    console.log(`    After deduplication: ${deduplicatedParticipants.length} unique participants`)

    for (const participant of deduplicatedParticipants) {
      try {
        const maxDuration = Math.max(...deduplicatedParticipants.map(p => p.duration))
        const engagementScore = maxDuration > 0 ? Math.min(10, (participant.duration / maxDuration) * 10) : 0

        const cleanEmail = participant.user_email?.toLowerCase().trim() || ''
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        
        const isLikelyBot = 
          participant.name?.toLowerCase().includes('bot') ||
          participant.name?.toLowerCase().includes('test') ||
          participant.duration < 30

        if (isValidEmail && !isLikelyBot) {
          const { error: upsertError } = await supabaseClient
            .from('attendees')
            .upsert({
              webinar_id,
              organization_id,
              zoom_user_id: participant.user_id,
              name: participant.name,
              email: cleanEmail,
              join_time: participant.join_time,
              leave_time: participant.leave_time,
              duration_minutes: Math.round(participant.duration / 60),
              engagement_score: Math.round(engagementScore * 10) / 10,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'webinar_id,email',
            })

          if (!upsertError) {
            metrics.participants.success++
          } else {
            console.error('Error upserting participant:', upsertError)
            metrics.participants.failed++
          }
        } else {
          metrics.participants.skipped++
        }
      } catch (error) {
        console.error(`Error processing participant:`, error)
        metrics.participants.failed++
      }
    }

    await supabaseClient
      .from('webinars')
      .update({ attendees_count: metrics.participants.success })
      .eq('id', webinar_id)

    console.log(`    Participants processed: ${metrics.participants.success} success, ${metrics.participants.failed} failed, ${metrics.participants.skipped} skipped`)
    
  } catch (error) {
    console.error(`Error processing participants for webinar ${webinarId}:`, error)
    throw error
  }
}

async function processChat(
  webinarId: string,
  webinar_id: string,
  organization_id: string,
  accessToken: string,
  supabaseClient: any,
  metrics: DetailedMetrics
): Promise<void> {
  console.log(`  - Processing chat for webinar ${webinarId}...`)
  
  try {
    let allMessages: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`    Fetching chat page ${pageCount}...`)
      
      const params = new URLSearchParams({
        page_size: '300',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/metrics/webinars/${webinarId}/participants/chatmessages?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.log(`    Chat API returned ${response.status}, skipping chat for this webinar`)
        return
      }

      const data = await response.json()
      const messages = data.chat_messages || []
      allMessages = allMessages.concat(messages)
      nextPageToken = data.next_page_token || ''
      
      console.log(`    Page ${pageCount}: Found ${messages.length} chat messages`)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } while (nextPageToken && pageCount < 10)

    console.log(`    Total chat messages found: ${allMessages.length}`)

    for (const message of allMessages) {
      try {
        const { error: upsertError } = await supabaseClient
          .from('zoom_chat_messages')
          .upsert({
            webinar_id,
            organization_id,
            sender_name: message.sender,
            message: message.content,
            timestamp: message.timestamp,
            message_type: 'chat',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,sender_name,timestamp',
          })

        if (!upsertError) {
          metrics.chat.success++
        } else {
          console.error('Error upserting chat message:', upsertError)
          metrics.chat.failed++
        }
      } catch (error) {
        console.error(`Error processing chat message:`, error)
        metrics.chat.failed++
      }
    }

    console.log(`    Chat processed: ${metrics.chat.success} success, ${metrics.chat.failed} failed`)
    
  } catch (error) {
    console.error(`Error processing chat for webinar ${webinarId}:`, error)
  }
}

async function processPolls(
  webinarId: string,
  webinar_id: string,
  organization_id: string,
  accessToken: string,
  supabaseClient: any,
  metrics: DetailedMetrics
): Promise<void> {
  console.log(`  - Processing polls for webinar ${webinarId}...`)
  
  try {
    const pollsResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/polls`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    let allPolls: any[] = []
    let pollResults: any[] = []

    if (pollsResponse.ok) {
      const pollsData = await pollsResponse.json()
      allPolls = pollsData.polls || []
      
      for (const poll of allPolls) {
        try {
          const resultsResponse = await fetch(`https://api.zoom.us/v2/metrics/webinars/${webinarId}/polls/${poll.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (resultsResponse.ok) {
            const resultData = await resultsResponse.json()
            pollResults.push(resultData)
          }
          
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Error fetching results for poll ${poll.id}:`, error)
        }
      }
    } else {
      console.log(`    Polls API returned ${pollsResponse.status}, skipping polls for this webinar`)
      return
    }

    console.log(`    Found ${allPolls.length} polls with ${pollResults.length} result sets`)

    for (const poll of allPolls) {
      try {
        const results = pollResults.find(r => r.poll_id === poll.id)
        
        const { error: upsertError } = await supabaseClient
          .from('zoom_polls')
          .upsert({
            webinar_id,
            organization_id,
            zoom_poll_id: poll.id,
            title: poll.title,
            poll_type: poll.poll_type,
            question: poll.questions?.[0]?.name || poll.title,
            options: poll.questions?.[0]?.answers || [],
            results: results?.question_details || [],
            total_responses: results?.question_details?.[0]?.answers?.reduce((sum: number, ans: any) => sum + ans.count, 0) || 0,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,zoom_poll_id',
          })

        if (!upsertError) {
          metrics.polls.success++
        } else {
          console.error('Error upserting poll:', upsertError)
          metrics.polls.failed++
        }
      } catch (error) {
        console.error(`Error processing poll ${poll.id}:`, error)
        metrics.polls.failed++
      }
    }

    console.log(`    Polls processed: ${metrics.polls.success} success, ${metrics.polls.failed} failed`)
    
  } catch (error) {
    console.error(`Error processing polls for webinar ${webinarId}:`, error)
  }
}

async function processQA(
  webinarId: string,
  webinar_id: string,
  organization_id: string,
  accessToken: string,
  supabaseClient: any,
  metrics: DetailedMetrics
): Promise<void> {
  console.log(`  - Processing Q&A for webinar ${webinarId}...`)
  
  try {
    let allQAs: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`    Fetching Q&A page ${pageCount}...`)
      
      const params = new URLSearchParams({
        page_size: '300',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/metrics/webinars/${webinarId}/qas?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.log(`    Q&A API returned ${response.status}, skipping Q&A for this webinar`)
        return
      }

      const data = await response.json()
      const qas = data.questions || []
      allQAs = allQAs.concat(qas)
      nextPageToken = data.next_page_token || ''
      
      console.log(`    Page ${pageCount}: Found ${qas.length} Q&A items`)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } while (nextPageToken && pageCount < 10)

    console.log(`    Total Q&A items found: ${allQAs.length}`)

    for (const qa of allQAs) {
      try {
        const firstAnswer = qa.answer_details?.[0]
        
        const { error: upsertError } = await supabaseClient
          .from('zoom_qa_sessions')
          .upsert({
            webinar_id,
            organization_id,
            question: qa.question,
            answer: firstAnswer?.answer || qa.answer || '',
            asker_name: qa.asker_name,
            asker_email: qa.asker_email,
            answered_by: firstAnswer?.answerer_name || '',
            timestamp: firstAnswer?.answer_timestamp || new Date().toISOString(),
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,question,asker_name',
          })

        if (!upsertError) {
          metrics.qa.success++
        } else {
          console.error('Error upserting Q&A:', upsertError)
          metrics.qa.failed++
        }
      } catch (error) {
        console.error(`Error processing Q&A:`, error)
        metrics.qa.failed++
      }
    }

    console.log(`    Q&A processed: ${metrics.qa.success} success, ${metrics.qa.failed} failed`)
    
  } catch (error) {
    console.error(`Error processing Q&A for webinar ${webinarId}:`, error)
  }
}

async function processRegistrations(
  webinarId: string,
  webinar_id: string,
  organization_id: string,
  accessToken: string,
  supabaseClient: any,
  metrics: DetailedMetrics
): Promise<void> {
  console.log(`  - Processing registrations for webinar ${webinarId}...`)
  
  try {
    let allRegistrants: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`    Fetching registrations page ${pageCount}...`)
      
      const params = new URLSearchParams({
        page_size: '300',
        status: 'approved',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/registrants?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.log(`    Registrations API returned ${response.status}, skipping registrations for this webinar`)
        return
      }

      const data = await response.json()
      const registrants = data.registrants || []
      allRegistrants = allRegistrants.concat(registrants)
      nextPageToken = data.next_page_token || ''
      
      console.log(`    Page ${pageCount}: Found ${registrants.length} registrations`)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } while (nextPageToken && pageCount < 10)

    console.log(`    Total registrations found: ${allRegistrants.length}`)

    for (const registrant of allRegistrants) {
      try {
        const customQuestions = registrant.custom_questions ? 
          Object.fromEntries(registrant.custom_questions.map((q: any) => [q.title, q.value])) : {}
        
        const { error: upsertError } = await supabaseClient
          .from('zoom_registrations')
          .upsert({
            webinar_id,
            organization_id,
            zoom_registrant_id: registrant.id,
            email: registrant.email.toLowerCase(),
            first_name: registrant.first_name,
            last_name: registrant.last_name,
            status: registrant.status,
            registration_time: registrant.create_time,
            join_url: registrant.join_url,
            custom_questions: customQuestions,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,email',
          })

        if (!upsertError) {
          metrics.registrations.success++
        } else {
          console.error('Error upserting registration:', upsertError)
          metrics.registrations.failed++
        }
      } catch (error) {
        console.error(`Error processing registration for ${registrant.email}:`, error)
        metrics.registrations.failed++
      }
    }

    console.log(`    Registrations processed: ${metrics.registrations.success} success, ${metrics.registrations.failed} failed`)
    
  } catch (error) {
    console.error(`Error processing registrations for webinar ${webinarId}:`, error)
  }
}

async function processWebinarComprehensiveData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any): Promise<void> {
  console.log(`Processing comprehensive data for webinar: ${webinarData.topic}`)
  
  try {
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
          close_registration: settings.close_registration,
          request_permission_to_unmute: settings.request_permission_to_unmute,
          language: settings.language,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'webinar_id'
        })

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
      }

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
      }
    }

    if (webinarData.tracking_fields && webinarData.tracking_fields.length > 0) {
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
    }

    if (webinarData.occurrences && webinarData.occurrences.length > 0) {
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

async function processDetailedSync(
  webinarsForDetailedSync: any[],
  organization_id: string,
  user_id: string,
  accessToken: string,
  supabaseClient: any,
  progress: SyncProgress,
  syncJobId: string
): Promise<DetailedMetrics> {
  const metrics: DetailedMetrics = {
    participants: { success: 0, failed: 0, skipped: 0 },
    panelists: { success: 0, failed: 0, skipped: 0 },
    polls: { success: 0, failed: 0, skipped: 0 },
    qa: { success: 0, failed: 0, skipped: 0 },
    registrations: { success: 0, failed: 0, skipped: 0 },
    chat: { success: 0, failed: 0, skipped: 0 }
  }

  console.log(`\nStarting detailed sync for ${webinarsForDetailedSync.length} webinars...`)

  for (let i = 0; i < webinarsForDetailedSync.length; i++) {
    const webinar = webinarsForDetailedSync[i]
    console.log(`\nProcessing detailed data for webinar ${i + 1}/${webinarsForDetailedSync.length}: ${webinar.title}`)

    try {
      const { data: webinarRecord } = await supabaseClient
        .from('webinars')
        .select('id')
        .eq('zoom_webinar_id', webinar.zoom_webinar_id)
        .single()

      if (!webinarRecord) {
        console.log(`  Webinar record not found in database, skipping...`)
        continue
      }

      const webinar_id = webinarRecord.id

      await processParticipants(webinar.zoom_webinar_id, webinar_id, organization_id, accessToken, supabaseClient, metrics)
      await new Promise(resolve => setTimeout(resolve, 1000))

      await processChat(webinar.zoom_webinar_id, webinar_id, organization_id, accessToken, supabaseClient, metrics)
      await new Promise(resolve => setTimeout(resolve, 1000))

      await processPolls(webinar.zoom_webinar_id, webinar_id, organization_id, accessToken, supabaseClient, metrics)
      await new Promise(resolve => setTimeout(resolve, 1000))

      await processQA(webinar.zoom_webinar_id, webinar_id, organization_id, accessToken, supabaseClient, metrics)
      await new Promise(resolve => setTimeout(resolve, 1000))

      await processRegistrations(webinar.zoom_webinar_id, webinar_id, organization_id, accessToken, supabaseClient, metrics)
      await new Promise(resolve => setTimeout(resolve, 1000))

      const detailedProgress = 60 + Math.round(((i + 1) / webinarsForDetailedSync.length) * 35)
      progress.progress = detailedProgress
      progress.message = `Processing detailed data: ${i + 1}/${webinarsForDetailedSync.length} webinars`
      progress.details = {
        ...progress.details,
        detailed_sync_count: i + 1,
        participants_synced: metrics.participants.success,
        polls_synced: metrics.polls.success,
        qa_synced: metrics.qa.success,
        registrations_synced: metrics.registrations.success,
        chat_synced: metrics.chat.success
      }

      await supabaseClient
        .from('sync_jobs')
        .update({
          progress: detailedProgress,
          metadata: {
            ...progress,
            stage_message: progress.message,
            current_stage: 'background_processing',
            api_requests_made: progress.apiRequestsUsed || 0
          }
        })
        .eq('id', syncJobId)

    } catch (error) {
      console.error(`Error processing detailed data for webinar ${webinar.title}:`, error)
      metrics.participants.failed++
    }
  }

  console.log('\nDetailed sync completed!')
  console.log('Final metrics:', metrics)

  return metrics
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

    console.log('Starting comprehensive rate-limited sync for user:', user_id, 'org:', organization_id)

    const { data: syncJob, error: syncJobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_rate_limited_sync',
        status: 'running',
        metadata: { started_at: new Date().toISOString() }
      })
      .select()
      .single()

    if (syncJobError) {
      console.error('Error creating sync job:', syncJobError)
      throw new Error('Failed to create sync job')
    }

    console.log('Created sync job:', syncJob?.id)

    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    const progress: SyncProgress = {
      stage: 'webinars',
      message: 'Starting comprehensive sync...',
      progress: 5,
      apiRequestsUsed: 0,
      details: {
        webinars_found: 0,
        webinars_synced: 0,
        detailed_sync_count: 0,
        participants_synced: 0,
        panelists_synced: 0,
        polls_synced: 0,
        qa_synced: 0,
        registrations_synced: 0,
        chat_synced: 0
      }
    }

    console.log('\n=== PHASE 1: Fast Basic Sync ===')
    progress.message = 'Fetching webinar list...'
    progress.progress = 10

    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    let apiRequestCount = 0
    
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
      apiRequestCount++

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
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
    } while (nextPageToken && pageCount < 10)

    progress.details!.webinars_found = allWebinars.length
    progress.apiRequestsUsed = apiRequestCount

    console.log(`Total webinars found: ${allWebinars.length}`)

    progress.message = 'Processing webinar data...'
    progress.progress = 20

    let processedCount = 0
    const batchSize = 5

    for (let i = 0; i < allWebinars.length; i += batchSize) {
      const batch = allWebinars.slice(i, i + batchSize)
      
      for (const webinar of batch) {
        try {
          console.log(`Processing webinar: ${webinar.topic}`)
          
          const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinar.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })
          apiRequestCount++

          let detailedWebinar = webinar
          if (detailResponse.ok) {
            detailedWebinar = await detailResponse.json()
          }

          const webinarStatus = (() => {
            if (!detailedWebinar.start_time) return 'scheduled'
            const startTime = new Date(detailedWebinar.start_time)
            const now = new Date()
            
            if (startTime > now) return 'upcoming'
            
            const endTime = detailedWebinar.duration 
              ? new Date(startTime.getTime() + detailedWebinar.duration * 60000)
              : null
            
            if (endTime && endTime <= now) return 'completed'
            if (startTime <= now) return 'live'
            
            return 'scheduled'
          })()

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
              status: webinarStatus,
              registration_url: detailedWebinar.registration_url,
              host_email: detailedWebinar.host_email,
              pstn_password: detailedWebinar.pstn_password,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })
            .select()
            .single()

          if (upsertError) {
            console.error('Error upserting webinar:', upsertError)
          } else if (webinarRecord) {
            await processWebinarComprehensiveData(detailedWebinar, webinarRecord.id, organization_id, supabaseClient)
            processedCount++
          }

          await new Promise(resolve => setTimeout(resolve, 500))
          
        } catch (error) {
          console.error(`Error processing webinar ${webinar.topic}:`, error)
        }
      }

      const currentProgress = 20 + Math.round((i + batch.length) / allWebinars.length * 40)
      progress.progress = currentProgress
      progress.details!.webinars_synced = processedCount
      progress.apiRequestsUsed = apiRequestCount

      await supabaseClient
        .from('sync_jobs')
        .update({
          progress: currentProgress,
          metadata: {
            ...progress,
            stage_message: `Processing webinars: ${i + batch.length}/${allWebinars.length}`,
            current_stage: 'webinars',
            api_requests_made: apiRequestCount
          }
        })
        .eq('id', syncJob?.id)

      if (i + batchSize < allWebinars.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`Basic sync completed: ${processedCount} webinars processed`)

    const summary = {
      webinars_found: allWebinars.length,
      webinars_synced: processedCount,
      api_requests_made: apiRequestCount
    }

    EdgeRuntime.waitUntil((async () => {
      try {
        console.log('\n=== PHASE 2: Background Detailed Sync ===')
        
        const webinarsForDetailedSync = allWebinars
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          .slice(0, 5)

        console.log(`Selected ${webinarsForDetailedSync.length} recent webinars for detailed sync`)

        const detailedMetrics = await processDetailedSync(
          webinarsForDetailedSync,
          organization_id,
          user_id,
          accessToken,
          supabaseClient,
          progress,
          syncJob?.id
        )

        await supabaseClient
          .from('sync_jobs')
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            metadata: {
              webinars_found: allWebinars.length,
              webinars_synced: processedCount,
              detailed_sync_count: webinarsForDetailedSync.length,
              participants_synced: detailedMetrics.participants.success,
              panelists_synced: detailedMetrics.panelists.success,
              polls_synced: detailedMetrics.polls.success,
              qa_synced: detailedMetrics.qa.success,
              registrations_synced: detailedMetrics.registrations.success,
              chat_synced: detailedMetrics.chat.success,
              api_requests_made: apiRequestCount,
              completed_at: new Date().toISOString()
            }
          })
          .eq('id', syncJob?.id)

        console.log('Comprehensive rate-limited sync completed successfully')

      } catch (backgroundError) {
        console.error('Background processing error:', backgroundError)
        
        await supabaseClient
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_message: backgroundError.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncJob?.id)
      }
    })())

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Comprehensive rate-limited sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
