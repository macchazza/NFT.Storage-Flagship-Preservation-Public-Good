import express from 'express'
import { check_preservation_status } from '../controller/preservation/index.js'
import validator from '../middlewares/validators/index.js'
import validate from '../middlewares/validate.js'
import authenticator, { publicKeyOnly } from '../middlewares/authenticator.js'
import { preservationRateLimit } from '../middlewares/rateLimit.js'

const router = express.Router()

// Preservation status check endpoint
router.get(
  '/check',
  validate(validator.PreservationCheckSchema, { query: true }),
  authenticator(),
  publicKeyOnly(),
  preservationRateLimit,
  check_preservation_status,
)

export default router
