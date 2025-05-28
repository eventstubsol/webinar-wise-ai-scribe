
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomWebinar {
  id: string
  topic: string
  host_id: string
  host_email: string
  start_time: string
  duration: number
  join_url: string
  registrants_count?: number
  created_at: string
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

    const { organization_id } = await req.json()
    
    if (!organization_id) {
      throw new Error('Organization ID is required')
    }

    // Get organization's Zoom tokens
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('zoom_access_token, zoom_refresh_token, zoom_token_expires_at')
      .eq('id', organization_id)
      .single()

    if (orgError || !org?.zoom_access_token) {
      throw new Error('Organization not connected to Zoom')
    }

    // Check if token needs refresh
    let accessToken = org.zoom_access_token
    if (org.zoom_token_expires_at && new Date(org.zoom_token_expires_at) <= new Date()) {
      // Refresh token logic would go here
      console.log('Token expired, refresh logic needed')
    }

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        sync_type: 'webinars',
        status: 'started',
      })
      .select()
      .single()

    // Fetch webinars from Zoom API
    let allWebinars: ZoomWebinar[] = []
    let nextPageToken = ''
    
    do {
      const params = new URLSearchParams({
        page_size: '300',
        type: 'past',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`Zoom API error: ${data.message || data.error}`)
      }

      allWebinars = allWebinars.concat(data.webinars || [])
      nextPageToken = data.next_page_token || ''
      
    } while (nextPageToken)

    console.log(`Found ${allWebinars.length} webinars`)

    // Process and store webinars
    let processedCount = 0
    
    for (const zoomWebinar of allWebinars) {
      try {
        // Get detailed webinar info
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        const detailData = await detailResponse.json()
        
        if (detailResponse.ok) {
          // Upsert webinar data
          const { error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: zoomWebinar.id,
              organization_id,
              title: zoomWebinar.topic,
              host_name: detailData.host_email || zoomWebinar.host_email,
              start_time: zoomWebinar.start_time,
              duration_minutes: zoomWebinar.duration,
              registrants_count: detailData.registrants_count || 0,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id,organization_id',
            })

          if (!upsertError) {
            processedCount++
          } else {
            console.error('Error upserting webinar:', upsertError)
          }
        }
        
        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
      }
    }

    // Update sync log
    await supabaseClient
      .from('sync_logs')
      .update({
        status: 'completed',
        records_processed: processedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        webinars_synced: processedCount,
        total_found: allWebinars.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
