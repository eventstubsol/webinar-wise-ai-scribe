
export async function fetchWebinarsFromZoom(
  accessToken: string,
  rateLimiter: any,
  config: any,
  daysBack: number = 180
): Promise<any[]> {
  const { getDateRange } = await import('./date-utils.ts')
  
  // Get date range for extended lookback
  const { from, to } = getDateRange(daysBack)
  console.log(`Fetching webinars from ${from} to ${to}`)

  // Get webinars with pagination and rate limiting
  let allWebinars: any[] = []
  let nextPageToken = ''
  let pageCount = 0
  
  do {
    pageCount++
    console.log(`Fetching webinars page ${pageCount}...`)
    
    const webinarsData = await rateLimiter.makeRequest(async () => {
      const params = new URLSearchParams({
        page_size: '50', // Smaller page size for rate limiting
        type: 'past',
        from,
        to,
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
        throw new Error(`Zoom API error: ${errorData.message || errorData.error}`)
      }

      return response.json()
    })

    const webinars = webinarsData.webinars || []
    allWebinars = allWebinars.concat(webinars)
    nextPageToken = webinarsData.next_page_token || ''
    
    console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
    
    // Rate limiting delay between pages
    if (nextPageToken && pageCount < 50) { // Increased safety limit for larger date range
      await rateLimiter.delay(config.webinarDelay)
    }
    
  } while (nextPageToken && pageCount < 50)

  console.log(`Total webinars found: ${allWebinars.length}`)
  return allWebinars
}

export async function processWebinarDetails(
  allWebinars: any[],
  accessToken: string,
  rateLimiter: any,
  config: any,
  organizationId: string,
  userId: string,
  supabaseClient: any,
  syncJob: any
): Promise<{ successfulWebinars: any[], processedWebinars: number }> {
  let processedWebinars = 0

  const webinarResults = await rateLimiter.batchProcess(
    allWebinars,
    async (webinar: any) => {
      try {
        // Get detailed webinar info
        const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinar.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Upsert webinar data
          const { error: upsertError } = await supabaseClient
            .from('webinars')
            .upsert({
              zoom_webinar_id: webinar.id,
              organization_id: organizationId,
              user_id: userId,
              title: webinar.topic,
              host_name: detailData.host_email || webinar.host_email,
              start_time: webinar.start_time,
              duration_minutes: webinar.duration,
              registrants_count: detailData.registrants_count || 0,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'zoom_webinar_id',
            })

          if (upsertError) {
            console.error('Error upserting webinar:', upsertError)
            return { success: false, error: upsertError.message }
          }

          return { success: true, webinar_id: webinar.id }
        } else {
          console.warn(`Failed to get details for webinar ${webinar.id}`)
          return { success: false, error: 'Failed to fetch details' }
        }
      } catch (error: any) {
        console.error(`Error processing webinar ${webinar.id}:`, error)
        return { success: false, error: error.message }
      }
    },
    config.webinarBatchSize,
    config.webinarDelay,
    (processed: number, total: number) => {
      processedWebinars = processed
      const progress = 20 + Math.round((processed / total) * 60) // 20-80% for webinar processing
      supabaseClient
        .from('sync_jobs')
        .update({ 
          progress,
          current_item: processed,
          metadata: { 
            ...syncJob?.metadata, 
            current_stage: 'webinar_details',
            stage_message: `Processed ${processed}/${total} webinars...`
          }
        })
        .eq('id', syncJob?.id)
    }
  )

  const successfulWebinars = webinarResults.filter(r => r.success)
  console.log(`Processed ${successfulWebinars.length}/${allWebinars.length} webinars successfully`)

  return { successfulWebinars, processedWebinars }
}
