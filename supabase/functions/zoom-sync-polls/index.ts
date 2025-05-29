
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
  id: string
  uuid: string
  start_time: string
  title: string
  questions: Array<{
    name: string
    type: string
    answer_required: boolean
    answers: Array<{
      answer: string
      count: number
      percentage?: string
    }>
  }>
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

    // First, fetch polls from the correct endpoint
    console.log(`Fetching polls for webinar ${zoom_webinar_id}...`)
    const pollsResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoom_webinar_id}/polls`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    let allPolls: ZoomPoll[] = []
    let pollResults: ZoomPollResult[] = []
    let pollFetchError = null

    if (pollsResponse.ok) {
      const pollsData = await pollsResponse.json()
      allPolls = pollsData.polls || []
      console.log(`Found ${allPolls.length} polls for webinar ${zoom_webinar_id}`)
      
      // Try to fetch poll results using the correct endpoint
      if (allPolls.length > 0) {
        console.log('Attempting to fetch poll results...')
        
        // Try the report endpoint for poll results
        try {
          const resultsResponse = await fetch(`https://api.zoom.us/v2/report/webinars/${zoom_webinar_id}/polls`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (resultsResponse.ok) {
            const resultData = await resultsResponse.json()
            console.log('Poll results response:', JSON.stringify(resultData, null, 2))
            
            // The results might be in different format, let's handle it flexibly
            if (resultData.polls) {
              pollResults = resultData.polls
            } else if (resultData.questions) {
              // Transform the data if it's in a different format
              pollResults = [{
                id: zoom_webinar_id,
                uuid: zoom_webinar_id,
                start_time: '',
                title: 'Poll Results',
                questions: resultData.questions
              }]
            }
            console.log(`Successfully fetched poll results: ${pollResults.length} result sets`)
          } else {
            const errorData = await resultsResponse.json()
            console.log(`Poll results fetch failed with status ${resultsResponse.status}:`, errorData)
          }
        } catch (error) {
          console.error('Error fetching poll results:', error.message)
        }
      }
    } else {
      const errorData = await pollsResponse.json()
      pollFetchError = `API Error ${pollsResponse.status}: ${errorData.message || 'Unknown error'}`
      console.error('Failed to fetch polls:', pollFetchError)
    }

    console.log(`Processing ${allPolls.length} polls with ${pollResults.length} result sets`)

    // Store polls and results
    let processedCount = 0
    let errorCount = 0
    
    for (const poll of allPolls) {
      try {
        console.log(`Processing poll: ${poll.id} - ${poll.title}`)
        
        // Find corresponding results
        const results = pollResults.find(r => r.id === poll.id) || pollResults[0] // Fallback to first result if available
        
        // Prepare the poll data for insertion
        const pollData = {
          webinar_id,
          organization_id,
          zoom_poll_id: poll.id,
          title: poll.title || 'Untitled Poll',
          poll_type: poll.poll_type || 'single',
          question: poll.questions?.[0]?.name || poll.title || 'No question available',
          options: poll.questions?.[0]?.answers || [],
          results: results?.questions || [],
          total_responses: 0,
          created_at: new Date().toISOString(),
        }

        // Calculate total responses if results are available
        if (results?.questions?.[0]?.answers) {
          pollData.total_responses = results.questions[0].answers.reduce((sum: number, ans: any) => sum + (ans.count || 0), 0)
        }

        console.log(`Inserting poll data:`, {
          zoom_poll_id: pollData.zoom_poll_id,
          title: pollData.title,
          total_responses: pollData.total_responses,
          has_results: pollData.results.length > 0
        })

        const { error: upsertError } = await supabaseClient
          .from('zoom_polls')
          .upsert(pollData, {
            onConflict: 'webinar_id,zoom_poll_id',
          })

        if (!upsertError) {
          processedCount++
          console.log(`✓ Successfully processed poll: ${poll.id}`)
        } else {
          console.error('Database upsert error for poll:', poll.id, upsertError)
          errorCount++
        }
        
      } catch (error) {
        console.error(`Error processing poll ${poll.id}:`, error.message)
        errorCount++
      }
    }

    console.log(`Polls sync completed: ${processedCount} processed, ${errorCount} errors`)

    // Update sync log
    const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
    let errorMessage = null
    
    if (pollFetchError) {
      errorMessage = pollFetchError
    } else if (errorCount > 0) {
      errorMessage = `${errorCount} polls failed to process`
    }
    
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
        success: processedCount > 0 || allPolls.length === 0,
        polls_synced: processedCount,
        total_found: allPolls.length,
        errors: errorCount,
        has_results: pollResults.length > 0,
        api_error: pollFetchError
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Polls sync error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        polls_synced: 0,
        total_found: 0,
        errors: 1
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
