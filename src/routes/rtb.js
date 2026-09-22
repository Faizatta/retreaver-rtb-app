import { Router } from 'express';
import { validateRtbInput } from '../utils/validator.js';
import { requestRtbReservation } from '../services/retreaver.js';

const router = Router();

/**
 * POST /api/rtb
 * Receives caller information, executes Retreaver RTB reservation,
 * and responds strictly with the DID or safe user-facing message.
 */
router.post('/rtb', async (req, res) => {
  let validatedParams;

  // 1. Input Validation
  try {
    validatedParams = validateRtbInput(req.body);
  } catch (validationErr) {
    return res.status(400).json({
      success: false,
      message: validationErr.message
    });
  }

  // 2. Request RTB Reservation from Backend Service
  try {
    const result = await requestRtbReservation(validatedParams);

    if (result.status === 'reserved') {
      return res.status(200).json({
        success: true,
        inbound_number: result.inbound_number
      });
    }

    if (result.status === 'no-target') {
      return res.status(200).json({
        success: false,
        message: 'No DID available'
      });
    }

    // Generic error handling (status === 'error')
    return res.status(400).json({
      success: false,
      message: result.message || 'Unable to get a DID. Please check the configuration and caller information.'
    });

  } catch (err) {
    // Unhandled exception fallback
    console.error('[RTB Route] Unexpected server error processing RTB request.');
    return res.status(500).json({
      success: false,
      message: 'Unable to get a DID. Please check the configuration and caller information.'
    });
  }
});

export default router;
