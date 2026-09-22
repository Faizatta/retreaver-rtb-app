/**
 * US States & Territories (2-letter ISO 3166-2:US codes)
 */
const VALID_US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'MP', 'AS'
]);

/**
 * Normalizes and validates caller phone number.
 * Accepts formats:
 * - "+18005550199"
 * - "18005550199"
 * - "(800) 555-0199"
 * - "800-555-0199"
 * - "8005550199"
 *
 * Returns E.164 formatted number (+1XXXXXXXXXX) or throws validation error.
 *
 * @param {unknown} input
 * @returns {string} E.164 phone number
 */
export function validateCallerNumber(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Caller phone number is required.');
  }

  const trimmed = input.trim();
  // Remove non-digit characters except leading plus
  const cleaned = trimmed.replace(/[^\d+]/g, '');

  // Check if international E.164 with +
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (!/^\d{10,15}$/.test(digits)) {
      throw new Error('Invalid phone number format. Please provide a valid 10-digit phone number or international E.164 number.');
    }
    return cleaned;
  }

  // If 11 digits starting with 1 (US country code)
  if (/^1\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If 10 digits (Standard US)
  if (/^\d{10}$/.test(cleaned)) {
    return `+1${cleaned}`;
  }

  throw new Error('Invalid caller phone number. Please provide a standard 10-digit US phone number (e.g., 8005550199 or (800) 555-0199).');
}

/**
 * Validates US ZIP code (5 digits or 5+4 format).
 *
 * @param {unknown} input
 * @returns {string} Clean 5-digit ZIP code
 */
export function validateZip(input) {
  if (!input || (typeof input !== 'string' && typeof input !== 'number')) {
    throw new Error('ZIP code is required.');
  }

  const str = String(input).trim();
  const zip5Regex = /^\d{5}$/;
  const zip9Regex = /^(\d{5})-\d{4}$/;

  if (zip5Regex.test(str)) {
    return str;
  }

  const match9 = str.match(zip9Regex);
  if (match9) {
    return match9[1]; // Use primary 5-digit ZIP for Retreaver routing
  }

  throw new Error('Invalid ZIP code. Please provide a valid 5-digit US ZIP code (e.g., 90210).');
}

/**
 * Validates US State code.
 *
 * @param {unknown} input
 * @returns {string} Uppercase 2-letter state code
 */
export function validateState(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('State is required.');
  }

  const cleaned = input.trim().toUpperCase();

  if (!VALID_US_STATES.has(cleaned)) {
    throw new Error('Invalid State code. Please provide a valid 2-letter US state abbreviation (e.g., CA, TX, NY).');
  }

  return cleaned;
}

/**
 * Validates all RTB submission inputs.
 *
 * @param {Record<string, unknown>} body
 * @returns {{ caller_number: string, caller_zip: string, caller_state: string }}
 */
export function validateRtbInput(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request payload.');
  }

  const caller_number = validateCallerNumber(body.caller_number || body.callerNumber);
  const caller_zip = validateZip(body.caller_zip || body.callerZip || body.zip);
  const caller_state = validateState(body.caller_state || body.callerState || body.state);

  return { caller_number, caller_zip, caller_state };
}
