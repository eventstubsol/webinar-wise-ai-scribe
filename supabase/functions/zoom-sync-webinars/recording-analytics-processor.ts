
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Process enhanced recording analytics
export async function processRecordingAnalytics(
  webinarId: string,
  zoomWebinarId: string,
  organizationId: string,
  supabaseClient: any,
  accessToken: string
) {
  console.log(`Processing recording analytics for webinar: ${zoomWebinarId}`)

  try {
    // Fetch recordings
    const recordingsResponse = await fetch(`https://api.zoom.us/v2/meetings/${zoomWebinarId}/recordings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!recordingsResponse.ok) {
      console.log('No recordings found for analytics processing')
      return { success: true, recordingsProcessed: 0 }
    }

    const recordingsData = await recordingsResponse.json()
    const recordingFiles = recordingsData.recording_files || []

    let processedCount = 0

    for (const recording of recordingFiles) {
      try {
        // Find the recording in our database
        const { data: recordingRecord } = await supabaseClient
          .from('zoom_recordings')
          .select('id')
          .eq('zoom_recording_id', recording.id)
          .eq('webinar_id', webinarId)
          .single()

        if (recordingRecord) {
          // Fetch detailed recording analytics if available
          const analytics = await fetchRecordingDetailedAnalytics(recording.id, accessToken)
          
          // Process transcript if available
          const transcript = await fetchRecordingTranscript(recording.id, accessToken)

          // Store enhanced analytics
          await supabaseClient
            .from('webinar_recording_analytics')
            .upsert({
              recording_id: recordingRecord.id,
              webinar_id: webinarId,
              organization_id: organizationId,
              total_views: analytics.total_views || 0,
              unique_viewers: analytics.unique_viewers || 0,
              average_view_duration: analytics.average_view_duration || 0,
              peak_concurrent_viewers: analytics.peak_concurrent_viewers || 0,
              geographic_data: analytics.geographic_data || {},
              device_analytics: analytics.device_analytics || {},
              sharing_permissions: {
                download_enabled: recording.download_url ? true : false,
                play_enabled: recording.play_url ? true : false,
                sharing_enabled: recording.share_url ? true : false
              },
              access_logs: analytics.access_logs || [],
              transcript_available: transcript ? true : false,
              transcript_content: transcript,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'recording_id',
            })

          processedCount++
          console.log(`✓ Processed recording analytics: ${recording.id}`)
        }

      } catch (error) {
        console.error(`Error processing recording analytics:`, error)
      }
    }

    console.log(`Recording analytics processing complete: ${processedCount} processed`)
    return { success: true, recordingsProcessed: processedCount }

  } catch (error) {
    console.error('Error processing recording analytics:', error)
    return { success: false, error: error.message }
  }
}

async function fetchRecordingDetailedAnalytics(recordingId: string, accessToken: string) {
  try {
    // Note: This endpoint may require additional permissions or may not be available
    // Returning mock structure for now - implement based on available Zoom APIs
    const analyticsResponse = await fetch(`https://api.zoom.us/v2/meetings/${recordingId}/recordings/analytics`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (analyticsResponse.ok) {
      return await analyticsResponse.json()
    }

    return {
      total_views: 0,
      unique_viewers: 0,
      average_view_duration: 0,
      peak_concurrent_viewers: 0,
      geographic_data: {},
      device_analytics: {},
      access_logs: []
    }

  } catch (error) {
    console.log('Could not fetch detailed recording analytics:', error.message)
    return {}
  }
}

async function fetchRecordingTranscript(recordingId: string, accessToken: string) {
  try {
    // Fetch transcript if available
    const transcriptResponse = await fetch(`https://api.zoom.us/v2/meetings/${recordingId}/recordings/transcript`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json()
      return transcriptData.transcript || null
    }

    return null

  } catch (error) {
    console.log('Could not fetch recording transcript:', error.message)
    return null
  }
}
