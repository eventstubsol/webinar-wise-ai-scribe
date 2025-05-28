import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomParticipant {
  id: string
  user_id: string
  name: string
  user_email: string
  join_time: string
  leave_time: string
  duration: number
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

    const { organization_id, webinar_id, zoom_webinar_id } = await req.json()
    
    if (!organization_id || !zoom_webinar_id) {
      throw new Error('Organization ID and Zoom webinar ID are required')
    }

    // Get organization's Zoom tokens
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('zoom_access_token')
      .eq('id', organization_id)
      .single()

    if (orgError || !org?.zoom_access_token) {
      throw new Error('Organization not connected to Zoom')
    }

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        webinar_id,
        sync_type: 'participants',
        status: 'started',
      })
      .select()
      .single()

    // Fetch participants from Zoom API
    let allParticipants: ZoomParticipant[] = []
    let nextPageToken = ''
    
    do {
      const params = new URLSearchParams({
        page_size: '300',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/metrics/webinars/${zoom_webinar_id}/participants?${params}`, {
        headers: {
          'Authorization': `Bearer ${org.zoom_access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`Zoom API error: ${data.message || data.error}`)
      }

      allParticipants = allParticipants.concat(data.participants || [])
      nextPageToken = data.next_page_token || ''
      
    } while (nextPageToken)

    console.log(`Found ${allParticipants.length} participants for webinar ${zoom_webinar_id}`)

    // Process and deduplicate participants by email
    const participantMap = new Map<string, ZoomParticipant>()
    
    for (const participant of allParticipants) {
      const email = participant.user_email?.toLowerCase() || `unknown_${participant.id}`
      const existing = participantMap.get(email)
      
      if (!existing || new Date(participant.join_time) < new Date(existing.join_time)) {
        // Keep the earliest join time for the same email
        participantMap.set(email, {
          ...participant,
          duration: existing ? existing.duration + participant.duration : participant.duration
        })
      } else if (existing) {
        // Aggregate duration for multiple sessions
        existing.duration += participant.duration
      }
    }

    const deduplicatedParticipants = Array.from(participantMap.values())
    console.log(`After deduplication: ${deduplicatedParticipants.length} unique participants`)

    // Calculate engagement scores and store participants
    let processedCount = 0
    
    for (const participant of deduplicatedParticipants) {
      try {
        // Simple engagement score calculation (0-10 based on duration)
        const maxDuration = Math.max(...deduplicatedParticipants.map(p => p.duration))
        const engagementScore = maxDuration > 0 ? Math.min(10, (participant.duration / maxDuration) * 10) : 0

        // Clean and validate email
        const cleanEmail = participant.user_email?.toLowerCase().trim() || ''
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        
        // Bot detection (simple heuristics)
        const isLikelyBot = 
          participant.name?.toLowerCase().includes('bot') ||
          participant.name?.toLowerCase().includes('test') ||
          participant.duration < 30 // Less than 30 seconds

        if (isValidEmail && !isLikelyBot) {
          const { error: upsertError } = await supabaseClient
            .from('attendees')
            .upsert({
              webinar_id,
              organization_id,
              zoom_user_id: participant.user_id,
              name: participant.name,
              email: cleanEmail,
              join_time: participant.join_time,
              leave_time: participant.leave_time,
              duration_minutes: Math.round(participant.duration / 60),
              engagement_score: Math.round(engagementScore * 10) / 10, // Round to 1 decimal
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'webinar_id,email',
            })

          if (!upsertError) {
            processedCount++
          } else {
            console.error('Error upserting participant:', upsertError)
          }
        } else {
          console.log(`Filtered out participant: ${participant.name} (${cleanEmail}) - Bot: ${isLikelyBot}, Valid email: ${isValidEmail}`)
        }
        
      } catch (error) {
        console.error(`Error processing participant ${participant.id}:`, error)
      }
    }

    // Update attendee count in webinar
    await supabaseClient
      .from('webinars')
      .update({ attendees_count: processedCount })
      .eq('id', webinar_id)

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
        participants_synced: processedCount,
        total_found: allParticipants.length,
        after_deduplication: deduplicatedParticipants.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Participant sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
