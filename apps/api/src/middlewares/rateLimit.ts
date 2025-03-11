import rateLimit, { Store, IncrementResponse } from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'
import ddbClient from '../db/db/ddbClient.js'
import { GetCommandOutput, UpdateCommandOutput } from '@aws-sdk/lib-dynamodb'
import { ReturnValue } from '@aws-sdk/client-dynamodb'
import logger from '../utils/logger.js'
import { authTable } from '../config/constants.js'

// Rate limit configurations for different endpoints/roles
export const RATE_LIMITS = {
  preservation: {
    public: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 1000, // requests per day
    },
    // Add other roles if needed
    // private: {
    //   windowMs: 24 * 60 * 60 * 1000,
    //   max: 10000,
    // }
  },
  // Add other endpoints if needed
  // uploads: {
  //   public: { ... }
  // }
} as const

// Custom store implementation for express-rate-limit
class DynamoDBStore implements Store {
  private windowMs: number = 60 * 60 * 1000 // Default 1 hour

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs
    logger.debug('Initialized rate limit store', { windowMs: this.windowMs })
  }

  async get(key: string): Promise<IncrementResponse | undefined> {
    try {
      if (!ddbClient) {
        logger.error('Rate limit: DynamoDB client not initialized')
        return undefined
      }

      const params = {
        TableName: authTable,
        Key: { keyID: key },
      }

      const result = (await ddbClient.get(params)) as GetCommandOutput
      if (!result.Item) {
        return undefined
      }

      const resetTimeMs = Number(result.Item.resetTime || 0)
      const now = Date.now()

      // If the reset time has passed, return undefined to trigger a new period
      if (resetTimeMs < now) {
        logger.debug('Rate limit: Reset time passed, starting new period', {
          key,
          resetTimeMs,
          now,
        })
        return undefined
      }

      // Convert to Unix timestamp (seconds) and ensure it's in the future
      const resetTimeUnix = Math.ceil(Math.max(resetTimeMs, now + this.windowMs) / 1000)
      // Create a Date object from the Unix timestamp
      const resetTime = new Date(resetTimeUnix * 1000)

      logger.debug('Rate limit: Got counter', {
        key,
        hits: result.Item.hits,
        resetTimeMs,
        resetTimeUnix,
        now,
      })

      return {
        totalHits: Number(result.Item.hits || 0),
        resetTime,
      }
    } catch (error) {
      logger.error('Rate limit: Error getting counter', {
        key,
        error: error instanceof Error ? error.message : error,
      })
      return undefined
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    const operationStart = Date.now()
    // Calculate reset time in Unix timestamp (seconds)
    const resetTimeUnix = Math.ceil((Date.now() + this.windowMs) / 1000)
    // Create a Date object from the Unix timestamp
    const resetTime = new Date(resetTimeUnix * 1000)

    try {
      if (!ddbClient) {
        logger.error('Rate limit: DynamoDB client not initialized')
        return { totalHits: 1, resetTime }
      }

      const params = {
        TableName: authTable,
        Key: { keyID: key },
        UpdateExpression: 'SET hits = if_not_exists(hits, :zero) + :inc, resetTime = if_not_exists(resetTime, :reset)',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0,
          ':reset': resetTimeUnix * 1000, // Store as milliseconds in DynamoDB
        },
        ReturnValues: ReturnValue.ALL_NEW,
      }

      logger.debug('Rate limit: DynamoDB update attempt', {
        params,
        resetTimeUnix,
        duration: Date.now() - operationStart,
      })

      const result = (await ddbClient.update(params)) as UpdateCommandOutput
      const hits = Number(result.Attributes?.hits || 1)
      const storedResetTimeMs = Number(result.Attributes?.resetTime || resetTimeUnix * 1000)
      const storedResetTimeUnix = Math.ceil(storedResetTimeMs / 1000)
      const storedResetTime = new Date(storedResetTimeUnix * 1000)

      logger.debug('Rate limit: DynamoDB increment success', {
        key,
        hits,
        resetTimeUnix: storedResetTimeUnix,
        duration: Date.now() - operationStart,
      })

      return {
        totalHits: hits,
        resetTime: storedResetTime,
      }
    } catch (error) {
      logger.error('Rate limit: DynamoDB increment failed', {
        key,
        error: error instanceof Error ? error.message : error,
        duration: Date.now() - operationStart,
      })
      return {
        totalHits: 1,
        resetTime,
      }
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      if (!ddbClient) {
        logger.error('Rate limit: DynamoDB client not initialized')
        return
      }

      const params = {
        TableName: authTable,
        Key: { keyID: key },
        UpdateExpression: 'SET hits = if_not_exists(hits, :zero)',
        ExpressionAttributeValues: {
          ':zero': 0,
        },
        ConditionExpression: 'hits > :zero',
      }

      await ddbClient.update(params)
      logger.debug('Rate limit: Decrement success', { key })
    } catch (error) {
      // Ignore ConditionalCheckFailedException as it just means hits was already 0
      if (error && typeof error === 'object' && 'name' in error && error.name !== 'ConditionalCheckFailedException') {
        logger.error('Rate limit: Decrement failed', {
          key,
          error: error instanceof Error ? error.message : error,
        })
      }
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      if (!ddbClient) {
        logger.error('Rate limit: DynamoDB client not initialized')
        return
      }

      const params = {
        TableName: authTable,
        Key: { keyID: key },
        UpdateExpression: 'SET hits = :zero REMOVE resetTime',
        ExpressionAttributeValues: {
          ':zero': 0,
        },
      }

      await ddbClient.update(params)
      logger.debug('Rate limit: Reset key success', { key })
    } catch (error) {
      logger.error('Rate limit: Reset key failed', {
        key,
        error: error instanceof Error ? error.message : error,
      })
    }
  }
}

interface RateLimitOptions {
  windowMs: number
  max: number
  endpoint: string
}

/**
 * Creates a rate limiter middleware using DynamoDB as the store
 * @param options Configuration options for the rate limiter
 * @returns Express middleware for rate limiting
 */
export const createRateLimit = ({ windowMs, max, endpoint }: RateLimitOptions) => {
  logger.info('Creating rate limit middleware', { endpoint, windowMs, max })

  // Create and initialize the store
  const store = new DynamoDBStore()
  store.init({ windowMs })

  // Create the base rate limiter
  const rateLimiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    keyGenerator: (req: Request) => {
      const apiKey = req.headers.authorization?.split(' ')[1]
      const key = `rate-limit:${endpoint}:${apiKey}`
      logger.debug('Generated rate limit key', { key, endpoint })
      return key
    },
    handler: (req: Request, res: Response) => {
      const resetTime = res.getHeader('RateLimit-Reset')
      const limit = res.getHeader('RateLimit-Limit')
      const remaining = res.getHeader('RateLimit-Remaining')

      logger.debug('Rate limit headers before processing', {
        resetTime,
        limit,
        remaining,
        resetTimeType: typeof resetTime,
        resetTimeIsDate: resetTime instanceof Date,
      })

      // Calculate reset time as Unix timestamp (seconds)
      const now = Date.now()
      const resetTimeUnix = Math.ceil((now + windowMs) / 1000)

      logger.debug('Rate limit timestamp calculation', {
        now,
        windowMs,
        resetTimeUnix,
        nowUnix: Math.floor(now / 1000),
      })

      // Set headers with the calculated reset time
      res.setHeader('RateLimit-Reset', String(resetTimeUnix))
      res.setHeader('RateLimit-Limit', String(max))
      res.setHeader('RateLimit-Remaining', '0')

      logger.debug('Rate limit headers after setting', {
        reset: res.getHeader('RateLimit-Reset'),
        limit: res.getHeader('RateLimit-Limit'),
        remaining: res.getHeader('RateLimit-Remaining'),
      })

      res.status(429).json({
        error: 'Too many requests, please try again later.',
        reset: resetTimeUnix,
        limit: max,
        windowMs,
      })
    },
    skip: (req: Request) => {
      // Skip rate limiting if no API key is present (will be caught by auth middleware)
      const hasApiKey = !!req.headers.authorization?.split(' ')[1]
      if (!hasApiKey) {
        logger.debug('Skipping rate limit check - no API key present', { endpoint })
      }
      return !hasApiKey
    },
  })

  // Return a wrapped middleware that adds logging and timeout
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    logger.info('Rate limit middleware hit', {
      endpoint,
      method: req.method,
      path: req.path,
      auth: req.headers.authorization,
      startTime,
    })

    // Set a timeout for the entire middleware
    const timeoutId = setTimeout(() => {
      logger.error('Rate limit middleware timed out', {
        endpoint,
        method: req.method,
        path: req.path,
        duration: Date.now() - startTime,
      })
      next()
    }, 15000)

    try {
      logger.debug('Calling rate limiter middleware')

      // Intercept the response to ensure headers are set correctly
      const originalSetHeader = res.setHeader.bind(res)
      res.setHeader = function (name: string, value: number | string | string[]) {
        if (name === 'RateLimit-Reset') {
          const now = Date.now()
          const resetTimeUnix = Math.ceil((now + windowMs) / 1000)
          logger.debug('Intercepted RateLimit-Reset header', {
            original: value,
            calculated: resetTimeUnix,
            now,
            windowMs,
          })
          return originalSetHeader(name, String(resetTimeUnix))
        }
        return originalSetHeader(name, value)
      }

      // Create a promise to handle the rate limiter callback
      const rateLimitPromise = new Promise<void>((resolve, reject) => {
        rateLimiter(req, res, (err?: string | Error) => {
          logger.debug('Rate limiter callback received', {
            hasError: !!err,
            duration: Date.now() - startTime,
            headers: {
              reset: res.getHeader('RateLimit-Reset'),
              limit: res.getHeader('RateLimit-Limit'),
              remaining: res.getHeader('RateLimit-Remaining'),
            },
          })
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })

      // Handle the rate limiter promise
      rateLimitPromise
        .then(() => {
          clearTimeout(timeoutId)
          logger.debug('Rate limiter completed successfully', {
            duration: Date.now() - startTime,
          })
          next()
        })
        .catch((err) => {
          clearTimeout(timeoutId)
          const error = err instanceof Error ? err : new Error(String(err))
          logger.error('Rate limiter middleware error', {
            error: error.message,
            stack: error.stack,
            endpoint,
            method: req.method,
            path: req.path,
            duration: Date.now() - startTime,
          })
          next()
        })
    } catch (error) {
      clearTimeout(timeoutId)
      logger.error('Unexpected error in rate limiter middleware', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        endpoint,
        method: req.method,
        path: req.path,
        duration: Date.now() - startTime,
      })
      next()
    }
  }
}

// Create middleware instances for different endpoints
export const preservationRateLimit = createRateLimit({
  ...RATE_LIMITS.preservation.public,
  endpoint: 'preservation',
})

// Export other rate limiters as needed
// export const uploadsRateLimit = createRateLimit({ ...RATE_LIMITS.uploads.public, endpoint: 'uploads' })
