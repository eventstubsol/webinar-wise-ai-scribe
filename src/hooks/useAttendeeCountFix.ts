
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export const useAttendeeCountFix = () => {
  const { user } = useAuth();
  const [fixing, setFixing] = useState(false);

  const fixAttendeeCountsForWebinar = async (webinarId: string) => {
    try {
      console.log(`[useAttendeeCountFix] Fixing counts for webinar: ${webinarId}`);
      
      // Get attendee count directly with proper error handling
      const { count: attendeeCount, error: attendeeError } = await supabase
        .from('attendees')
        .select('*', { count: 'exact', head: true })
        .eq('webinar_id', webinarId);
      
      if (attendeeError) {
        console.warn('Error getting attendee count:', attendeeError);
      }

      // Get registrant count directly with proper error handling
      const { count: registrantCount, error: registrantError } = await supabase
        .from('zoom_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('webinar_id', webinarId);
      
      if (registrantError) {
        console.warn('Error getting registrant count:', registrantError);
      }

      const finalAttendeeCount = attendeeCount || 0;
      const finalRegistrantCount = registrantCount || 0;

      console.log(`[useAttendeeCountFix] Found ${finalAttendeeCount} attendees, ${finalRegistrantCount} registrants`);

      // Update webinar counts
      const { error: updateError } = await supabase
        .from('webinars')
        .update({
          attendees_count: finalAttendeeCount,
          registrants_count: finalRegistrantCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', webinarId);

      if (updateError) {
        throw updateError;
      }

      console.log(`[useAttendeeCountFix] Successfully updated counts for webinar ${webinarId}`);

      return {
        attendees_count: finalAttendeeCount,
        registrants_count: finalRegistrantCount
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

      console.log(`[useAttendeeCountFix] Starting comprehensive count fix for organization: ${profile.organization_id}`);

      // Get all webinars for the organization
      const { data: webinars, error: webinarsError } = await supabase
        .from('webinars')
        .select('id, title, status, attendees_count, registrants_count')
        .eq('organization_id', profile.organization_id);

      if (webinarsError) {
        throw webinarsError;
      }

      console.log(`[useAttendeeCountFix] Processing ${webinars?.length || 0} webinars`);

      let fixed = 0;
      let totalAttendees = 0;
      let totalRegistrants = 0;
      let webinarsWithUpdatedCounts = 0;
      let completedWebinarsWithNoAttendees = 0;

      for (const webinar of webinars || []) {
        try {
          const oldAttendeeCount = webinar.attendees_count || 0;
          const oldRegistrantCount = webinar.registrants_count || 0;
          
          const counts = await fixAttendeeCountsForWebinar(webinar.id);
          totalAttendees += counts.attendees_count;
          totalRegistrants += counts.registrants_count;
          
          // Check if counts actually changed
          if (counts.attendees_count !== oldAttendeeCount || counts.registrants_count !== oldRegistrantCount) {
            webinarsWithUpdatedCounts++;
            console.log(`[useAttendeeCountFix] Updated ${webinar.title}: ${oldAttendeeCount}->${counts.attendees_count} attendees, ${oldRegistrantCount}->${counts.registrants_count} registrants`);
          }
          
          // Track completed webinars that still have no attendees but have registrants
          if (webinar.status === 'completed' && counts.attendees_count === 0 && counts.registrants_count > 0) {
            completedWebinarsWithNoAttendees++;
          }
          
          fixed++;
        } catch (error) {
          console.error(`Failed to fix counts for webinar ${webinar.title}:`, error);
        }
      }

      console.log(`[useAttendeeCountFix] Comprehensive fix completed:`, {
        processed: fixed,
        updated: webinarsWithUpdatedCounts,
        totalAttendees,
        totalRegistrants,
        completedWithMissingAttendees: completedWebinarsWithNoAttendees
      });

      // Show appropriate success message
      if (webinarsWithUpdatedCounts > 0) {
        toast({
          title: "Attendee Counts Fixed",
          description: `Updated ${webinarsWithUpdatedCounts} webinars. Total: ${totalAttendees} attendees, ${totalRegistrants} registrants.`,
        });
      } else {
        toast({
          title: "Counts Already Accurate",
          description: `All ${fixed} webinars already have correct counts. No updates needed.`,
        });
      }

      // Additional warning if there are still completed webinars without attendee data
      if (completedWebinarsWithNoAttendees > 0) {
        setTimeout(() => {
          toast({
            title: "Missing Attendee Data Detected",
            description: `${completedWebinarsWithNoAttendees} completed webinars still have no attendee data. You may need to sync attendee data from Zoom.`,
            variant: "default",
          });
        }, 2000);
      }

      return { 
        fixed, 
        updated: webinarsWithUpdatedCounts,
        totalAttendees, 
        totalRegistrants, 
        completedWebinarsWithMissingAttendees: completedWebinarsWithNoAttendees 
      };
    } catch (error: any) {
      console.error('Error in comprehensive attendee count fix:', error);
      toast({
        title: "Count Fix Failed",
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
