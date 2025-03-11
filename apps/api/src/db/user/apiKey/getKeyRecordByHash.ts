import dbbClient from '../../db/ddbClient.js'
import { authTable } from '../../../config/constants.js'
import logger from '../../../utils/logger.js'
import CustomError from '../../../middlewares/error/customError.js'

type GetKeyRecordByHash = {
  keyID: string
  keyHash: string
  keyName: string
  userID: string
  userRole: string
  lastUsed: number
}

export default async (keyhash: string): Promise<GetKeyRecordByHash> => {
  try {
    logger.info('Starting getKeyRecordByHash', { keyhash })
    const params = {
      TableName: authTable,
      IndexName: 'keyHash-index',
      KeyConditionExpression: 'keyHash = :k',
      ExpressionAttributeValues: {
        ':k': keyhash,
      },
      ProjectionExpression: 'keyID, keyName, keyHash, userID, userRole, lastUsed',
    }
    logger.info('DynamoDB query params', params)

    logger.info('Executing DynamoDB query')
    const record = await dbbClient.query(params)
    logger.info('DynamoDB query completed', { itemCount: record.Items?.length })

    const Items = record.Items ?? []
    if (Items.length === 0) {
      logger.warn('No key record found')
      throw new CustomError(404, `Key record not found.`)
    }
    logger.info('Key record found')
    return Items[0] as GetKeyRecordByHash
  } catch (error: any) {
    logger.error('Error in fetch key record', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      name: error.name
    })
    throw new CustomError(401, `Unauthorized: Invalid access token.`)
  }
}
