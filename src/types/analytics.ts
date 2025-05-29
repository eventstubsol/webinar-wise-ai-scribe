
export interface AnalyticsSummary {
  id: string;
  webinar_id: string;
  organization_id: string;
  analytics_date: string;
  total_registrants: number;
  total_attendees: number;
  attendance_rate: number;
  peak_attendance: number;
  average_attendance: number;
  average_engagement_score: number;
  total_chat_messages: number;
  total_poll_responses: number;
  total_qa_questions: number;
  actual_duration_minutes: number;
  average_watch_time_minutes: number;
  completion_rate: number;
  device_breakdown: Record<string, number>;
  geographic_breakdown: Record<string, number>;
  overall_performance_score: number;
  engagement_performance_score: number;
  retention_performance_score: number;
  created_at: string;
  updated_at: string;
}

export interface EngagementTimelinePoint {
  id: string;
  webinar_id: string;
  organization_id: string;
  time_interval: number;
  active_attendees: number;
  engagement_level: number;
  chat_activity: number;
  poll_activity: number;
  qa_activity: number;
  significant_events: any[];
  created_at: string;
}

export interface ComparativeAnalytics {
  id: string;
  organization_id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  total_webinars: number;
  total_registrants: number;
  total_attendees: number;
  average_attendance_rate: number;
  average_engagement_score: number;
  attendance_trend: number;
  engagement_trend: number;
  registration_trend: number;
  top_performing_webinars: any[];
  engagement_hotspots: any[];
  created_at: string;
  updated_at: string;
}

export interface AnalyticsPeriod {
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  start: string;
  end: string;
}
