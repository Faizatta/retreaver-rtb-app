import { validateRtbInput } from '../src/utils/validator.js';
import { requestRtbReservation } from '../src/services/retreaver.js';
import { recordLead } from '../src/services/tracker.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let validatedParams;
  try {
    validatedParams = validateRtbInput(req.body);
  } catch (validationErr) {
    return res.status(400).json({
      success: false,
      message: validationErr.message,
      error: validationErr.message
    });
  }

  try {
    const result = await requestRtbReservation(validatedParams);

    if (result.status === 'reserved') {
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
        number: result.inbound_number,
        retreaver_uuid: result.retreaver_uuid
      });
    }

    if (result.status === 'no-target') {
      return res.status(200).json({
        success: false,
        message: 'No DID available',
        number: null
      });
    }

    return res.status(400).json({
      success: false,
      message: result.message || 'Unable to get a DID. Please check caller details.',
      error: result.message || 'Unable to get a DID.'
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Unable to get a DID. Server error.',
      error: 'Unable to get a DID.'
    });
  }
}
