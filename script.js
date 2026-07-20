(function(){
  const STORAGE_KEY = 'scanline-history';
  let history = [];
  let currentDataUrl = null;
  let currentText = '';

  const contentInput = document.getElementById('contentInput');
  const sizeSelect = document.getElementById('sizeSelect');
  const levelSelect = document.getElementById('levelSelect');
  const generateBtn = document.getElementById('generateBtn');
  const hint = document.getElementById('hint');
  const qrContainer = document.getElementById('qrcodeContainer');
  const placeholderMsg = document.getElementById('placeholderMsg');
  const scanline = document.getElementById('scanline');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const statusBadge = document.getElementById('statusBadge');
  const contactSheet = document.getElementById('contactSheet');
  const emptyHistory = document.getElementById('emptyHistory');

  function uid(){ return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function loadHistory(){
    try {
      const res = await window.storage.get(STORAGE_KEY, false);
      if (res && res.value) history = JSON.parse(res.value);
    } catch(e) {
      history = [];
    }
    renderHistory();
  }

  async function persistHistory(){
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(history), false);
    } catch(e) {
      console.error('Could not save history', e);
    }
  }

  function renderHistory(){
    emptyHistory.style.display = history.length ? 'none' : 'block';
    const sorted = history.slice().sort((a,b) => b.createdAt - a.createdAt);
    contactSheet.innerHTML = sorted.map(item => `
      <div class="frame" data-id="${item.id}" tabindex="0" role="button" aria-label="Reload code">
        <button class="frame-del" data-action="delete" title="Remove">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <img src="${item.dataUrl}" alt="QR code for ${escapeHtml(item.text.slice(0,40))}">
        <div class="frame-text">${escapeHtml(item.text.slice(0,60))}</div>
      </div>
    `).join('');

    contactSheet.querySelectorAll('.frame').forEach(frame => {
      const id = frame.dataset.id;
      const item = history.find(h => h.id === id);
      if (!item) return;

      frame.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="delete"]')) return;
        contentInput.value = item.text;
        sizeSelect.value = String(item.size);
        levelSelect.value = item.level;
        generate(false);
      });

      frame.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        history = history.filter(h => h.id !== id);
        persistHistory(); renderHistory();
      });
    });
  }

  function setStatus(text, tone){
    statusBadge.textContent = text;
    statusBadge.style.color = tone === 'accent' ? 'var(--accent)' : tone === 'green' ? 'var(--green)' : '';
  }

  function generate(triggerSweep){
    const text = contentInput.value.trim();
    if (!text) {
      hint.textContent = 'Enter some content before generating a code.';
      hint.classList.add('error');
      return;
    }
    hint.classList.remove('error');
    hint.textContent = 'Higher error correction survives more damage but produces a denser pattern.';

    const size = parseInt(sizeSelect.value, 10);
    const level = levelSelect.value;

    qrContainer.innerHTML = '';
    placeholderMsg.style.display = 'none';
    setStatus('Encoding…');

    try {
      new QRCode(qrContainer, {
        text: text,
        width: size,
        height: size,
        colorDark: '#121212',
        colorLight: '#f7f5ef',
        correctLevel: QRCode.CorrectLevel[level]
      });
    } catch(e) {
      setStatus('Error', 'accent');
      hint.textContent = 'Could not generate a code for that content.';
      hint.classList.add('error');
      return;
    }

    // resize the viewfinder container to match code size (capped for layout)
    const displaySize = Math.min(size, 320);
    document.getElementById('viewfinder').style.width = displaySize + 'px';
    document.getElementById('viewfinder').style.height = displaySize + 'px';

    currentText = text;

    setTimeout(() => {
      const canvas = qrContainer.querySelector('canvas');
      const img = qrContainer.querySelector('img');
      if (canvas) {
        currentDataUrl = canvas.toDataURL('image/png');
      } else if (img) {
        currentDataUrl = img.src;
      }
      downloadBtn.disabled = !currentDataUrl;
      copyBtn.disabled = false;
      setStatus('Ready', 'green');

      if (triggerSweep !== false) {
        scanline.classList.remove('sweep');
        void scanline.offsetWidth;
        scanline.classList.add('sweep');
      }

      if (currentDataUrl) {
        history.push({
          id: uid(),
          text: text,
          size: size,
          level: level,
          dataUrl: currentDataUrl,
          createdAt: Date.now()
        });
        if (history.length > 24) history = history.slice(history.length - 24);
        persistHistory();
        renderHistory();
      }
    }, 60);
  }

  generateBtn.addEventListener('click', () => generate(true));
  contentInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(true);
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentDataUrl) return;
    const a = document.createElement('a');
    a.href = currentDataUrl;
    a.download = 'qr-code.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  copyBtn.addEventListener('click', async () => {
    if (!currentText) return;
    try {
      await navigator.clipboard.writeText(currentText);
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = 'Copy content'; copyBtn.classList.remove('copied'); }, 1400);
    } catch(e) {
      // clipboard unavailable; ignore
    }
  });

  loadHistory();
})();