
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WebinarData {
  id: string;
  title: string;
  host_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  attendees_count: number | null;
  registrants_count: number | null;
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

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Fetch webinars
        const { data: webinarsData, error: webinarsError } = await supabase
          .from('webinars')
          .select('*')
          .order('created_at', { ascending: false });

        if (webinarsError) throw webinarsError;

        setWebinars(webinarsData || []);

        // If we have webinars, fetch attendees for the most recent one
        if (webinarsData && webinarsData.length > 0) {
          const { data: attendeesData, error: attendeesError } = await supabase
            .from('attendees')
            .select('*')
            .eq('webinar_id', webinarsData[0].id)
            .order('engagement_score', { ascending: false });

          if (attendeesError) throw attendeesError;
          setAttendees(attendeesData || []);
        }
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching webinar data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return { webinars, attendees, loading, error };
};
