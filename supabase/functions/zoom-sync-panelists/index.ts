
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomPanelist {
  id: string
  email: string
  name?: string
  join_url?: string
  virtual_background_id?: string
}

interface ZoomPanelistParticipation {
  id: string
  email: string
  name: string
  join_time?: string
  leave_time?: string
  duration?: number
  status: string
}

async function fetchPanelistsFromZoom(webinarId: string, accessToken: string): Promise<ZoomPanelist[]> {
  const response = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/panelists`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      console.log(`No panelists found for webinar ${webinarId}`)
      return []
    }
    const error = await response.json()
    throw new Error(`Failed to fetch panelists: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  return data.panelists || []
}

async function fetchPanelistParticipationFromZoom(webinarId: string, accessToken: string): Promise<ZoomPanelistParticipation[]> {
  const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/panelists`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      console.log(`No panelist participation data found for webinar ${webinarId}`)
      return []
    }
    const error = await response.json()
    throw new Error(`Failed to fetch panelist participation: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  return data.panelists || []
}

async function processPanelistData(
  webinarId: string, 
  organizationId: string, 
  panelists: ZoomPanelist[], 
  participation: ZoomPanelistParticipation[],
  supabaseClient: any
) {
  console.log(`Processing ${panelists.length} panelists and ${participation.length} participation records`)

  // Create a map of participation data by email for easy lookup
  const participationMap = new Map()
  participation.forEach(p => {
    participationMap.set(p.email, p)
  })

  for (const panelist of panelists) {
    try {
      const participationData = participationMap.get(panelist.email)
      
      // Calculate duration in minutes
      let durationMinutes = 0
      if (participationData?.duration) {
        durationMinutes = Math.round(participationData.duration / 60)
      }

      // Determine status
      let status = 'invited'
      if (participationData) {
        status = participationData.join_time ? 'joined' : 'invited'
      }

      const panelistRecord = {
        webinar_id: webinarId,
        organization_id: organizationId,
        zoom_panelist_id: panelist.id,
        email: panelist.email,
        name: panelist.name || participationData?.name,
        join_url: panelist.join_url,
        virtual_background_id: panelist.virtual_background_id,
        status,
        invited_at: new Date().toISOString(),
        joined_at: participationData?.join_time || null,
        left_at: participationData?.leave_time || null,
        duration_minutes: durationMinutes,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabaseClient
        .from('webinar_panelists')
        .upsert(panelistRecord, {
          onConflict: 'webinar_id,zoom_panelist_id',
        })

      if (error) {
        console.error(`Error upserting panelist ${panelist.email}:`, error)
      } else {
        console.log(`  - Processed panelist: ${panelist.email}`)
      }

    } catch (error) {
      console.error(`Error processing panelist ${panelist.email}:`, error)
    }
  }
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

    const { webinar_id, organization_id, access_token } = await req.json()
    
    if (!webinar_id || !organization_id || !access_token) {
      throw new Error('Webinar ID, Organization ID, and Access Token are required')
    }

    console.log('Starting panelist sync for webinar:', webinar_id)

    // Fetch panelist data from Zoom
    const [panelists, participation] = await Promise.allSettled([
      fetchPanelistsFromZoom(webinar_id, access_token),
      fetchPanelistParticipationFromZoom(webinar_id, access_token)
    ])

    const panelistData = panelists.status === 'fulfilled' ? panelists.value : []
    const participationData = participation.status === 'fulfilled' ? participation.value : []

    if (panelists.status === 'rejected') {
      console.warn('Failed to fetch panelists:', panelists.reason)
    }
    if (participation.status === 'rejected') {
      console.warn('Failed to fetch participation:', participation.reason)
    }

    // Process and store panelist data
    await processPanelistData(webinar_id, organization_id, panelistData, participationData, supabaseClient)

    console.log(`Panelist sync completed: ${panelistData.length} panelists processed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        panelists_synced: panelistData.length,
        participation_records: participationData.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Panelist sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
