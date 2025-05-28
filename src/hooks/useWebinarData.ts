
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
}

interface AttendeeData {
  id: string;
  name: string;
  email: string;
  join_time: string | null;
  duration_minutes: number | null;
  engagement_score: number | null;
}

export const useWebinarData = () => {
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
        .select('id, title, host_name, start_time, end_time, duration_minutes, attendees_count, registrants_count, status')
        .order('created_at', { ascending: false })
        .limit(20);

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
      }));

      setWebinars(transformedWebinars);

      // If we have webinars, fetch attendees for the most recent one
      if (transformedWebinars.length > 0) {
        const { data: attendeesData, error: attendeesError } = await supabase
          .from('attendees')
          .select('id, name, email, join_time, duration_minutes, engagement_score')
          .eq('webinar_id', transformedWebinars[0].id)
          .order('engagement_score', { ascending: false, nullsFirst: false })
          .limit(50);

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
          }));
          setAttendees(transformedAttendees);
        }
      } else {
        setAttendees([]);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch webinar data';
      setError(errorMessage);
      console.error('Error in useWebinarData:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

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
    totalWebinars: webinars.length,
    totalAttendees: attendees.length
  };
};
