import { type NextFunction, type Request, type Response } from 'express'
import { getTokenByCID } from '../../db/collection/getTokenByCID.js'
import responseParser from '../../utils/responseParser.js'
import logger from '../../utils/logger.js'
import CustomError from '../../middlewares/error/customError.js'

export const check_preservation_status = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cid, chain_id, collection_address, token_id } = req.query

    logger.info('Checking preservation status', {
      cid,
      chain_id,
      collection_address,
      token_id,
    })

    if (!cid) {
      throw new CustomError(400, 'CID is required')
    }

    const token = await getTokenByCID({
      cid: cid as string,
      chain_id: chain_id as string,
      collection_address: collection_address as string,
      token_id: token_id as string,
    })

    if (!token) {
      return res.status(200).json(
        responseParser({
          chain_id: chain_id || null,
          available: false,
          token_id: token_id || null,
          collection_address: collection_address || null,
          url: `ipfs://${cid}`,
          timestamp: new Date().toISOString(),
        }),
      )
    }

    const isPreserved = token.dealStatus === 'complete'
    return res.status(200).json(
      responseParser({
        chain_id: chain_id || null,
        available: isPreserved,
        token_id: token_id || token.tokenID || null,
        collection_address: collection_address || null,
        url: `ipfs://${cid}`,
        timestamp: isPreserved ? new Date(token.updatedAt).toISOString() : new Date().toISOString(),
      }),
    )
  } catch (error) {
    next(error)
  }
}
