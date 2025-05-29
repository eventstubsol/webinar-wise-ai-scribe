
import { ZoomWebinar } from './types.ts'

// Map Zoom webinar status to our enum with enhanced logic
export function mapZoomStatusToOurs(zoomWebinar: ZoomWebinar): string {
  const now = new Date()
  const startTime = zoomWebinar.start_time ? new Date(zoomWebinar.start_time) : null
  
  // If Zoom provides explicit status, use it with enhanced mapping
  if (zoomWebinar.status) {
    switch (zoomWebinar.status.toLowerCase()) {
      case 'waiting':
      case 'started':
        return 'live'
      case 'ended':
      case 'finished':
        return 'completed'
      case 'cancelled':
        return 'cancelled'
      default:
        break
    }
  }
  
  // Enhanced time-based logic with template and source consideration
  if (!startTime) return 'scheduled'
  
  if (startTime > now) {
    // Future webinar - check if it's from a template
    if (zoomWebinar.template_id) {
      return 'upcoming' // Template-based webinars are more likely to be properly scheduled
    }
    return 'upcoming'
  }
  
  // For past webinars, enhanced logic
  if (startTime <= now) {
    // Check if webinar has recordings (strong indicator it was completed)
    if (zoomWebinar.recording_count && zoomWebinar.recording_count > 0) {
      return 'completed'
    }
    
    // Check if it has duration (indicating it actually happened)
    if (zoomWebinar.duration && zoomWebinar.duration > 0) {
      return 'completed'
    }
    
    // Check if it has attendees (another indicator it happened)
    if (zoomWebinar.attendees_count && zoomWebinar.attendees_count > 0) {
      return 'completed'
    }
    
    // If it's more than 24 hours past start time with no indicators, likely cancelled
    const hoursPast = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    if (hoursPast > 24) {
      return 'cancelled'
    }
    
    // Recent past webinar with no completion indicators
    return 'scheduled'
  }
  
  return 'scheduled'
}

// Enhanced webinar type mapping
export function mapZoomTypeToWebinarType(zoomType: number, additionalData?: any): string {
  switch (zoomType) {
    case 5:
      return 'webinar'
    case 6:
      return 'recurring_webinar'
    case 9:
      return 'recurring_webinar_fixed_time'
    case 10:
      return 'practice_session'
    default:
      // Use additional context to determine type
      if (additionalData?.template_id) {
        return 'template_based'
      }
      if (additionalData?.recurrence) {
        return 'recurring_webinar'
      }
      if (additionalData?.is_simulive) {
        return 'simulive'
      }
      return 'webinar'
  }
}

// Calculate engagement level based on enhanced data
export function calculateEngagementLevel(webinarData: any): string {
  if (!webinarData.attendees_count || webinarData.attendees_count === 0) {
    return 'no_engagement'
  }

  const registrationRate = webinarData.registrants_count > 0 ? 
    webinarData.attendees_count / webinarData.registrants_count : 0

  const hasInteraction = (webinarData.chat_count || 0) > 0 || 
                        (webinarData.qa_count || 0) > 0 || 
                        (webinarData.poll_count || 0) > 0

  if (registrationRate >= 0.7 && hasInteraction) {
    return 'high_engagement'
  } else if (registrationRate >= 0.4 || hasInteraction) {
    return 'medium_engagement'
  } else {
    return 'low_engagement'
  }
}
