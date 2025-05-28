
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomWebinar {
  id: string
  topic: string
  host_id: string
  host_email: string
  start_time: string
  duration: number
  join_url: string
  registrants_count?: number
  created_at: string
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
  
  // Get the zoom connection with encrypted credentials
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

  // Create decryption key (same as used in zoom-store-credentials)
  const encryptionKey = `${userId}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
  
  try {
    const clientId = await decryptCredential(connection.encrypted_client_id, encryptionKey)
    const clientSecret = await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    
    console.log('Decrypted credentials successfully')
    
    // Get access token using account credentials (server-to-server OAuth)
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

    console.log('Successfully obtained access token')
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

    const { organization_id, user_id } = await req.json()
    
    if (!organization_id || !user_id) {
      throw new Error('Organization ID and User ID are required')
    }

    console.log('Starting webinar sync for user:', user_id, 'org:', organization_id)

    // Get access token using the new token management
    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        user_id,
        sync_type: 'webinars',
        status: 'started',
      })
      .select()
      .single()

    console.log('Created sync log:', syncLog?.id)

    // Fetch webinars from Zoom API
    let allWebinars: ZoomWebinar[] = []
    let nextPageToken = ''
    let pageCount = 0
    
    do {
      pageCount++
      console.log(`Fetching page ${pageCount} of webinars...`)
      
      const params = new URLSearchParams({
        page_size: '300',
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

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Zoom API error:', data)
        throw new Error(`Zoom API error: ${data.message || data.error}`)
      }

      const webinars = data.webinars || []
      allWebinars = allWebinars.concat(webinars)
      nextPageToken = data.next_page_token || ''
      
      console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
      
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } while (nextPageToken && pageCount < 10) // Safety limit

    console.log(`Total webinars found: ${allWebinars.length}`)

    // Process and store webinars
    let processedCount = 0
    let errorCount = 0
    
    for (const zoomWebinar of allWebinars) {
      try {
        // Get detailed webinar info
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Check if webinar already exists
          const { data: existingWebinar } = await supabaseClient
            .from('webinars')
            .select('id')
            .eq('zoom_webinar_id', zoomWebinar.id)
            .eq('organization_id', organization_id)
            .single()

          if (existingWebinar) {
            // Update existing webinar
            const { error: updateError } = await supabaseClient
              .from('webinars')
              .update({
                title: zoomWebinar.topic,
                host_name: detailData.host_email || zoomWebinar.host_email,
                start_time: zoomWebinar.start_time,
                duration_minutes: zoomWebinar.duration,
                registrants_count: detailData.registrants_count || 0,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingWebinar.id)

            if (!updateError) {
              processedCount++
              if (processedCount % 10 === 0) {
                console.log(`Updated ${processedCount} webinars...`)
              }
            } else {
              console.error('Error updating webinar:', updateError)
              errorCount++
            }
          } else {
            // Insert new webinar
            const { error: insertError } = await supabaseClient
              .from('webinars')
              .insert({
                zoom_webinar_id: zoomWebinar.id,
                organization_id,
                user_id,
                title: zoomWebinar.topic,
                host_name: detailData.host_email || zoomWebinar.host_email,
                start_time: zoomWebinar.start_time,
                duration_minutes: zoomWebinar.duration,
                registrants_count: detailData.registrants_count || 0,
                updated_at: new Date().toISOString(),
              })

            if (!insertError) {
              processedCount++
              if (processedCount % 10 === 0) {
                console.log(`Processed ${processedCount} webinars...`)
              }
            } else {
              console.error('Error inserting webinar:', insertError)
              errorCount++
            }
          }
        } else {
          console.warn(`Failed to get details for webinar ${zoomWebinar.id}`)
          errorCount++
        }
        
        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.error(`Error processing webinar ${zoomWebinar.id}:`, error)
        errorCount++
      }
    }

    console.log(`Sync completed: ${processedCount} processed, ${errorCount} errors`)

    // Update sync log
    const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
    const errorMessage = errorCount > 0 ? `${errorCount} webinars failed to process` : null
    
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
        webinars_synced: processedCount,
        total_found: allWebinars.length,
        errors: errorCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Sync error:', error)
    
    // Try to update sync log with error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { user_id } = await req.json().catch(() => ({}))
      
      if (user_id) {
        await supabaseClient
          .from('sync_logs')
          .insert({
            organization_id: 'unknown',
            user_id,
            sync_type: 'webinars',
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
