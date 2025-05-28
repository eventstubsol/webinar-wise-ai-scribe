
import { ZoomWebinar } from './types.ts'

// Map Zoom webinar status to our enum
export function mapZoomStatusToOurs(zoomWebinar: ZoomWebinar): string {
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
