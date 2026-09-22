import { getTrackedLeads, clearTrackedLeads } from '../src/services/tracker.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'DELETE') {
    clearTrackedLeads();
    return res.status(200).json({
      success: true,
      message: 'Tracking history cleared.'
    });
  }

  const leads = getTrackedLeads();
  return res.status(200).json({
    success: true,
    count: leads.length,
    leads
  });
}
