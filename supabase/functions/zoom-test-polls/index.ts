
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Token management functions (same as polls sync)
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

    const { user_id, zoom_webinar_id } = await req.json()
    
    if (!zoom_webinar_id || !user_id) {
      throw new Error('User ID and Zoom webinar ID are required')
    }

    console.log('Testing polls API for webinar:', zoom_webinar_id)

    const accessToken = await getZoomAccessToken(user_id, supabaseClient)

    const testResults = {
      webinar_id: zoom_webinar_id,
      polls_endpoint: null,
      results_endpoint: null,
      api_errors: [],
      polls_found: 0,
      results_found: 0
    }

    // Test 1: Fetch polls
    console.log('Testing polls endpoint...')
    try {
      const pollsResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoom_webinar_id}/polls`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (pollsResponse.ok) {
        const pollsData = await pollsResponse.json()
        testResults.polls_endpoint = {
          status: 'success',
          data: pollsData,
          polls_count: pollsData.polls?.length || 0
        }
        testResults.polls_found = pollsData.polls?.length || 0
      } else {
        const errorData = await pollsResponse.json()
        testResults.polls_endpoint = {
          status: 'error',
          error: errorData,
          status_code: pollsResponse.status
        }
        testResults.api_errors.push(`Polls API: ${pollsResponse.status} - ${errorData.message}`)
      }
    } catch (error) {
      testResults.polls_endpoint = {
        status: 'exception',
        error: error.message
      }
      testResults.api_errors.push(`Polls API Exception: ${error.message}`)
    }

    // Test 2: Fetch poll results
    console.log('Testing poll results endpoint...')
    try {
      const resultsResponse = await fetch(`https://api.zoom.us/v2/report/webinars/${zoom_webinar_id}/polls`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (resultsResponse.ok) {
        const resultData = await resultsResponse.json()
        testResults.results_endpoint = {
          status: 'success',
          data: resultData,
          results_count: resultData.polls?.length || resultData.questions?.length || 0
        }
        testResults.results_found = resultData.polls?.length || resultData.questions?.length || 0
      } else {
        const errorData = await resultsResponse.json()
        testResults.results_endpoint = {
          status: 'error',
          error: errorData,
          status_code: resultsResponse.status
        }
        testResults.api_errors.push(`Results API: ${resultsResponse.status} - ${errorData.message}`)
      }
    } catch (error) {
      testResults.results_endpoint = {
        status: 'exception',
        error: error.message
      }
      testResults.api_errors.push(`Results API Exception: ${error.message}`)
    }

    // Test 3: Check database for existing polls
    const { data: existingPolls, error: dbError } = await supabaseClient
      .from('zoom_polls')
      .select('*')
      .eq('zoom_poll_id', zoom_webinar_id)

    if (!dbError && existingPolls) {
      testResults.database_polls = existingPolls.length
    }

    console.log('Test results:', testResults)

    return new Response(
      JSON.stringify({
        success: true,
        ...testResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Polls test error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
