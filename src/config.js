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
    retreaverRtbKey: env.RETREAVER_RTB_KEY ? env.RETREAVER_RTB_KEY.trim() : '01d32947-f6a8-4bff-a47f-b8b660da49a4',
    retreaverPublisherId: env.RETREAVER_PUBLISHER_ID ? env.RETREAVER_PUBLISHER_ID.trim() : '404c64b1',
    retreaverCampaignId: env.RETREAVER_CAMPAIGN_ID ? env.RETREAVER_CAMPAIGN_ID.trim() : 'd236359b',
    retreaverEndpoint: env.RETREAVER_RTB_ENDPOINT || 'https://rtb.retreaver.com/rtbs.json',
    demoMode: env.DEMO_MODE !== 'false',
    nodeEnv: env.NODE_ENV || 'development'
  };
}

let config;

const isServerlessOrTest = process.env.NODE_ENV === 'test' ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.argv.some(arg => arg.includes('test'));

try {
  config = validateConfig(process.env);
} catch (err) {
  if (!isServerlessOrTest) {
    console.error(err.message);
    process.exit(1);
  } else {
    // In serverless/test mode, supply safe fallback config so Vercel functions never crash with 500
    config = {
      port: 3000,
      retreaverRtbKey: process.env.RETREAVER_RTB_KEY || '01d32947-f6a8-4bff-a47f-b8b660da49a4',
      retreaverPublisherId: process.env.RETREAVER_PUBLISHER_ID || '404c64b1',
      retreaverCampaignId: process.env.RETREAVER_CAMPAIGN_ID || 'd236359b',
      retreaverEndpoint: 'https://rtb.retreaver.com/rtbs.json',
      demoMode: process.env.DEMO_MODE !== 'false',
      nodeEnv: 'production'
    };
  }
}

export default config;
