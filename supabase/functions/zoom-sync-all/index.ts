
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncJobData {
  webinar_id: string
  zoom_webinar_id: string
  title: string
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

    console.log('Starting comprehensive sync for user:', user_id, 'org:', organization_id)

    // Create master sync job
    const { data: syncJob } = await supabaseClient
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

    console.log('Created master sync job:', syncJob?.id)

    // Step 1: Sync webinars first
    console.log('Step 1: Syncing webinars...')
    const webinarsResult = await supabaseClient.functions.invoke('zoom-sync-webinars', {
      body: { organization_id, user_id }
    })

    if (webinarsResult.error) {
      throw new Error(`Webinars sync failed: ${webinarsResult.error.message}`)
    }

    // Update progress
    await supabaseClient
      .from('sync_jobs')
      .update({ progress: 20, current_item: 1 })
      .eq('id', syncJob?.id)

    // Step 2: Get list of webinars to sync detailed data for
    const { data: webinars } = await supabaseClient
      .from('webinars')
      .select('id, zoom_webinar_id, title')
      .eq('user_id', user_id)
      .not('zoom_webinar_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10) // Sync detailed data for 10 most recent webinars

    console.log(`Step 2: Found ${webinars?.length || 0} webinars for detailed sync`)

    if (!webinars || webinars.length === 0) {
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          status: 'completed', 
          progress: 100,
          completed_at: new Date().toISOString(),
          metadata: { 
            message: 'No webinars found for detailed sync',
            webinars_synced: webinarsResult.data?.webinars_synced || 0
          }
        })
        .eq('id', syncJob?.id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sync completed - webinars only',
          webinars_synced: webinarsResult.data?.webinars_synced || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update total items
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        total_items: webinars.length * 5, // 5 sync operations per webinar
        current_item: 1
      })
      .eq('id', syncJob?.id)

    let totalParticipants = 0
    let totalChat = 0
    let totalPolls = 0
    let totalQA = 0
    let totalRegistrations = 0
    let syncErrors: string[] = []

    // Step 3: Sync detailed data for each webinar
    for (let i = 0; i < webinars.length; i++) {
      const webinar = webinars[i]
      console.log(`Processing webinar ${i + 1}/${webinars.length}: ${webinar.title}`)

      try {
        // Participants sync
        console.log('  - Syncing participants...')
        const participantsResult = await supabaseClient.functions.invoke('zoom-sync-participants', {
          body: {
            organization_id,
            user_id,
            webinar_id: webinar.id,
            zoom_webinar_id: webinar.zoom_webinar_id,
          }
        })

        if (participantsResult.data?.participants_synced) {
          totalParticipants += participantsResult.data.participants_synced
        }

        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: 20 + Math.round((i * 5 + 1) / (webinars.length * 5) * 70),
            current_item: i * 5 + 2
          })
          .eq('id', syncJob?.id)

        // Chat sync
        console.log('  - Syncing chat messages...')
        const chatResult = await supabaseClient.functions.invoke('zoom-sync-chat', {
          body: {
            organization_id,
            user_id,
            webinar_id: webinar.id,
            zoom_webinar_id: webinar.zoom_webinar_id,
          }
        })

        if (chatResult.data?.messages_synced) {
          totalChat += chatResult.data.messages_synced
        }

        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: 20 + Math.round((i * 5 + 2) / (webinars.length * 5) * 70),
            current_item: i * 5 + 3
          })
          .eq('id', syncJob?.id)

        // Polls sync
        console.log('  - Syncing polls...')
        const pollsResult = await supabaseClient.functions.invoke('zoom-sync-polls', {
          body: {
            organization_id,
            user_id,
            webinar_id: webinar.id,
            zoom_webinar_id: webinar.zoom_webinar_id,
          }
        })

        if (pollsResult.data?.polls_synced) {
          totalPolls += pollsResult.data.polls_synced
        }

        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: 20 + Math.round((i * 5 + 3) / (webinars.length * 5) * 70),
            current_item: i * 5 + 4
          })
          .eq('id', syncJob?.id)

        // Q&A sync
        console.log('  - Syncing Q&A...')
        const qaResult = await supabaseClient.functions.invoke('zoom-sync-qa', {
          body: {
            organization_id,
            user_id,
            webinar_id: webinar.id,
            zoom_webinar_id: webinar.zoom_webinar_id,
          }
        })

        if (qaResult.data?.qa_synced) {
          totalQA += qaResult.data.qa_synced
        }

        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: 20 + Math.round((i * 5 + 4) / (webinars.length * 5) * 70),
            current_item: i * 5 + 5
          })
          .eq('id', syncJob?.id)

        // Registrations sync
        console.log('  - Syncing registrations...')
        const registrationsResult = await supabaseClient.functions.invoke('zoom-sync-registrations', {
          body: {
            organization_id,
            user_id,
            webinar_id: webinar.id,
            zoom_webinar_id: webinar.zoom_webinar_id,
          }
        })

        if (registrationsResult.data?.registrations_synced) {
          totalRegistrations += registrationsResult.data.registrations_synced
        }

        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: 20 + Math.round((i * 5 + 5) / (webinars.length * 5) * 70),
            current_item: i * 5 + 5
          })
          .eq('id', syncJob?.id)

        // Small delay between webinars
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Error syncing webinar ${webinar.title}:`, error)
        syncErrors.push(`${webinar.title}: ${error.message}`)
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
          webinars_synced: webinarsResult.data?.webinars_synced || 0,
          participants_synced: totalParticipants,
          chat_messages_synced: totalChat,
          polls_synced: totalPolls,
          qa_synced: totalQA,
          registrations_synced: totalRegistrations,
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
          webinars_synced: webinarsResult.data?.webinars_synced || 0,
          participants_synced: totalParticipants,
          chat_messages_synced: totalChat,
          polls_synced: totalPolls,
          qa_synced: totalQA,
          registrations_synced: totalRegistrations,
          webinars_detailed: webinars.length,
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
