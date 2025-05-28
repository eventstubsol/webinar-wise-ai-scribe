
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple decryption function using built-in Web Crypto API
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  // Decode base64 and extract IV and encrypted data
  const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )
  
  return decoder.decode(decrypted)
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

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
  console.log('zoom-sync-all function called with method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { organization_id, user_id } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting comprehensive sync for user:', user_id, 'org:', organization_id)

    // Create master sync job
    const { data: syncJob, error: syncJobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        organization_id,
        user_id,
        job_type: 'comprehensive_sync',
        status: 'running',
        metadata: { started_at: new Date().toISOString() }
      })
      .select()
      .single()

    if (syncJobError) {
      console.error('Error creating sync job:', syncJobError)
      throw new Error('Failed to create sync job')
    }

    console.log('Created master sync job:', syncJob?.id)

    // Get access token
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Step 1: Sync webinars with rate limiting
    console.log('Step 1: Syncing webinars...')
    await supabaseClient
      .from('sync_jobs')
      .update({ progress: 20, current_item: 1 })
      .eq('id', syncJob?.id)

    let allWebinars: any[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    // Fetch webinars with pagination and rate limiting
    do {
      pageCount++
      console.log(`Fetching webinars page ${pageCount}...`)
      
      const params = new URLSearchParams({
        page_size: '30',
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

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Zoom API error:', errorData)
        throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
      }

      const webinarsData = await response.json()
      const webinars = webinarsData.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = webinarsData.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
      
      // Rate limiting delay between pages
      if (nextPageToken && pageCount < 10) {
        await delay(1000)
      }
      
    } while (nextPageToken && pageCount < 10)

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Process webinars in smaller batches
    const batchSize = 5
    let processedCount = 0

    for (let i = 0; i < allWebinars.length; i += batchSize) {
      const batch = allWebinars.slice(i, i + batchSize)
      
      for (const webinar of batch) {
        try {
          // Upsert webinar data
          const { error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: webinar.id,
              organization_id,
              user_id,
              title: webinar.topic,
              host_name: webinar.host_email,
              start_time: webinar.start_time,
              duration_minutes: webinar.duration,
              registrants_count: 0,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })

          if (upsertError) {
            console.error('Error upserting webinar:', upsertError)
          } else {
            processedCount++
          }
        } catch (error) {
          console.error(`Error processing webinar ${webinar.topic}:`, error)
        }

        await delay(200)
      }

      // Update progress
      const progress = 20 + Math.round((i + batch.length) / allWebinars.length * 50)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress,
          current_item: i + batch.length,
          total_items: allWebinars.length
        })
        .eq('id', syncJob?.id)

      if (i + batchSize < allWebinars.length) {
        await delay(2000)
      }
    }

    // Step 2: Sync detailed data for recent webinars (limit to 3 to avoid timeout)
    const recentWebinars = allWebinars.slice(0, 3)
    console.log(`Step 2: Syncing detailed data for ${recentWebinars.length} recent webinars...`)

    let totalParticipants = 0
    let totalRegistrations = 0
    let syncErrors: string[] = []

    for (let i = 0; i < recentWebinars.length; i++) {
      const webinar = recentWebinars[i]
      console.log(`Processing webinar ${i + 1}/${recentWebinars.length}: ${webinar.topic}`)

      try {
        // Get webinar record from database
        const { data: webinarRecord } = await supabaseClient
          .from('webinars')
          .select('id')
          .eq('zoom_webinar_id', webinar.id)
          .single()

        if (!webinarRecord) continue

        const webinar_id = webinarRecord.id

        // Sync registrations
        console.log('  - Syncing registrations...')
        const registrationsResult = await supabaseClient.functions.invoke('zoom-sync-registrations', {
          body: {
            organization_id,
            user_id,
            webinar_id,
            zoom_webinar_id: webinar.id,
          }
        })

        if (registrationsResult.data?.registrations_synced) {
          totalRegistrations += registrationsResult.data.registrations_synced
        }

        await delay(2000)

        // Update progress
        const progress = 70 + Math.round((i + 1) / recentWebinars.length * 25)
        await supabaseClient
          .from('sync_jobs')
          .update({ progress })
          .eq('id', syncJob?.id)

      } catch (error) {
        console.error(`Error syncing detailed data for webinar ${webinar.topic}:`, error)
        syncErrors.push(`${webinar.topic}: ${error.message}`)
      }
    }

    // Final update
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          webinars_synced: processedCount,
          participants_synced: totalParticipants,
          registrations_synced: totalRegistrations,
          webinars_detailed: recentWebinars.length,
          errors: syncErrors,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', syncJob?.id)

    console.log('Comprehensive sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        job_id: syncJob?.id,
        summary: {
          webinars_synced: processedCount,
          participants_synced: totalParticipants,
          registrations_synced: totalRegistrations,
          webinars_detailed: recentWebinars.length,
          errors: syncErrors.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Comprehensive sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
