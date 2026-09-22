import config from '../config.js';

/**
 * Service to interact with the Retreaver Real-Time Bidding (RTB) API.
 * Guarantees strict confidentiality of server credentials and limits
 * returned payload strictly to the inbound DID.
 *
 * @param {{ caller_number: string, caller_zip: string, caller_state: string }} params
 * @param {object} [options] Optional overrides for testing
 * @returns {Promise<{ status: 'reserved' | 'no-target' | 'error', inbound_number?: string, message?: string }>}
 */
export async function requestRtbReservation(params, options = {}) {
  const endpoint = options.endpoint || (config ? config.retreaverEndpoint : process.env.RETREAVER_RTB_ENDPOINT) || 'https://rtb.retreaver.com/rtbs.json';
  const key = options.key || (config ? config.retreaverRtbKey : process.env.RETREAVER_RTB_KEY);
  const publisherId = options.publisherId || (config ? config.retreaverPublisherId : process.env.RETREAVER_PUBLISHER_ID);

  const isDemo = ((config && config.demoMode) || options.demoMode) && !options.endpoint;

  if (isDemo) {
    // Simulate real RTB auction latency
    await new Promise(res => setTimeout(res, 400));
    return {
      status: 'reserved',
      inbound_number: '+18772435010'
    };
  }

  if (!key || !publisherId) {
    return {
      status: 'error',
      message: 'Unable to get a DID. Please check the configuration and caller information.'
    };
  }

  const campaignId = options.campaignId || (config ? config.retreaverCampaignId : process.env.RETREAVER_CAMPAIGN_ID);

  const payload = {
    key,
    publisher_id: publisherId,
    caller_number: params.caller_number,
    caller_zip: params.caller_zip,
    caller_state: params.caller_state
  };

  if (campaignId) {
    payload.campaign_id = campaignId;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // If HTTP status is not 2xx (e.g., 401 Unauthorized, 422 Unprocessable, 500)
    if (!response.ok) {
      // NOTE: Never log the key or request/response payload
      console.warn(`[RTB Service] Upstream Retreaver returned HTTP status: ${response.status}`);
      return {
        status: 'error',
        message: 'Unable to get a DID. Please check the configuration and caller information.'
      };
    }

    const data = await response.json();

    // Check for "no-target" or "rejected" (no reservation available) response
    if (data && (data.status === 'no-target' || data.status === 'rejected')) {
      return {
        status: 'no-target',
        message: 'No DID available'
      };
    }

    // Check for successful reservation with inbound_number
    if (data && data.inbound_number) {
      // Return ONLY inbound_number.
      // Explicitly discard: retreaver_payout, retreaver_seconds, uuid, sip_address, expires_at, buyer info, etc.
      return {
        status: 'reserved',
        inbound_number: String(data.inbound_number).trim()
      };
    }

    // Upstream returned unexpected or unhandled structure
    console.warn('[RTB Service] Upstream response did not contain a valid inbound_number or expected status.');
    return {
      status: 'error',
      message: 'Unable to get a DID. Please check the configuration and caller information.'
    };

  } catch (err) {
    // Network errors, aborts, or JSON parse errors
    console.error(`[RTB Service] Communication error: ${err.name === 'AbortError' ? 'Request timed out' : 'Failed to connect to upstream'}`);
    return {
      status: 'error',
      message: 'Unable to get a DID. Please check the configuration and caller information.'
    };
  }
}
