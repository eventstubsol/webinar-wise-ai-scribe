import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ComprehensiveWebinarData {
  id: string;
  title: string;
  host_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  attendees_count: number | null;
  registrants_count: number | null;
  zoom_webinar_id: string | null;
  uuid: string | null;
  join_url: string | null;
  password: string | null;
  agenda: string | null;
  timezone: string | null;
  is_simulive: boolean | null;
  webinar_type: string | null;
  created_at_zoom: string | null;
  // Related data
  settings?: {
    approval_type: number | null;
    registration_type: number | null;
    host_video: boolean | null;
    panelists_video: boolean | null;
    practice_session: boolean | null;
    hd_video: boolean | null;
    auto_recording: string | null;
    on_demand: boolean | null;
    post_webinar_survey: boolean | null;
    survey_url: string | null;
    allow_multiple_devices: boolean | null;
    alternative_hosts: string | null;
    contact_name: string | null;
    contact_email: string | null;
    email_language: string | null;
  };
  authentication?: {
    meeting_authentication: boolean | null;
    panelist_authentication: boolean | null;
    authentication_option: string | null;
    authentication_name: string | null;
    enforce_login: boolean | null;
    enforce_login_domains: string | null;
  };
  recurrence?: {
    recurrence_type: number;
    repeat_interval: number | null;
    weekly_days: string | null;
    monthly_day: number | null;
    end_date_time: string | null;
    end_times: number | null;
  };
  notifications?: {
    attendees_reminder_enable: boolean | null;
    attendees_reminder_type: number | null;
    follow_up_attendees_enable: boolean | null;
    follow_up_attendees_type: number | null;
    follow_up_absentees_enable: boolean | null;
    follow_up_absentees_type: number | null;
  };
  qa_settings?: {
    enable: boolean | null;
    allow_submit_questions: boolean | null;
    allow_anonymous_questions: boolean | null;
    answer_questions: string | null;
    attendees_can_comment: boolean | null;
    attendees_can_upvote: boolean | null;
    allow_auto_reply: boolean | null;
    auto_reply_text: string | null;
  };
  tracking_fields?: Array<{
    field_name: string;
    field_value: string;
  }>;
  occurrences?: Array<{
    occurrence_id: string;
    start_time: string | null;
    duration: number | null;
    status: string | null;
  }>;
  interpreters?: Array<{
    interpreter_type: string;
    email: string;
    languages?: string | null;
    sign_language?: string | null;
  }>;
  panelists?: Array<{
    id: string;
    email: string;
    name?: string;
    status: string;
    joined_at?: string;
    duration_minutes: number;
  }>;
}

export const useComprehensiveWebinarData = () => {
  const { user } = useAuth();
  const [webinars, setWebinars] = useState<ComprehensiveWebinarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComprehensiveData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Fetch webinars with all related data including panelists
      const { data: webinarsData, error: webinarsError } = await supabase
        .from('webinars')
        .select(`
          *,
          settings:webinar_settings(*),
          authentication:webinar_authentication(*),
          recurrence:webinar_recurrence(*),
          notifications:webinar_notifications(*),
          qa_settings:webinar_qa_settings(*),
          tracking_fields:webinar_tracking_fields(*),
          occurrences:webinar_occurrences(*),
          interpreters:webinar_interpreters(*),
          panelists:webinar_panelists(*)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (webinarsError) {
        console.error('Error fetching comprehensive webinar data:', webinarsError);
        throw webinarsError;
      }

      // Transform the data to match our interface
      const transformedData: ComprehensiveWebinarData[] = (webinarsData || []).map(webinar => ({
        id: webinar.id,
        title: webinar.title,
        host_name: webinar.host_name,
        start_time: webinar.start_time,
        end_time: webinar.end_time,
        duration_minutes: webinar.duration_minutes,
        attendees_count: webinar.attendees_count,
        registrants_count: webinar.registrants_count,
        zoom_webinar_id: webinar.zoom_webinar_id,
        uuid: webinar.uuid,
        join_url: webinar.join_url,
        password: webinar.password,
        agenda: webinar.agenda,
        timezone: webinar.timezone,
        is_simulive: webinar.is_simulive,
        webinar_type: webinar.webinar_type,
        created_at_zoom: webinar.created_at_zoom,
        settings: Array.isArray(webinar.settings) && webinar.settings.length > 0 ? webinar.settings[0] : undefined,
        authentication: Array.isArray(webinar.authentication) && webinar.authentication.length > 0 ? webinar.authentication[0] : undefined,
        recurrence: Array.isArray(webinar.recurrence) && webinar.recurrence.length > 0 ? webinar.recurrence[0] : undefined,
        notifications: Array.isArray(webinar.notifications) && webinar.notifications.length > 0 ? webinar.notifications[0] : undefined,
        qa_settings: Array.isArray(webinar.qa_settings) && webinar.qa_settings.length > 0 ? webinar.qa_settings[0] : undefined,
        tracking_fields: Array.isArray(webinar.tracking_fields) ? webinar.tracking_fields : [],
        occurrences: Array.isArray(webinar.occurrences) ? webinar.occurrences : [],
        interpreters: Array.isArray(webinar.interpreters) ? webinar.interpreters : [],
        panelists: Array.isArray(webinar.panelists) ? webinar.panelists : [],
      }));

      setWebinars(transformedData);
      console.log(`Fetched ${transformedData.length} webinars with comprehensive data including panelists`);
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch comprehensive webinar data';
      setError(errorMessage);
      console.error('Error fetching comprehensive webinar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComprehensiveData();
  }, [user]);

  const refreshData = async () => {
    setLoading(true);
    await fetchComprehensiveData();
  };

  return { 
    webinars, 
    loading, 
    error, 
    refreshData,
    totalCount: webinars.length 
  };
};
