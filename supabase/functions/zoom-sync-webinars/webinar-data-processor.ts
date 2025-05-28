
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Enhanced webinar data processor that fixes data quality issues
export async function processWebinarDataWithQualityFixes(
  zoomWebinar: any,
  detailData: any,
  organizationId: string,
  userId: string,
  supabaseClient: any,
  accessToken: string
) {
  console.log(`Processing webinar with quality fixes: ${detailData.id}`)

  try {
    // 1. Fix host_name - Get actual host information from Zoom
    let hostName = detailData.host_email || zoomWebinar.host_email
    if (detailData.host_id) {
      try {
        const hostResponse = await fetch(`https://api.zoom.us/v2/users/${detailData.host_id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (hostResponse.ok) {
          const hostData = await hostResponse.json()
          if (hostData.first_name || hostData.last_name) {
            hostName = `${hostData.first_name || ''} ${hostData.last_name || ''}`.trim()
          } else if (hostData.display_name) {
            hostName = hostData.display_name
          }
        }
      } catch (error) {
        console.log('Could not fetch host details, using email as fallback')
      }
    }

    // 2. Fix webinar_type - Map Zoom numeric types to meaningful strings
    let webinarType = 'past' // default
    const zoomType = detailData.type || zoomWebinar.type
    switch (zoomType) {
      case 5:
        webinarType = 'webinar'
        break
      case 6:
        webinarType = 'recurring_webinar'
        break
      case 9:
        webinarType = 'recurring_webinar_fixed_time'
        break
      default:
        if (detailData.start_time && new Date(detailData.start_time) > new Date()) {
          webinarType = 'scheduled'
        } else {
          webinarType = 'past'
        }
    }

    // 3. Check for recordings and get recording status
    let hasRecording = false
    let recordingCount = 0
    let recordFileId = detailData.record_file_id

    try {
      const recordingsResponse = await fetch(`https://api.zoom.us/v2/meetings/${detailData.id}/recordings`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (recordingsResponse.ok) {
        const recordingsData = await recordingsResponse.json()
        if (recordingsData.recording_files && recordingsData.recording_files.length > 0) {
          hasRecording = true
          recordingCount = recordingsData.recording_files.length
          recordFileId = recordingsData.recording_files[0].id || recordFileId
        }
      }
    } catch (error) {
      console.log('Could not fetch recording data:', error.message)
    }

    // 4. Get accurate registrants count
    let registrantsCount = detailData.registrants_count || 0
    try {
      const registrantsResponse = await fetch(`https://api.zoom.us/v2/webinars/${detailData.id}/registrants?page_size=300`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (registrantsResponse.ok) {
        const registrantsData = await registrantsResponse.json()
        registrantsCount = registrantsData.total_records || registrantsData.registrants?.length || 0
      }
    } catch (error) {
      console.log('Could not fetch registrants count:', error.message)
    }

    // 5. Get accurate attendees count from participants API
    let attendeesCount = 0
    try {
      const participantsResponse = await fetch(`https://api.zoom.us/v2/metrics/webinars/${detailData.id}/participants?page_size=300`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (participantsResponse.ok) {
        const participantsData = await participantsResponse.json()
        attendeesCount = participantsData.total_records || participantsData.participants?.length || 0
      }
    } catch (error) {
      console.log('Could not fetch participants count:', error.message)
    }

    // Map Zoom status to our status
    const webinarStatus = mapZoomStatusToOurs(detailData)

    // Upsert main webinar data with quality fixes
    const { data: webinarRecord, error: upsertError } = await supabaseClient
      .from('webinars')
      .upsert({
        zoom_webinar_id: detailData.id?.toString(),
        organization_id: organizationId,
        user_id: userId,
        title: detailData.topic,
        host_name: hostName, // Fixed: actual name instead of email
        host_id: detailData.host_id,
        host_email: detailData.host_email,
        uuid: detailData.uuid,
        start_time: detailData.start_time || zoomWebinar.start_time,
        duration_minutes: detailData.duration || zoomWebinar.duration,
        registrants_count: registrantsCount, // Fixed: accurate count
        attendees_count: attendeesCount, // Fixed: accurate count
        recording_count: recordingCount, // Fixed: actual recording count
        has_recording: hasRecording, // Fixed: actual recording status
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
        record_file_id: recordFileId, // Fixed: actual record file ID
        transition_to_live: detailData.transition_to_live || false,
        creation_source: detailData.creation_source,
        webinar_type: webinarType, // Fixed: meaningful type instead of numeric
        status: webinarStatus,
        registration_url: detailData.registration_url,
        pstn_password: detailData.pstn_password,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'zoom_webinar_id',
      })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting webinar:', upsertError)
      return { success: false, error: upsertError.message }
    }

    console.log(`✓ Webinar processed with quality fixes: ${detailData.topic}`)
    console.log(`  Host: ${hostName}`)
    console.log(`  Type: ${webinarType}`)
    console.log(`  Has Recording: ${hasRecording}`)
    console.log(`  Registrants: ${registrantsCount}`)
    console.log(`  Attendees: ${attendeesCount}`)

    return { 
      success: true, 
      webinarRecord,
      qualityFixes: {
        hostName,
        webinarType,
        hasRecording,
        registrantsCount,
        attendeesCount
      }
    }

  } catch (error) {
    console.error(`Error processing webinar ${detailData.id}:`, error)
    return { success: false, error: error.message }
  }
}

function mapZoomStatusToOurs(detailData: any): string {
  const now = new Date()
  const startTime = detailData.start_time ? new Date(detailData.start_time) : null
  
  if (!startTime) return 'scheduled'
  
  if (startTime > now) {
    return 'upcoming'
  } else {
    // For past webinars, check if it was completed or cancelled
    if (detailData.status === 'finished' || detailData.status === 'ended') {
      return 'completed'
    } else if (detailData.status === 'cancelled') {
      return 'cancelled'
    } else {
      return 'completed' // Default for past webinars
    }
  }
}
