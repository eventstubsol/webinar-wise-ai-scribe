
export interface RateLimiter {
  requestCount: number
  dailyLimit: number
  lastReset: Date
  requestQueue: Array<() => Promise<any>>
  processing: boolean
}

export interface SyncConfig {
  webinarBatchSize: number
  webinarDelay: number
  participantsBatchSize: number
  participantsDelay: number
  chatBatchSize: number
  chatDelay: number
  pollsBatchSize: number
  pollsDelay: number
  qaBatchSize: number
  qaDelay: number
  registrationsBatchSize: number
  registrationsDelay: number
  maxRetries: number
  baseBackoff: number
}

export const DEFAULT_CONFIG: SyncConfig = {
  webinarBatchSize: 10,
  webinarDelay: 500,
  participantsBatchSize: 5,
  participantsDelay: 1000,
  chatBatchSize: 8,
  chatDelay: 300,
  pollsBatchSize: 8,
  pollsDelay: 300,
  qaBatchSize: 8,
  qaDelay: 300,
  registrationsBatchSize: 8,
  registrationsDelay: 300,
  maxRetries: 3,
  baseBackoff: 1000
}

export class ZoomRateLimiter {
  private limiter: RateLimiter

  constructor() {
    this.limiter = {
      requestCount: 0,
      dailyLimit: 1000, // Conservative daily limit
      lastReset: new Date(),
      requestQueue: [],
      processing: false
    }
  }

  async makeRequest<T>(requestFn: () => Promise<T>, retryCount = 0): Promise<T> {
    // Check if we need to reset daily counter
    const now = new Date()
    if (now.getDate() !== this.limiter.lastReset.getDate()) {
      this.limiter.requestCount = 0
      this.limiter.lastReset = now
    }

    // Check daily limit
    if (this.limiter.requestCount >= this.limiter.dailyLimit) {
      throw new Error('Daily rate limit reached. Please try again tomorrow.')
    }

    try {
      this.limiter.requestCount++
      const response = await requestFn()
      return response
    } catch (error: any) {
      if (error.message?.includes('429') || error.status === 429) {
        if (retryCount < DEFAULT_CONFIG.maxRetries) {
          const backoffDelay = DEFAULT_CONFIG.baseBackoff * Math.pow(2, retryCount)
          console.log(`Rate limited, backing off for ${backoffDelay}ms (attempt ${retryCount + 1})`)
          await this.delay(backoffDelay)
          return this.makeRequest(requestFn, retryCount + 1)
        }
        throw new Error('Rate limit exceeded after maximum retries')
      }
      throw error
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number,
    delayMs: number,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(
        batch.map(item => this.makeRequest(() => processor(item)))
      )
      
      results.push(...batchResults)
      
      if (progressCallback) {
        progressCallback(i + batch.length, items.length)
      }
      
      // Add delay between batches (except for the last batch)
      if (i + batchSize < items.length) {
        await this.delay(delayMs)
      }
    }
    
    return results
  }

  get requestCount(): number {
    return this.limiter.requestCount
  }

  delay(ms: number): Promise<void> {
    return this.delay(ms)
  }
}
