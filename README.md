# Retreaver Real-Time Bidding (RTB) Web App

A secure, production-grade web application that connects to the **Retreaver Real-Time Bidding (RTB) API** (`https://rtb.retreaver.com/rtbs.json`).

The application provides a clean, minimal interface for users to enter caller details (Caller ID, ZIP code, and State) and retrieves an assigned inbound DID (`inbound_number`) while keeping all Retreaver API credentials, publisher IDs, and RTB internal auction data completely isolated on the server.

---

## Features

- **Strict Secret Isolation**:
  - `RETREAVER_RTB_KEY` and `RETREAVER_PUBLISHER_ID` exist exclusively on the server backend.
  - Secrets are **never** exposed in HTML, frontend JavaScript, network payloads, error responses, or logs.
  - Server strictly refuses to start if either required environment variable is missing.
- **Data Filtering & Redaction**:
  - Extracts and displays **only** the assigned `inbound_number` (`DID: +1XXXXXXXXXX`).
  - Completely discards `retreaver_payout`, `retreaver_seconds`, `uuid`, `sip_address`, `expires_at`, and buyer details.
- **Input Validation**:
  - Normalizes and validates Caller ID / phone numbers (E.164 and 10-digit US formats).
  - Validates US ZIP codes (5-digit or 5+4 format).
  - Validates US State codes against official 2-letter state/territory abbreviations.
- **Rate Limiting & Security**:
  - Express rate limiter (30 requests/minute per IP) prevents abuse.
  - Helmet HTTP security headers configured with Content Security Policy (CSP).
  - Payload size limits to guard against DOS.
- **Clean Error Handling**:
  - Displays `"No DID available"` when Retreaver returns `status: "no-target"`.
  - Displays `"Unable to get a DID. Please check the configuration and caller information."` on any upstream validation or authentication failure.
  - Zero raw Retreaver error or response logging to prevent credential or PII leaks.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (Node.js v20+ / v24+ recommended).
- A valid Retreaver account with Real-Time Bidding (RTB) enabled.

---

## Environment Variable Configuration

Create a `.env` file in the root of the project directory:

```bash
cp .env.example .env
```

Open `.env` and fill in your Retreaver credentials:

```env
# Server Port (default 3000)
PORT=3000

# Retreaver Real-Time Bidding (RTB) Credentials
# Obtain these from your Retreaver campaign settings under RTB / Postback configuration
RETREAVER_RTB_KEY=your_new_rtb_postback_key
RETREAVER_PUBLISHER_ID=your_publisher_id
```

> [!WARNING]
> **Never commit `.env` or real API keys to version control.**
> The `.gitignore` file is preconfigured to prevent `.env` and local credentials from ever being tracked by git.

### Obtaining Retreaver Credentials:
1. Log into your Retreaver dashboard at `https://retreaver.com`.
2. Navigate to your **Campaign** or **Affiliate/Publisher** settings.
3. Locate your **RTB Postback Key** (used in `RETREAVER_RTB_KEY`).
4. Locate your **Publisher ID** / **Source ID** (used in `RETREAVER_PUBLISHER_ID`).
5. Ensure your campaign is configured to accept RTB reservation requests.

---

## Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm start
```
The server will start at:
```
http://localhost:3000
```

### 3. Development Mode (Auto-reloading)
```bash
npm run dev
```

---

## Running Automated Tests

The application includes unit and integration tests covering startup validation, input formatting, rate limiting, and response redaction:

```bash
npm test
```

---

## API Documentation

### `POST /api/rtb`

Submits caller information to request a Real-Time Bidding reservation.

#### Request Headers:
```
Content-Type: application/json
```

#### Request Body:
```json
{
  "caller_number": "+18005550199",
  "caller_zip": "90210",
  "caller_state": "CA"
}
```

#### Successful Reservation Response (`HTTP 200`):
```json
{
  "success": true,
  "inbound_number": "+18772435010"
}
```

#### No Target Available Response (`HTTP 200`):
```json
{
  "success": false,
  "message": "No DID available"
}
```

#### Validation or Auth Error Response (`HTTP 400`):
```json
{
  "success": false,
  "message": "Unable to get a DID. Please check the configuration and caller information."
}
```

---

## Project Structure

```
retreaver-rtb-app/
├── .env.example          # Template for environment variables
├── .gitignore            # Git exclusion rules for .env and node_modules
├── package.json          # Node package definition
├── README.md             # Documentation and usage guide
├── src/
│   ├── config.js         # Startup validation for required environment variables
│   ├── server.js         # Express server, Helmet, rate limiting, static hosting
│   ├── routes/
│   │   └── rtb.js        # POST /api/rtb route controller
│   ├── services/
│   │   └── retreaver.js  # Upstream Retreaver API integration & payload filtering
│   ├── utils/
│   │   └── validator.js  # Phone, ZIP, and State validation helpers
│   └── public/
│       ├── index.html    # Clean UI (Caller ID, ZIP, State, GET DID, Result)
│       ├── styles.css    # Responsive modern styles
│       └── app.js        # Frontend client logic & clipboard handling
└── test/
    └── rtb.test.js       # Automated tests
```

---

## Important Retreaver RTB Behavior

- **Reservation Expiry**: An RTB reservation returns a time-sensitive destination (`inbound_number`). Depending on your Retreaver campaign rules, calls must be routed or confirmed within the reservation window.
- **Caller ID Relevance**: Retreaver matches buyers based on caller geographic location and history. Always supply accurate Caller ID, ZIP, and State values for optimal bid matching.
