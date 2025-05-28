
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncProgress {
  webinars_synced: number
  detailed_sync_count: number
  participants_synced: number
  panelists_synced: number
  polls_synced: number
  qa_synced: number
  registrations_synced: number
  api_requests_made: number
  current_stage: string
  stage_message: string
}

interface DetailedMetrics {
  webinars: { success: number, failed: number, skipped: number }
  participants: { success: number, failed: number, skipped: number }
  panelists: { success: number, failed: number, skipped: number }
  polls: { success: number, failed: number, skipped: number }
  qa: { success: number, failed: number, skipped: number }
  api_calls: { total: number, successful: number, failed: number }
  database_ops: { total: number, successful: number, failed: number }
  timing: { start_time: number, phase_times: Record<string, number> }
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
  console.log(`🔑 Getting Zoom access token for user: ${userId}`)
  
  const { data: connection, error: connectionError } = await supabaseClient
    .from('zoom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single()

  if (connectionError || !connection) {
    console.error('❌ No active Zoom connection found:', connectionError)
    throw new Error('No active Zoom connection found')
  }

  if (!connection.encrypted_client_id || !connection.encrypted_client_secret) {
    console.error('❌ Zoom credentials not found in connection')
    throw new Error('Zoom credentials not found')
  }

  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
  try {
    console.log('🔓 Decrypting credentials...')
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)
    
    console.log('✅ Credentials decrypted successfully')
    
    console.log('🌐 Requesting access token from Zoom...')
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=account_credentials&account_id=' + encodeURIComponent(accountId),
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('❌ Token request failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: tokenData
      })
      throw new Error(`Failed to get access token: ${tokenData.error || tokenData.message}`)
    }

    console.log('✅ Successfully obtained access token')
    return tokenData.access_token
    
  } catch (error) {
    console.error('❌ Error getting access token:', error)
    throw error
  }
}

// Rate limiting helper with enhanced logging
async function rateLimitedDelay(requestCount: number) {
  const delay = requestCount % 5 === 0 ? 1000 : 200
  if (delay > 200) {
    console.log(`⏱️ Rate limiting: waiting ${delay}ms after ${requestCount} requests`)
  }
  await new Promise(resolve => setTimeout(resolve, delay))
}

// Map Zoom webinar type to our database enum
function mapWebinarType(zoomType: number): string {
  const mapping = {
    1: 'webinar',
    5: 'recurring_webinar', 
    6: 'webinar_pac',
    9: 'recurring_webinar_pac'
  }
  const result = mapping[zoomType] || 'webinar'
  console.log(`🔄 Mapped Zoom type ${zoomType} to: ${result}`)
  return result
}

// Calculate end time from start time and duration
function calculateEndTime(startTime: string, durationMinutes: number): string | null {
  if (!startTime || !durationMinutes) return null
  const start = new Date(startTime)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return end.toISOString()
}

// Enhanced panelist sync function with detailed logging
async function syncWebinarPanelists(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress, metrics: DetailedMetrics) {
  const startTime = Date.now()
  console.log(`👥 Starting panelist sync for webinar: ${webinarId}`)
  
  try {
    // Fetch panelist list
    console.log(`📋 Fetching panelist list from Zoom API...`)
    const panelistsResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/panelists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    progress.api_requests_made++
    metrics.api_calls.total++
    
    if (panelistsResponse.ok) {
      metrics.api_calls.successful++
      console.log(`✅ Panelist list API call successful (${panelistsResponse.status})`)
    } else {
      metrics.api_calls.failed++
      console.log(`⚠️ Panelist list API call failed (${panelistsResponse.status})`)
    }
    
    // Fetch panelist participation data
    await rateLimitedDelay(progress.api_requests_made)
    console.log(`📊 Fetching panelist participation data from Zoom API...`)
    const participationResponse = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/panelists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    progress.api_requests_made++
    metrics.api_calls.total++
    
    if (participationResponse.ok) {
      metrics.api_calls.successful++
      console.log(`✅ Panelist participation API call successful (${participationResponse.status})`)
    } else {
      metrics.api_calls.failed++
      console.log(`⚠️ Panelist participation API call failed (${participationResponse.status})`)
    }

    let panelists = []
    let participationData = []

    if (panelistsResponse.ok) {
      const data = await panelistsResponse.json()
      panelists = data.panelists || []
      console.log(`📋 Found ${panelists.length} invited panelists`)
    } else {
      console.log(`📋 No panelist list found (${panelistsResponse.status}: ${panelistsResponse.statusText})`)
    }

    if (participationResponse.ok) {
      const data = await participationResponse.json()
      participationData = data.panelists || []
      console.log(`📊 Found ${participationData.length} panelist participation records`)
    } else {
      console.log(`📊 No panelist participation found (${participationResponse.status}: ${participationResponse.statusText})`)
    }

    if (panelists.length === 0 && participationData.length === 0) {
      console.log(`⚠️ No panelist data found for webinar ${webinarId}`)
      metrics.panelists.skipped++
      return
    }

    // Create participation lookup map
    const participationMap = new Map()
    participationData.forEach(p => {
      participationMap.set(p.email, p)
    })
    console.log(`🗂️ Created participation lookup map with ${participationMap.size} entries`)

    // Process each invited panelist
    console.log(`🔄 Processing ${panelists.length} invited panelists...`)
    for (const [index, panelist] of panelists.entries()) {
      try {
        const participation = participationMap.get(panelist.email)
        
        let durationMinutes = 0
        if (participation?.duration) {
          durationMinutes = Math.round(participation.duration / 60)
        }

        let status = 'invited'
        if (participation?.join_time) {
          status = 'joined'
        }

        const panelistRecord = {
          webinar_id,
          organization_id,
          zoom_panelist_id: panelist.id,
          email: panelist.email,
          name: panelist.name || participation?.name || null,
          join_url: panelist.join_url || null,
          virtual_background_id: panelist.virtual_background_id || null,
          status,
          invited_at: new Date().toISOString(),
          joined_at: participation?.join_time || null,
          left_at: participation?.leave_time || null,
          duration_minutes: durationMinutes,
          updated_at: new Date().toISOString(),
        }

        console.log(`💾 Upserting panelist ${index + 1}/${panelists.length}: ${panelist.email} (status: ${status})`)
        metrics.database_ops.total++
        
        const { error } = await supabaseClient
          .from('webinar_panelists')
          .upsert(panelistRecord, {
            onConflict: 'webinar_id,email'
          })

        if (error) {
          console.error(`❌ Error upserting panelist ${panelist.email}:`, {
            code: error.code,
            message: error.message,
            details: error.details
          })
          metrics.database_ops.failed++
          metrics.panelists.failed++
        } else {
          console.log(`✅ Successfully processed panelist: ${panelist.email}`)
          metrics.database_ops.successful++
          progress.panelists_synced++
          metrics.panelists.success++
        }

      } catch (error) {
        console.error(`❌ Error processing panelist ${panelist.email}:`, error)
        metrics.panelists.failed++
      }
    }

    // Process any participation data without corresponding panelist records
    const orphanedParticipation = participationData.filter(participation => 
      !panelists.find(p => p.email === participation.email)
    )
    
    if (orphanedParticipation.length > 0) {
      console.log(`🔄 Processing ${orphanedParticipation.length} orphaned participation records...`)
    }
    
    for (const [index, participation] of orphanedParticipation.entries()) {
      try {
        const durationMinutes = participation.duration ? Math.round(participation.duration / 60) : 0

        const participantRecord = {
          webinar_id,
          organization_id,
          zoom_panelist_id: participation.id || `participant_${participation.email}`,
          email: participation.email,
          name: participation.name || null,
          status: participation.join_time ? 'joined' : 'invited',
          joined_at: participation.join_time || null,
          left_at: participation.leave_time || null,
          duration_minutes: durationMinutes,
          updated_at: new Date().toISOString(),
        }

        console.log(`💾 Upserting orphaned participation ${index + 1}/${orphanedParticipation.length}: ${participation.email}`)
        metrics.database_ops.total++
        
        const { error } = await supabaseClient
          .from('webinar_panelists')
          .upsert(participantRecord, {
            onConflict: 'webinar_id,email'
          })

        if (error) {
          console.error(`❌ Error upserting participation record ${participation.email}:`, {
            code: error.code,
            message: error.message,
            details: error.details
          })
          metrics.database_ops.failed++
          metrics.panelists.failed++
        } else {
          console.log(`✅ Successfully processed participation record: ${participation.email}`)
          metrics.database_ops.successful++
          progress.panelists_synced++
          metrics.panelists.success++
        }

      } catch (error) {
        console.error(`❌ Error processing participation record ${participation.email}:`, error)
        metrics.panelists.failed++
      }
    }

    const endTime = Date.now()
    const duration = endTime - startTime
    metrics.timing.phase_times[`panelists_${webinarId}`] = duration
    
    console.log(`✅ Panelist sync completed for webinar ${webinarId}:`)
    console.log(`   • Total processed: ${progress.panelists_synced} records`)
    console.log(`   • Duration: ${duration}ms`)
    console.log(`   • Success: ${metrics.panelists.success}, Failed: ${metrics.panelists.failed}, Skipped: ${metrics.panelists.skipped}`)
    
  } catch (error) {
    console.error(`❌ Critical error syncing panelists for webinar ${webinarId}:`, error)
    metrics.panelists.failed++
  }
}

// Background processing function for detailed sync with enhanced logging
async function processDetailedSync(
  webinars: any[], 
  organization_id: string, 
  user_id: string, 
  syncJobId: string,
  supabaseClient: any
) {
  const overallStartTime = Date.now()
  console.log(`🚀 Starting background detailed sync for ${webinars.length} webinars`)
  
  const metrics: DetailedMetrics = {
    webinars: { success: 0, failed: 0, skipped: 0 },
    participants: { success: 0, failed: 0, skipped: 0 },
    panelists: { success: 0, failed: 0, skipped: 0 },
    polls: { success: 0, failed: 0, skipped: 0 },
    qa: { success: 0, failed: 0, skipped: 0 },
    api_calls: { total: 0, successful: 0, failed: 0 },
    database_ops: { total: 0, successful: 0, failed: 0 },
    timing: { start_time: overallStartTime, phase_times: {} }
  }
  
  try {
    console.log(`🔑 Getting access token for detailed sync...`)
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    const progress: SyncProgress = {
      webinars_synced: 0,
      detailed_sync_count: 0,
      participants_synced: 0,
      panelists_synced: 0,
      polls_synced: 0,
      qa_synced: 0,
      registrations_synced: 0,
      api_requests_made: 0,
      current_stage: 'detailed_processing',
      stage_message: 'Processing detailed webinar data...'
    }

    // Process webinars in small batches to avoid overwhelming the API
    const BATCH_SIZE = 2
    const pastWebinars = webinars.filter(w => w.webinar_category === 'past').slice(0, 10)
    console.log(`📊 Processing ${pastWebinars.length} past webinars in batches of ${BATCH_SIZE}`)
    
    for (let i = 0; i < pastWebinars.length; i += BATCH_SIZE) {
      const batch = pastWebinars.slice(i, i + BATCH_SIZE)
      const batchStartTime = Date.now()
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(pastWebinars.length/BATCH_SIZE)} (${batch.length} webinars)`)
      
      for (const [batchIndex, webinar] of batch.entries()) {
        const webinarStartTime = Date.now()
        try {
          console.log(`\n🎯 Processing detailed data for webinar ${i + batchIndex + 1}/${pastWebinars.length}: "${webinar.topic}" (ID: ${webinar.id})`)
          
          // Update progress
          progress.current_stage = 'participants'
          progress.stage_message = `Processing participants for: ${webinar.topic}`
          
          await supabaseClient
            .from('sync_jobs')
            .update({ 
              progress: 60 + Math.round((i / pastWebinars.length) * 35),
              metadata: progress
            })
            .eq('id', syncJobId)

          // Get webinar record
          console.log(`🔍 Finding webinar record in database...`)
          const { data: webinarRecord } = await supabaseClient
            .from('webinars')
            .select('id')
            .eq('zoom_webinar_id', webinar.id)
            .single()

          if (!webinarRecord) {
            console.log(`⚠️ Webinar record not found for ${webinar.id} - skipping`)
            metrics.webinars.skipped++
            continue
          }
          
          console.log(`✅ Found webinar record: ${webinarRecord.id}`)

          // Sync participants
          console.log(`👥 Starting participant sync...`)
          progress.current_stage = 'participants'
          progress.stage_message = `Processing participants for: ${webinar.topic}`
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarParticipants(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress, metrics)
          
          // Sync panelists
          console.log(`🎤 Starting panelist sync...`)
          progress.current_stage = 'panelists'
          progress.stage_message = `Processing panelists for: ${webinar.topic}`
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarPanelists(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress, metrics)
          
          // Sync polls
          console.log(`📊 Starting polls sync...`)
          progress.current_stage = 'polls'
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarPolls(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress, metrics)
          
          // Sync Q&A
          console.log(`❓ Starting Q&A sync...`)
          progress.current_stage = 'qa'
          await rateLimitedDelay(progress.api_requests_made)
          await syncWebinarQA(webinar.id, webinarRecord.id, organization_id, accessToken, supabaseClient, progress, metrics)
          
          progress.detailed_sync_count++
          metrics.webinars.success++
          
          const webinarDuration = Date.now() - webinarStartTime
          metrics.timing.phase_times[`webinar_${webinar.id}`] = webinarDuration
          console.log(`✅ Completed processing webinar "${webinar.topic}" in ${webinarDuration}ms`)
          
        } catch (error) {
          console.error(`❌ Error in detailed processing for webinar ${webinar.id}:`, error)
          metrics.webinars.failed++
        }
      }
      
      const batchDuration = Date.now() - batchStartTime
      console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1} completed in ${batchDuration}ms`)
      
      // Longer delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Final update
    const totalDuration = Date.now() - overallStartTime
    progress.current_stage = 'completed'
    progress.stage_message = `Background sync completed successfully! Processed ${progress.panelists_synced} panelists.`
    
    console.log(`\n🎉 Background detailed sync completed successfully!`)
    console.log(`📊 Final Statistics:`)
    console.log(`   • Total Duration: ${totalDuration}ms (${Math.round(totalDuration/1000)}s)`)
    console.log(`   • Webinars: ${metrics.webinars.success} success, ${metrics.webinars.failed} failed, ${metrics.webinars.skipped} skipped`)
    console.log(`   • Participants: ${progress.participants_synced} synced`)
    console.log(`   • Panelists: ${progress.panelists_synced} synced`)
    console.log(`   • Polls: ${progress.polls_synced} synced`)
    console.log(`   • Q&A: ${progress.qa_synced} synced`)
    console.log(`   • API Calls: ${metrics.api_calls.successful}/${metrics.api_calls.total} successful`)
    console.log(`   • Database Operations: ${metrics.database_ops.successful}/${metrics.database_ops.total} successful`)
    
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: { ...progress, final_metrics: metrics }
      })
      .eq('id', syncJobId)

  } catch (error) {
    console.error('❌ Background detailed sync error:', error)
    
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        metadata: { final_metrics: metrics }
      })
      .eq('id', syncJobId)
  }
}

// Enhanced sync functions with detailed logging
async function syncWebinarParticipants(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress, metrics: DetailedMetrics) {
  const startTime = Date.now()
  console.log(`👥 Starting participant sync for webinar: ${webinarId}`)
  
  try {
    console.log(`📋 Fetching participants from Zoom API...`)
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/participants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++
    metrics.api_calls.total++

    if (response.ok) {
      metrics.api_calls.successful++
      console.log(`✅ Participants API call successful (${response.status})`)
      
      const data = await response.json()
      const participants = data.participants || []
      console.log(`📊 Found ${participants.length} participant records`)
      
      for (const [index, participant] of participants.entries()) {
        try {
          console.log(`💾 Processing participant ${index + 1}/${participants.length}: ${participant.name || 'Unknown'} (${participant.email || 'No email'})`)
          metrics.database_ops.total++
          
          await supabaseClient
            .from('attendees')
            .upsert({
              webinar_id,
              organization_id,
              name: participant.name || 'Unknown',
              email: participant.email || '',
              zoom_user_id: participant.user_id,
              join_time: participant.join_time,
              leave_time: participant.leave_time,
              duration_minutes: participant.duration || 0,
              engagement_score: calculateEngagementScore(participant),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'webinar_id,email'
            })
          
          metrics.database_ops.successful++
          progress.participants_synced++
          metrics.participants.success++
          
        } catch (error) {
          console.error(`❌ Error inserting participant ${participant.name}:`, error)
          metrics.database_ops.failed++
          metrics.participants.failed++
        }
      }
    } else {
      metrics.api_calls.failed++
      console.log(`⚠️ Participants API call failed (${response.status}: ${response.statusText})`)
      metrics.participants.skipped++
    }
    
    const duration = Date.now() - startTime
    console.log(`✅ Participant sync completed in ${duration}ms`)
    
  } catch (error) {
    console.error(`❌ Error syncing participants for webinar ${webinarId}:`, error)
    metrics.participants.failed++
  }
}

async function syncWebinarPolls(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress, metrics: DetailedMetrics) {
  const startTime = Date.now()
  console.log(`📊 Starting polls sync for webinar: ${webinarId}`)
  
  try {
    console.log(`📋 Fetching polls from Zoom API...`)
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/polls`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++
    metrics.api_calls.total++

    if (response.ok) {
      metrics.api_calls.successful++
      console.log(`✅ Polls API call successful (${response.status})`)
      
      const data = await response.json()
      const polls = data.polls || []
      console.log(`📊 Found ${polls.length} poll records`)
      
      for (const [index, poll] of polls.entries()) {
        try {
          console.log(`💾 Processing poll ${index + 1}/${polls.length}: ${poll.title || 'Untitled Poll'}`)
          metrics.database_ops.total++
          
          await supabaseClient
            .from('zoom_polls')
            .upsert({
              webinar_id,
              organization_id,
              zoom_poll_id: poll.id,
              title: poll.title || 'Untitled Poll',
              question: poll.question || '',
              options: poll.questions?.[0]?.answers || [],
              results: poll.results || {},
              total_responses: poll.total_responses || 0,
              poll_type: poll.type || 'single',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'webinar_id,zoom_poll_id'
            })
          
          metrics.database_ops.successful++
          progress.polls_synced++
          metrics.polls.success++
          
        } catch (error) {
          console.error(`❌ Error inserting poll ${poll.title}:`, error)
          metrics.database_ops.failed++
          metrics.polls.failed++
        }
      }
    } else {
      metrics.api_calls.failed++
      console.log(`⚠️ Polls API call failed (${response.status}: ${response.statusText})`)
      metrics.polls.skipped++
    }
    
    const duration = Date.now() - startTime
    console.log(`✅ Polls sync completed in ${duration}ms`)
    
  } catch (error) {
    console.error(`❌ Error syncing polls for webinar ${webinarId}:`, error)
    metrics.polls.failed++
  }
}

async function syncWebinarQA(webinarId: string, webinar_id: string, organization_id: string, accessToken: string, supabaseClient: any, progress: SyncProgress, metrics: DetailedMetrics) {
  const startTime = Date.now()
  console.log(`❓ Starting Q&A sync for webinar: ${webinarId}`)
  
  try {
    console.log(`📋 Fetching Q&A from Zoom API...`)
    const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/qa`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    progress.api_requests_made++
    metrics.api_calls.total++

    if (response.ok) {
      metrics.api_calls.successful++
      console.log(`✅ Q&A API call successful (${response.status})`)
      
      const data = await response.json()
      const questions = data.questions || []
      console.log(`📊 Found ${questions.length} Q&A records`)
      
      for (const [index, qa] of questions.entries()) {
        try {
          console.log(`💾 Processing Q&A ${index + 1}/${questions.length}: "${qa.question?.substring(0, 50)}..."`)
          metrics.database_ops.total++
          
          await supabaseClient
            .from('zoom_qa_sessions')
            .upsert({
              webinar_id,
              organization_id,
              zoom_qa_id: qa.id,
              question: qa.question || '',
              answer: qa.answer || null,
              asker_name: qa.name || 'Anonymous',
              asker_email: qa.email || null,
              answered_by: qa.answered_by || null,
              timestamp: qa.date_time || new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'webinar_id,zoom_qa_id'
            })
          
          metrics.database_ops.successful++
          progress.qa_synced++
          metrics.qa.success++
          
        } catch (error) {
          console.error(`❌ Error inserting Q&A:`, error)
          metrics.database_ops.failed++
          metrics.qa.failed++
        }
      }
    } else {
      metrics.api_calls.failed++
      console.log(`⚠️ Q&A API call failed (${response.status}: ${response.statusText})`)
      metrics.qa.skipped++
    }
    
    const duration = Date.now() - startTime
    console.log(`✅ Q&A sync completed in ${duration}ms`)
    
  } catch (error) {
    console.error(`❌ Error syncing Q&A for webinar ${webinarId}:`, error)
    metrics.qa.failed++
  }
}

function calculateEngagementScore(participant: any): number {
  let score = 0
  
  // Base score for attending
  score += 10
  
  // Duration bonus (up to 40 points)
  if (participant.duration) {
    score += Math.min(40, Math.round(participant.duration / 60 * 40))
  }
  
  return Math.min(100, score)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const overallStartTime = Date.now()
  console.log(`\n🚀 ======= STARTING ZOOM COMPREHENSIVE SYNC =======`)
  console.log(`⏰ Start time: ${new Date().toISOString()}`)

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id } = await req.json()
    
    if (!organization_id || !user_id) {
      console.error('❌ Missing required parameters')
      throw new Error('Organization ID and User ID are required')
    }

    console.log(`🏢 Organization: ${organization_id}`)
    console.log(`👤 User: ${user_id}`)

    // Create master sync job
    console.log(`📝 Creating master sync job...`)
    const { data: syncJob } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_rate_limited_sync',
        status: 'running',
        progress: 5,
        metadata: { 
          started_at: new Date().toISOString(),
          current_stage: 'webinars',
          stage_message: 'Starting FAST comprehensive sync...',
          api_requests_made: 0
        }
      })
      .select()
      .single()

    console.log(`✅ Created master sync job: ${syncJob?.id}`)

    const progress: SyncProgress = {
      webinars_synced: 0,
      detailed_sync_count: 0,
      participants_synced: 0,
      panelists_synced: 0,
      polls_synced: 0,
      qa_synced: 0,
      registrations_synced: 0,
      api_requests_made: 0,
      current_stage: 'webinars',
      stage_message: 'Fetching webinar data...'
    }

    // Get access token
    console.log(`🔑 Getting access token...`)
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    progress.api_requests_made++

    // PHASE 1: Quick webinar sync (return response after this)
    console.log(`\n📋 ======= PHASE 1: QUICK WEBINAR DISCOVERY =======`)
    
    // Fetch past webinars (limited to prevent timeout)
    let allWebinars: any[] = []
    const params = new URLSearchParams({
      page_size: '30',
      type: 'past',
    })

    console.log(`🌐 Fetching webinars from Zoom API with params: ${params.toString()}`)
    const response = await fetch(`https://api.zoom.us/v2/users/me/webinars?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    progress.api_requests_made++

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`❌ Zoom API error (${response.status}):`, errorData)
      throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
    }

    const data = await response.json()
    const webinars = data.webinars || []
    allWebinars = allWebinars.concat(webinars.map(w => ({ ...w, webinar_category: 'past' })))

    console.log(`✅ Found ${allWebinars.length} webinars for basic sync`)

    // Process basic webinar data quickly (first 20 to prevent timeout)
    const webinarsToProcess = allWebinars.slice(0, 20)
    console.log(`🔄 Processing basic data for ${webinarsToProcess.length} webinars...`)
    
    for (const [index, zoomWebinar] of webinarsToProcess.entries()) {
      const webinarStartTime = Date.now()
      try {
        console.log(`\n📋 Processing webinar ${index + 1}/${webinarsToProcess.length}: "${zoomWebinar.topic}" (ID: ${zoomWebinar.id})`)
        
        await rateLimitedDelay(progress.api_requests_made)

        // Get basic webinar details
        console.log(`🔍 Fetching detailed webinar info from Zoom API...`)
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        progress.api_requests_made++

        if (detailResponse.ok) {
          console.log(`✅ Webinar details API call successful (${detailResponse.status})`)
          const detailData = await detailResponse.json()
          
          // Calculate end_time
          const endTime = calculateEndTime(detailData.start_time, detailData.duration)
          
          // Map webinar type correctly
          const mappedWebinarType = mapWebinarType(detailData.type || 1)
          
          // Upsert basic webinar data
          console.log(`💾 Upserting webinar data to database...`)
          const { data: webinarRecord, error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: detailData.id?.toString(),
              organization_id,
              user_id,
              title: detailData.topic,
              host_name: detailData.host_email || zoomWebinar.host_email,
              host_id: detailData.host_id,
              uuid: detailData.uuid,
              start_time: detailData.start_time || zoomWebinar.start_time,
              end_time: endTime,
              duration_minutes: detailData.duration || zoomWebinar.duration,
              registrants_count: 0, // Will be updated in background
              attendees_count: 0, // Will be updated in background
              join_url: detailData.join_url,
              password: detailData.password,
              timezone: detailData.timezone,
              agenda: detailData.agenda,
              created_at_zoom: detailData.created_at,
              webinar_number: parseInt(detailData.id),
              is_simulive: detailData.is_simulive || false,
              webinar_type: mappedWebinarType,
              start_url: detailData.start_url,
              encrypted_passcode: detailData.encrypted_passcode,
              h323_passcode: detailData.h323_passcode,
              transition_to_live: detailData.transition_to_live || false,
              creation_source: detailData.creation_source,
              has_recording: false, // Will be updated in background
              recording_count: 0, // Will be updated in background
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })
            .select()
            .single()

          if (!upsertError && webinarRecord) {
            progress.webinars_synced++
            const webinarDuration = Date.now() - webinarStartTime
            console.log(`✅ Quick sync completed for "${webinarRecord.title}" in ${webinarDuration}ms`)
          } else {
            console.error(`❌ Error upserting webinar:`, upsertError)
          }
        } else {
          console.log(`⚠️ Webinar details API call failed (${detailResponse.status}: ${detailResponse.statusText})`)
        }
      } catch (error) {
        console.error(`❌ Error in quick sync for webinar ${zoomWebinar.id}:`, error)
      }
    }

    // Update progress to 60% (basic sync complete)
    progress.current_stage = 'basic_complete'
    progress.stage_message = `Basic sync complete: ${progress.webinars_synced} webinars synced`
    
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        progress: 60,
        metadata: progress
      })
      .eq('id', syncJob?.id)

    console.log(`\n✅ ======= PHASE 1 COMPLETED =======`)
    console.log(`📊 Basic sync results:`)
    console.log(`   • Webinars synced: ${progress.webinars_synced}`)
    console.log(`   • Total webinars found: ${allWebinars.length}`)
    console.log(`   • API requests made: ${progress.api_requests_made}`)

    // PHASE 2: Start background processing for detailed data
    console.log(`\n🔄 ======= PHASE 2: STARTING BACKGROUND PROCESSING =======`)
    
    // Use EdgeRuntime.waitUntil to process detailed data in background
    const backgroundTask = processDetailedSync(allWebinars, organization_id, user_id, syncJob?.id, supabaseClient)
    
    // Use waitUntil to ensure the background task continues even after we return the response
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask)
      console.log(`✅ Background task queued with EdgeRuntime.waitUntil`)
    } else {
      // Fallback: start background task without awaiting
      backgroundTask.catch(error => console.error('❌ Background task error:', error))
      console.log(`✅ Background task started as fallback (no EdgeRuntime)`)
    }

    // Return immediate success response (prevents timeout)
    const totalDuration = Date.now() - overallStartTime
    console.log(`\n🎉 ======= RETURNING SUCCESS RESPONSE =======`)
    console.log(`⏰ Total phase 1 duration: ${totalDuration}ms`)
    console.log(`📊 Final summary: ${progress.webinars_synced}/${allWebinars.length} webinars synced`)

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        message: 'Basic sync completed, detailed processing in background',
        summary: {
          webinars_synced: progress.webinars_synced,
          webinars_found: allWebinars.length,
          basic_sync_complete: true,
          detailed_processing: 'in_background',
          api_requests_made: progress.api_requests_made,
          phase_1_duration_ms: totalDuration
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    const totalDuration = Date.now() - overallStartTime
    console.error(`\n❌ ======= COMPREHENSIVE SYNC ERROR =======`)
    console.error(`⏰ Failed after: ${totalDuration}ms`)
    console.error(`💥 Error:`, error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
