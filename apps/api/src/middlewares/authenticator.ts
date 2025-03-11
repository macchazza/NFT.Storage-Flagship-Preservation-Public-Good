import cjs from 'crypto-js'

import config from '../config/index.js'
import { verifyJWT } from '../utils/verifyJWT.js'
import CustomError from './error/customError.js'
import getKeyRecord from '../db/user/apiKey/getKeyRecordByHash.js'
import updateLastUsed from '../db/user/apiKey/updateLastUsed.js'
import { JWTPayload } from '../types/user.js'
import { type NextFunction, type Request, type Response } from 'express'
import logger from '../utils/logger.js'
import { API_KEY_ROLES } from '../config/apiKeyRoles.js'

const verifyAccessToken = async (accessToken: string) => {
  logger.info('Starting token verification')
  if (accessToken.split('.').length === 3) {
    logger.info('JWT token detected')
    const payload = verifyJWT(accessToken, config.jwt_secret) as JWTPayload
    if (payload.restricted) {
      throw new CustomError(403, 'Please accept the terms and condition.')
    }
    return payload
  } else {
    logger.info('API key detected')
    const keyHash = cjs.SHA256(accessToken).toString()
    logger.info('Key hash generated', { keyHash })
    const keyRecord = await getKeyRecord(keyHash)
    logger.info('Key record retrieved')
    await updateLastUsed(keyRecord.keyID)
    logger.info('Last used timestamp updated')
    return keyRecord
  }
}

export default (rules: string[] = [], clauses: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Starting authentication middleware')
      const { authorization } = req.headers
      const accessToken = authorization?.split(' ')[1]

      if (!accessToken) {
        throw new CustomError(401, 'Unauthorized: Access token missing.')
      }

      logger.info('Verifying access token')
      const keyRecord = await verifyAccessToken(accessToken)
      if (!keyRecord) {
        throw new CustomError(401, 'Unauthorized: Invalid access token.')
      }

      logger.info('Authentication successful')
      req.body.user = keyRecord
      next()
    } catch (error) {
      logger.error('Authentication error', error)
      next(error)
    }
  }
}

// Middleware to ensure only public API keys can access the endpoint
export const publicKeyOnly = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.body.user
      if (!user || user.userRole !== API_KEY_ROLES.PUBLIC) {
        throw new CustomError(403, 'This endpoint can only be accessed with a public API key.')
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
