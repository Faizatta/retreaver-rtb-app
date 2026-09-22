document.addEventListener('DOMContentLoaded', () => {
  const rtbForm = document.getElementById('rtbForm');
  const callerIdInput = document.getElementById('callerId');
  const zipCodeInput = document.getElementById('zipCode');
  const stateInput = document.getElementById('state');
  const submitBtn = document.getElementById('submitBtn');

  const resultContainer = document.getElementById('resultContainer');
  const successBox = document.getElementById('successBox');
  const noTargetBox = document.getElementById('noTargetBox');
  const errorBox = document.getElementById('errorBox');
  const didValue = document.getElementById('didValue');
  const errorMessage = document.getElementById('errorMessage');
  const copyBtn = document.getElementById('copyBtn');

  function hideAllResults() {
    resultContainer.classList.remove('hidden');
    successBox.classList.add('hidden');
    noTargetBox.classList.add('hidden');
    errorBox.classList.add('hidden');
  }

  function showSuccess(inboundNumber) {
    hideAllResults();
    didValue.textContent = inboundNumber;
    successBox.classList.remove('hidden');
  }

  function showNoTarget() {
    hideAllResults();
    noTargetBox.classList.remove('hidden');
  }

  function showError(msg) {
    hideAllResults();
    errorMessage.textContent = msg || 'Unable to get a DID. Please check the configuration and caller information.';
    errorBox.classList.remove('hidden');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.classList.add('loading');
    } else {
      submitBtn.classList.remove('loading');
    }
  }

  // Auto-format phone numbers as user types
  callerIdInput.addEventListener('input', (e) => {
    let val = e.target.value;
    // Allow digits, plus, parenthesis, spaces, dashes
    val = val.replace(/[^\d+()\-\s]/g, '');
    e.target.value = val;
  });

  // ZIP code input restrict to numbers & hyphen
  zipCodeInput.addEventListener('input', (e) => {
    let val = e.target.value;
    val = val.replace(/[^\d-]/g, '');
    e.target.value = val;
  });

  // Copy to clipboard
  copyBtn.addEventListener('click', async () => {
    const textToCopy = didValue.textContent;
    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });

  // Handle form submission
  rtbForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const callerNumber = callerIdInput.value.trim();
    const callerZip = zipCodeInput.value.trim();
    const callerState = stateInput.value.trim();

    // Client-side quick checks
    if (!callerNumber) {
      showError('Please enter a Caller ID / Phone Number.');
      callerIdInput.focus();
      return;
    }

    if (!callerZip) {
      showError('Please enter a ZIP code.');
      zipCodeInput.focus();
      return;
    }

    if (!callerState) {
      showError('Please select a State.');
      stateInput.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/rtb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          caller_number: callerNumber,
          caller_zip: callerZip,
          caller_state: callerState
        })
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data && data.success && data.inbound_number) {
        showSuccess(data.inbound_number);
      } else if (data && data.message === 'No DID available') {
        showNoTarget();
      } else if (data && data.message) {
        showError(data.message);
      } else {
        showError('Unable to get a DID. Please check the configuration and caller information.');
      }
    } catch (networkErr) {
      showError('Unable to connect to the server. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  });
});
