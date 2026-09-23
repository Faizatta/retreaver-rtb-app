import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'tracking.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Graceful fallback for read-only environments (e.g. serverless)
}

let inMemoryLeads = [];

// Try to load existing leads from disk
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    inMemoryLeads = JSON.parse(raw);
  }
} catch (err) {
  inMemoryLeads = [];
}

/**
 * Add a tracked RTB lead reservation
 */
export function recordLead({ caller_number, caller_state, caller_zip, destination_number, retreaver_uuid, status = 'Reserved', publisher = 'SureCall LLC' }) {
  const lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    caller_number,
    caller_state,
    caller_zip,
    destination_number,
    retreaver_uuid: retreaver_uuid || null,
    publisher,
    status
  };

  inMemoryLeads.unshift(lead);

  // Cap at 100 entries
  if (inMemoryLeads.length > 100) {
    inMemoryLeads = inMemoryLeads.slice(0, 100);
  }

  // Persist asynchronously if filesystem is writable
  try {
    fs.writeFile(DATA_FILE, JSON.stringify(inMemoryLeads, null, 2), () => {});
  } catch (e) {}

  return lead;
}

/**
 * Get all tracked leads
 */
export function getTrackedLeads() {
  return inMemoryLeads;
}

/**
 * Clear tracking log
 */
export function clearTrackedLeads() {
  inMemoryLeads = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
  } catch (e) {}
  return true;
}
