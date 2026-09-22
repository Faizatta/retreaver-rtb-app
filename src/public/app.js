'use strict';

const $ = id => document.getElementById(id);

// 50 US States & DC
const states = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming';

states.split('|').forEach(entry => {
  const [value, label] = entry.split(':');
  $('state').add(new Option(`${label} (${value})`, value));
});

// Update live badge count
async function updateTrackingCount() {
  try {
    const res = await fetch('/api/tracking');
    const data = await res.json();
    if (data.success && $('header-lead-count')) {
      $('header-lead-count').textContent = data.count || 0;
    }
  } catch (e) {}
}

updateTrackingCount();

const panel = document.querySelector('.result-card');

$('bid-form').addEventListener('submit', async event => {
  event.preventDefault();

  const button = $('submit-btn');
  const buttonLabel = $('button-label');
  const errorBox = $('error');
  const resultBox = $('result');
  const emptyBox = $('empty');
  const numberText = $('number');
  const statusPill = $('rtb-status-pill');
  const responseTimeText = $('response-time-text');

  // Reset UI state
  button.disabled = true;
  buttonLabel.textContent = 'Finding number…';
  errorBox.hidden = true;
  resultBox.hidden = true;
  emptyBox.hidden = false;
  numberText.textContent = '';
  statusPill.textContent = 'BIDDING…';
  statusPill.style.color = '#c4b5fd';
  
  $('result-title').textContent = 'Finding your connection…';
  $('empty-copy').textContent = 'This can take a few seconds.';
  panel.classList.add('loading');
  panel.setAttribute('aria-busy', 'true');

  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const payload = {
    caller_number: $('phone').value.trim(),
    caller_state: $('state').value.trim(),
    caller_zip: $('zip').value.trim()
  };

  try {
    const response = await fetch('/api/rtb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('The site could not complete this request. Please try again.');
    }

    const elapsed = Date.now() - startTime;
    responseTimeText.textContent = `Auction latency: ${elapsed}ms`;

    if (!response.ok) {
      throw new Error(data.message || data.error || 'The request could not be completed.');
    }

    const assignedNumber = data.inbound_number || data.number;

    if (assignedNumber && typeof assignedNumber === 'string' && /^\+?[0-9]{7,16}$/.test(assignedNumber)) {
      emptyBox.hidden = true;
      resultBox.hidden = false;
      numberText.textContent = assignedNumber;
      $('copy').textContent = 'Copy number';
      statusPill.textContent = 'RESERVED';
      statusPill.style.color = '#4ade80';

      // Update badge
      updateTrackingCount();
    } else if (data.status === 'no-target' || data.number === null || !data.success) {
      statusPill.textContent = 'NO TARGET';
      statusPill.style.color = '#fbbf24';
      $('result-title').textContent = 'No number available.';
      $('empty-copy').textContent = data.message || 'No campaign target available for this caller.';
    } else {
      throw new Error('No destination number was returned. Please try again.');
    }

  } catch (error) {
    statusPill.textContent = 'ERROR';
    statusPill.style.color = '#f87171';
    errorBox.textContent = error.name === 'AbortError' ? 'The request timed out. Please try again.' : error.message;
    errorBox.hidden = false;
    $('result-title').textContent = 'Let’s try that again.';
    $('empty-copy').textContent = 'Check the message below the form, then submit when ready.';
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    buttonLabel.textContent = 'Find a bid (GET DID)';
    panel.classList.remove('loading');
    panel.setAttribute('aria-busy', 'false');
  }
});

// Copy number to clipboard
$('copy').addEventListener('click', async () => {
  const text = $('number').textContent;
  try {
    await navigator.clipboard.writeText(text);
    $('copy').textContent = '✓ Copied';
    setTimeout(() => {
      $('copy').textContent = 'Copy number';
    }, 2000);
  } catch {
    $('copy').textContent = 'Select number to copy';
  }
});
