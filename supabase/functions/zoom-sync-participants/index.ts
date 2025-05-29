import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Enhanced recovery statistics tracking
interface RecoveryStats {
  total_api_calls: number
  total_pages_processed: number
  participants_found: number
  participants_after_dedup: number
  participants_stored: number
  bots_filtered: number
  invalid_emails_filtered: number
  validation_errors: number
  database_errors: number
  endpoints_tried: string[]
  success_endpoint: string
}

// Token management functions
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
  console.log('Getting Zoom access token for aggressive recovery...')
  
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

// Enhanced fetch with aggressive pagination and retry logic
async function fetchParticipantsAggressively(url: string, accessToken: string, maxRetries = 5): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Aggressive fetch (attempt ${attempt}/${maxRetries}): ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 429) {
          // Exponential backoff for rate limiting
          const waitTime = Math.pow(2, attempt) * 3000
          console.log(`⏸️ Rate limited, waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        if (response.status === 404) {
          console.log('ℹ️ No participants found (404) - this is normal for some webinars')
          return { participants: [], total_records: 0 }
        }
        
        throw new Error(`Zoom API error (${response.status}): ${data.message || data.error}`)
      }

      console.log(`✅ Successfully fetched participants data (${data.participants?.length || 0} participants)`)
      return data
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Progressive wait time
      const waitTime = Math.pow(2, attempt) * 1500
      console.log(`⏸️ Waiting ${waitTime}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}

// Enhanced engagement score calculation with strict bounds
function calculateEngagementScoreSafe(participant: ZoomParticipant, maxDuration: number): number {
  let engagementScore = 0
  
  if (maxDuration > 0 && participant.duration) {
    // Base score from duration (0-7 points)
    const durationRatio = Math.min(1, participant.duration / maxDuration)
    engagementScore += durationRatio * 7
    
    // Bonus for attentiveness score (0-2 points)
    if (participant.attentiveness_score) {
      const attentiveness = parseFloat(participant.attentiveness_score)
      if (!isNaN(attentiveness) && attentiveness >= 0 && attentiveness <= 100) {
        engagementScore += Math.min(2, (attentiveness / 100) * 2)
      }
    }
  }
  
  // CRITICAL: Ensure score never exceeds database constraint (9.99)
  const finalScore = Math.min(9.99, Math.max(0, engagementScore))
  const roundedScore = Math.round(finalScore * 100) / 100
  
  console.log(`📊 Safe engagement: ${participant.name}: duration=${participant.duration}s, max=${maxDuration}s, attentiveness=${participant.attentiveness_score}, final=${roundedScore}`)
  
  return roundedScore
}

// Lenient bot detection for maximum data recovery
function isLikelyBotLenient(participant: ZoomParticipant): boolean {
  const name = participant.name || ''
  const email = participant.user_email || ''
  
  // Only filter OBVIOUS bots to maximize data recovery
  const obviousBotIndicators = [
    'zoom recorder', 'zoom recording', 'system test', 'api test',
    'webhook test', 'automated system', 'bot test'
  ]
  
  const isObviousBot = obviousBotIndicators.some(indicator => 
    name.toLowerCase().includes(indicator) || email.toLowerCase().includes(indicator)
  )
  
  // Only filter if BOTH obvious bot indicator AND extremely short duration (< 3 seconds)
  const extremelyShortDuration = (participant.duration || 0) < 3
  const shouldFilter = isObviousBot && extremelyShortDuration
  
  if (shouldFilter) {
    console.log(`🤖 Filtered obvious bot: ${name} (${email}) - duration: ${participant.duration}s`)
  }
  
  return shouldFilter
}

// Enhanced email validation with lenient mode
function isValidEmailLenient(email: string): boolean {
  if (!email || email.trim() === '') return false
  
  // Very lenient validation - just needs @ symbol and some text
  const basicEmailPattern = /.+@.+/
  const isValid = basicEmailPattern.test(email.trim())
  
  if (!isValid) {
    console.log(`📧 Invalid email filtered: "${email}"`)
  }
  
  return isValid
}

// Enhanced data sanitization
function sanitizeParticipantData(participant: ZoomParticipant): any {
  return {
    zoom_user_id: (participant.user_id || participant.id || '').substring(0, 255),
    name: (participant.name || 'Unknown Attendee').substring(0, 255),
    email: (participant.user_email || '').toLowerCase().trim().substring(0, 255),
    join_time: participant.join_time,
    leave_time: participant.leave_time,
    duration_minutes: Math.max(0, Math.round((participant.duration || 0) / 60)),
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

    console.log('🚀 Starting AGGRESSIVE participant recovery for webinar:', zoom_webinar_id)

    // Initialize recovery statistics
    const recoveryStats: RecoveryStats = {
      total_api_calls: 0,
      total_pages_processed: 0,
      participants_found: 0,
      participants_after_dedup: 0,
      participants_stored: 0,
      bots_filtered: 0,
      invalid_emails_filtered: 0,
      validation_errors: 0,
      database_errors: 0,
      endpoints_tried: [],
      success_endpoint: ''
    }

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        user_id,
        webinar_id,
        sync_type: 'participants_aggressive',
        status: 'started',
      })
      .select()
      .single()

    console.log('📝 Created aggressive sync log:', syncLog?.id)

    // PHASE 1: AGGRESSIVE MULTI-ENDPOINT STRATEGY
    let allParticipants: ZoomParticipant[] = []
    let successfulEndpoint = ''
    
    // Strategy 1: Past webinars endpoint with maximum pagination
    try {
      console.log('🔍 Strategy 1: Aggressive past webinars participants endpoint...')
      recoveryStats.endpoints_tried.push('past_webinars')
      
      let nextPageToken = ''
      let pageCount = 0
      const maxPages = 200 // Increased safety limit
      
      do {
        pageCount++
        console.log(`📄 Aggressive pagination - Page ${pageCount}/${maxPages}...`)
        
        const params = new URLSearchParams({
          page_size: '1000', // MAXIMUM page size
          include_fields: 'registrant_id,status,join_time,leave_time,duration,attentiveness_score,failover'
        })
        
        if (nextPageToken) {
          params.append('next_page_token', nextPageToken)
        }

        const url = `https://api.zoom.us/v2/past_webinars/${zoom_webinar_id}/participants?${params}`
        const data = await fetchParticipantsAggressively(url, accessToken)
        
        recoveryStats.total_api_calls++
        recoveryStats.total_pages_processed++
        
        const participants = data.participants || []
        allParticipants = allParticipants.concat(participants)
        nextPageToken = data.next_page_token || ''
        
        console.log(`📊 Page ${pageCount}: Found ${participants.length} participants (Total: ${allParticipants.length})`)
        
        // Minimal delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } while (nextPageToken && pageCount < maxPages)

      successfulEndpoint = 'past_webinars'
      recoveryStats.participants_found = allParticipants.length
      console.log(`✅ Past webinars strategy successful: ${allParticipants.length} participants found`)
      
    } catch (pastWebinarError) {
      console.log('⚠️ Past webinars endpoint failed, trying metrics endpoint...')
      console.error('Past webinar error:', pastWebinarError)
      
      // Strategy 2: Metrics endpoint as fallback
      try {
        console.log('🔍 Strategy 2: Metrics endpoint with aggressive pagination...')
        recoveryStats.endpoints_tried.push('metrics')
        allParticipants = [] // Reset
        
        let nextPageToken = ''
        let pageCount = 0
        const maxPages = 200
        
        do {
          pageCount++
          console.log(`📄 Metrics pagination - Page ${pageCount}/${maxPages}...`)
          
          const params = new URLSearchParams({
            page_size: '1000', // MAXIMUM page size
          })
          
          if (nextPageToken) {
            params.append('next_page_token', nextPageToken)
          }

          const url = `https://api.zoom.us/v2/metrics/webinars/${zoom_webinar_id}/participants?${params}`
          const data = await fetchParticipantsAggressively(url, accessToken)
          
          recoveryStats.total_api_calls++
          recoveryStats.total_pages_processed++
          
          const participants = data.participants || []
          allParticipants = allParticipants.concat(participants)
          nextPageToken = data.next_page_token || ''
          
          console.log(`📊 Metrics Page ${pageCount}: Found ${participants.length} participants (Total: ${allParticipants.length})`)
          
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } while (nextPageToken && pageCount < maxPages)

        successfulEndpoint = 'metrics'
        recoveryStats.participants_found = allParticipants.length
        console.log(`✅ Metrics strategy successful: ${allParticipants.length} participants found`)
        
      } catch (metricsError) {
        console.error('❌ Both strategies failed:', { pastWebinarError, metricsError })
        throw new Error(`Failed to fetch participants from both endpoints: ${pastWebinarError.message} | ${metricsError.message}`)
      }
    }

    recoveryStats.success_endpoint = successfulEndpoint
    console.log(`🎯 TOTAL PARTICIPANTS FOUND: ${allParticipants.length} using ${successfulEndpoint} API`)

    // PHASE 2: ENHANCED DEDUPLICATION WITH INTELLIGENT MERGING
    const participantMap = new Map<string, ZoomParticipant>()
    let duplicatesFound = 0
    
    for (const participant of allParticipants) {
      const email = participant.user_email?.toLowerCase()?.trim() || `unknown_${participant.id || participant.user_id}_${Date.now()}`
      
      if (participantMap.has(email)) {
        duplicatesFound++
        const existing = participantMap.get(email)!
        
        // Intelligent merging - keep best data from both records
        existing.join_time = new Date(participant.join_time) < new Date(existing.join_time) ? participant.join_time : existing.join_time
        existing.leave_time = new Date(participant.leave_time) > new Date(existing.leave_time) ? participant.leave_time : existing.leave_time
        existing.duration = Math.max(existing.duration || 0, participant.duration || 0)
        existing.name = existing.name || participant.name
        existing.attentiveness_score = existing.attentiveness_score || participant.attentiveness_score
      } else {
        participantMap.set(email, { ...participant })
      }
    }

    const deduplicatedParticipants = Array.from(participantMap.values())
    recoveryStats.participants_after_dedup = deduplicatedParticipants.length
    console.log(`🔄 After intelligent deduplication: ${deduplicatedParticipants.length} unique participants (${duplicatesFound} duplicates merged)`)

    // Calculate max duration for engagement scoring
    const maxDuration = Math.max(...deduplicatedParticipants.map(p => p.duration || 0))
    console.log(`📏 Max webinar duration: ${maxDuration} seconds`)

    // PHASE 3: LENIENT FILTERING AND ROBUST STORAGE
    let processedCount = 0
    const processingErrors: string[] = []
    
    for (const participant of deduplicatedParticipants) {
      try {
        // Lenient filtering
        const isBot = isLikelyBotLenient(participant)
        if (isBot) {
          recoveryStats.bots_filtered++
          continue
        }

        const cleanEmail = participant.user_email?.toLowerCase().trim() || ''
        const isValidEmail = isValidEmailLenient(cleanEmail)
        if (!isValidEmail) {
          recoveryStats.invalid_emails_filtered++
          continue
        }

        // Safe engagement score calculation
        const engagementScore = calculateEngagementScoreSafe(participant, maxDuration)
        
        // Sanitize and validate all data
        const sanitizedData = sanitizeParticipantData(participant)
        
        const attendeeData = {
          webinar_id,
          organization_id,
          ...sanitizedData,
          engagement_score: engagementScore,
          updated_at: new Date().toISOString(),
        }
        
        // Validate all critical fields before insertion
        if (!attendeeData.name || !attendeeData.email || !attendeeData.webinar_id) {
          console.error(`❌ Missing critical fields for: ${JSON.stringify(attendeeData)}`)
          recoveryStats.validation_errors++
          continue
        }

        // Robust database insertion with error handling
        const { error: upsertError } = await supabaseClient
          .from('attendees')
          .upsert(attendeeData, {
            onConflict: 'webinar_id,email',
            ignoreDuplicates: false,
          })

        if (!upsertError) {
          processedCount++
          if (processedCount % 50 === 0) {
            console.log(`💾 Progress: ${processedCount}/${deduplicatedParticipants.length} participants stored...`)
          }
        } else {
          console.error('❌ Database error for participant:', upsertError)
          console.error('❌ Failed data:', JSON.stringify(attendeeData))
          recoveryStats.database_errors++
          processingErrors.push(`${participant.name} (${cleanEmail}): ${upsertError.message}`)
        }
        
      } catch (error) {
        console.error(`❌ Processing error for participant ${participant.id}:`, error)
        recoveryStats.database_errors++
        processingErrors.push(`${participant.name}: ${error.message}`)
      }
    }

    recoveryStats.participants_stored = processedCount

    console.log(`🎉 AGGRESSIVE RECOVERY COMPLETED!`)
    console.log(`📊 Final Results:`)
    console.log(`  - Total API calls: ${recoveryStats.total_api_calls}`)
    console.log(`  - Pages processed: ${recoveryStats.total_pages_processed}`)
    console.log(`  - Participants found: ${recoveryStats.participants_found}`)
    console.log(`  - After deduplication: ${recoveryStats.participants_after_dedup}`)
    console.log(`  - Successfully stored: ${recoveryStats.participants_stored}`)
    console.log(`  - Bots filtered: ${recoveryStats.bots_filtered}`)
    console.log(`  - Invalid emails: ${recoveryStats.invalid_emails_filtered}`)
    console.log(`  - Validation errors: ${recoveryStats.validation_errors}`)
    console.log(`  - Database errors: ${recoveryStats.database_errors}`)
    console.log(`  - Success endpoint: ${recoveryStats.success_endpoint}`)

    // Update webinar attendee count
    if (webinar_id && processedCount > 0) {
      const { error: updateError } = await supabaseClient
        .from('webinars')
        .update({ 
          attendees_count: processedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', webinar_id)

      if (updateError) {
        console.error('⚠️ Failed to update webinar attendee count:', updateError)
      } else {
        console.log(`📊 Updated webinar attendee count to ${processedCount}`)
      }
    }

    // Update sync log with comprehensive results
    const syncStatus = processedCount > 0 ? 'completed' : 'failed'
    const errorMessage = (recoveryStats.database_errors > 0 || recoveryStats.validation_errors > 0) ? 
      `Aggressive recovery: ${recoveryStats.database_errors} DB errors, ${recoveryStats.validation_errors} validation errors, ${recoveryStats.bots_filtered} bots filtered. Found ${recoveryStats.participants_found}, stored ${processedCount}.` : null
    
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
        success: processedCount > 0,
        participants_synced: processedCount,
        total_found: recoveryStats.participants_found,
        after_deduplication: recoveryStats.participants_after_dedup,
        recovery_stats: recoveryStats,
        api_used: successfulEndpoint,
        message: `AGGRESSIVE RECOVERY: Found ${recoveryStats.participants_found}, stored ${processedCount} attendees. Filtered: ${recoveryStats.bots_filtered} bots, ${recoveryStats.invalid_emails_filtered} invalid emails.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('💥 Aggressive recovery error:', error)
    
    // Try to update sync log with error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { user_id, webinar_id, organization_id } = await req.json().catch(() => ({}))
      
      if (user_id) {
        await supabaseClient
          .from('sync_logs')
          .insert({
            organization_id: organization_id || 'unknown',
            user_id,
            webinar_id,
            sync_type: 'participants_aggressive',
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        participants_synced: 0,
        recovery_stats: null
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
