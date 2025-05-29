
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

interface ZoomPollDefinition {
  id: string
  title: string
  poll_type?: string
  status?: string
  anonymous?: boolean
  questions: ZoomPollQuestion[]
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
      percentage: string
    }>
    question_details: Array<{
      answer: string
      name: string
      email: string
      first_name?: string
      last_name?: string
      date_time: string
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

async function fetchPollDefinitions(webinarId: string, accessToken: string): Promise<ZoomPollDefinition[]> {
  console.log(`Fetching poll definitions for webinar ${webinarId}`)
  
  const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/polls`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error(`Poll definitions API error ${response.status}:`, errorData)
    return []
  }

  const data = await response.json()
  console.log(`Found ${data.polls?.length || 0} poll definitions`)
  return data.polls || []
}

async function fetchPollResults(webinarId: string, pollId: string, accessToken: string): Promise<ZoomPollResult | null> {
  console.log(`Fetching poll results for webinar ${webinarId}, poll ${pollId}`)
  
  const response = await fetch(`https://api.zoom.us/v2/past_webinars/${webinarId}/polls/${pollId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error(`Poll results API error ${response.status} for poll ${pollId}:`, errorData)
    return null
  }

  const data = await response.json()
  console.log(`Poll ${pollId} has ${data.questions?.length || 0} questions with results`)
  return data
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

    console.log('=== COMPREHENSIVE POLLS SYNC START ===')
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

    // Step 1: Fetch poll definitions
    console.log('=== STEP 1: FETCHING POLL DEFINITIONS ===')
    const pollDefinitions = await fetchPollDefinitions(zoom_webinar_id, accessToken)
    
    let pollsProcessed = 0
    let responsesProcessed = 0
    let errorCount = 0
    let pollFetchError = null

    if (pollDefinitions.length === 0) {
      console.log('ℹ️ No polls found for this webinar')
    } else {
      console.log(`Found ${pollDefinitions.length} poll definitions`)

      // Step 2: Process each poll definition and fetch its results
      for (const pollDef of pollDefinitions) {
        try {
          console.log(`=== PROCESSING POLL: ${pollDef.id} - "${pollDef.title}" ===`)

          // Step 3: Fetch individual poll results
          const pollResults = await fetchPollResults(zoom_webinar_id, pollDef.id, accessToken)

          // Prepare poll data for database insertion
          const primaryQuestion = pollDef.questions?.[0] || { name: pollDef.title, answers: [] }
          
          // Calculate total responses from results if available
          let totalResponses = 0
          let aggregatedResults = pollDef.questions || []

          if (pollResults && pollResults.questions) {
            // Use results data for more accurate information
            aggregatedResults = pollResults.questions
            totalResponses = pollResults.questions.reduce((sum, question) => {
              return sum + (question.answers?.reduce((qSum, ans) => qSum + (ans.count || 0), 0) || 0)
            }, 0)
          }

          const pollData = {
            webinar_id: webinar_id || null,
            organization_id,
            zoom_poll_id: pollDef.id,
            title: pollDef.title || 'Untitled Poll',
            poll_type: pollDef.poll_type || 'single',
            question: primaryQuestion.name || pollDef.title || 'No question available',
            options: primaryQuestion.answers?.map(a => a.answer) || [],
            results: aggregatedResults,
            total_responses: totalResponses,
            created_at: new Date().toISOString(),
          }

          console.log(`Storing poll definition:`, {
            zoom_poll_id: pollData.zoom_poll_id,
            title: pollData.title,
            total_responses: pollData.total_responses,
            has_results: aggregatedResults.length > 0
          })

          // Insert/update poll definition
          const { data: insertedPoll, error: insertError } = await supabaseClient
            .from('zoom_polls')
            .upsert(pollData, {
              onConflict: 'zoom_poll_id,organization_id'
            })
            .select()
            .single()

          if (insertError) {
            console.error('❌ Database error for poll:', pollDef.id, insertError)
            errorCount++
            continue
          }

          pollsProcessed++
          console.log(`✓ Poll definition stored: ${pollDef.id}`)

          // Step 4: Process individual responses if we have detailed results
          if (pollResults && pollResults.questions) {
            console.log(`Processing individual responses for poll ${pollDef.id}`)
            
            for (const question of pollResults.questions) {
              if (question.question_details && question.question_details.length > 0) {
                console.log(`Found ${question.question_details.length} individual responses`)
                
                for (const response of question.question_details) {
                  try {
                    const responseData = {
                      poll_id: insertedPoll.id,
                      organization_id,
                      participant_name: response.name || `${response.first_name || ''} ${response.last_name || ''}`.trim(),
                      participant_email: response.email,
                      response: response.answer,
                      timestamp: response.date_time ? new Date(response.date_time).toISOString() : new Date().toISOString(),
                    }

                    const { error: responseError } = await supabaseClient
                      .from('zoom_poll_responses')
                      .insert(responseData)

                    if (responseError) {
                      console.error('❌ Error storing response:', responseError)
                      errorCount++
                    } else {
                      responsesProcessed++
                    }
                  } catch (responseErr) {
                    console.error('❌ Error processing response:', responseErr)
                    errorCount++
                  }
                }
              }
            }
          }

        } catch (error) {
          console.error(`❌ Error processing poll ${pollDef.id}:`, error.message)
          errorCount++
        }
      }
    }

    console.log('=== COMPREHENSIVE POLLS SYNC SUMMARY ===')
    console.log(`Poll definitions processed: ${pollsProcessed}`)
    console.log(`Individual responses processed: ${responsesProcessed}`)
    console.log(`Errors: ${errorCount}`)

    // Update sync log
    const syncStatus = errorCount > 0 && pollsProcessed === 0 ? 'failed' : 'completed'
    let errorMessage = null
    
    if (pollFetchError) {
      errorMessage = pollFetchError
    } else if (errorCount > 0) {
      errorMessage = `${errorCount} items failed to process`
    }
    
    if (syncLog?.id) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: syncStatus,
          records_processed: pollsProcessed + responsesProcessed,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id)
    }

    console.log('=== COMPREHENSIVE POLLS SYNC COMPLETE ===')

    return new Response(
      JSON.stringify({ 
        success: pollsProcessed > 0 || pollDefinitions.length === 0,
        polls_synced: pollsProcessed,
        responses_synced: responsesProcessed,
        total_polls_found: pollDefinitions.length,
        errors: errorCount,
        has_detailed_results: responsesProcessed > 0,
        api_error: pollFetchError,
        endpoints_used: {
          definitions: `/past_webinars/${zoom_webinar_id}/polls`,
          results: `/past_webinars/${zoom_webinar_id}/polls/{pollId}`
        },
        summary: {
          polls_definitions_found: pollDefinitions.length,
          polls_stored: pollsProcessed,
          individual_responses_stored: responsesProcessed,
          error_details: errorMessage
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('=== COMPREHENSIVE POLLS SYNC ERROR ===')
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        polls_synced: 0,
        responses_synced: 0,
        total_polls_found: 0,
        errors: 1
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
