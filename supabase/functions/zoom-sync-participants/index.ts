
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

// Token management functions (same as webinars sync)
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    )
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credential')
  }
}

async function getZoomAccessToken(userId: string, supabaseClient: any): Promise<string> {
  console.log('Getting Zoom access token for user:', userId)
  
  const { data: connection, error: connectionError } = await supabaseClient
    .from('zoom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single()

  if (connectionError || !connection) {
    console.error('No active Zoom connection found:', connectionError)
    throw new Error('No active Zoom connection found')
  }

  if (!connection.encrypted_client_id || !connection.encrypted_client_secret) {
    throw new Error('Zoom credentials not found')
  }

  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
  try {
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=account_credentials&account_id=' + encodeURIComponent(await decryptCredential(connection.encrypted_account_id, encryptionKey)),
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('Token request failed:', tokenData)
      throw new Error(`Failed to get access token: ${tokenData.error || tokenData.message}`)
    }

    return tokenData.access_token
    
  } catch (error) {
    console.error('Error getting access token:', error)
    throw error
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

    const { organization_id, user_id, webinar_id, zoom_webinar_id } = await req.json()
    
    if (!organization_id || !zoom_webinar_id || !user_id) {
      throw new Error('Organization ID, User ID, and Zoom webinar ID are required')
    }

    console.log('Starting participant sync for webinar:', zoom_webinar_id, 'user:', user_id)

    // Get access token using the new token management
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        user_id,
        webinar_id,
        sync_type: 'participants',
        status: 'started',
      })
      .select()
      .single()

    console.log('Created sync log:', syncLog?.id)

    // Fetch participants from Zoom API
    let allParticipants: ZoomParticipant[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching page ${pageCount} of participants...`)
      
      const params = new URLSearchParams({
        page_size: '300',
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      const response = await fetch(`https://api.zoom.us/v2/metrics/webinars/${zoom_webinar_id}/participants?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Zoom API error:', data)
        throw new Error(`Zoom API error: ${data.message || data.error}`)
      }

      const participants = data.participants || []
      allParticipants = allParticipants.concat(participants)
      nextPageToken = data.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${participants.length} participants`)
      
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } while (nextPageToken && pageCount < 10) // Safety limit

    console.log(`Total participants found: ${allParticipants.length}`)

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
    let errorCount = 0
    
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
            if (processedCount % 25 === 0) {
              console.log(`Processed ${processedCount} participants...`)
            }
          } else {
            console.error('Error upserting participant:', upsertError)
            errorCount++
          }
        } else {
          console.log(`Filtered out participant: ${participant.name} (${cleanEmail}) - Bot: ${isLikelyBot}, Valid email: ${isValidEmail}`)
        }
        
      } catch (error) {
        console.error(`Error processing participant ${participant.id}:`, error)
        errorCount++
      }
    }

    console.log(`Participant sync completed: ${processedCount} processed, ${errorCount} errors`)

    // Update attendee count in webinar
    if (webinar_id && processedCount > 0) {
      await supabaseClient
        .from('webinars')
        .update({ attendees_count: processedCount })
        .eq('id', webinar_id)
    }

    // Update sync log
    const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
    const errorMessage = errorCount > 0 ? `${errorCount} participants failed to process` : null
    
    await supabaseClient
      .from('sync_logs')
      .update({
        status: syncStatus,
        records_processed: processedCount,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        participants_synced: processedCount,
        total_found: allParticipants.length,
        after_deduplication: deduplicatedParticipants.length,
        errors: errorCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Participant sync error:', error)
    
    // Try to update sync log with error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { user_id, webinar_id } = await req.json().catch(() => ({}))
      
      if (user_id) {
        await supabaseClient
          .from('sync_logs')
          .insert({
            organization_id: 'unknown',
            user_id,
            webinar_id,
            sync_type: 'participants',
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
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
