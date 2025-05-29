
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { EngagementTimelinePoint } from '@/types/analytics';

export const useEngagementTimeline = (webinarId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['engagement-timeline', webinarId],
    queryFn: async () => {
      if (!webinarId) return [];
      
      const { data, error } = await supabase
        .from('webinar_engagement_timeline')
        .select('*')
        .eq('webinar_id', webinarId)
        .order('time_interval', { ascending: true });

      if (error) throw error;
      return data as EngagementTimelinePoint[];
    },
    enabled: !!webinarId && !!user
  });
};
