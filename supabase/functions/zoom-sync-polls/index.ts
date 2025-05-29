
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoomPollQuestion {
  name: string
  type: string
  answer_required?: boolean
  answers: Array<{
    answer: string
    count?: number
    percentage?: string
  }>
}

interface ZoomPollResponse {
  id: string
  title: string
  poll_type?: string
  status?: string
  anonymous?: boolean
  questions: ZoomPollQuestion[]
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

    console.log('=== POLLS SYNC START ===')
    console.log('Webinar ID:', zoom_webinar_id)
    console.log('DB Webinar ID:', webinar_id)
    console.log('Organization ID:', organization_id)
    console.log('User ID:', user_id)

    const accessToken = await getZoomAccessToken(user_id, supabaseClient)
    console.log('✓ Access token obtained successfully')

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

    console.log('✓ Sync log created:', syncLog?.id)

    // Use the correct API endpoint for past webinar polls
    console.log('=== FETCHING POLLS FROM CORRECT ENDPOINT ===')
    const pollsResponse = await fetch(`https://api.zoom.us/v2/past_webinars/${zoom_webinar_id}/polls`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    let allPolls: ZoomPollResponse[] = []
    let pollFetchError = null

    if (pollsResponse.ok) {
      const pollsData = await pollsResponse.json()
      allPolls = pollsData.polls || []
      console.log(`✓ Found ${allPolls.length} polls with embedded results`)
      
      if (allPolls.length > 0) {
        console.log('Poll details:', allPolls.map(p => ({ 
          id: p.id, 
          title: p.title, 
          questions: p.questions?.length || 0,
          hasResults: p.questions?.some(q => q.answers?.some(a => a.count)) || false
        })))
      }
    } else {
      const errorData = await pollsResponse.json()
      pollFetchError = `Polls API Error ${pollsResponse.status}: ${errorData.message || errorData.error_description || 'Unknown error'}`
      console.error('❌ Polls fetch failed:', pollFetchError)
      console.error('Error details:', errorData)
    }

    // Process and store polls data
    console.log('=== PROCESSING AND STORING POLLS ===')
    let processedCount = 0
    let errorCount = 0
    
    if (allPolls.length === 0) {
      console.log('ℹ️ No polls to process for this webinar')
    }
    
    for (const poll of allPolls) {
      try {
        console.log(`Processing poll: ${poll.id} - "${poll.title}"`)
        
        // Extract question data - polls can have multiple questions
        const primaryQuestion = poll.questions?.[0]
        if (!primaryQuestion) {
          console.error(`❌ No questions found for poll ${poll.id}`)
          errorCount++
          continue
        }

        // Calculate total responses from the embedded results
        let totalResponses = 0
        const results = poll.questions || []
        if (results.length > 0 && results[0].answers) {
          totalResponses = results[0].answers.reduce((sum: number, ans: any) => {
            const count = parseInt(ans.count?.toString() || '0') || 0
            return sum + count
          }, 0)
        }

        // Prepare poll data for database insertion
        const pollData = {
          webinar_id: webinar_id || null,
          organization_id,
          zoom_poll_id: poll.id,
          title: poll.title || 'Untitled Poll',
          poll_type: poll.poll_type || 'single',
          question: primaryQuestion.name || poll.title || 'No question available',
          options: primaryQuestion.answers?.map(a => a.answer) || [],
          results: results,
          total_responses: totalResponses,
          created_at: new Date().toISOString(),
        }

        console.log(`Inserting poll data:`, {
          zoom_poll_id: pollData.zoom_poll_id,
          title: pollData.title,
          question: pollData.question.substring(0, 50) + '...',
          options_count: pollData.options.length,
          total_responses: pollData.total_responses,
          has_results: pollData.results.length > 0
        })

        // Use insert with conflict handling instead of upsert to avoid constraint issues
        const { error: insertError } = await supabaseClient
          .from('zoom_polls')
          .insert(pollData)

        if (insertError) {
          // If it's a duplicate, try to update instead
          if (insertError.code === '23505') { // unique violation
            console.log(`Poll ${poll.id} already exists, attempting update...`)
            const { error: updateError } = await supabaseClient
              .from('zoom_polls')
              .update({
                title: pollData.title,
                poll_type: pollData.poll_type,
                question: pollData.question,
                options: pollData.options,
                results: pollData.results,
                total_responses: pollData.total_responses,
              })
              .eq('zoom_poll_id', poll.id)
              .eq('organization_id', organization_id)

            if (!updateError) {
              processedCount++
              console.log(`✓ Successfully updated poll: ${poll.id}`)
            } else {
              console.error('❌ Database update error for poll:', poll.id, updateError)
              errorCount++
            }
          } else {
            console.error('❌ Database insert error for poll:', poll.id, insertError)
            errorCount++
          }
        } else {
          processedCount++
          console.log(`✓ Successfully processed poll: ${poll.id}`)
        }
        
      } catch (error) {
        console.error(`❌ Error processing poll ${poll.id}:`, error.message)
        errorCount++
      }
    }

    console.log('=== POLLS SYNC SUMMARY ===')
    console.log(`Total polls found: ${allPolls.length}`)
    console.log(`Successfully processed: ${processedCount}`)
    console.log(`Errors: ${errorCount}`)
    console.log(`Poll results embedded in response: ${allPolls.length > 0}`)

    // Update sync log
    const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
    let errorMessage = null
    
    if (pollFetchError) {
      errorMessage = pollFetchError
    } else if (errorCount > 0) {
      errorMessage = `${errorCount} polls failed to process`
    }
    
    if (syncLog?.id) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: syncStatus,
          records_processed: processedCount,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id)
    }

    console.log('=== POLLS SYNC COMPLETE ===')

    return new Response(
      JSON.stringify({ 
        success: processedCount > 0 || allPolls.length === 0,
        polls_synced: processedCount,
        total_found: allPolls.length,
        errors: errorCount,
        has_results: allPolls.some(p => p.questions?.some(q => q.answers?.some(a => a.count))),
        api_error: pollFetchError,
        endpoint_used: `/past_webinars/${zoom_webinar_id}/polls`,
        summary: {
          polls_found: allPolls.length,
          polls_processed: processedCount,
          polls_with_results: allPolls.filter(p => p.questions?.some(q => q.answers?.some(a => a.count))).length,
          error_details: errorMessage
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('=== POLLS SYNC ERROR ===')
    console.error('Error:', error)
    
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
