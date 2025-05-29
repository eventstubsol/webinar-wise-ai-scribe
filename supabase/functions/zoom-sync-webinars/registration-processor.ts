
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Process enhanced registration data
export async function processEnhancedRegistrationData(
  webinarId: string,
  zoomWebinarId: string,
  organizationId: string,
  supabaseClient: any,
  accessToken: string
) {
  console.log(`Processing enhanced registration data for webinar: ${zoomWebinarId}`)

  try {
    // Fetch registration questions
    await processRegistrationQuestions(webinarId, zoomWebinarId, organizationId, supabaseClient, accessToken)

    // Fetch detailed registration data with custom responses
    await processRegistrationResponses(webinarId, zoomWebinarId, organizationId, supabaseClient, accessToken)

    return { success: true }

  } catch (error) {
    console.error('Error processing enhanced registration data:', error)
    return { success: false, error: error.message }
  }
}

async function processRegistrationQuestions(
  webinarId: string,
  zoomWebinarId: string,
  organizationId: string,
  supabaseClient: any,
  accessToken: string
) {
  try {
    // Fetch webinar details to get registration questions
    const webinarResponse = await fetch(`https://api.zoom.us/v2/webinars/${zoomWebinarId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!webinarResponse.ok) {
      console.log('Could not fetch webinar details for registration questions')
      return
    }

    const webinarData = await webinarResponse.json()
    const questions = webinarData.settings?.registration_questions || []

    for (const [index, question] of questions.entries()) {
      try {
        await supabaseClient
          .from('webinar_registration_questions')
          .upsert({
            webinar_id: webinarId,
            organization_id: organizationId,
            question_type: question.type || 'short',
            question_text: question.field_name || question.question,
            is_required: question.required || false,
            field_name: question.field_name,
            answer_options: question.answers || [],
            display_order: index,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'webinar_id,field_name',
          })

        console.log(`✓ Processed registration question: ${question.field_name}`)

      } catch (error) {
        console.error(`Error processing registration question:`, error)
      }
    }

  } catch (error) {
    console.error('Error fetching registration questions:', error)
  }
}

async function processRegistrationResponses(
  webinarId: string,
  zoomWebinarId: string,
  organizationId: string,
  supabaseClient: any,
  accessToken: string
) {
  try {
    // Fetch registrants with custom questions
    let pageNumber = 1
    let hasMore = true

    while (hasMore) {
      const registrantsResponse = await fetch(
        `https://api.zoom.us/v2/webinars/${zoomWebinarId}/registrants?page_size=300&page_number=${pageNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!registrantsResponse.ok) {
        console.log('Could not fetch registrants for responses')
        break
      }

      const registrantsData = await registrantsResponse.json()
      const registrants = registrantsData.registrants || []

      for (const registrant of registrants) {
        try {
          // Find the registration record in our database
          const { data: registration } = await supabaseClient
            .from('zoom_registrations')
            .select('id')
            .eq('zoom_registrant_id', registrant.registrant_id)
            .eq('webinar_id', webinarId)
            .single()

          if (registration && registrant.custom_questions) {
            // Process custom question responses
            for (const response of registrant.custom_questions) {
              // Find the question in our database
              const { data: question } = await supabaseClient
                .from('webinar_registration_questions')
                .select('id')
                .eq('webinar_id', webinarId)
                .eq('field_name', response.title)
                .single()

              if (question) {
                await supabaseClient
                  .from('webinar_registration_responses')
                  .upsert({
                    registration_id: registration.id,
                    question_id: question.id,
                    organization_id: organizationId,
                    response_text: response.value,
                    response_values: Array.isArray(response.value) ? response.value : [response.value],
                  }, {
                    onConflict: 'registration_id,question_id',
                  })
              }
            }

            console.log(`✓ Processed responses for registrant: ${registrant.email}`)
          }

        } catch (error) {
          console.error(`Error processing registrant responses:`, error)
        }
      }

      hasMore = registrantsData.page_count > pageNumber
      pageNumber++

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200))
    }

  } catch (error) {
    console.error('Error processing registration responses:', error)
  }
}
