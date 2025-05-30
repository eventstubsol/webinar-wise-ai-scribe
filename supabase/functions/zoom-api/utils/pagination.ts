
export async function fetchAllPaginatedData<T>(
  baseUrl: string,
  headers: Record<string, string>,
  pageSize: number = 300
): Promise<T[]> {
  const allData: T[] = [];
  let nextPageToken = '';
  let pageCount = 0;
  const maxPages = 100; // Safety limit
  
  // Add include_fields parameter for participant endpoints
  const includeFields = baseUrl.includes('/participants') 
    ? 'registrant_id,user_id,id,participant_user_id,name,user_name,email,user_email,join_time,leave_time,duration,device_type,ip_address,location,network_type'
    : '';
  
  do {
    pageCount++;
    
    // Build URL with proper query parameter handling
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set('page_size', pageSize.toString());
    
    if (includeFields) {
      urlObj.searchParams.set('include_fields', includeFields);
    }
    
    if (nextPageToken) {
      urlObj.searchParams.set('next_page_token', nextPageToken);
    }
    
    const url = urlObj.toString();
    
    console.log(`[Pagination] Fetching page ${pageCount}: ${url}`);
    
    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[Pagination] Resource not found (404): ${url}. This may be expected for old webinars (30+ days).`);
          break; // Stop pagination for 404s
        }
        
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          console.log(`[Pagination] Rate limited, waiting ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue; // Retry same page
        }
        
        // For other errors, log and continue to next page to avoid breaking entire sync
        console.error(`[Pagination] HTTP ${response.status} for ${url}: ${response.statusText}`);
        if (pageCount <= 3) { // Only retry first few pages
          const backoffTime = Math.pow(2, pageCount) * 1000;
          console.log(`[Pagination] Retrying in ${backoffTime}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        break; // Give up after retries
      }
      
      const data = await response.json();
      
      // Log raw response for debugging (first page only to avoid spam)
      if (pageCount === 1 && baseUrl.includes('/participants')) {
        console.log(`[Pagination] Sample participant data structure:`, JSON.stringify(data, null, 2));
      }
      
      // Handle different response structures
      const items = data.participants || data.registrants || data.instances || [];
      allData.push(...items);
      
      nextPageToken = data.next_page_token || '';
      
      console.log(`[Pagination] Page ${pageCount}: Got ${items.length} items, next_page_token: ${nextPageToken ? 'exists' : 'empty'}`);
      
      // Safety break
      if (pageCount >= maxPages) {
        console.warn(`[Pagination] Reached maximum pages (${maxPages}), stopping`);
        break;
      }
      
    } catch (error) {
      console.error(`[Pagination] Error on page ${pageCount}:`, error);
      
      // Implement exponential backoff retry for network errors
      if (pageCount <= 3) {
        const backoffTime = Math.pow(2, pageCount) * 1000;
        console.log(`[Pagination] Retrying in ${backoffTime}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue;
      }
      
      // Log error but don't throw to allow other webinars to continue processing
      console.error(`[Pagination] Giving up on ${baseUrl} after ${pageCount} attempts`);
      break;
    }
    
  } while (nextPageToken && pageCount < maxPages);
  
  console.log(`[Pagination] Completed: ${allData.length} total items across ${pageCount} pages`);
  return allData;
}
