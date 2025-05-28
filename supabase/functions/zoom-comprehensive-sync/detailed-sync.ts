
export async function syncDetailedData(
  recentWebinars: any[],
  rateLimiter: any,
  config: any,
  supabaseClient: any,
  organizationId: string,
  userId: string,
  syncJob: any
): Promise<number> {
  if (recentWebinars.length === 0) {
    return 0
  }

  console.log(`Stage 3: Syncing detailed data for ${recentWebinars.length} recent webinars...`)
  
  let detailsProcessed = 0
  const detailsTotal = recentWebinars.length * 5 // 5 operations per webinar
  
  for (const webinar of recentWebinars) {
    try {
      // Get webinar record from database
      const { data: webinarRecord } = await supabaseClient
        .from('webinars')
        .select('id')
        .eq('zoom_webinar_id', webinar.id)
        .single()

      if (!webinarRecord) continue

      const webinar_id = webinarRecord.id

      // Sync participants
      console.log(`  - Syncing participants for ${webinar.topic}...`)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress: 80 + Math.round((detailsProcessed / detailsTotal) * 15),
          metadata: { 
            ...syncJob?.metadata, 
            current_stage: 'participants',
            stage_message: `Syncing participants for: ${webinar.topic}`
          }
        })
        .eq('id', syncJob?.id)

      await supabaseClient.functions.invoke('zoom-sync-participants', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id,
          zoom_webinar_id: webinar.id,
        }
      })
      detailsProcessed++
      await rateLimiter.delay(config.participantsDelay)

      // Sync chat
      console.log(`  - Syncing chat for ${webinar.topic}...`)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          metadata: { 
            ...syncJob?.metadata, 
            current_stage: 'chat',
            stage_message: `Syncing chat for: ${webinar.topic}`
          }
        })
        .eq('id', syncJob?.id)

      await supabaseClient.functions.invoke('zoom-sync-chat', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id,
          zoom_webinar_id: webinar.id,
        }
      })
      detailsProcessed++
      await rateLimiter.delay(config.chatDelay)

      // Sync polls
      console.log(`  - Syncing polls for ${webinar.topic}...`)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          metadata: { 
            ...syncJob?.metadata, 
            current_stage: 'polls',
            stage_message: `Syncing polls for: ${webinar.topic}`
          }
        })
        .eq('id', syncJob?.id)

      await supabaseClient.functions.invoke('zoom-sync-polls', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id,
          zoom_webinar_id: webinar.id,
        }
      })
      detailsProcessed++
      await rateLimiter.delay(config.pollsDelay)

      // Sync Q&A
      console.log(`  - Syncing Q&A for ${webinar.topic}...`)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          metadata: { 
            ...syncJob?.metadata, 
            current_stage: 'qa',
            stage_message: `Syncing Q&A for: ${webinar.topic}`
          }
        })
        .eq('id', syncJob?.id)

      await supabaseClient.functions.invoke('zoom-sync-qa', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id,
          zoom_webinar_id: webinar.id,
        }
      })
      detailsProcessed++
      await rateLimiter.delay(config.qaDelay)

      // Sync registrations
      console.log(`  - Syncing registrations for ${webinar.topic}...`)
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          metadata: { 
            ...syncJob?.metadata, 
            current_stage: 'registrations',
            stage_message: `Syncing registrations for: ${webinar.topic}`
          }
        })
        .eq('id', syncJob?.id)

      await supabaseClient.functions.invoke('zoom-sync-registrations', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          webinar_id,
          zoom_webinar_id: webinar.id,
        }
      })
      detailsProcessed++
      await rateLimiter.delay(config.registrationsDelay)

    } catch (error) {
      console.error(`Error syncing detailed data for webinar ${webinar.topic}:`, error)
      detailsProcessed += 5 // Skip this webinar
    }
  }

  return detailsProcessed
}
