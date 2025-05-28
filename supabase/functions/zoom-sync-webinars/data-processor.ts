
export async function processWebinarComprehensiveData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any) {
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
