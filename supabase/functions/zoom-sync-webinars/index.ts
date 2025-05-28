
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getZoomAccessToken } from './auth.ts'
import { mapZoomStatusToOurs } from './status-mapper.ts'
import { processWebinarComprehensiveData } from './data-processor.ts'
import { fetchWebinarsFromZoom, getWebinarDetails } from './webinar-fetcher.ts'
import { createSyncLog, updateSyncLog, logSyncError } from './sync-logger.ts'
import { ZoomWebinar } from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id, days_back = 180 } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log(`Starting comprehensive webinar sync for user: ${user_id}, org: ${organization_id}, fetching ${days_back} days back`)

    // Get access token using the new token management
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const syncLog = await createSyncLog(supabaseClient, organization_id, user_id)

    // Fetch webinars from Zoom API with extended date range
    const allWebinars = await fetchWebinarsFromZoom(accessToken, days_back)

    // Process and store webinars with comprehensive data
    let processedCount = 0
    let errorCount = 0
    
    for (const zoomWebinar of allWebinars) {
      try {
        // Get detailed webinar info including comprehensive settings
        const detailData = await getWebinarDetails(zoomWebinar.id, accessToken)
        
        // Map Zoom status to our status
        const webinarStatus = mapZoomStatusToOurs(detailData)
        
        // Upsert main webinar data with status
        const { data: webinarRecord, error: upsertError } = await supabaseClient
          .from('webinars')
          .upsert({
            zoom_webinar_id: detailData.id?.toString(),
            organization_id,
            user_id,
            title: detailData.topic,
            host_name: detailData.host_email || zoomWebinar.host_email,
            host_id: detailData.host_id,
            uuid: detailData.uuid,
            start_time: detailData.start_time || zoomWebinar.start_time,
            duration_minutes: detailData.duration || zoomWebinar.duration,
            registrants_count: detailData.registrants_count || 0,
            join_url: detailData.join_url,
            password: detailData.password,
            encrypted_passcode: detailData.encrypted_passcode,
            h323_passcode: detailData.h323_passcode,
            start_url: detailData.start_url,
            timezone: detailData.timezone,
            agenda: detailData.agenda,
            created_at_zoom: detailData.created_at,
            webinar_number: detailData.id,
            is_simulive: detailData.is_simulive || false,
            record_file_id: detailData.record_file_id,
            transition_to_live: detailData.transition_to_live || false,
            creation_source: detailData.creation_source,
            webinar_type: detailData.type?.toString() || 'past',
            status: webinarStatus, // Set the mapped status
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'zoom_webinar_id',
          })
          .select()
          .single()

        if (!upsertError && webinarRecord) {
          // Process comprehensive settings data with proper error handling
          await processWebinarComprehensiveData(detailData, webinarRecord.id, organization_id, supabaseClient)
          processedCount++
          
          if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount} webinars with comprehensive data...`)
          }
        } else {
          console.error('Error upserting webinar:', upsertError)
          errorCount++
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        errorCount++
      }
    }

    console.log(`Comprehensive webinar sync completed: ${processedCount} processed, ${errorCount} errors`)

    // Update sync log
    if (syncLog?.id) {
      await updateSyncLog(supabaseClient, syncLog.id, processedCount, errorCount)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        webinars_synced: processedCount,
        total_found: allWebinars.length,
        errors: errorCount,
        days_back,
        comprehensive_data: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Comprehensive webinar sync error:', error)
    
    // Try to update sync log with error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { user_id } = await req.json().catch(() => ({}))
      
      if (user_id) {
        await logSyncError(supabaseClient, user_id, error.message)
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
