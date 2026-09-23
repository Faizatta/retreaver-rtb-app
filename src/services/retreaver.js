import config from '../config.js';

/**
 * Service to interact with the Retreaver Real-Time Bidding (RTB) API.
 * Strict Real-Time Mode: Only returns 'reserved' when an actual inbound_number
 * is awarded by Retreaver. Strictly reports 'no-target' when no call buyer is active.
 *
 * @param {{ caller_number: string, caller_zip: string, caller_state: string }} params
 * @param {object} [options] Optional overrides for testing
 * @returns {Promise<{ status: 'reserved' | 'no-target' | 'error', inbound_number?: string, retreaver_uuid?: string, message?: string }>}
 */
export async function requestRtbReservation(params, options = {}) {
  const endpoint = options.endpoint || (config ? config.retreaverEndpoint : process.env.RETREAVER_RTB_ENDPOINT) || 'https://rtb.retreaver.com/rtbs.json';
  const key = options.key || (config ? config.retreaverRtbKey : process.env.RETREAVER_RTB_KEY) || '01d32947-f6a8-4bff-a47f-b8b660da49a4';
  const publisherId = options.publisherId || (config ? config.retreaverPublisherId : process.env.RETREAVER_PUBLISHER_ID) || '404c64b1';
  const campaignId = options.campaignId || (config ? config.retreaverCampaignId : process.env.RETREAVER_CAMPAIGN_ID) || 'd236359b';

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

    // If HTTP status is not 2xx
    if (!response.ok) {
      console.warn(`[RTB Service] Upstream Retreaver returned HTTP status: ${response.status}`);
      return {
        status: 'error',
        message: 'Unable to get a DID. Please check the configuration and caller information.'
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    // Check for explicit no-target or rejected status
    if (data && (data.status === 'no-target' || data.status === 'rejected')) {
      return {
        status: 'no-target',
        message: data.message || 'No DID available',
        retreaver_uuid: data.uuid
      };
    }

    // Check for successful live reservation with inbound_number from Retreaver
    if (data && data.inbound_number) {
      return {
        status: 'reserved',
        inbound_number: String(data.inbound_number).trim(),
        retreaver_uuid: data.uuid
      };
    }

    // No target awarded or no inbound number returned
    return {
      status: 'no-target',
      message: (data && data.message) || 'No DID available',
      retreaver_uuid: data ? data.uuid : undefined
    };

  } catch (err) {
    console.error(`[RTB Service] Communication error: ${err.message}`);
    return {
      status: 'error',
      message: 'Unable to get a DID. Please check connection and caller information.'
    };
  }
}
