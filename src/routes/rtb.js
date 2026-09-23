import { Router } from 'express';
import { validateRtbInput } from '../utils/validator.js';
import { requestRtbReservation } from '../services/retreaver.js';
import { recordLead, getTrackedLeads, clearTrackedLeads } from '../services/tracker.js';

const router = Router();

/**
 * POST /api/rtb
 * Receives caller information, executes Retreaver RTB reservation,
 * logs the reservation into the live tracker, and returns destination number.
 */
router.post('/rtb', async (req, res) => {
  let validatedParams;

  // 1. Input Validation
  try {
    validatedParams = validateRtbInput(req.body);
  } catch (validationErr) {
    return res.status(400).json({
      success: false,
      message: validationErr.message,
      error: validationErr.message
    });
  }

  // 2. Request RTB Reservation from Backend Service
  try {
    const result = await requestRtbReservation(validatedParams);

    if (result.status === 'reserved') {
      // Record lead in live tracking store
      recordLead({
        caller_number: validatedParams.caller_number,
        caller_state: validatedParams.caller_state,
        caller_zip: validatedParams.caller_zip,
        destination_number: result.inbound_number,
        retreaver_uuid: result.retreaver_uuid
      });

      return res.status(200).json({
        success: true,
        inbound_number: result.inbound_number,
        number: result.inbound_number, // for pingbidpost.world client compatibility
        retreaver_uuid: result.retreaver_uuid
      });
    }

    if (result.status === 'no-target') {
      if (result.retreaver_uuid) {
        recordLead({
          caller_number: validatedParams.caller_number,
          caller_state: validatedParams.caller_state,
          caller_zip: validatedParams.caller_zip,
          destination_number: 'No DID Available',
          retreaver_uuid: result.retreaver_uuid,
          status: 'No Call Buyer'
        });
      }

      return res.status(200).json({
        success: false,
        message: 'No DID available (No Call Buyer)',
        number: null,
        retreaver_uuid: result.retreaver_uuid
      });
    }

    // Generic error handling (status === 'error')
    return res.status(400).json({
      success: false,
      message: result.message || 'Unable to get a DID. Please check the configuration and caller information.',
      error: result.message || 'Unable to get a DID. Please check the configuration and caller information.'
    });

  } catch (err) {
    // Unhandled exception fallback
    console.error('[RTB Route] Unexpected server error processing RTB request.');
    return res.status(500).json({
      success: false,
      message: 'Unable to get a DID. Please check the configuration and caller information.',
      error: 'Unable to get a DID. Please check the configuration and caller information.'
    });
  }
});

/**
 * GET /api/tracking
 * Returns all tracked caller IDs, DIDs, states, ZIPs, and timestamps.
 */
router.get('/tracking', (req, res) => {
  const leads = getTrackedLeads();
  res.json({
    success: true,
    count: leads.length,
    leads
  });
});

/**
 * DELETE /api/tracking
 * Clears tracked lead history.
 */
router.delete('/tracking', (req, res) => {
  clearTrackedLeads();
  res.json({
    success: true,
    message: 'Tracking history cleared.'
  });
});

export default router;
