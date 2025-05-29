
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getZoomAccessToken } from './auth.ts'
import { processWebinarDataWithQualityFixes } from './webinar-data-processor.ts'
import { fetchWebinarsFromZoom, getWebinarDetails } from './webinar-fetcher.ts'
import { createSyncLog, updateSyncLog, logSyncError } from './sync-logger.ts'
import { processWebinarComprehensiveData } from './data-processor.ts'
import { processWebinarTemplates, linkWebinarToTemplate } from './template-processor.ts'
import { processEnhancedRegistrationData } from './registration-processor.ts'
import { processRecordingAnalytics } from './recording-analytics-processor.ts'
import { processParticipantAnalytics } from './participant-analytics-processor.ts'

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

    console.log('Starting enhanced comprehensive webinar sync for user:', user_id, 'org:', organization_id)

    // Get access token using the new token management
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const syncLog = await createSyncLog(supabaseClient, organization_id, user_id)

    // Step 1: Process webinar templates first
    console.log('Step 1: Processing webinar templates...')
    const templatesResult = await processWebinarTemplates(organization_id, user_id, supabaseClient, accessToken)
    console.log(`Templates processed: ${templatesResult.templatesProcessed || 0}`)

    // Step 2: Fetch webinars from Zoom API
    console.log('Step 2: Fetching webinars from Zoom...')
    const allWebinars = await fetchWebinarsFromZoom(accessToken)

    // Process and store webinars with quality fixes
    let processedCount = 0
    let errorCount = 0
    let qualityFixesApplied = 0
    let enhancedDataCount = 0
    
    for (const zoomWebinar of allWebinars) {
      try {
        console.log(`\n=== Processing webinar: ${zoomWebinar.topic || zoomWebinar.id} ===`)
        
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

          const webinarRecord = result.webinarRecord
          const webinarId = webinarRecord.id

          // Step 3: Link webinar to template source
          await linkWebinarToTemplate(webinarId, detailData, organization_id, supabaseClient)

          // Step 4: Process enhanced registration data
          console.log('Processing enhanced registration data...')
          await processEnhancedRegistrationData(webinarId, detailData.id?.toString(), organization_id, supabaseClient, accessToken)

          // Step 5: Process recording analytics
          console.log('Processing recording analytics...')
          await processRecordingAnalytics(webinarId, detailData.id?.toString(), organization_id, supabaseClient, accessToken)

          // Step 6: Process participant analytics
          console.log('Processing participant analytics...')
          await processParticipantAnalytics(webinarId, detailData.id?.toString(), organization_id, supabaseClient, accessToken)

          // Step 7: Process comprehensive settings data (existing functionality)
          await processWebinarComprehensiveData(
            detailData, 
            webinarRecord.id, 
            organization_id, 
            supabaseClient, 
            accessToken
          )

          enhancedDataCount++

          // Create detailed sync job for this webinar
          await supabaseClient
            .from('sync_jobs')
            .insert({
              organization_id,
              user_id,
              job_type: 'enhanced_comprehensive_sync',
              status: 'pending',
              metadata: {
                webinar_zoom_id: detailData.id?.toString(),
                organization_id,
                user_id,
                enhanced_features: [
                  'templates',
                  'registration_analytics',
                  'recording_analytics', 
                  'participant_analytics',
                  'source_tracking'
                ],
                created_by: 'enhanced_comprehensive_webinar_sync'
              }
            })

          if (processedCount % 5 === 0) {
            console.log(`\n📊 Progress: ${processedCount} webinars processed with enhanced data collection...`)
          }
        } else {
          console.error('Error processing webinar:', result.error)
          errorCount++
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        errorCount++
      }
    }

    console.log(`\n🎉 Enhanced comprehensive webinar sync completed!`)
    console.log(`📈 Results:`)
    console.log(`  - ${processedCount} webinars processed`)
    console.log(`  - ${qualityFixesApplied} webinars with quality fixes applied`)
    console.log(`  - ${enhancedDataCount} webinars with enhanced analytics`)
    console.log(`  - ${templatesResult.templatesProcessed || 0} templates processed`)
    console.log(`  - ${errorCount} errors encountered`)

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
        enhanced_data_processed: enhancedDataCount,
        templates_processed: templatesResult.templatesProcessed || 0,
        errors: errorCount,
        comprehensive_data: true,
        enhanced_features: [
          'webinar_templates',
          'registration_analytics', 
          'recording_analytics',
          'participant_analytics',
          'source_tracking'
        ],
        detailed_jobs_created: processedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Enhanced comprehensive webinar sync error:', error)
    
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
