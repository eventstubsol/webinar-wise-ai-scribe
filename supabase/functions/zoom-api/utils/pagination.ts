
export async function fetchAllPaginatedData<T>(
  baseUrl: string,
  headers: Record<string, string>,
  pageSize: number = 300
): Promise<T[]> {
  const allData: T[] = [];
  let nextPageToken = '';
  let pageCount = 0;
  const maxPages = 100; // Safety limit
  
  do {
    pageCount++;
    const url = nextPageToken 
      ? `${baseUrl}?page_size=${pageSize}&next_page_token=${nextPageToken}`
      : `${baseUrl}?page_size=${pageSize}`;
    
    console.log(`[Pagination] Fetching page ${pageCount}: ${url}`);
    
    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          console.log(`[Pagination] Rate limited, waiting ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue; // Retry same page
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
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
      
      // Implement exponential backoff retry
      if (pageCount <= 3) { // Retry first 3 pages
        const backoffTime = Math.pow(2, pageCount) * 1000; // 2s, 4s, 8s
        console.log(`[Pagination] Retrying in ${backoffTime}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue; // Retry same page
      }
      
      throw error; // Give up after 3 retries
    }
    
  } while (nextPageToken && pageCount < maxPages);
  
  console.log(`[Pagination] Completed: ${allData.length} total items across ${pageCount} pages`);
  return allData;
}
