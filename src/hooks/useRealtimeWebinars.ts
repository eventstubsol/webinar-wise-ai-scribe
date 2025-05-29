import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LiveWebinarStatus {
  id: string;
  webinar_id: string;
  status: string;
  current_participants: number;
  peak_participants: number;
  started_at: string | null;
  is_live: boolean;
  live_metrics: any;
  last_activity: string;
}

interface LiveEvent {
  id: string;
  webinar_id: string;
  event_type: string;
  event_data: any;
  timestamp: string;
}

interface LiveParticipantSession {
  id: string;
  webinar_id: string;
  participant_name: string;
  participant_email: string;
  joined_at: string;
  last_seen: string;
  is_active: boolean;
  attention_score: number;
  interaction_count: number;
}

export const useRealtimeWebinars = () => {
  const { user } = useAuth();
  const [liveStatuses, setLiveStatuses] = useState<LiveWebinarStatus[]>([]);
  const [recentEvents, setRecentEvents] = useState<LiveEvent[]>([]);
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipantSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Initial data fetch
    fetchInitialData();

    // Set up real-time subscriptions
    const statusChannel = supabase
      .channel('webinar-live-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webinar_live_status'
        },
        (payload) => {
          console.log('Live status change:', payload);
          handleStatusChange(payload);
        }
      )
      .subscribe();

    const eventsChannel = supabase
      .channel('webinar-live-events-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webinar_live_events'
        },
        (payload) => {
          console.log('New live event:', payload);
          handleNewEvent(payload);
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel('live-participant-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_participant_sessions'
        },
        (payload) => {
          console.log('Participant session change:', payload);
          handleParticipantChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [user]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch live webinar statuses
      const { data: statuses } = await supabase
        .from('webinar_live_status')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statuses) {
        setLiveStatuses(statuses);
      }

      // Fetch recent events (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: events } = await supabase
        .from('webinar_live_events')
        .select('*')
        .gte('timestamp', oneHourAgo)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (events) {
        setRecentEvents(events);
      }

      // Fetch active participants
      const { data: participants } = await supabase
        .from('live_participant_sessions')
        .select('*')
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (participants) {
        setLiveParticipants(participants);
      }

    } catch (error) {
      console.error('Error fetching real-time data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    setLiveStatuses(current => {
      switch (eventType) {
        case 'INSERT':
          return [newRecord, ...current];
        case 'UPDATE':
          return current.map(status => 
            status.id === newRecord.id ? newRecord : status
          );
        case 'DELETE':
          return current.filter(status => status.id !== oldRecord.id);
        default:
          return current;
      }
    });
  };

  const handleNewEvent = (payload: any) => {
    const { new: newEvent } = payload;
    
    setRecentEvents(current => {
      const updated = [newEvent, ...current];
      // Keep only last 50 events
      return updated.slice(0, 50);
    });
  };

  const handleParticipantChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    setLiveParticipants(current => {
      switch (eventType) {
        case 'INSERT':
          return newRecord.is_active ? [newRecord, ...current] : current;
        case 'UPDATE':
          if (newRecord.is_active) {
            return current.map(participant => 
              participant.id === newRecord.id ? newRecord : participant
            );
          } else {
            return current.filter(participant => participant.id !== newRecord.id);
          }
        case 'DELETE':
          return current.filter(participant => participant.id !== oldRecord.id);
        default:
          return current;
      }
    });
  };

  const getLiveWebinarsCount = () => {
    return liveStatuses.filter(status => status.is_live).length;
  };

  const getTotalActiveParticipants = () => {
    return liveStatuses.reduce((total, status) => total + (status.current_participants || 0), 0);
  };

  const getWebinarStatus = (webinarId: string) => {
    return liveStatuses.find(status => status.webinar_id === webinarId);
  };

  const getWebinarParticipants = (webinarId: string) => {
    return liveParticipants.filter(participant => participant.webinar_id === webinarId);
  };

  return {
    liveStatuses,
    recentEvents,
    liveParticipants,
    loading,
    getLiveWebinarsCount,
    getTotalActiveParticipants,
    getWebinarStatus,
    getWebinarParticipants,
    refreshData: fetchInitialData
  };
};
