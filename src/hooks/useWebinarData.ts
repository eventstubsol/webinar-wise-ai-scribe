
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { WebinarStatus } from '@/types/sync';

interface WebinarData {
  id: string;
  title: string;
  host_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  attendees_count: number | null;
  registrants_count: number | null;
  status: WebinarStatus;
  zoom_webinar_id: string | null;
}

interface AttendeeData {
  id: string;
  name: string;
  email: string;
  join_time: string | null;
  duration_minutes: number | null;
  engagement_score: number | null;
  webinar_id: string;
  webinar_title?: string;
}

export const useWebinarData = (selectedWebinarId?: string) => {
  const { user } = useAuth();
  const [webinars, setWebinars] = useState<WebinarData[]>([]);
  const [attendees, setAttendees] = useState<AttendeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Update webinar status before fetching
      await supabase.rpc('update_webinar_status');
      
      // Fetch webinars with status column
      const { data: webinarsData, error: webinarsError } = await supabase
        .from('webinars')
        .select('id, title, host_name, start_time, end_time, duration_minutes, attendees_count, registrants_count, status, zoom_webinar_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (webinarsError) {
        console.error('Error fetching webinars:', webinarsError);
        throw new Error(`Failed to fetch webinars: ${webinarsError.message}`);
      }

      const transformedWebinars = (webinarsData || []).map(w => ({
        id: w.id,
        title: w.title || 'Untitled Webinar',
        host_name: w.host_name,
        start_time: w.start_time,
        end_time: w.end_time,
        duration_minutes: w.duration_minutes,
        attendees_count: w.attendees_count || 0,
        registrants_count: w.registrants_count || 0,
        status: w.status as WebinarStatus,
        zoom_webinar_id: w.zoom_webinar_id,
      }));

      setWebinars(transformedWebinars);

      // Fetch attendees based on selection
      let attendeesQuery = supabase
        .from('attendees')
        .select(`
          id, 
          name, 
          email, 
          join_time, 
          duration_minutes, 
          engagement_score, 
          webinar_id,
          webinars!inner(title)
        `)
        .order('engagement_score', { ascending: false, nullsFirst: false })
        .limit(100);

      // If specific webinar selected, filter by it, otherwise get attendees from recent webinars
      if (selectedWebinarId) {
        attendeesQuery = attendeesQuery.eq('webinar_id', selectedWebinarId);
      } else if (transformedWebinars.length > 0) {
        // Get attendees from the 5 most recent webinars
        const recentWebinarIds = transformedWebinars.slice(0, 5).map(w => w.id);
        attendeesQuery = attendeesQuery.in('webinar_id', recentWebinarIds);
      }

      const { data: attendeesData, error: attendeesError } = await attendeesQuery;

      if (attendeesError) {
        console.error('Error fetching attendees:', attendeesError);
        setAttendees([]);
      } else {
        const transformedAttendees = (attendeesData || []).map(a => ({
          id: a.id,
          name: a.name || 'Unknown Attendee',
          email: a.email || '',
          join_time: a.join_time,
          duration_minutes: a.duration_minutes || 0,
          engagement_score: a.engagement_score || 0,
          webinar_id: a.webinar_id,
          webinar_title: a.webinars?.title || 'Unknown Webinar',
        }));
        setAttendees(transformedAttendees);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch webinar data';
      setError(errorMessage);
      console.error('Error in useWebinarData:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAttendeeData = async (webinarId?: string) => {
    try {
      // Trigger a fresh sync for specific webinar
      if (webinarId && user) {
        const { data: webinar } = await supabase
          .from('webinars')
          .select('zoom_webinar_id, organization_id')
          .eq('id', webinarId)
          .single();

        if (webinar?.zoom_webinar_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

          if (profile?.organization_id) {
            await supabase.functions.invoke('zoom-sync-participants', {
              body: {
                organization_id: profile.organization_id,
                user_id: user.id,
                webinar_id: webinarId,
                zoom_webinar_id: webinar.zoom_webinar_id
              }
            });
          }
        }
      }
      
      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Error refreshing attendee data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedWebinarId]);

  const refreshData = async () => {
    setLoading(true);
    await fetchData();
  };

  return { 
    webinars, 
    attendees, 
    loading, 
    error, 
    refreshData,
    refreshAttendeeData,
    totalWebinars: webinars.length,
    totalAttendees: attendees.length,
    webinarsWithAttendees: webinars.filter(w => (w.attendees_count || 0) > 0).length,
    webinarsWithoutAttendees: webinars.filter(w => (w.attendees_count || 0) === 0).length
  };
};
