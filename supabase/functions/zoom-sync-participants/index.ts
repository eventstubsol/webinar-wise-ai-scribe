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

// Enhanced recovery statistics tracking with detailed error categorization
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
  constraint_violations: number // New: Track specific constraint errors
  endpoints_tried: string[]
  success_endpoint: string
  error_details: string[] // New: Store specific error messages
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

// Enhanced fetch with aggressive pagination, retry logic, and detailed error handling
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

      // Handle non-JSON responses gracefully
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error(`Non-JSON response (${response.status}): ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
        data = { error: 'Invalid response format', status: response.status };
      }
      
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
        
        throw new Error(`Zoom API error (${response.status}): ${data.message || data.error || 'Unknown error'}`)
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

// Enhanced engagement score calculation with strict bounds checking
// CRITICAL FIX: Ensure score never exceeds database constraint (9.99)
function calculateEngagementScoreSafe(participant: ZoomParticipant, maxDuration: number): number {
  let engagementScore = 0
  
  // Basic validation to prevent NaN results
  const participantDuration = typeof participant.duration === 'number' && !isNaN(participant.duration) ? 
    participant.duration : 0;
  
  // Only calculate if we have valid durations
  if (maxDuration > 0 && participantDuration > 0) {
    // Base score from duration (0-7 points) with safety bounds
    const durationRatio = Math.min(1, Math.max(0, participantDuration / maxDuration))
    engagementScore += durationRatio * 7
    
    // Bonus for attentiveness score (0-2 points) with validation
    if (participant.attentiveness_score) {
      const attentivenessStr = participant.attentiveness_score.toString().trim();
      const attentiveness = parseFloat(attentivenessStr)
      if (!isNaN(attentiveness) && attentiveness >= 0 && attentiveness <= 100) {
        engagementScore += Math.min(2, (attentiveness / 100) * 2)
      }
    }
  }
  
  // CRITICAL: Strict bounds enforcement with multiple safeguards
  // Ensure score never exceeds database constraint (9.99) 
  // Apply multiple validations to guarantee compliance
  const maxAllowedScore = 9.99;
  let finalScore = Math.min(maxAllowedScore, Math.max(0, engagementScore));
  
  // Further safeguard: round to 2 decimal places to prevent floating point issues
  const roundedScore = Math.floor(finalScore * 100) / 100;
  
  console.log(`📊 Safe engagement: ${participant.name}: duration=${participantDuration}s, max=${maxDuration}s, raw_score=${engagementScore.toFixed(2)}, final=${roundedScore.toFixed(2)}`)
  
  return roundedScore;
}

// Enhanced bot detection with improved accuracy while minimizing false positives
function isLikelyBotLenient(participant: ZoomParticipant): boolean {
  const name = (participant.name || '').toLowerCase();
  const email = (participant.user_email || '').toLowerCase();
  
  // Only filter OBVIOUS bots to maximize data recovery
  const obviousBotIndicators = [
    'zoom recorder', 'zoom recording', 'system test', 'api test',
    'webhook test', 'automated system', 'bot test'
  ]
  
  // Check for definite bot patterns
  const isObviousBot = obviousBotIndicators.some(indicator => 
    name.includes(indicator) || email.includes(indicator)
  )
  
  // Only filter if BOTH obvious bot indicator AND extremely short duration (< 3 seconds)
  const extremelyShortDuration = (participant.duration || 0) < 3
  const shouldFilter = isObviousBot && extremelyShortDuration
  
  if (shouldFilter) {
    console.log(`🤖 Filtered obvious bot: ${name} (${email}) - duration: ${participant.duration}s`)
  }
  
  return shouldFilter
}

// Enhanced progressive email validation with multiple fallback strategies
function isValidEmailLenient(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  const trimmedEmail = email.trim();
  if (trimmedEmail === '') return false;
  
  // Strategy 1: Basic check for any email-like format
  const basicEmailPattern = /.+@.+\..+/;
  const basicValid = basicEmailPattern.test(trimmedEmail);
  
  // Strategy 2: Allow partial emails with just @ symbol if basic check fails
  const partialEmailPattern = /.+@.+/;
  const partiallyValid = partialEmailPattern.test(trimmedEmail);
  
  // Accept if either validation passes
  const isValid = basicValid || partiallyValid;
  
  if (!isValid) {
    console.log(`📧 Invalid email filtered: "${email}"`);
  }
  
  return isValid;
}

// Enhanced data sanitization with validation and constraint checking
function sanitizeParticipantData(participant: ZoomParticipant): any {
  // Sanitize and truncate text fields to prevent DB constraint violations
  const name = participant.name 
    ? participant.name.toString().substring(0, 255) 
    : 'Unknown Attendee';
  
  const email = participant.user_email 
    ? participant.user_email.toString().toLowerCase().trim().substring(0, 255) 
    : '';
  
  const zoomUserId = (participant.user_id || participant.id || '')
    .toString().substring(0, 255);

  // Ensure join and leave times are valid dates or null
  let joinTime = null;
  let leaveTime = null;
  
  try {
    if (participant.join_time) {
      joinTime = new Date(participant.join_time).toISOString();
    }
  } catch (e) {
    console.log(`Invalid join_time for ${name}: ${participant.join_time}`);
  }
  
  try {
    if (participant.leave_time) {
      leaveTime = new Date(participant.leave_time).toISOString();
    }
  } catch (e) {
    console.log(`Invalid leave_time for ${name}: ${participant.leave_time}`);
  }
  
  // Ensure duration is a valid non-negative number
  const durationSecs = typeof participant.duration === 'number' && !isNaN(participant.duration)
    ? Math.max(0, participant.duration)
    : 0;
  
  const durationMinutes = Math.round(durationSecs / 60);
  
  return {
    zoom_user_id: zoomUserId,
    name: name,
    email: email,
    join_time: joinTime,
    leave_time: leaveTime,
    duration_minutes: durationMinutes,
  };
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

    console.log('🚀 Starting ENHANCED RECOVERY for webinar:', zoom_webinar_id)

    // Initialize recovery statistics with enhanced error tracking
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
      constraint_violations: 0,
      endpoints_tried: [],
      success_endpoint: '',
      error_details: []
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

    console.log('📝 Created enhanced recovery log:', syncLog?.id)

    // PHASE 1: MULTI-ENDPOINT STRATEGY WITH IMPROVED ERROR HANDLING
    let allParticipants: ZoomParticipant[] = []
    let successfulEndpoint = ''
    
    // Strategy 1: Past webinars endpoint with maximum pagination
    try {
      console.log('🔍 Strategy 1: Enhanced past webinars participants endpoint...')
      recoveryStats.endpoints_tried.push('past_webinars')
      
      let nextPageToken = ''
      let pageCount = 0
      const maxPages = 300 // Increased safety limit for large webinars
      
      do {
        pageCount++
        console.log(`📄 Enhanced pagination - Page ${pageCount}/${maxPages}...`)
        
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
      recoveryStats.error_details.push(`Past webinars API failed: ${pastWebinarError.message}`)
      
      // Strategy 2: Metrics endpoint as fallback with enhanced error handling
      try {
        console.log('🔍 Strategy 2: Metrics endpoint with enhanced pagination...')
        recoveryStats.endpoints_tried.push('metrics')
        allParticipants = [] // Reset
        
        let nextPageToken = ''
        let pageCount = 0
        const maxPages = 300
        
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
        recoveryStats.error_details.push(`Metrics API failed: ${metricsError.message}`)
        
        // Try Strategy 3: List registrants and filter those who attended (last resort)
        try {
          console.log('🔍 Strategy 3: Registrants endpoint with attendance filter...')
          recoveryStats.endpoints_tried.push('registrants')
          allParticipants = [] // Reset
          
          let nextPageToken = ''
          let pageCount = 0
          const maxPages = 50
          
          do {
            pageCount++
            console.log(`📄 Registrants pagination - Page ${pageCount}/${maxPages}...`)
            
            const params = new URLSearchParams({
              page_size: '300',
              status: 'attended' // Only get registrants who attended
            })
            
            if (nextPageToken) {
              params.append('next_page_token', nextPageToken)
            }

            const url = `https://api.zoom.us/v2/webinars/${zoom_webinar_id}/registrants?${params}`
            const data = await fetchParticipantsAggressively(url, accessToken)
            
            recoveryStats.total_api_calls++
            recoveryStats.total_pages_processed++
            
            // Convert registrants format to participants format
            const registrants = data.registrants || []
            const convertedParticipants = registrants.map((r: any) => ({
              id: r.id,
              user_id: r.id,
              name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
              user_email: r.email,
              join_time: r.join_time || new Date().toISOString(),
              leave_time: r.leave_time || new Date().toISOString(),
              duration: r.duration || 60, // Default 1 minute if not known
              attentiveness_score: '0'
            }))
            
            allParticipants = allParticipants.concat(convertedParticipants)
            nextPageToken = data.next_page_token || ''
            
            console.log(`📊 Registrants Page ${pageCount}: Found ${convertedParticipants.length} attended registrants (Total: ${allParticipants.length})`)
            
            await new Promise(resolve => setTimeout(resolve, 200))
            
          } while (nextPageToken && pageCount < maxPages)

          if (allParticipants.length > 0) {
            successfulEndpoint = 'registrants_attended'
            recoveryStats.participants_found = allParticipants.length
            console.log(`✅ Registrants strategy successful as fallback: ${allParticipants.length} participants found`)
          } else {
            throw new Error('No attendees found from registrant endpoint')
          }
          
        } catch (registrantsError) {
          console.error('❌ All three strategies failed:', { pastWebinarError, metricsError, registrantsError })
          recoveryStats.error_details.push(`Registrants API failed: ${registrantsError.message}`)
          throw new Error(`Failed to fetch participants from all endpoints. Try manual recovery.`)
        }
      }
    }

    recoveryStats.success_endpoint = successfulEndpoint
    console.log(`🎯 TOTAL PARTICIPANTS FOUND: ${allParticipants.length} using ${successfulEndpoint} API`)

    // PHASE 2: ENHANCED DEDUPLICATION WITH INTELLIGENT MERGING
    const participantMap = new Map<string, ZoomParticipant>()
    let duplicatesFound = 0
    let idOnlyEntries = 0
    
    for (const participant of allParticipants) {
      // Handle participants with missing email - use ID as backup key
      const hasValidEmail = participant.user_email?.trim().length > 0;
      const mapKey = hasValidEmail 
        ? participant.user_email.toLowerCase().trim() 
        : `id_${participant.id || participant.user_id}`;
      
      if (!hasValidEmail) {
        idOnlyEntries++;
      }
      
      if (participantMap.has(mapKey)) {
        duplicatesFound++
        const existing = participantMap.get(mapKey)!
        
        // Intelligent merging - keep best data from both records
        // Prefer earliest join time
        if (participant.join_time && existing.join_time) {
          existing.join_time = new Date(participant.join_time) < new Date(existing.join_time) 
            ? participant.join_time 
            : existing.join_time;
        } else {
          existing.join_time = existing.join_time || participant.join_time;
        }
        
        // Prefer latest leave time
        if (participant.leave_time && existing.leave_time) {
          existing.leave_time = new Date(participant.leave_time) > new Date(existing.leave_time) 
            ? participant.leave_time 
            : existing.leave_time;
        } else {
          existing.leave_time = existing.leave_time || participant.leave_time;
        }
        
        // Take max duration
        existing.duration = Math.max(existing.duration || 0, participant.duration || 0);
        
        // Merge other fields if missing
        existing.name = existing.name || participant.name;
        existing.user_email = existing.user_email || participant.user_email;
        existing.attentiveness_score = existing.attentiveness_score || participant.attentiveness_score;
      } else {
        participantMap.set(mapKey, { ...participant });
      }
    }

    const deduplicatedParticipants = Array.from(participantMap.values());
    recoveryStats.participants_after_dedup = deduplicatedParticipants.length;
    console.log(`🔄 After intelligent deduplication: ${deduplicatedParticipants.length} unique participants (${duplicatesFound} duplicates merged, ${idOnlyEntries} participants without email)`);
    
    // Calculate max duration for engagement scoring
    const maxDuration = Math.max(...deduplicatedParticipants.map(p => p.duration || 0));
    console.log(`📏 Max webinar duration: ${maxDuration} seconds`);

    // PHASE 3: TRANSACTION-BASED PROCESSING WITH ENHANCED ERROR HANDLING
    let processedCount = 0;
    let validationErrors = 0;
    let databaseErrors = 0;
    let constraintViolations = 0;
    const errorDetails: string[] = [];
    
    // Process participants in manageable batches
    const batchSize = 200;
    const totalBatches = Math.ceil(deduplicatedParticipants.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, deduplicatedParticipants.length);
      const batch = deduplicatedParticipants.slice(start, end);
      
      console.log(`\n🔄 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} participants)...`);
      
      for (const participant of batch) {
        try {
          // Step 1: Lenient filtering with detailed tracking
          const isBot = isLikelyBotLenient(participant);
          if (isBot) {
            recoveryStats.bots_filtered++;
            continue;
          }

          const cleanEmail = participant.user_email?.toLowerCase().trim() || '';
          const isValidEmail = isValidEmailLenient(cleanEmail);
          if (!isValidEmail) {
            recoveryStats.invalid_emails_filtered++;
            continue;
          }

          // Step 2: Safe engagement score calculation with strict bounds
          const engagementScore = calculateEngagementScoreSafe(participant, maxDuration);
          
          // Step 3: Comprehensive data sanitization
          const sanitizedData = sanitizeParticipantData(participant);
          
          const attendeeData = {
            webinar_id,
            organization_id,
            ...sanitizedData,
            engagement_score: engagementScore,
            updated_at: new Date().toISOString(),
          };
          
          // Step 4: Validation with detailed error tracking
          if (!attendeeData.name || !attendeeData.email || !attendeeData.webinar_id) {
            const missingFields = [];
            if (!attendeeData.name) missingFields.push('name');
            if (!attendeeData.email) missingFields.push('email');
            if (!attendeeData.webinar_id) missingFields.push('webinar_id');
            
            console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
            recoveryStats.validation_errors++;
            validationErrors++;
            errorDetails.push(`Validation error: ${participant.name || 'Unknown'} missing ${missingFields.join(', ')}`);
            continue;
          }

          // Step 5: Robust database insertion with detailed error handling
          const { error: upsertError } = await supabaseClient
            .from('attendees')
            .upsert(attendeeData, {
              onConflict: 'webinar_id,email',
              ignoreDuplicates: false,
            });

          if (!upsertError) {
            processedCount++;
            if (processedCount % 50 === 0 || processedCount === deduplicatedParticipants.length) {
              console.log(`💾 Progress: ${processedCount}/${deduplicatedParticipants.length} participants stored (${Math.round(processedCount/deduplicatedParticipants.length*100)}%)...`);
            }
          } else {
            console.error(`❌ Database error for ${participant.name} (${cleanEmail}):`, upsertError);
            
            // Categorize database errors for better troubleshooting
            if (upsertError.message?.includes('violates check constraint')) {
              constraintViolations++;
              errorDetails.push(`Constraint violation for ${attendeeData.name}: ${upsertError.message}`);
            } else {
              databaseErrors++;
              errorDetails.push(`DB error for ${attendeeData.name}: ${upsertError.message}`);
            }
          }
          
        } catch (error: any) {
          console.error(`❌ Processing error for participant ${participant.name || participant.id || 'unknown'}:`, error);
          databaseErrors++;
          errorDetails.push(`Error processing ${participant.name || 'Unknown'}: ${error.message}`);
        }
      }
      
      // Progress update after each batch
      console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} complete. Total stored: ${processedCount}, Validation errors: ${validationErrors}, DB errors: ${databaseErrors}, Constraint violations: ${constraintViolations}`);
    }

    recoveryStats.participants_stored = processedCount;
    recoveryStats.validation_errors = validationErrors;
    recoveryStats.database_errors = databaseErrors;
    recoveryStats.constraint_violations = constraintViolations;
    recoveryStats.error_details = errorDetails.slice(0, 100); // Limit error details to prevent payload size issues

    console.log(`\n🎉 ENHANCED RECOVERY COMPLETED!`);
    console.log(`📊 Final Results:`);
    console.log(`  - Total API calls: ${recoveryStats.total_api_calls}`);
    console.log(`  - Pages processed: ${recoveryStats.total_pages_processed}`);
    console.log(`  - Participants found: ${recoveryStats.participants_found}`);
    console.log(`  - After deduplication: ${recoveryStats.participants_after_dedup}`);
    console.log(`  - Successfully stored: ${recoveryStats.participants_stored}`);
    console.log(`  - Bots filtered: ${recoveryStats.bots_filtered}`);
    console.log(`  - Invalid emails: ${recoveryStats.invalid_emails_filtered}`);
    console.log(`  - Validation errors: ${recoveryStats.validation_errors}`);
    console.log(`  - Database errors: ${recoveryStats.database_errors}`);
    console.log(`  - Constraint violations: ${recoveryStats.constraint_violations}`);
    console.log(`  - Success endpoint: ${recoveryStats.success_endpoint}`);

    // Update webinar attendee count
    if (webinar_id && processedCount > 0) {
      const { error: updateError } = await supabaseClient
        .from('webinars')
        .update({ 
          attendees_count: processedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', webinar_id);

      if (updateError) {
        console.error('⚠️ Failed to update webinar attendee count:', updateError);
        recoveryStats.error_details.push(`Failed to update webinar count: ${updateError.message}`);
      } else {
        console.log(`📊 Updated webinar attendee count to ${processedCount}`);
      }
    }

    // Update sync log with comprehensive results
    const syncStatus = processedCount > 0 ? 'completed' : 'failed';
    const totalErrors = recoveryStats.database_errors + recoveryStats.validation_errors + recoveryStats.constraint_violations;
    
    const errorMessage = totalErrors > 0
      ? `Enhanced recovery: ${recoveryStats.database_errors} DB errors, ${recoveryStats.validation_errors} validation errors, ${recoveryStats.constraint_violations} constraint violations, ${recoveryStats.bots_filtered} bots filtered. Found ${recoveryStats.participants_found}, stored ${processedCount}.`
      : null;
    
    await supabaseClient
      .from('sync_logs')
      .update({
        status: syncStatus,
        records_processed: processedCount,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id);

    return new Response(
      JSON.stringify({ 
        success: processedCount > 0,
        participants_synced: processedCount,
        total_found: recoveryStats.participants_found,
        after_deduplication: recoveryStats.participants_after_dedup,
        recovery_stats: recoveryStats,
        api_used: successfulEndpoint,
        message: `ENHANCED RECOVERY: Found ${recoveryStats.participants_found}, stored ${processedCount} attendees.${totalErrors > 0 ? ` ${totalErrors} errors handled.` : ''}`,
        error_summary: totalErrors > 0 ? errorDetails.slice(0, 5) : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Enhanced recovery error:', error);
    
    // Try to update sync log with error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { user_id, webinar_id, organization_id } = await req.json().catch(() => ({}));
      
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
          });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
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
    );
  }
});
