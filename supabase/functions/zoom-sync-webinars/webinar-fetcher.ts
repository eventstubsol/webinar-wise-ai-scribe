
import { ZoomWebinar } from './types.ts'
import { getDateRange } from './date-utils.ts'

export async function fetchWebinarsFromZoom(
  accessToken: string, 
  daysBack: number = 180
): Promise<ZoomWebinar[]> {
  let allWebinars: ZoomWebinar[] = []
  let nextPageToken = ''
  let pageCount = 0
  
  const { from, to } = getDateRange(daysBack)
  console.log(`Fetching webinars from ${from} to ${to} (${daysBack} days back)`)
  
  do {
    pageCount++
    console.log(`Fetching page ${pageCount} of webinars...`)
    
    const params = new URLSearchParams({
      page_size: '50',
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

    const data = await response.json()
    
    if (!response.ok) {
      console.error('Zoom API error:', data)
      throw new Error(`Zoom API error: ${data.message || data.error}`)
    }

    const webinars = data.webinars || []
    allWebinars = allWebinars.concat(webinars)
    nextPageToken = data.next_page_token || ''
    
    console.log(`Page ${pageCount}: Found ${webinars.length} webinars`)
    
    // Add small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200))
    
  } while (nextPageToken && pageCount < 50) // Increased safety limit for larger date range

  console.log(`Total webinars found: ${allWebinars.length}`)
  return allWebinars
}

export async function getWebinarDetails(webinarId: string, accessToken: string): Promise<any> {
  const detailResponse = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (detailResponse.ok) {
    return await detailResponse.json()
  }
  
  throw new Error(`Failed to get webinar details for ${webinarId}`)
}
