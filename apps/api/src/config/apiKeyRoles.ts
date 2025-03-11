export const API_KEY_ROLES = {
  PRIVATE: 'private',
  PUBLIC: 'public',
} as const

export type APIKeyRole = (typeof API_KEY_ROLES)[keyof typeof API_KEY_ROLES]

export const API_KEY_PERMISSIONS = {
  [API_KEY_ROLES.PRIVATE]: {
    description: 'Full access for backend-to-backend integration',
    rateLimitPerHour: null, // No limit
    endpoints: ['*'],
  },
  [API_KEY_ROLES.PUBLIC]: {
    description: 'Limited read-only access for preservation status checks',
    rateLimitPerHour: 100000, // 100k requests per hour
    endpoints: ['/api/v1/preservation/check'],
  },
} as const
