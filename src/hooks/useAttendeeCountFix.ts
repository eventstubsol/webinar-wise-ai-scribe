
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export const useAttendeeCountFix = () => {
  const { user } = useAuth();
  const [fixing, setFixing] = useState(false);

  const fixAttendeeCountsForWebinar = async (webinarId: string) => {
    try {
      // Get attendee count
      const { count: attendeeCount } = await supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('webinar_id', webinarId);

      // Get registrant count  
      const { count: registrantCount } = await supabase
        .from('zoom_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('webinar_id', webinarId);

      // Update webinar counts
      const { error: updateError } = await supabase
        .from('webinars')
        .update({
          attendees_count: attendeeCount || 0,
          registrants_count: registrantCount || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', webinarId);

      if (updateError) {
        throw updateError;
      }

      return {
        attendees_count: attendeeCount || 0,
        registrants_count: registrantCount || 0
      };
    } catch (error) {
      console.error('Error fixing counts for webinar:', webinarId, error);
      throw error;
    }
  };

  const fixAllAttendeeCounts = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setFixing(true);

    try {
      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Get all webinars for the organization
      const { data: webinars, error: webinarsError } = await supabase
        .from('webinars')
        .select('id, title')
        .eq('organization_id', profile.organization_id);

      if (webinarsError) {
        throw webinarsError;
      }

      let fixed = 0;
      let totalAttendees = 0;
      let totalRegistrants = 0;

      for (const webinar of webinars || []) {
        try {
          const counts = await fixAttendeeCountsForWebinar(webinar.id);
          totalAttendees += counts.attendees_count;
          totalRegistrants += counts.registrants_count;
          fixed++;
        } catch (error) {
          console.error(`Failed to fix counts for webinar ${webinar.title}:`, error);
        }
      }

      toast({
        title: "Attendee Counts Fixed",
        description: `Updated ${fixed} webinars with ${totalAttendees} attendees and ${totalRegistrants} registrants`,
      });

      return { fixed, totalAttendees, totalRegistrants };
    } catch (error: any) {
      console.error('Error fixing attendee counts:', error);
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix attendee counts",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  return {
    fixing,
    fixAllAttendeeCounts,
    fixAttendeeCountsForWebinar
  };
};
