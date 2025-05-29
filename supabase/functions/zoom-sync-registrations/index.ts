
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomRegistrant {
  id: string
  email: string
  first_name: string
  last_name: string
  status: string
  create_time: string
  join_url: string
  custom_questions: Array<{
    title: string
    value: string
  }>
}

interface RegistrationSyncJob {
  id: string
  webinar_id: string
  organization_id: string
  zoom_webinar_id: string
  total_expected: number
  total_fetched: number
  total_stored: number
  error_count: number
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
  const accountId = await decryptCredential(connection.encrypted_account_id, encryptionKey)
  
  const tokenResponse = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
  })

  const tokenData = await tokenResponse.json()
  
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenData.error || tokenData.message}`)
  }

  return tokenData.access_token
}

async function fetchAllRegistrants(accessToken: string, zoomWebinarId: string, syncJob: RegistrationSyncJob, supabaseClient: any): Promise<ZoomRegistrant[]> {
  const allRegistrants: ZoomRegistrant[] = []
  const statuses = ['approved', 'pending', 'denied', 'cancelled']
  
  console.log(`📋 Fetching registrants for webinar ${zoomWebinarId} with all statuses...`)
  
  for (const status of statuses) {
    console.log(`📊 Fetching ${status} registrants...`)
    
    let nextPageToken = ''
    let pageCount = 0
    let statusRegistrants: ZoomRegistrant[] = []
    
    do {
      pageCount++
      console.log(`  📄 Page ${pageCount} for ${status} registrants...`)
      
      // Update sync job progress
      await supabaseClient
        .from('registration_sync_jobs')
        .update({
          metadata: {
            current_status: status,
            current_page: pageCount,
            total_fetched_so_far: allRegistrants.length
          }
        })
        .eq('id', syncJob.id)
      
      const params = new URLSearchParams({
        page_size: '300',
        status: status,
      })
      
      if (nextPageToken) {
        params.append('next_page_token', nextPageToken)
      }

      let retryCount = 0
      let response: Response
      let data: any
      
      // Implement retry logic for API calls
      while (retryCount < 3) {
        try {
          response = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinarId}/registrants?${params}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })

          data = await response.json()
          
          if (!response.ok) {
            if (response.status === 429) {
              // Rate limited - wait longer before retry
              console.warn(`⚠️ Rate limited on page ${pageCount}, waiting 2 seconds...`)
              await new Promise(resolve => setTimeout(resolve, 2000))
              retryCount++
              continue
            } else if (response.status >= 500) {
              // Server error - retry
              console.warn(`⚠️ Server error ${response.status} on page ${pageCount}, retrying...`)
              retryCount++
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            } else {
              // Client error - don't retry
              throw new Error(`Zoom API error (${response.status}): ${data.message || data.error}`)
            }
          }
          
          // Success - break out of retry loop
          break
          
        } catch (error) {
          retryCount++
          if (retryCount >= 3) {
            throw error
          }
          console.warn(`⚠️ Attempt ${retryCount} failed for ${status} page ${pageCount}, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      const registrants = data.registrants || []
      statusRegistrants = statusRegistrants.concat(registrants)
      nextPageToken = data.next_page_token || ''
      
      console.log(`  ✅ Page ${pageCount}: Found ${registrants.length} ${status} registrants (Total ${status}: ${statusRegistrants.length})`)
      
      // Respectful rate limiting between pages
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Safety limit to prevent infinite loops
      if (pageCount >= 50) {
        console.warn(`⚠️ Hit page limit (50) for ${status} registrants`)
        break
      }
      
    } while (nextPageToken)
    
    allRegistrants.push(...statusRegistrants)
    console.log(`✅ Completed ${status} registrants: ${statusRegistrants.length} found`)
    
    // Brief pause between status queries
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`🎉 Total registrants fetched across all statuses: ${allRegistrants.length}`)
  return allRegistrants
}

async function storeRegistrants(registrants: ZoomRegistrant[], webinarId: string, organizationId: string, syncBatchId: string, supabaseClient: any): Promise<{ processed: number, errors: number }> {
  let processedCount = 0
  let errorCount = 0
  
  console.log(`💾 Storing ${registrants.length} registrants...`)
  
  for (const [index, registrant] of registrants.entries()) {
    try {
      // Validate required fields
      if (!registrant.email || !registrant.first_name) {
        console.warn(`⚠️ Skipping registrant with missing required fields: ${JSON.stringify(registrant)}`)
        errorCount++
        continue
      }
      
      // Convert custom questions to JSONB format
      const customQuestions = registrant.custom_questions ? 
        Object.fromEntries(registrant.custom_questions.map(q => [q.title, q.value])) : {}
      
      const registrationData = {
        webinar_id: webinarId,
        organization_id: organizationId,
        zoom_registrant_id: registrant.id,
        email: registrant.email.toLowerCase().trim(),
        first_name: registrant.first_name.trim(),
        last_name: registrant.last_name?.trim() || '',
        status: registrant.status,
        source_api_status: registrant.status, // Track original API status
        registration_time: registrant.create_time,
        join_url: registrant.join_url,
        custom_questions: customQuestions,
        sync_batch_id: syncBatchId,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      const { error: upsertError } = await supabaseClient
        .from('zoom_registrations')
        .upsert(registrationData, {
          onConflict: 'webinar_id,email',
        })

      if (!upsertError) {
        processedCount++
        if (processedCount % 50 === 0) {
          console.log(`💾 Stored ${processedCount}/${registrants.length} registrants...`)
        }
      } else {
        console.error(`❌ Error storing registrant ${registrant.email}:`, upsertError)
        errorCount++
      }
      
    } catch (error) {
      console.error(`❌ Exception storing registrant ${registrant.email}:`, error)
      errorCount++
    }
  }
  
  console.log(`✅ Storage complete: ${processedCount} stored, ${errorCount} errors`)
  return { processed: processedCount, errors: errorCount }
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

    console.log(`🚀 Starting enhanced registration sync for webinar: ${zoom_webinar_id}`)

    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    const syncBatchId = crypto.randomUUID()

    // Create registration sync job for tracking
    const { data: syncJob, error: syncJobError } = await supabaseClient
      .from('registration_sync_jobs')
      .insert({
        webinar_id,
        organization_id,
        zoom_webinar_id,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: {
          sync_batch_id: syncBatchId,
          started_by: user_id
        }
      })
      .select()
      .single()

    if (syncJobError || !syncJob) {
      throw new Error('Failed to create registration sync job')
    }

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        user_id,
        webinar_id,
        sync_type: 'registrations_enhanced',
        status: 'started',
      })
      .select()
      .single()

    console.log(`📊 Created enhanced sync job: ${syncJob.id}`)

    try {
      // Fetch all registrants with enhanced pagination and status handling
      const allRegistrants = await fetchAllRegistrants(accessToken, zoom_webinar_id, syncJob, supabaseClient)
      
      // Update sync job with fetch results
      await supabaseClient
        .from('registration_sync_jobs')
        .update({
          total_fetched: allRegistrants.length,
          metadata: {
            ...syncJob.metadata,
            fetch_completed_at: new Date().toISOString(),
            status_breakdown: {
              approved: allRegistrants.filter(r => r.status === 'approved').length,
              pending: allRegistrants.filter(r => r.status === 'pending').length,
              denied: allRegistrants.filter(r => r.status === 'denied').length,
              cancelled: allRegistrants.filter(r => r.status === 'cancelled').length,
            }
          }
        })
        .eq('id', syncJob.id)

      // Store registrants with enhanced error handling
      const storeResults = await storeRegistrants(allRegistrants, webinar_id, organization_id, syncBatchId, supabaseClient)
      
      // Complete the sync job
      await supabaseClient
        .from('registration_sync_jobs')
        .update({
          status: 'completed',
          total_stored: storeResults.processed,
          error_count: storeResults.errors,
          completed_at: new Date().toISOString(),
          metadata: {
            ...syncJob.metadata,
            final_stats: {
              total_fetched: allRegistrants.length,
              total_stored: storeResults.processed,
              error_count: storeResults.errors,
              success_rate: allRegistrants.length > 0 ? (storeResults.processed / allRegistrants.length * 100).toFixed(2) + '%' : '0%'
            }
          }
        })
        .eq('id', syncJob.id)

      // Update sync log
      const syncStatus = storeResults.errors > 0 && storeResults.processed === 0 ? 'failed' : 'completed'
      const errorMessage = storeResults.errors > 0 ? `${storeResults.errors} registrations failed to store` : null
      
      await supabaseClient
        .from('sync_logs')
        .update({
          status: syncStatus,
          records_processed: storeResults.processed,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog?.id)

      console.log(`🎉 Enhanced registration sync completed successfully!`)
      console.log(`📈 Final results:`)
      console.log(`  - ${allRegistrants.length} registrants fetched from Zoom API`)
      console.log(`  - ${storeResults.processed} registrants stored in database`)
      console.log(`  - ${storeResults.errors} errors encountered`)
      
      // The trigger will automatically update webinar registrants_count
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          registrations_synced: storeResults.processed,
          total_found: allRegistrants.length,
          errors: storeResults.errors,
          sync_batch_id: syncBatchId,
          enhanced_sync: true,
          status_breakdown: {
            approved: allRegistrants.filter(r => r.status === 'approved').length,
            pending: allRegistrants.filter(r => r.status === 'pending').length,
            denied: allRegistrants.filter(r => r.status === 'denied').length,
            cancelled: allRegistrants.filter(r => r.status === 'cancelled').length,
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (error) {
      // Mark sync job as failed
      await supabaseClient
        .from('registration_sync_jobs')
        .update({
          status: 'failed',
          last_error: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncJob.id)
      
      throw error
    }

  } catch (error) {
    console.error('❌ Enhanced registration sync error:', error)
    
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
            sync_type: 'registrations_enhanced',
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
        enhanced_sync: true 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
