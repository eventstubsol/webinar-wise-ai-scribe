
export interface ZoomWebinar {
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

export interface WebinarRecord {
  id: string
  zoom_webinar_id: string
  organization_id: string
  user_id: string
  title: string
  host_name: string | null
  host_id: string | null
  uuid: string | null
  start_time: string | null
  duration_minutes: number | null
  registrants_count: number | null
  join_url: string | null
  password: string | null
  encrypted_passcode: string | null
  h323_passcode: string | null
  start_url: string | null
  timezone: string | null
  agenda: string | null
  created_at_zoom: string | null
  webinar_number: number | null
  is_simulive: boolean | null
  record_file_id: string | null
  transition_to_live: boolean | null
  creation_source: string | null
  webinar_type: string | null
  status: string
  updated_at: string
}
