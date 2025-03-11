import dbbClient from '../db/ddbClient.js'
import { tokenTable } from '../../config/constants.js'
import { Token } from '../../types/collection.js'
import logger from '../../utils/logger.js'
import CustomError from '../../middlewares/error/customError.js'

interface DynamoDBError extends Error {
  code?: string
  statusCode?: number
}

interface TokenQuery {
  cid: string
  chain_id?: string
  collection_address?: string
  token_id?: string
}

interface DynamoDBExpressionValues {
  [key: string]: string
}

export const getTokenByCID = async ({
  cid,
  chain_id,
  collection_address,
  token_id,
}: TokenQuery): Promise<Token | null> => {
  try {
    if (!cid) {
      throw new CustomError(400, 'CID is required')
    }

    logger.info('Getting token by CID and optional params', {
      cid,
      chain_id: chain_id || 'not provided',
      collection_address: collection_address || 'not provided',
      token_id: token_id || 'not provided',
    })

    const ExpressionAttributeValues: DynamoDBExpressionValues = { ':c': cid }
    const FilterExpression: string[] = []

    // Only add defined parameters to the query
    if (chain_id !== undefined && chain_id !== '') {
      FilterExpression.push('chainID = :chainId')
      ExpressionAttributeValues[':chainId'] = chain_id
    }

    if (collection_address !== undefined && collection_address !== '') {
      FilterExpression.push('contractAddress = :addr')
      ExpressionAttributeValues[':addr'] = collection_address
    }

    if (token_id !== undefined && token_id !== '') {
      FilterExpression.push('tokenID = :tokenId')
      ExpressionAttributeValues[':tokenId'] = token_id
    }

    const params = {
      TableName: tokenTable,
      FilterExpression: ['cid = :c', ...FilterExpression].join(' AND '),
      ExpressionAttributeValues,
    }

    logger.info('DynamoDB query params', params)

    try {
      const record = await dbbClient.scan(params)
      const Items = record.Items ?? []

      if (Items.length === 0) {
        logger.info('No token found for query', { cid, chain_id, collection_address, token_id })
        return null
      }

      logger.info('Token found', {
        cid,
        tokenId: Items[0].id,
        chainId: Items[0].chainID,
        contractAddress: Items[0].contractAddress,
        tokenID: Items[0].tokenID,
      })
      return Items[0] as Token
    } catch (dbError: unknown) {
      const error = dbError as DynamoDBError
      logger.error('DynamoDB query error', {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        name: error.name,
        params,
      })
      throw new CustomError(500, 'Database query failed')
    }
  } catch (error: unknown) {
    if (error instanceof CustomError) {
      throw error
    }
    const dbError = error as DynamoDBError
    logger.error('Error getting token by CID', {
      error: dbError.message,
      code: dbError.code,
      statusCode: dbError.statusCode,
      name: dbError.name,
    })
    throw new CustomError(500, 'Internal Server Error')
  }
}
