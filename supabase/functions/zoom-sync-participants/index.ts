
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

async function fetchParticipantsWithRetry(url: string, accessToken: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 Fetching participants (attempt ${attempt}/${maxRetries}): ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit - wait longer before retry
          const waitTime = Math.pow(2, attempt) * 2000 // Exponential backoff
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

      console.log(`✅ Successfully fetched participants data`)
      return data
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Wait before retry with exponential backoff
      const waitTime = Math.pow(2, attempt) * 1000
      console.log(`⏸️ Waiting ${waitTime}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}

// Fixed engagement score calculation that respects database constraints
function calculateEngagementScore(participant: ZoomParticipant, maxDuration: number): number {
  let engagementScore = 0
  
  if (maxDuration > 0 && participant.duration) {
    // Base score from duration (0-7 points to leave room for bonuses)
    const durationRatio = Math.min(1, participant.duration / maxDuration)
    engagementScore += durationRatio * 7
    
    // Bonus for attentiveness score (0-2 points)
    if (participant.attentiveness_score) {
      const attentiveness = parseFloat(participant.attentiveness_score)
      if (!isNaN(attentiveness)) {
        engagementScore += Math.min(2, (attentiveness / 100) * 2)
      }
    }
  }
  
  // Ensure the score never exceeds 9.99 (database constraint is numeric(3,2))
  const finalScore = Math.min(9.99, Math.max(0, engagementScore))
  
  console.log(`📊 Engagement calculation for ${participant.name}: duration=${participant.duration}s, max=${maxDuration}s, attentiveness=${participant.attentiveness_score}, final=${finalScore}`)
  
  return Math.round(finalScore * 100) / 100 // Round to 2 decimal places
}

// Improved bot detection with more reasonable thresholds
function isLikelyBot(participant: ZoomParticipant): boolean {
  const name = participant.name || ''
  const email = participant.user_email || ''
  
  // Check for obvious bot indicators in name
  const botNameIndicators = [
    'bot', 'test', 'zoom', 'recording', 'admin', 'system',
    'automated', 'service', 'api', 'webhook', 'integration'
  ]
  
  const nameHasBotIndicator = botNameIndicators.some(indicator => 
    name.toLowerCase().includes(indicator)
  )
  
  // Check for test/bot email patterns
  const botEmailIndicators = [
    'test@', 'bot@', 'noreply@', 'system@', 'admin@',
    'donotreply@', 'automated@', 'service@'
  ]
  
  const emailHasBotIndicator = botEmailIndicators.some(indicator =>
    email.toLowerCase().includes(indicator)
  )
  
  // Very short duration (less than 10 seconds) combined with bot indicators
  const veryShortDuration = (participant.duration || 0) < 10
  const hasLowDuration = (participant.duration || 0) < 5 // Only filter out extremely short sessions
  
  // More sophisticated bot detection
  const isBot = (nameHasBotIndicator || emailHasBotIndicator) || 
                (hasLowDuration && (nameHasBotIndicator || emailHasBotIndicator)) ||
                (veryShortDuration && name.toLowerCase() === 'zoom')
  
  if (isBot) {
    console.log(`🤖 Detected bot: ${name} (${email}) - duration: ${participant.duration}s`)
  }
  
  return isBot
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

    console.log('🚀 Starting enhanced participant sync with improved error handling for webinar:', zoom_webinar_id)

    // Get access token
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

    console.log('📝 Created sync log:', syncLog?.id)

    // Try both API endpoints for maximum compatibility
    let allParticipants: ZoomParticipant[] = []
    let totalFound = 0
    let apiUsed = 'unknown'
    
    // First try the correct past webinars endpoint
    try {
      console.log('🔍 Trying past webinars participants endpoint...')
      
      let nextPageToken = ''
      let pageCount = 0
      
      do {
        pageCount++
        console.log(`📄 Fetching page ${pageCount} of participants...`)
        
        const params = new URLSearchParams({
          page_size: '300',
          include_fields: 'registrant_id,status,join_time,leave_time,duration,attentiveness_score,failover'
        })
        
        if (nextPageToken) {
          params.append('next_page_token', nextPageToken)
        }

        const url = `https://api.zoom.us/v2/past_webinars/${zoom_webinar_id}/participants?${params}`
        const data = await fetchParticipantsWithRetry(url, accessToken)
        
        const participants = data.participants || []
        allParticipants = allParticipants.concat(participants)
        nextPageToken = data.next_page_token || ''
        totalFound = data.total_records || allParticipants.length
        
        console.log(`📊 Page ${pageCount}: Found ${participants.length} participants (Total so far: ${allParticipants.length})`)
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } while (nextPageToken && pageCount < 50)

      apiUsed = 'past_webinars'
      console.log(`✅ Past webinars API successful: ${allParticipants.length} participants found`)
      
    } catch (pastWebinarError) {
      console.log('⚠️ Past webinars endpoint failed, trying metrics endpoint as fallback...')
      console.error('Past webinar error:', pastWebinarError)
      
      // Fallback to metrics endpoint
      try {
        let nextPageToken = ''
        let pageCount = 0
        
        do {
          pageCount++
          console.log(`📄 Fetching page ${pageCount} of participants (metrics API)...`)
          
          const params = new URLSearchParams({
            page_size: '300',
          })
          
          if (nextPageToken) {
            params.append('next_page_token', nextPageToken)
          }

          const url = `https://api.zoom.us/v2/metrics/webinars/${zoom_webinar_id}/participants?${params}`
          const data = await fetchParticipantsWithRetry(url, accessToken)
          
          const participants = data.participants || []
          allParticipants = allParticipants.concat(participants)
          nextPageToken = data.next_page_token || ''
          
          console.log(`📊 Page ${pageCount}: Found ${participants.length} participants (Total so far: ${allParticipants.length})`)
          
          await new Promise(resolve => setTimeout(resolve, 300))
          
        } while (nextPageToken && pageCount < 50)

        apiUsed = 'metrics'
        console.log(`✅ Metrics API successful: ${allParticipants.length} participants found`)
        
      } catch (metricsError) {
        console.error('❌ Both API endpoints failed:', { pastWebinarError, metricsError })
        throw new Error(`Failed to fetch participants from both endpoints: ${pastWebinarError.message} | ${metricsError.message}`)
      }
    }

    console.log(`🎯 Total participants found: ${allParticipants.length} using ${apiUsed} API`)

    // Enhanced participant processing with better deduplication
    const participantMap = new Map<string, ZoomParticipant>()
    let duplicatesFound = 0
    
    for (const participant of allParticipants) {
      const email = participant.user_email?.toLowerCase()?.trim() || `unknown_${participant.id || participant.user_id}`
      
      if (participantMap.has(email)) {
        duplicatesFound++
        const existing = participantMap.get(email)!
        
        // Merge data - keep earliest join time and sum durations
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
    console.log(`🔄 After deduplication: ${deduplicatedParticipants.length} unique participants (${duplicatesFound} duplicates merged)`)

    // Calculate max duration for engagement scoring
    const maxDuration = Math.max(...deduplicatedParticipants.map(p => p.duration || 0))
    console.log(`📏 Max webinar duration: ${maxDuration} seconds`)

    // Enhanced participant storage with improved validation and error handling
    let processedCount = 0
    let errorCount = 0
    let validationErrors = 0
    let botFilteredCount = 0
    const processingErrors: string[] = []
    
    for (const participant of deduplicatedParticipants) {
      try {
        // Validate email
        const cleanEmail = participant.user_email?.toLowerCase().trim() || ''
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        
        // Improved bot detection
        const isBot = isLikelyBot(participant)
        
        if (isBot) {
          botFilteredCount++
          console.log(`⏭️ Filtered out bot: ${participant.name} (${cleanEmail}) - duration: ${participant.duration}s`)
          continue
        }

        // Calculate engagement score with proper constraints
        const engagementScore = calculateEngagementScore(participant, maxDuration)
        
        // Validate engagement score before insertion
        if (engagementScore > 9.99 || engagementScore < 0) {
          console.error(`❌ Invalid engagement score: ${engagementScore} for ${participant.name}`)
          validationErrors++
          continue
        }

        if (isValidEmail && cleanEmail !== '') {
          // Enhanced data validation before insertion
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
          
          // Validate all required fields
          if (!attendeeData.name || !attendeeData.email || !attendeeData.webinar_id) {
            console.error(`❌ Missing required fields for participant: ${JSON.stringify(attendeeData)}`)
            validationErrors++
            continue
          }

          const { error: upsertError } = await supabaseClient
            .from('attendees')
            .upsert(attendeeData, {
              onConflict: 'webinar_id,email',
              ignoreDuplicates: false,
            })

          if (!upsertError) {
            processedCount++
            if (processedCount % 25 === 0) {
              console.log(`💾 Successfully stored ${processedCount}/${deduplicatedParticipants.length} participants...`)
            }
          } else {
            console.error('❌ Error upserting participant:', upsertError)
            console.error('❌ Failed participant data:', JSON.stringify(attendeeData))
            errorCount++
            processingErrors.push(`${participant.name} (${cleanEmail}): ${upsertError.message}`)
          }
        } else {
          console.log(`⏭️ Filtered out invalid email: ${participant.name} (${cleanEmail})`)
        }
        
      } catch (error) {
        console.error(`❌ Error processing participant ${participant.id}:`, error)
        errorCount++
        processingErrors.push(`${participant.name}: ${error.message}`)
      }
    }

    console.log(`🎉 Participant sync completed with enhanced error handling!`)
    console.log(`📊 Results summary:`)
    console.log(`  - Total found: ${allParticipants.length}`)
    console.log(`  - After deduplication: ${deduplicatedParticipants.length}`)
    console.log(`  - Successfully stored: ${processedCount}`)
    console.log(`  - Bot filtered: ${botFilteredCount}`)
    console.log(`  - Validation errors: ${validationErrors}`)
    console.log(`  - Database errors: ${errorCount}`)

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
    const syncStatus = processedCount > 0 ? 'completed' : (errorCount > 0 ? 'failed' : 'completed')
    const errorMessage = (errorCount > 0 || validationErrors > 0) ? 
      `${errorCount} database errors, ${validationErrors} validation errors, ${botFilteredCount} bots filtered. Successfully stored: ${processedCount}.` : null
    
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
        total_found: allParticipants.length,
        after_deduplication: deduplicatedParticipants.length,
        errors: errorCount,
        validation_errors: validationErrors,
        bots_filtered: botFilteredCount,
        api_used: apiUsed,
        error_summary: (errorCount > 0 || validationErrors > 0) ? 
          `${errorCount} database errors, ${validationErrors} validation errors occurred` : null,
        message: processedCount > 0 ? 
          `Successfully stored ${processedCount} attendees (${botFilteredCount} bots filtered, ${validationErrors + errorCount} errors)` : 
          `No attendees stored - check filtering criteria and error logs`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('💥 Participant sync error:', error)
    
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
