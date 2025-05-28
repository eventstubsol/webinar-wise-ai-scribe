
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getZoomAccessToken } from './auth.ts'
import { processWebinarDataWithQualityFixes } from './webinar-data-processor.ts'
import { fetchWebinarsFromZoom, getWebinarDetails } from './webinar-fetcher.ts'
import { createSyncLog, updateSyncLog, logSyncError } from './sync-logger.ts'
import { processWebinarComprehensiveData } from './data-processor.ts'

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

    const { organization_id, user_id } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting enhanced webinar sync with quality fixes for user:', user_id, 'org:', organization_id)

    // Get access token using the new token management
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const syncLog = await createSyncLog(supabaseClient, organization_id, user_id)

    // Fetch webinars from Zoom API
    const allWebinars = await fetchWebinarsFromZoom(accessToken)

    // Process and store webinars with quality fixes
    let processedCount = 0
    let errorCount = 0
    let qualityFixesApplied = 0
    
    for (const zoomWebinar of allWebinars) {
      try {
        // Get detailed webinar info
        const detailData = await getWebinarDetails(zoomWebinar.id, accessToken)
        
        // Process with quality fixes
        const result = await processWebinarDataWithQualityFixes(
          zoomWebinar,
          detailData,
          organization_id,
          user_id,
          supabaseClient,
          accessToken
        )

        if (result.success) {
          processedCount++
          if (result.qualityFixes) {
            qualityFixesApplied++
          }

          // Process comprehensive settings data
          await processWebinarComprehensiveData(
            detailData, 
            result.webinarRecord.id, 
            organization_id, 
            supabaseClient, 
            accessToken
          )

          // Determine sync types based on webinar status
          const baseSync = ['participants', 'registrations', 'polls', 'qa']
          let syncTypes = [...baseSync]
          
          // Check if webinar is completed and should include chat
          const isCompleted = detailData.status === 'ended' || 
                             result.webinarRecord.status === 'completed' ||
                             (result.webinarRecord.start_time && 
                              new Date(result.webinarRecord.start_time) < new Date(Date.now() - 24 * 60 * 60 * 1000))

          if (isCompleted) {
            syncTypes.push('chat')
            console.log(`Adding chat sync for completed webinar: ${detailData.id}`)
            
            // Update webinar status to completed if it should be
            if (result.webinarRecord.status !== 'completed') {
              await supabaseClient
                .from('webinars')
                .update({ status: 'completed' })
                .eq('id', result.webinarRecord.id)
              
              console.log(`Updated webinar ${result.webinarRecord.id} status to completed`)
            }
          }

          // Create job with COMPLETE metadata structure
          const jobMetadata = {
            webinar_zoom_id: detailData.id?.toString(),
            webinar_id: result.webinarRecord.id, // CRITICAL: Include webinar_id
            organization_id, // Include for redundancy
            user_id, // Include for redundancy
            sync_types: syncTypes,
            webinar_status: isCompleted ? 'completed' : result.webinarRecord.status,
            webinar_title: result.webinarRecord.title,
            is_completed: isCompleted,
            created_by: 'enhanced_webinar_sync',
            scheduled_at: new Date().toISOString(),
            has_chat_sync: syncTypes.includes('chat')
          }

          console.log(`Creating job for webinar ${detailData.id} with metadata:`, jobMetadata)

          await supabaseClient
            .from('sync_jobs')
            .insert({
              organization_id,
              user_id,
              job_type: 'detailed_webinar_sync',
              status: 'pending',
              metadata: jobMetadata
            })

          console.log(`Created sync job for webinar ${detailData.id} with sync types: ${syncTypes.join(', ')}`)

          if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount} webinars with quality fixes...`)
          }
        } else {
          console.error('Error processing webinar:', result.error)
          errorCount++
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        errorCount++
      }
    }

    console.log(`Enhanced webinar sync completed: ${processedCount} processed, ${qualityFixesApplied} with quality fixes, ${errorCount} errors`)

    // Update sync log
    if (syncLog?.id) {
      await updateSyncLog(supabaseClient, syncLog.id, processedCount, errorCount)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        webinars_synced: processedCount,
        total_found: allWebinars.length,
        quality_fixes_applied: qualityFixesApplied,
        errors: errorCount,
        comprehensive_data: true,
        detailed_jobs_created: processedCount,
        jobs_with_chat_sync: allWebinars.filter((_, i) => i < processedCount).length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Enhanced webinar sync error:', error)
    
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
