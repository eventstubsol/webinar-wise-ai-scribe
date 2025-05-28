import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ZoomRateLimiter, DEFAULT_CONFIG } from './rate-limiter.ts'
import { getZoomAccessToken } from './auth.ts'
import { fetchWebinarsFromZoom, processWebinarDetails } from './webinar-processor.ts'
import { syncDetailedData } from './detailed-sync.ts'

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

    const { organization_id, user_id, config = DEFAULT_CONFIG, days_back = 180 } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log(`Starting comprehensive rate-limited sync for user: ${user_id}, fetching ${days_back} days back`)

    const rateLimiter = new ZoomRateLimiter()
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Create master sync job
    const { data: syncJob } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_rate_limited_sync',
        status: 'running',
        metadata: { 
          started_at: new Date().toISOString(),
          config,
          days_back
        }
      })
      .select()
      .single()

    console.log('Created comprehensive sync job:', syncJob?.id)

    // Stage 1: Fetch webinars with rate limiting and extended date range
    console.log(`Stage 1: Fetching webinars from ${days_back} days back...`)
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 10, 
        metadata: { 
          ...syncJob?.metadata, 
          current_stage: 'webinars',
          stage_message: `Fetching webinar list for past ${days_back} days...`
        }
      })
      .eq('id', syncJob?.id)

    const allWebinars = await fetchWebinarsFromZoom(accessToken, rateLimiter, config, days_back)

    // Stage 2: Process webinar details with rate limiting
    console.log('Stage 2: Processing webinar details...')
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 20,
        total_items: allWebinars.length,
        metadata: { 
          ...syncJob?.metadata, 
          current_stage: 'webinar_details',
          stage_message: `Processing ${allWebinars.length} webinars...`,
          webinars_found: allWebinars.length
        }
      })
      .eq('id', syncJob?.id)

    const { successfulWebinars } = await processWebinarDetails(
      allWebinars,
      accessToken,
      rateLimiter,
      config,
      organization_id,
      user_id,
      supabaseClient,
      syncJob
    )

    // Stage 3: Sync detailed data for recent webinars
    const recentWebinars = allWebinars.slice(0, 10) // Sync detailed data for 10 most recent
    
    await syncDetailedData(
      recentWebinars,
      rateLimiter,
      config,
      supabaseClient,
      organization_id,
      user_id,
      syncJob
    )

    // Final update
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          webinars_synced: successfulWebinars.length,
          webinars_found: allWebinars.length,
          detailed_sync_count: recentWebinars.length,
          api_requests_made: rateLimiter.requestCount,
          days_back,
          rate_limit_hits: 0 // TODO: Track this
        }
      })
      .eq('id', syncJob?.id)

    console.log('Comprehensive rate-limited sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary: {
          webinars_synced: successfulWebinars.length,
          webinars_found: allWebinars.length,
          detailed_sync_count: recentWebinars.length,
          api_requests_made: rateLimiter.requestCount,
          days_back,
          rate_limit_hits: 0 // TODO: Track this
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Comprehensive sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
