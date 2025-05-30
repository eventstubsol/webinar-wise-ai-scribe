
-- Create function to update webinar counts automatically
CREATE OR REPLACE FUNCTION public.update_webinar_attendee_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update attendee and registrant counts for the affected webinar
  UPDATE public.webinars 
  SET 
    attendees_count = (
      SELECT COUNT(*) 
      FROM public.attendees 
      WHERE webinar_id = COALESCE(NEW.webinar_id, OLD.webinar_id)
        AND is_historical = false
    ),
    registrants_count = (
      SELECT COUNT(*) 
      FROM public.zoom_registrations 
      WHERE webinar_id = COALESCE(NEW.webinar_id, OLD.webinar_id)
        AND is_historical = false
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.webinar_id, OLD.webinar_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for attendees table
DROP TRIGGER IF EXISTS trigger_update_webinar_counts_attendees ON public.attendees;
CREATE TRIGGER trigger_update_webinar_counts_attendees
  AFTER INSERT OR UPDATE OR DELETE ON public.attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webinar_attendee_counts();

-- Create triggers for zoom_registrations table  
DROP TRIGGER IF EXISTS trigger_update_webinar_counts_registrations ON public.zoom_registrations;
CREATE TRIGGER trigger_update_webinar_counts_registrations
  AFTER INSERT OR UPDATE OR DELETE ON public.zoom_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webinar_attendee_counts();
