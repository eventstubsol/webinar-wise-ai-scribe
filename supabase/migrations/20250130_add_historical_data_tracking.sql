
-- Add historical data tracking columns to key tables

-- Add to attendees table
ALTER TABLE attendees 
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS zoom_data_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_zoom_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'zoom_sync',
ADD COLUMN IF NOT EXISTS data_checksum TEXT;

-- Add to zoom_registrations table
ALTER TABLE zoom_registrations
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS zoom_data_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'zoom_sync',
ADD COLUMN IF NOT EXISTS data_checksum TEXT;

-- Add to webinar_panelists table
ALTER TABLE webinar_panelists
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS zoom_data_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_zoom_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'zoom_sync',
ADD COLUMN IF NOT EXISTS data_checksum TEXT;

-- Add to zoom_webinar_instance_participants table
ALTER TABLE zoom_webinar_instance_participants
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS zoom_data_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_zoom_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'zoom_sync',
ADD COLUMN IF NOT EXISTS data_checksum TEXT;

-- Create index for faster historical data queries
CREATE INDEX IF NOT EXISTS idx_attendees_historical ON attendees(is_historical, last_zoom_sync);
CREATE INDEX IF NOT EXISTS idx_registrations_historical ON zoom_registrations(is_historical, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_panelists_historical ON webinar_panelists(is_historical, last_zoom_sync);

-- Create function to generate data checksum
CREATE OR REPLACE FUNCTION generate_participant_checksum(
  p_name TEXT,
  p_email TEXT,
  p_join_time TIMESTAMP WITH TIME ZONE,
  p_duration_minutes INTEGER,
  p_engagement_score NUMERIC
) RETURNS TEXT AS $$
BEGIN
  RETURN MD5(CONCAT(
    COALESCE(p_name, ''),
    COALESCE(p_email, ''),
    COALESCE(p_join_time::TEXT, ''),
    COALESCE(p_duration_minutes::TEXT, '0'),
    COALESCE(p_engagement_score::TEXT, '0')
  ));
END;
$$ LANGUAGE plpgsql;
