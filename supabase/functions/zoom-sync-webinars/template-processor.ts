
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Process webinar templates
export async function processWebinarTemplates(
  organizationId: string,
  userId: string,
  supabaseClient: any,
  accessToken: string
) {
  console.log('Processing webinar templates...')

  try {
    // Fetch templates from Zoom API
    const templatesResponse = await fetch(`https://api.zoom.us/v2/users/me/webinar_templates`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!templatesResponse.ok) {
      console.log('No templates found or API not accessible')
      return { success: true, templatesProcessed: 0 }
    }

    const templatesData = await templatesResponse.json()
    const templates = templatesData.templates || []

    let processedCount = 0

    for (const template of templates) {
      try {
        // Upsert template
        const { data: templateRecord, error: templateError } = await supabaseClient
          .from('webinar_templates')
          .upsert({
            zoom_template_id: template.id.toString(),
            organization_id: organizationId,
            user_id: userId,
            name: template.name,
            description: template.description,
            template_type: template.type || 'webinar',
            is_default: template.is_default || false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'zoom_template_id,organization_id',
          })
          .select()
          .single()

        if (templateError) {
          console.error('Error upserting template:', templateError)
          continue
        }

        // Process template settings if available
        if (template.settings || template.branding) {
          await supabaseClient
            .from('webinar_template_settings')
            .upsert({
              template_id: templateRecord.id,
              organization_id: organizationId,
              settings_data: template.settings || {},
              branding_data: template.branding || {},
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'template_id',
            })
        }

        processedCount++
        console.log(`✓ Processed template: ${template.name}`)

      } catch (error) {
        console.error(`Error processing template ${template.id}:`, error)
      }
    }

    console.log(`Templates processing complete: ${processedCount} processed`)
    return { success: true, templatesProcessed: processedCount }

  } catch (error) {
    console.error('Error fetching templates:', error)
    return { success: false, error: error.message }
  }
}

// Link webinar to its source template
export async function linkWebinarToTemplate(
  webinarId: string,
  zoomWebinarData: any,
  organizationId: string,
  supabaseClient: any
) {
  try {
    // Determine source type and metadata
    let sourceType = 'manual' // default
    let sourceMetadata = {}
    let templateId = null

    if (zoomWebinarData.template_id) {
      sourceType = 'template'
      
      // Find the template in our database
      const { data: template } = await supabaseClient
        .from('webinar_templates')
        .select('id')
        .eq('zoom_template_id', zoomWebinarData.template_id.toString())
        .eq('organization_id', organizationId)
        .single()

      if (template) {
        templateId = template.id
      }
    } else if (zoomWebinarData.recurrence) {
      sourceType = 'recurring'
    } else if (zoomWebinarData.creation_source === 'api') {
      sourceType = 'api'
    }

    // Store source tracking data
    await supabaseClient
      .from('webinar_source_tracking')
      .upsert({
        webinar_id: webinarId,
        organization_id: organizationId,
        template_id: templateId,
        source_type: sourceType,
        source_metadata: {
          creation_source: zoomWebinarData.creation_source,
          template_id: zoomWebinarData.template_id,
          created_by: zoomWebinarData.host_email,
          zoom_creation_time: zoomWebinarData.created_at
        },
        creation_workflow: zoomWebinarData.workflow || {},
        approval_history: zoomWebinarData.approval_history || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'webinar_id',
      })

    console.log(`✓ Linked webinar to source: ${sourceType}`)

  } catch (error) {
    console.error('Error linking webinar to template:', error)
  }
}
