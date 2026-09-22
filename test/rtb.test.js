import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { validateConfig } from '../src/config.js';
import { validateCallerNumber, validateZip, validateState, validateRtbInput } from '../src/utils/validator.js';
import { requestRtbReservation } from '../src/services/retreaver.js';
import { app } from '../src/server.js';

describe('1. Configuration & Startup Validation', () => {
  test('refuses to proceed if RETREAVER_RTB_KEY is missing', () => {
    assert.throws(
      () => validateConfig({ RETREAVER_PUBLISHER_ID: 'pub_123' }),
      /Missing required environment variable\(s\): RETREAVER_RTB_KEY/
    );
  });

  test('refuses to proceed if RETREAVER_PUBLISHER_ID is missing', () => {
    assert.throws(
      () => validateConfig({ RETREAVER_RTB_KEY: 'key_123' }),
      /Missing required environment variable\(s\): RETREAVER_PUBLISHER_ID/
    );
  });

  test('refuses to proceed if both required variables are missing or empty', () => {
    assert.throws(
      () => validateConfig({ RETREAVER_RTB_KEY: '  ', RETREAVER_PUBLISHER_ID: '' }),
      /Missing required environment variable\(s\): RETREAVER_RTB_KEY, RETREAVER_PUBLISHER_ID/
    );
  });

  test('successfully loads configuration when both variables are set', () => {
    const cfg = validateConfig({
      RETREAVER_RTB_KEY: 'test_key_abc',
      RETREAVER_PUBLISHER_ID: 'pub_xyz',
      PORT: '4000'
    });
    assert.equal(cfg.retreaverRtbKey, 'test_key_abc');
    assert.equal(cfg.retreaverPublisherId, 'pub_xyz');
    assert.equal(cfg.port, 4000);
  });
});

describe('2. Input Validation Utilities', () => {
  test('validates and normalizes phone numbers to E.164 format', () => {
    assert.equal(validateCallerNumber('8005550199'), '+18005550199');
    assert.equal(validateCallerNumber('(800) 555-0199'), '+18005550199');
    assert.equal(validateCallerNumber('+18005550199'), '+18005550199');
    assert.equal(validateCallerNumber('18005550199'), '+18005550199');
    assert.equal(validateCallerNumber('+447911123456'), '+447911123456');
  });

  test('rejects malformed phone numbers', () => {
    assert.throws(() => validateCallerNumber('12345'), /Invalid caller phone number/);
    assert.throws(() => validateCallerNumber('not-a-number'), /Invalid caller phone number/);
    assert.throws(() => validateCallerNumber(''), /Caller phone number is required/);
  });

  test('validates 5-digit and 5+4 US ZIP codes', () => {
    assert.equal(validateZip('90210'), '90210');
    assert.equal(validateZip('10001-1234'), '10001');
    assert.equal(validateZip(75001), '75001');
  });

  test('rejects invalid ZIP codes', () => {
    assert.throws(() => validateZip('1234'), /Invalid ZIP code/);
    assert.throws(() => validateZip('ABCDE'), /Invalid ZIP code/);
    assert.throws(() => validateZip(''), /ZIP code is required/);
  });

  test('validates 2-letter US state abbreviations', () => {
    assert.equal(validateState('tx'), 'TX');
    assert.equal(validateState('ca'), 'CA');
    assert.equal(validateState('NY'), 'NY');
    assert.equal(validateState('dc'), 'DC');
  });

  test('rejects invalid states', () => {
    assert.throws(() => validateState('ZZ'), /Invalid State code/);
    assert.throws(() => validateState('Texas'), /Invalid State code/);
    assert.throws(() => validateState(''), /State is required/);
  });

  test('validateRtbInput parses complete valid payload', () => {
    const result = validateRtbInput({
      caller_number: '(800) 555-0199',
      caller_zip: '75001',
      caller_state: 'tx'
    });
    assert.deepEqual(result, {
      caller_number: '+18005550199',
      caller_zip: '75001',
      caller_state: 'TX'
    });
  });
});

describe('3. Retreaver RTB Service Isolation & Redaction', () => {
  let mockServer;
  let mockServerPort;
  let nextMockResponse = { status: 200, body: {} };

  before(async () => {
    mockServer = http.createServer((req, res) => {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        // Verify request payload conforms to Retreaver RTB format
        const parsed = JSON.parse(bodyStr);
        assert.ok(parsed.key, 'Payload must contain key');
        assert.ok(parsed.publisher_id, 'Payload must contain publisher_id');
        assert.ok(parsed.caller_number, 'Payload must contain caller_number');
        assert.ok(parsed.caller_zip, 'Payload must contain caller_zip');
        assert.ok(parsed.caller_state, 'Payload must contain caller_state');

        res.writeHead(nextMockResponse.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(nextMockResponse.body));
      });
    });

    await new Promise(resolve => {
      mockServer.listen(0, () => {
        mockServerPort = mockServer.address().port;
        resolve();
      });
    });
  });

  after(() => {
    mockServer.close();
  });

  test('extracts ONLY inbound_number and discards sensitive RTB fields', async () => {
    nextMockResponse = {
      status: 200,
      body: {
        uuid: 'test-uuid-secret-12345',
        status: 'reserved',
        retreaver_payout: 50.00,
        retreaver_seconds: 120,
        inbound_number: '+18772435010',
        sip_address: 'sip:buyer@telephony.carrier.net',
        expires_at: '2026-09-22T21:30:00Z',
        buyer_info: { id: 999, name: 'Private Buyer Co' }
      }
    };

    const result = await requestRtbReservation(
      { caller_number: '+18005550199', caller_zip: '90210', caller_state: 'CA' },
      {
        endpoint: `http://localhost:${mockServerPort}/rtbs.json`,
        key: 'test_key_dummy',
        publisherId: 'test_pub_dummy'
      }
    );

    assert.equal(result.status, 'reserved');
    assert.equal(result.inbound_number, '+18772435010');

    // Confirm strict isolation: sensitive fields must not be present
    assert.equal(result.retreaver_payout, undefined);
    assert.equal(result.retreaver_seconds, undefined);
    assert.equal(result.uuid, undefined);
    assert.equal(result.sip_address, undefined);
    assert.equal(result.expires_at, undefined);
    assert.equal(result.buyer_info, undefined);
  });

  test('handles status: "no-target" by returning "No DID available"', async () => {
    nextMockResponse = {
      status: 200,
      body: {
        status: 'no-target'
      }
    };

    const result = await requestRtbReservation(
      { caller_number: '+18005550199', caller_zip: '90210', caller_state: 'CA' },
      {
        endpoint: `http://localhost:${mockServerPort}/rtbs.json`,
        key: 'test_key_dummy',
        publisherId: 'test_pub_dummy'
      }
    );

    assert.equal(result.status, 'no-target');
    assert.equal(result.message, 'No DID available');
    assert.equal(result.inbound_number, undefined);
  });

  test('masks upstream errors with generic user-friendly message', async () => {
    nextMockResponse = {
      status: 401,
      body: {
        error: 'Invalid API key or unauthorized publisher'
      }
    };

    const result = await requestRtbReservation(
      { caller_number: '+18005550199', caller_zip: '90210', caller_state: 'CA' },
      {
        endpoint: `http://localhost:${mockServerPort}/rtbs.json`,
        key: 'bad_key',
        publisherId: 'bad_pub'
      }
    );

    assert.equal(result.status, 'error');
    assert.equal(result.message, 'Unable to get a DID. Please check the configuration and caller information.');
    // Upstream error text must never leak
    assert.equal(JSON.stringify(result).includes('Invalid API key'), false);
  });
});

describe('4. Express HTTP Route Integration', () => {
  let serverInstance;
  let serverPort;

  before(async () => {
    await new Promise(resolve => {
      serverInstance = app.listen(0, () => {
        serverPort = serverInstance.address().port;
        resolve();
      });
    });
  });

  after(() => {
    serverInstance.close();
  });

  test('POST /api/rtb rejects invalid phone number with 400', async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/rtb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_number: 'invalid',
        caller_zip: '90210',
        caller_state: 'CA'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Invalid caller phone number'));
  });

  test('POST /api/rtb rejects missing state with 400', async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/rtb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_number: '8005550199',
        caller_zip: '90210'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('State is required'));
  });

  test('GET /api/health returns healthy status', async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
  });

  test('Serves frontend HTML on GET /', async () => {
    const res = await fetch(`http://localhost:${serverPort}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Inbound DID Reservation'));
    assert.ok(text.includes('GET DID'));
    assert.ok(text.includes('Caller ID'));
    assert.ok(text.includes('ZIP Code'));
    assert.ok(text.includes('State'));
  });

  test('POST /api/rtb sanitized route output never leaks secret credentials', async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/rtb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_number: '8005550199',
        caller_zip: '90210',
        caller_state: 'CA'
      })
    });

    const bodyText = await res.text();
    assert.equal(bodyText.includes('process.env'), false);
    assert.equal(bodyText.includes('RETREAVER_RTB_KEY'), false);
    assert.equal(bodyText.includes('test_key'), false);
  });
});
