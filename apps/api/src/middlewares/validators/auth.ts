import joi from 'joi'

export const registerSchema = joi.object({
  email: joi.string().max(200).email().required().messages({
    'any.required': 'email not found.',
  }),
  marketingEmail: joi.boolean().default(true),
})

export const loginSchema = joi.object({
  email: joi.string().max(200).email().required().messages({
    'any.required': 'email not found.',
  }),
})

export const verificationTokenSchema = joi.object({
  verification_token: joi.string().length(64).required().messages({
    'any.required': 'verification token not found.',
  }),
})

export const NewAPIKeySchema = joi.object({
  keyName: joi.string().max(50).required().messages({
    'any.required': 'keyName not found.',
  }),
  role: joi.string().default('user'),
  apiKeyType: joi.string().valid('private', 'public').default('private').messages({
    'any.only': 'apiKeyType must be one of: private, public',
  }),
})

export const APIKeyIDSchema = joi.object({
  keyID: joi.string().max(50).required().messages({
    'any.required': 'keyID not found.',
  }),
})

export const gitOAuth = joi.object({
  code: joi.string().max(100).required().messages({
    'any.required': 'code not found.',
  }),
  emailOpt: joi.boolean(),
})

export const PreservationCheckSchema = joi.object({
  cid: joi.string().required().messages({
    'any.required': 'CID is required',
  }),
  chain_id: joi.string().messages({
    'string.base': 'chain_id must be a string',
  }),
  collection_address: joi.string().messages({
    'string.base': 'collection_address must be a string',
  }),
  token_id: joi.string().messages({
    'string.base': 'token_id must be a string',
  }),
})
