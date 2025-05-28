
export async function processPanelistData(webinarData: any, webinar_id: string, organization_id: string, supabaseClient: any, accessToken: string) {
  console.log(`Processing panelist data for webinar: ${webinarData.topic}`)
  
  try {
    // Fetch panelist data from Zoom API
    const [panelistsResponse, participationResponse] = await Promise.allSettled([
      fetch(`https://api.zoom.us/v2/webinars/${webinarData.id}/panelists`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(`https://api.zoom.us/v2/past_webinars/${webinarData.id}/panelists`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
    ])

    let panelists = []
    let participationData = []

    // Process panelist list
    if (panelistsResponse.status === 'fulfilled' && panelistsResponse.value.ok) {
      const panelistData = await panelistsResponse.value.json()
      panelists = panelistData.panelists || []
    }

    // Process participation data
    if (participationResponse.status === 'fulfilled' && participationResponse.value.ok) {
      const participation = await participationResponse.value.json()
      participationData = participation.panelists || []
    }

    if (panelists.length === 0 && participationData.length === 0) {
      console.log(`  - No panelist data found`)
      return
    }

    // Create participation lookup map
    const participationMap = new Map()
    participationData.forEach(p => {
      participationMap.set(p.email, p)
    })

    // Process each panelist
    for (const panelist of panelists) {
      try {
        const participation = participationMap.get(panelist.email)
        
        let durationMinutes = 0
        if (participation?.duration) {
          durationMinutes = Math.round(participation.duration / 60)
        }

        let status = 'invited'
        if (participation?.join_time) {
          status = 'joined'
        }

        await supabaseClient
          .from('webinar_panelists')
          .upsert({
            webinar_id,
            organization_id,
            zoom_panelist_id: panelist.id,
            email: panelist.email,
            name: panelist.name || participation?.name,
            join_url: panelist.join_url,
            virtual_background_id: panelist.virtual_background_id,
            status,
            invited_at: new Date().toISOString(),
            joined_at: participation?.join_time || null,
            left_at: participation?.leave_time || null,
            duration_minutes: durationMinutes,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,zoom_panelist_id'
          })

      } catch (error) {
        console.error(`  - Error processing panelist ${panelist.email}:`, error)
      }
    }

    // Process any participation data without corresponding panelist records
    for (const participation of participationData) {
      if (!panelists.find(p => p.email === participation.email)) {
        try {
          const durationMinutes = participation.duration ? Math.round(participation.duration / 60) : 0

          await supabaseClient
            .from('webinar_panelists')
            .upsert({
              webinar_id,
              organization_id,
              zoom_panelist_id: participation.id,
              email: participation.email,
              name: participation.name,
              status: participation.join_time ? 'joined' : 'invited',
              joined_at: participation.join_time || null,
              left_at: participation.leave_time || null,
              duration_minutes: durationMinutes,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'webinar_id,zoom_panelist_id'
            })

        } catch (error) {
          console.error(`  - Error processing participation record ${participation.email}:`, error)
        }
      }
    }

    console.log(`  - Processed ${panelists.length} panelists and ${participationData.length} participation records`)
    
  } catch (error) {
    console.error(`Error processing panelist data:`, error)
  }
}
