import dbbClient from '../db/ddbClient.js'
import { tokenTable, pageSizeToken } from '../../config/constants.js'
import logger from '../../utils/logger.js'
import CustomError from '../../middlewares/error/customError.js'

type TokenList = {
  id: string
  tokenID: string
  cid: string
  fileSize: number
  dealStatus: string
  createdAt: number
}
type GetTokensResult = {
  tokens: TokenList[]
  lastEvaluatedKey: any
}

export default async (collectionID: string, exclusiveStartKey: any): Promise<GetTokensResult> => {
  try {
    const params = {
      TableName: tokenTable,
      IndexName: 'collectionID-createdAt-index',
      KeyConditionExpression: 'collectionID = :c',
      ExpressionAttributeValues: {
        ':c': collectionID,
      },
      ScanIndexForward: false,
      ProjectionExpression: 'id, tokenID, cid, fileSize, dealStatus, createdAt',
      Limit: pageSizeToken,
      ExclusiveStartKey: exclusiveStartKey,
    }

    const record = await dbbClient.query(params)
    return {
      tokens: (record.Items as TokenList[]) ?? [],
      lastEvaluatedKey: record.LastEvaluatedKey,
    }
  } catch (error: any) {
    logger.error(`Error in listing collection: ${error}`)
    throw new CustomError(500, `Internal Server Error.`)
  }
}
