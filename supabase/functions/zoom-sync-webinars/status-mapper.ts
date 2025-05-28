import { ZoomWebinar } from './types.ts'

// Map Zoom webinar status to our enum with improved logic for completed webinars
export function mapZoomStatusToOurs(zoomWebinar: ZoomWebinar): string {
  const now = new Date()
  const startTime = zoomWebinar.start_time ? new Date(zoomWebinar.start_time) : null
  
  // If Zoom provides explicit status, use it first
  if (zoomWebinar.status) {
    switch (zoomWebinar.status.toLowerCase()) {
      case 'waiting':
      case 'started':
      case 'live':
        return 'live'
      case 'ended':
      case 'finished':
      case 'completed':
        return 'completed'
      case 'cancelled':
        return 'cancelled'
      default:
        break
    }
  }
  
  // Enhanced time-based logic
  if (!startTime) return 'scheduled'
  
  if (startTime > now) {
    return 'upcoming'
  }
  
  // For past webinars, be more aggressive about marking as completed
  if (startTime <= now) {
    const daysSinceStart = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24)
    
    // If webinar started more than 1 day ago, definitely completed
    if (daysSinceStart > 1) {
      return 'completed'
    }
    
    // If webinar has duration data, it likely completed
    if (zoomWebinar.duration && zoomWebinar.duration > 0) {
      return 'completed'
    }
    
    // If webinar started more than 3 hours ago (typical webinar length), mark as completed
    const hoursLived = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    if (hoursLived > 3) {
      return 'completed'
    }
    
    // Otherwise, might still be live or just ended
    return 'live'
  }
  
  return 'scheduled'
}
