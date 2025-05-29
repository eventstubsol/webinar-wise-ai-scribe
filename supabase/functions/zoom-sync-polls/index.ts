
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomPoll {
  id: string
  title: string
  poll_type: string
  status: string
  anonymous: boolean
  questions: Array<{
    name: string
    type: string
    answer_required: boolean
    answers: string[]
  }>
}

interface ZoomPollResult {
  poll_id: string
  question_details: Array<{
    question: string
    answers: Array<{
      answer: string
      count: number
    }>
  }>
}

// Token management functions (same as chat sync)
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

    console.log('Starting polls sync for webinar:', zoom_webinar_id)

    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    // Log sync start
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id,
        user_id,
        webinar_id,
        sync_type: 'polls',
        status: 'started',
      })
      .select()
      .single()

    // Fetch polls from Zoom API
    const pollsResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoom_webinar_id}/polls`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    let allPolls: ZoomPoll[] = []
    let pollResults: ZoomPollResult[] = []

    if (pollsResponse.ok) {
      const pollsData = await pollsResponse.json()
      allPolls = pollsData.polls || []
      
      // Fetch poll results for each poll
      for (const poll of allPolls) {
        try {
          const resultsResponse = await fetch(`https://api.zoom.us/v2/metrics/webinars/${zoom_webinar_id}/polls/${poll.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (resultsResponse.ok) {
            const resultData = await resultsResponse.json()
            pollResults.push(resultData)
          }
          
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Error fetching results for poll ${poll.id}:`, error)
        }
      }
    }

    console.log(`Found ${allPolls.length} polls with ${pollResults.length} result sets`)

    // Store polls and results
    let processedCount = 0
    let errorCount = 0
    
    for (const poll of allPolls) {
      try {
        // Find corresponding results
        const results = pollResults.find(r => r.poll_id === poll.id)
        
        const { error: upsertError } = await supabaseClient
          .from('zoom_polls')
          .upsert({
            webinar_id,
            organization_id,
            zoom_poll_id: poll.id,
            title: poll.title,
            poll_type: poll.poll_type,
            question: poll.questions?.[0]?.name || poll.title,
            options: poll.questions?.[0]?.answers || [],
            results: results?.question_details || [],
            total_responses: results?.question_details?.[0]?.answers?.reduce((sum: number, ans: any) => sum + ans.count, 0) || 0,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,zoom_poll_id',
          })

        if (!upsertError) {
          processedCount++
        } else {
          console.error('Error upserting poll:', upsertError)
          errorCount++
        }
        
      } catch (error) {
        console.error(`Error processing poll ${poll.id}:`, error)
        errorCount++
      }
    }

    console.log(`Polls sync completed: ${processedCount} processed, ${errorCount} errors`)

    // Update sync log
    const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
    const errorMessage = errorCount > 0 ? `${errorCount} polls failed to process` : null
    
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
        polls_synced: processedCount,
        total_found: allPolls.length,
        errors: errorCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Polls sync error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
