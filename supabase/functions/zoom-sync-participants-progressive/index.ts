
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProgressiveOptions {
  enableLenientBotDetection: boolean;
  enableLenientEmailValidation: boolean;
  maxRetryAttempts: number;
  batchSize: number;
  customFilters?: {
    minDuration?: number;
    allowPartialEmails?: boolean;
  };
}

interface ZoomParticipant {
  id: string
  user_id: string
  user_uuid?: string
  name: string
  user_email: string
  join_time: string
  leave_time: string
  duration: number
  attentiveness_score?: string
  failover?: boolean
  status?: string
}

// Token management functions (reuse from main function)
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
  console.log('Getting Zoom access token for progressive sync...')
  
  const { data: connection, error: connectionError } = await supabaseClient
    .from('zoom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single()

  if (connectionError || !connection) {
    throw new Error('No active Zoom connection found')
  }

  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
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
    throw new Error(`Failed to get access token: ${tokenData.error || tokenData.message}`)
  }

  return tokenData.access_token
}

// Enhanced bot detection with progressive options
function isLikelyBotProgressive(participant: ZoomParticipant, options: ProgressiveOptions): boolean {
  const name = participant.name || ''
  const email = participant.user_email || ''
  
  if (options.enableLenientBotDetection) {
    // Only filter obvious bots
    const obviousBotNames = ['zoom', 'recording', 'system', 'automated']
    const isObviousBot = obviousBotNames.some(indicator => 
      name.toLowerCase().includes(indicator)
    )
    
    // Very short duration AND obvious bot name
    const veryShortDuration = (participant.duration || 0) < 5
    return isObviousBot && veryShortDuration
  }
  
  // Standard bot detection (from original function)
  const botNameIndicators = [
    'bot', 'test', 'zoom', 'recording', 'admin', 'system',
    'automated', 'service', 'api', 'webhook', 'integration'
  ]
  
  const nameHasBotIndicator = botNameIndicators.some(indicator => 
    name.toLowerCase().includes(indicator)
  )
  
  const botEmailIndicators = [
    'test@', 'bot@', 'noreply@', 'system@', 'admin@',
    'donotreply@', 'automated@', 'service@'
  ]
  
  const emailHasBotIndicator = botEmailIndicators.some(indicator =>
    email.toLowerCase().includes(indicator)
  )
  
  const hasLowDuration = (participant.duration || 0) < 10
  
  return (nameHasBotIndicator || emailHasBotIndicator) || 
         (hasLowDuration && (nameHasBotIndicator || emailHasBotIndicator))
}

// Enhanced email validation with progressive options
function isValidEmailProgressive(email: string, options: ProgressiveOptions): boolean {
  if (!email) return false
  
  if (options.enableLenientEmailValidation) {
    // More permissive validation
    if (options.customFilters?.allowPartialEmails) {
      // Allow emails without domains for recovery purposes
      return email.includes('@') || email.length > 3
    }
    
    // Basic email pattern - more lenient
    return /\S+@\S+/.test(email)
  }
  
  // Standard validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Enhanced engagement calculation
function calculateEngagementScoreProgressive(participant: ZoomParticipant, maxDuration: number): number {
  let engagementScore = 0
  
  if (maxDuration > 0 && participant.duration) {
    const durationRatio = Math.min(1, participant.duration / maxDuration)
    engagementScore += durationRatio * 7
    
    if (participant.attentiveness_score) {
      const attentiveness = parseFloat(participant.attentiveness_score)
      if (!isNaN(attentiveness)) {
        engagementScore += Math.min(2, (attentiveness / 100) * 2)
      }
    }
  }
  
  return Math.min(9.99, Math.max(0, Math.round(engagementScore * 100) / 100))
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

    const { 
      organization_id, 
      user_id, 
      webinar_id, 
      zoom_webinar_id, 
      progressive_options 
    } = await req.json()
    
    const options: ProgressiveOptions = progressive_options || {
      enableLenientBotDetection: false,
      enableLenientEmailValidation: false,
      maxRetryAttempts: 3,
      batchSize: 300
    }

    console.log('🚀 Starting progressive participant sync with options:', options)

    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Enhanced logging for diagnostics
    const diagnostics = {
      api_calls_made: 0,
      endpoints_tried: [],
      filtering_stats: {
        total_found: 0,
        bots_filtered: 0,
        invalid_emails: 0,
        validation_errors: 0,
        duplicates_merged: 0,
        stored_successfully: 0
      },
      performance_metrics: {
        start_time: Date.now(),
        api_response_times: [],
        processing_time: 0
      }
    }

    // Try both endpoints with enhanced error handling
    let allParticipants: ZoomParticipant[] = []
    let apiUsed = 'unknown'
    
    for (let attempt = 1; attempt <= options.maxRetryAttempts; attempt++) {
      console.log(`📡 Attempt ${attempt}/${options.maxRetryAttempts}`)
      
      try {
        // Try past webinars endpoint first
        console.log('🔍 Trying past webinars participants endpoint...')
        diagnostics.endpoints_tried.push('past_webinars')
        
        let nextPageToken = ''
        let pageCount = 0
        
        do {
          pageCount++
          const apiStartTime = Date.now()
          
          const params = new URLSearchParams({
            page_size: options.batchSize.toString(),
            include_fields: 'registrant_id,status,join_time,leave_time,duration,attentiveness_score,failover'
          })
          
          if (nextPageToken) {
            params.append('next_page_token', nextPageToken)
          }

          const url = `https://api.zoom.us/v2/past_webinars/${zoom_webinar_id}/participants?${params}`
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })

          diagnostics.api_calls_made++
          diagnostics.performance_metrics.api_response_times.push(Date.now() - apiStartTime)

          if (!response.ok) {
            if (response.status === 404) {
              console.log('ℹ️ No participants found (404)')
              break
            }
            throw new Error(`API error (${response.status})`)
          }

          const data = await response.json()
          const participants = data.participants || []
          allParticipants = allParticipants.concat(participants)
          nextPageToken = data.next_page_token || ''
          
          console.log(`📊 Page ${pageCount}: Found ${participants.length} participants`)
          
          await new Promise(resolve => setTimeout(resolve, 500)) // Rate limiting
          
        } while (nextPageToken && pageCount < 20) // Safety limit

        apiUsed = 'past_webinars'
        console.log(`✅ Success with ${allParticipants.length} participants`)
        break // Success, exit retry loop
        
      } catch (error) {
        console.log(`⚠️ Attempt ${attempt} failed:`, error)
        
        if (attempt === options.maxRetryAttempts) {
          // Try metrics endpoint as final fallback
          console.log('🔄 Trying metrics endpoint as final fallback...')
          diagnostics.endpoints_tried.push('metrics')
          
          try {
            const metricsUrl = `https://api.zoom.us/v2/metrics/webinars/${zoom_webinar_id}/participants`
            const metricsResponse = await fetch(metricsUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            })

            if (metricsResponse.ok) {
              const metricsData = await metricsResponse.json()
              allParticipants = metricsData.participants || []
              apiUsed = 'metrics'
              diagnostics.api_calls_made++
            }
          } catch (metricsError) {
            console.error('❌ Metrics endpoint also failed:', metricsError)
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)) // Exponential backoff
        }
      }
    }

    diagnostics.filtering_stats.total_found = allParticipants.length
    console.log(`🎯 Total participants found: ${allParticipants.length} using ${apiUsed} API`)

    // Enhanced deduplication and processing
    const participantMap = new Map<string, ZoomParticipant>()
    
    for (const participant of allParticipants) {
      const email = participant.user_email?.toLowerCase()?.trim() || `unknown_${participant.id || participant.user_id}`
      
      if (participantMap.has(email)) {
        diagnostics.filtering_stats.duplicates_merged++
        const existing = participantMap.get(email)!
        
        // Merge data intelligently
        if (new Date(participant.join_time) < new Date(existing.join_time)) {
          existing.join_time = participant.join_time
        }
        if (new Date(participant.leave_time) > new Date(existing.leave_time)) {
          existing.leave_time = participant.leave_time
        }
        existing.duration = (existing.duration || 0) + (participant.duration || 0)
      } else {
        participantMap.set(email, { ...participant })
      }
    }

    const deduplicatedParticipants = Array.from(participantMap.values())
    const maxDuration = Math.max(...deduplicatedParticipants.map(p => p.duration || 0))

    // Progressive filtering and storage
    let processedCount = 0
    let errorCount = 0

    for (const participant of deduplicatedParticipants) {
      try {
        const cleanEmail = participant.user_email?.toLowerCase().trim() || ''
        
        // Progressive validation
        const isBot = isLikelyBotProgressive(participant, options)
        const isValidEmail = isValidEmailProgressive(cleanEmail, options)
        
        if (isBot) {
          diagnostics.filtering_stats.bots_filtered++
          continue
        }

        // Apply custom duration filter if specified
        if (options.customFilters?.minDuration && 
            (participant.duration || 0) < options.customFilters.minDuration) {
          continue
        }

        if (!isValidEmail) {
          diagnostics.filtering_stats.invalid_emails++
          continue
        }

        const engagementScore = calculateEngagementScoreProgressive(participant, maxDuration)
        
        const attendeeData = {
          webinar_id,
          organization_id,
          zoom_user_id: participant.user_id || participant.id,
          name: participant.name || 'Unknown Attendee',
          email: cleanEmail,
          join_time: participant.join_time,
          leave_time: participant.leave_time,
          duration_minutes: Math.round((participant.duration || 0) / 60),
          engagement_score: engagementScore,
          updated_at: new Date().toISOString(),
        }

        const { error: upsertError } = await supabaseClient
          .from('attendees')
          .upsert(attendeeData, {
            onConflict: 'webinar_id,email',
            ignoreDuplicates: false,
          })

        if (!upsertError) {
          processedCount++
          diagnostics.filtering_stats.stored_successfully++
        } else {
          errorCount++
          diagnostics.filtering_stats.validation_errors++
        }
        
      } catch (error) {
        errorCount++
        diagnostics.filtering_stats.validation_errors++
      }
    }

    diagnostics.performance_metrics.processing_time = Date.now() - diagnostics.performance_metrics.start_time

    // Update webinar count
    if (processedCount > 0) {
      await supabaseClient
        .from('webinars')
        .update({ 
          attendees_count: processedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', webinar_id)
    }

    console.log(`🎉 Progressive sync completed!`)
    console.log(`📊 Diagnostics:`, diagnostics)

    return new Response(
      JSON.stringify({ 
        success: processedCount > 0,
        participants_synced: processedCount,
        total_found: allParticipants.length,
        after_deduplication: deduplicatedParticipants.length,
        errors: errorCount,
        api_used: apiUsed,
        diagnostics,
        progressive_options: options,
        message: `Progressive sync: ${processedCount} stored, ${diagnostics.filtering_stats.bots_filtered} bots filtered, ${diagnostics.filtering_stats.invalid_emails} invalid emails, ${errorCount} errors`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('💥 Progressive sync error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        participants_synced: 0
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
