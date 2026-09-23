'use strict';

const $ = id => document.getElementById(id);

// 50 US States + DC
const statesData = [
  ['AL', 'Alabama', '35004'], ['AK', 'Alaska', '99501'], ['AZ', 'Arizona', '85001'],
  ['AR', 'Arkansas', '72201'], ['CA', 'California', '90210'], ['CO', 'Colorado', '80201'],
  ['CT', 'Connecticut', '06101'], ['DE', 'Delaware', '19901'], ['DC', 'District of Columbia', '20001'],
  ['FL', 'Florida', '33101'], ['GA', 'Georgia', '30301'], ['HI', 'Hawaii', '96801'],
  ['ID', 'Idaho', '83701'], ['IL', 'Illinois', '60601'], ['IN', 'Indiana', '46201'],
  ['IA', 'Iowa', '50301'], ['KS', 'Kansas', '66101'], ['KY', 'Kentucky', '40201'],
  ['LA', 'Louisiana', '70112'], ['ME', 'Maine', '04101'], ['MD', 'Maryland', '21201'],
  ['MA', 'Massachusetts', '02108'], ['MI', 'Michigan', '48201'], ['MN', 'Minnesota', '55401'],
  ['MS', 'Mississippi', '39201'], ['MO', 'Missouri', '63101'], ['MT', 'Montana', '59601'],
  ['NE', 'Nebraska', '68101'], ['NV', 'Nevada', '89101'], ['NH', 'New Hampshire', '03301'],
  ['NJ', 'New Jersey', '07101'], ['NM', 'New Mexico', '87101'], ['NY', 'New York', '10001'],
  ['NC', 'North Carolina', '27601'], ['ND', 'North Dakota', '58501'], ['OH', 'Ohio', '43201'],
  ['OK', 'Oklahoma', '73101'], ['OR', 'Oregon', '97201'], ['PA', 'Pennsylvania', '19101'],
  ['RI', 'Rhode Island', '02901'], ['SC', 'South Carolina', '29201'], ['SD', 'South Dakota', '57101'],
  ['TN', 'Tennessee', '37201'], ['TX', 'Texas', '75201'], ['UT', 'Utah', '84101'],
  ['VT', 'Vermont', '05601'], ['VA', 'Virginia', '23219'], ['WA', 'Washington', '98101'],
  ['WV', 'West Virginia', '25301'], ['WI', 'Wisconsin', '53201'], ['WY', 'Wyoming', '82001']
];

// 11 Approved Buyer States: AL, FL, IN, KS, MS, MT, NE, OK, TX, UT, WI
const approvedStates = [
  ['AL', 'Alabama', '35004', '205'],
  ['FL', 'Florida', '33101', '305'],
  ['IN', 'Indiana', '46201', '317'],
  ['KS', 'Kansas', '66101', '913'],
  ['MS', 'Mississippi', '39201', '601'],
  ['MT', 'Montana', '59601', '406'],
  ['NE', 'Nebraska', '68101', '402'],
  ['OK', 'Oklahoma', '73101', '405'],
  ['TX', 'Texas', '75201', '214'],
  ['UT', 'Utah', '84101', '801'],
  ['WI', 'Wisconsin', '53201', '414']
];
const approvedCodes = new Set(approvedStates.map(s => s[0]));

// Populate state options with optgroups
const stateSelect = $('state');

const approvedGroup = document.createElement('optgroup');
approvedGroup.label = '★ Approved Buyer States (11 Active)';
approvedStates.forEach(([code, name]) => {
  approvedGroup.appendChild(new Option(`${name} (${code})`, code));
});
stateSelect.appendChild(approvedGroup);

const otherGroup = document.createElement('optgroup');
otherGroup.label = 'Other US States';
statesData.filter(([code]) => !approvedCodes.has(code)).forEach(([code, name]) => {
  otherGroup.appendChild(new Option(`${name} (${code})`, code));
});
stateSelect.appendChild(otherGroup);

// View Navigation & Tab Controller
function switchView(viewName) {
  const isTracking = viewName === 'tracking';
  $('view-console').hidden = isTracking;
  $('view-tracking').hidden = !isTracking;
  
  $('tab-console-btn').classList.toggle('active', !isTracking);
  $('tab-tracking-btn').classList.toggle('active', isTracking);

  if (isTracking) {
    loadTrackingStream();
  }
}

$('tab-console-btn').addEventListener('click', () => switchView('console'));
$('tab-tracking-btn').addEventListener('click', () => switchView('tracking'));
$('switch-to-tracking-link').addEventListener('click', e => {
  e.preventDefault();
  switchView('tracking');
});

// Auto-switch to tracking if URL or hash requests it
if (window.location.pathname.includes('/tracking') || window.location.hash === '#tracking') {
  switchView('tracking');
}

// Quick Sample Caller Filler (Picks from approved buyer states)
$('sample-caller-btn').addEventListener('click', () => {
  const randomApproved = approvedStates[Math.floor(Math.random() * approvedStates.length)];
  const randomMid = String(Math.floor(200 + Math.random() * 799));
  const randomLast = String(Math.floor(1000 + Math.random() * 9000));
  
  $('phone').value = `+1 (${randomApproved[3]}) ${randomMid}-${randomLast}`;
  $('state').value = randomApproved[0];
  $('zip').value = randomApproved[2];
});

// Format phone display
function formatPhoneNumber(numStr) {
  if (!numStr) return '';
  const digits = numStr.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return numStr;
}

// Bid Form Submission
const bidForm = $('bid-form');
bidForm.addEventListener('submit', async event => {
  event.preventDefault();

  const button = $('submit-btn');
  const buttonLabel = $('button-label');
  const errorBox = $('error-box');
  const emptyState = $('empty-state');
  const reservedState = $('reserved-state');
  const numberDisplay = $('number');
  const statusPill = $('rtb-status-pill');
  const latencyVal = $('latency-val');
  const uuidVal = $('uuid-val');
  const footerStatus = $('telemetry-footer-status');

  // Set loading state
  button.disabled = true;
  buttonLabel.textContent = 'Executing RTB Auction…';
  errorBox.hidden = true;
  emptyState.hidden = false;
  reservedState.hidden = true;
  numberDisplay.textContent = '';
  statusPill.textContent = 'AUCTIONING…';
  statusPill.className = 'status-badge-lg';
  $('result-title').textContent = 'Auctioning Inbound DID…';
  $('result-description').textContent = 'Pinging Retreaver RTB upstream and calculating highest yield reservation.';

  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const payload = {
    caller_number: $('phone').value.trim(),
    caller_state: $('state').value.trim(),
    caller_zip: $('zip').value.trim()
  };

  try {
    const response = await fetch('/api/rtb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const elapsed = Date.now() - startTime;
    latencyVal.textContent = `${elapsed}ms`;

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Failed to parse auction response from server.');
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Auction request failed.');
    }

    const assignedDid = data.inbound_number || data.number;

    if (assignedDid && typeof assignedDid === 'string') {
      emptyState.hidden = true;
      reservedState.hidden = false;
      numberDisplay.textContent = formatPhoneNumber(assignedDid);

      statusPill.textContent = 'RESERVED';
      statusPill.className = 'status-badge reserved';
      statusPill.style.background = '';
      statusPill.style.color = '';

      uuidVal.textContent = data.retreaver_uuid ? `${data.retreaver_uuid.substring(0, 13)}…` : 'Live RTB';
      footerStatus.textContent = 'Reservation Active (300s)';

      updateTrackingCounter();
    } else {
      emptyState.hidden = false;
      reservedState.hidden = true;
      statusPill.textContent = 'NO CALL BUYER';
      statusPill.className = 'status-badge';
      statusPill.style.background = '#3f1d24';
      statusPill.style.color = '#fca5a5';

      uuidVal.textContent = data.retreaver_uuid ? `${data.retreaver_uuid.substring(0, 13)}…` : 'Completed';
      footerStatus.textContent = 'Auction Completed · No Target';

      errorBox.textContent = data.message || 'No Call Buyer accepted this bid (Buyer is offline or out of operating hours).';
      errorBox.hidden = false;

      $('result-title').textContent = 'No Buyer Available (Offline)';
      $('result-description').textContent = 'Retreaver recorded auction, but no call buyer is currently active or accepting this state.';
      updateTrackingCounter();
    }

  } catch (err) {
    statusPill.textContent = 'AUCTION FAILED';
    statusPill.className = 'status-badge';
    errorBox.textContent = err.name === 'AbortError' ? 'Auction timed out. Please retry.' : err.message;
    errorBox.hidden = false;

    $('result-title').textContent = 'Auction Interrupted';
    $('result-description').textContent = 'Check parameter details and submit when ready.';
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    buttonLabel.textContent = 'Generate Inbound DID (GET DID)';
  }
});

// Clipboard Copy
$('copy-btn').addEventListener('click', async () => {
  const num = $('number').textContent;
  const btn = $('copy-btn');
  try {
    await navigator.clipboard.writeText(num);
    btn.classList.add('copied');
    btn.innerHTML = '<span>✓ Copied to Clipboard</span>';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<span>Copy Destination Number</span>';
    }, 2000);
  } catch {
    btn.innerHTML = '<span>Select text to copy</span>';
  }
});

// Live Tracking Stream Loader
let allLeads = [];

async function updateTrackingCounter() {
  try {
    const res = await fetch('/api/tracking');
    const data = await res.json();
    if (data.success) {
      $('nav-lead-counter').textContent = data.count || 0;
    }
  } catch (e) {}
}

async function loadTrackingStream() {
  try {
    const res = await fetch('/api/tracking');
    const data = await res.json();
    if (!data.success) return;

    allLeads = data.leads || [];
    $('total-pings-val').textContent = allLeads.length;
    $('active-dids-val').textContent = allLeads.filter(l => l.status === 'Reserved').length;
    $('nav-lead-counter').textContent = allLeads.length;

    renderTrackingTable(allLeads);
  } catch (err) {
    console.error('Failed to load tracking stream:', err);
  }
}

function renderTrackingTable(leads) {
  const tbody = $('tracking-tbody');
  const filterQuery = ($('tracking-search-input').value || '').trim().toLowerCase();

  const filtered = filterQuery
    ? leads.filter(l => 
        (l.caller_number && l.caller_number.toLowerCase().includes(filterQuery)) ||
        (l.caller_state && l.caller_state.toLowerCase().includes(filterQuery)) ||
        (l.destination_number && l.destination_number.toLowerCase().includes(filterQuery))
      )
    : leads;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">
          ${filterQuery ? 'No bids matching your search query.' : 'No bids logged yet. Use the Bid Console to execute an RTB reservation.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(lead => {
    const date = new Date(lead.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = date.toLocaleDateString();
    const formattedDid = formatPhoneNumber(lead.destination_number);
    const uuidText = lead.retreaver_uuid ? `<span title="${lead.retreaver_uuid}" style="font-family: var(--font-mono); font-size: 11px; color: #a5b4fc;">${lead.retreaver_uuid.substring(0, 13)}…</span>` : `<span style="font-size: 11px; color: #818cf8;">Live RTB</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: #f8fafc;">${timeStr}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${dateStr}</div>
        </td>
        <td class="caller-cell">${lead.caller_number}</td>
        <td><strong>${lead.caller_state}</strong> · ${lead.caller_zip}</td>
        <td>
          <span class="did-tag">${formattedDid}</span>
          <button style="background:transparent;border:none;color:#94a3b8;cursor:pointer;margin-left:6px;" onclick="copyMini('${lead.destination_number}', this)" title="Copy DID">⧉</button>
        </td>
        <td>${uuidText}</td>
        <td>
          <span class="status-chip" style="${lead.status === 'Reserved' ? 'background: #064e3b; color: #6ee7b7;' : 'background: #3f1d24; color: #fca5a5;'}">${lead.status || 'No Target'}</span>
        </td>
        <td style="color: var(--text-muted); font-size: 12px;">${lead.publisher || 'ID: 404c64b1'}</td>
      </tr>
    `;
  }).join('');
}

window.copyMini = async function(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  } catch (e) {}
};

$('tracking-search-input').addEventListener('input', () => {
  renderTrackingTable(allLeads);
});

$('refresh-tracking-btn').addEventListener('click', loadTrackingStream);

$('clear-tracking-btn').addEventListener('click', async () => {
  if (confirm('Clear all live tracking history?')) {
    await fetch('/api/tracking', { method: 'DELETE' });
    loadTrackingStream();
  }
});

// Initial boot
updateTrackingCounter();
setInterval(updateTrackingCounter, 5000);
