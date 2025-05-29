
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Process enhanced participant analytics
export async function processParticipantAnalytics(
  webinarId: string,
  zoomWebinarId: string,
  organizationId: string,
  supabaseClient: any,
  accessToken: string
) {
  console.log(`Processing participant analytics for webinar: ${zoomWebinarId}`)

  try {
    // Fetch detailed participant data
    let pageNumber = 1
    let hasMore = true
    let processedCount = 0

    while (hasMore) {
      const participantsResponse = await fetch(
        `https://api.zoom.us/v2/metrics/webinars/${zoomWebinarId}/participants?page_size=300&page_number=${pageNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!participantsResponse.ok) {
        console.log('Could not fetch participant metrics')
        break
      }

      const participantsData = await participantsResponse.json()
      const participants = participantsData.participants || []

      for (const participant of participants) {
        try {
          // Find the attendee in our database
          const { data: attendee } = await supabaseClient
            .from('attendees')
            .select('id')
            .eq('email', participant.email)
            .eq('webinar_id', webinarId)
            .single()

          if (attendee) {
            // Calculate engagement metrics
            const engagementMetrics = calculateEngagementMetrics(participant)
            
            // Get chat message count
            const { count: chatCount } = await supabaseClient
              .from('zoom_chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('webinar_id', webinarId)
              .eq('sender_email', participant.email)

            // Get Q&A participation
            const { count: qaCount } = await supabaseClient
              .from('zoom_qa_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('webinar_id', webinarId)
              .eq('asker_email', participant.email)

            // Get poll participation
            const { count: pollCount } = await supabaseClient
              .from('zoom_poll_responses')
              .select('*', { count: 'exact', head: true })
              .eq('participant_email', participant.email)

            // Store enhanced participant analytics
            await supabaseClient
              .from('participant_analytics')
              .upsert({
                attendee_id: attendee.id,
                webinar_id: webinarId,
                organization_id: organizationId,
                attention_score: engagementMetrics.attentionScore,
                interaction_count: engagementMetrics.interactionCount,
                questions_asked: qaCount || 0,
                polls_participated: pollCount || 0,
                chat_messages_sent: chatCount || 0,
                device_info: {
                  device: participant.device,
                  os: participant.os,
                  browser: participant.browser,
                  version: participant.version
                },
                connection_quality: {
                  network_type: participant.network_type,
                  ip_address: participant.ip_address,
                  location: participant.location,
                  data_center: participant.data_center
                },
                geographic_info: {
                  country: participant.country,
                  city: participant.city,
                  timezone: participant.timezone
                },
                engagement_timeline: engagementMetrics.timeline,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'attendee_id',
              })

            processedCount++
            console.log(`✓ Processed participant analytics: ${participant.email}`)
          }

        } catch (error) {
          console.error(`Error processing participant analytics:`, error)
        }
      }

      hasMore = participantsData.page_count > pageNumber
      pageNumber++

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`Participant analytics processing complete: ${processedCount} processed`)
    return { success: true, participantsProcessed: processedCount }

  } catch (error) {
    console.error('Error processing participant analytics:', error)
    return { success: false, error: error.message }
  }
}

function calculateEngagementMetrics(participant: any) {
  // Calculate attention score based on available data
  let attentionScore = 0.0
  let interactionCount = 0
  const timeline = []

  // Attention score factors
  if (participant.duration && participant.total_duration) {
    const attendanceRatio = participant.duration / participant.total_duration
    attentionScore += attendanceRatio * 40 // Up to 40 points for attendance
  }

  // Camera usage
  if (participant.camera_time > 0) {
    attentionScore += 10 // 10 points for camera usage
    interactionCount++
  }

  // Microphone usage
  if (participant.microphone_time > 0) {
    attentionScore += 10 // 10 points for microphone usage
    interactionCount++
  }

  // Screen sharing
  if (participant.screen_share_time > 0) {
    attentionScore += 15 // 15 points for screen sharing
    interactionCount++
  }

  // Join/leave frequency (too many may indicate distraction)
  const joinLeaveRatio = participant.join_time && participant.leave_time ? 
    Math.min(participant.join_leave_count || 1, 3) : 1
  attentionScore += Math.max(0, 25 - (joinLeaveRatio - 1) * 5) // Penalty for multiple joins

  // Create engagement timeline
  if (participant.join_time) {
    timeline.push({
      timestamp: participant.join_time,
      event: 'joined',
      duration: participant.duration || 0
    })
  }

  if (participant.leave_time) {
    timeline.push({
      timestamp: participant.leave_time,
      event: 'left'
    })
  }

  return {
    attentionScore: Math.min(100, Math.max(0, attentionScore)),
    interactionCount,
    timeline
  }
}
