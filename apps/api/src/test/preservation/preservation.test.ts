import request from 'supertest'
import app from '../../app.js'

describe('Preservation', () => {
  beforeAll(async () => {
    // Verify we have the required environment variables for testing
    expect(process.env.TEST_PUBLIC_API_KEY).toBeDefined()
    expect(process.env.TEST_API_KEY).toBeDefined()
  })

  describe('GET /api/v1/preservation/check', () => {
    it('should return 400 without CID', async () => {
      const response = await request(app)
        .get('/api/v1/preservation/check')
        .set('Authorization', `Bearer ${process.env.TEST_PUBLIC_API_KEY}`)
      expect(response.status).toBe(400)
      expect(response.body.error).toEqual({
        message: 'CID is required',
        param: 'cid',
      })
    })

    it('should return 403 when using private API key', async () => {
      const response = await request(app)
        .get('/api/v1/preservation/check?cid=test-cid')
        .set('Authorization', `Bearer ${process.env.TEST_API_KEY}`)
      expect(response.status).toBe(403)
      expect(response.body.error).toBeDefined()
    })

    it('should return preservation status for non-existent CID', async () => {
      const cid = 'non-existent-cid'
      const response = await request(app)
        .get(`/api/v1/preservation/check?cid=${cid}`)
        .set('Authorization', `Bearer ${process.env.TEST_PUBLIC_API_KEY}`)
      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)
      expect(response.body.value).toEqual({
        chain_id: null,
        available: false,
        token_id: null,
        collection_address: null,
        url: `ipfs://${cid}`,
        timestamp: expect.any(String),
      })
    })

    it('should return preservation status with optional parameters', async () => {
      const params = {
        cid: 'test-cid',
        chain_id: 'ethereum',
        collection_address: '0x123',
        token_id: '42',
      }
      const response = await request(app)
        .get('/api/v1/preservation/check')
        .query(params)
        .set('Authorization', `Bearer ${process.env.TEST_PUBLIC_API_KEY}`)

      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)
      expect(response.body.value).toEqual({
        chain_id: params.chain_id,
        available: false,
        token_id: params.token_id,
        collection_address: params.collection_address,
        url: `ipfs://${params.cid}`,
        timestamp: expect.any(String),
      })
    })

    it('should respect rate limits for public API keys', async () => {
      const response = await request(app)
        .get('/api/v1/preservation/check?cid=test-cid')
        .set('Authorization', `Bearer ${process.env.TEST_PUBLIC_API_KEY}`)

      expect(response.status).toBe(200)
      expect(response.headers['ratelimit-limit']).toBe('1000')
      expect(response.headers['ratelimit-remaining']).toBeDefined()
      expect(response.headers['ratelimit-reset']).toBeDefined()

      // Verify the remaining count is a number less than the limit
      const remaining = parseInt(response.headers['ratelimit-remaining'])
      expect(remaining).toBeLessThanOrEqual(1000)
      expect(remaining).toBeGreaterThanOrEqual(0)

      // Verify reset is a future timestamp
      const reset = parseInt(response.headers['ratelimit-reset'])
      expect(reset).toBeGreaterThan(Date.now() / 1000)
    })

    it('should return current timestamp for non-existent content', async () => {
      const params = {
        cid: 'non-existent-cid',
      }
      const beforeRequest = new Date()
      const response = await request(app)
        .get('/api/v1/preservation/check')
        .query(params)
        .set('Authorization', `Bearer ${process.env.TEST_PUBLIC_API_KEY}`)
      const afterRequest = new Date()

      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)
      expect(response.body.value).toEqual({
        chain_id: null,
        available: false,
        token_id: null,
        collection_address: null,
        url: `ipfs://${params.cid}`,
        timestamp: expect.any(String),
      })

      // Verify timestamp is within the request window
      const responseTime = new Date(response.body.value.timestamp)
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime())
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterRequest.getTime())
    })

    it('should return preservation status for a preserved CID', async () => {
      const preservedCid = 'bafkreigqkrsbhdsia4qqzl222gci536cj3vlwwrpzwskxqrsrxbziz3dri'
      const response = await request(app)
        .get(`/api/v1/preservation/check?cid=${preservedCid}`)
        .set('Authorization', `Bearer ${process.env.TEST_PUBLIC_API_KEY}`)

      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)
      expect(response.body.value).toEqual(
        expect.objectContaining({
          available: true,
        }),
      )

      // Verify the timestamp is a valid date
      expect(() => new Date(response.body.value.timestamp)).not.toThrow()
    })
  })
})
