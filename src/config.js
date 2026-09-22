import dotenv from 'dotenv';

dotenv.config();

/**
 * Validates required environment variables.
 * Refuses to proceed if RETREAVER_RTB_KEY or RETREAVER_PUBLISHER_ID is missing.
 *
 * @param {Record<string, string | undefined>} env
 * @throws {Error} if any required variable is absent or empty
 */
export function validateConfig(env = process.env) {
  const missing = [];

  if (!env.RETREAVER_RTB_KEY || env.RETREAVER_RTB_KEY.trim() === '') {
    missing.push('RETREAVER_RTB_KEY');
  }

  if (!env.RETREAVER_PUBLISHER_ID || env.RETREAVER_PUBLISHER_ID.trim() === '') {
    missing.push('RETREAVER_PUBLISHER_ID');
  }

  if (missing.length > 0) {
    const errorMsg = `[CRITICAL CONFIG ERROR] Missing required environment variable(s): ${missing.join(', ')}. ` +
      `The application refuses to start without these settings. ` +
      `Please configure them in your environment or in a .env file.`;
    throw new Error(errorMsg);
  }

  return {
    port: parseInt(env.PORT || '3000', 10),
    retreaverRtbKey: env.RETREAVER_RTB_KEY.trim(),
    retreaverPublisherId: env.RETREAVER_PUBLISHER_ID.trim(),
    retreaverCampaignId: env.RETREAVER_CAMPAIGN_ID ? env.RETREAVER_CAMPAIGN_ID.trim() : undefined,
    retreaverEndpoint: env.RETREAVER_RTB_ENDPOINT || 'https://rtb.retreaver.com/rtbs.json',
    demoMode: env.DEMO_MODE === 'true',
    nodeEnv: env.NODE_ENV || 'development'
  };
}

let config;

const isTestMode = process.env.NODE_ENV === 'test' ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.argv.some(arg => arg.includes('test'));

try {
  config = validateConfig(process.env);
} catch (err) {
  if (!isTestMode) {
    console.error(err.message);
    process.exit(1);
  } else {
    // In test runner mode, supply safe fallback config so tests can instantiate app & mock endpoints
    config = {
      port: 3000,
      retreaverRtbKey: 'test_key',
      retreaverPublisherId: 'test_publisher',
      retreaverEndpoint: 'https://rtb.retreaver.com/rtbs.json',
      nodeEnv: 'test'
    };
  }
}

export default config;
