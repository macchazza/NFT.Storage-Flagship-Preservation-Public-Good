import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import config from '../../config/index.js'
import logger from '../../utils/logger.js'

const clientConfig: DynamoDBClientConfig = {
  region: config.aws_region,
  credentials: {
    accessKeyId: config.aws_access_key_id,
    secretAccessKey: config.aws_secret_access_key,
  },
}

if (config.environment === 'dev' || config.environment === 'test') {
  logger.info('Using local DynamoDB endpoint', { endpoint: config.dynamodb_endpoint })
  clientConfig.endpoint = config.dynamodb_endpoint
}

logger.info('Initializing DynamoDB client', {
  region: clientConfig.region,
  endpoint: clientConfig.endpoint,
  environment: config.environment,
})

const client = new DynamoDBClient(clientConfig)
const docClient = DynamoDBDocument.from(client)

// Test connection
docClient
  .scan({ TableName: 'auth', Limit: 1 })
  .then(() => logger.info('DynamoDB connection successful'))
  .catch((err) => logger.error('DynamoDB connection failed', { error: err.message }))

export default docClient
