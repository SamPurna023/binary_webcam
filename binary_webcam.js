const vid = document.getElementById('vid');
const cnv = document.getElementById('cnv');
const ctx = cnv.getContext('2d');
const out = document.getElementById('output');
const startBtn = document.getElementById('startBtn');
const snapBtn = document.getElementById('snapBtn');
const status = document.getElementById('status');
const placeholder = document.getElementById('placeholder');

let running = false;
let animId = null;
let mode = 'binary';
let color = '#00ff41';

const shadeChars = [' ', '.', ':', '-', '=', '+', '*', '#', '@'];
const binaryChars = ['0', '1'];
const mixedChars = ['0', '1', '0', '0', '1', '1', '0', '1', '0', '1'];

function getBrightness(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function render() {
  if (!running) return;

  const fs = parseInt(document.getElementById('fontSize').value);
  const contrast = parseFloat(document.getElementById('contrast').value);
  const threshold = parseInt(document.getElementById('threshold').value);
  const brightness = parseFloat(document.getElementById('brightness').value);
  const mirror = document.getElementById('mirror').checked;
  const invert = document.getElementById('invert').checked;

  out.style.fontSize = fs + 'px';
  out.style.color = color;
  if (invert) {
    document.body.style.background = color === '#ffffff' ? '#111' : '#f0f0e8';
    out.style.color = '#000';
  } else {
    document.body.style.background = '#000';
    out.style.color = color;
  }

  const charW = fs * 0.601;
  const charH = fs;
  const areaW = document.getElementById('canvas-area').clientWidth - 24;
  const areaH = window.innerHeight - 80;
  const cols = Math.floor(areaW / charW);
  const rows = Math.floor(areaH / charH);

  cnv.width = cols;
  cnv.height = rows;

  try {
    ctx.save();
    ctx.filter = `contrast(${contrast}) brightness(${brightness})`;
    if (mirror) {
      ctx.translate(cols, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(vid, 0, 0, cols, rows);
    ctx.restore();
  } catch (e) {
    console.error('Canvas drawing error:', e);
    animId = requestAnimationFrame(render);
    return;
  }

  const data = ctx.getImageData(0, 0, cols, rows).data;

  let text = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let bright = getBrightness(data[i], data[i + 1], data[i + 2]);

      if (mode === 'binary') {
        text += bright > threshold ? '1' : '0';
      } else if (mode === 'shade') {
        const idx = Math.floor((bright / 255) * (shadeChars.length - 1));
        text += shadeChars[idx];
      } else if (mode === 'block') {
        text += bright > threshold ? '█' : ' ';
      } else if (mode === 'mixed') {
        if (bright > threshold) {
          text += binaryChars[Math.floor(Math.random() * 2)];
        } else {
          text += ' ';
        }
      }
    }
    text += '\n';
  }
  out.textContent = text;
  animId = requestAnimationFrame(render);
}

startBtn.addEventListener('click', async () => {
  if (running) {
    running = false;
    cancelAnimationFrame(animId);
    vid.srcObject?.getTracks().forEach(t => t.stop());
    vid.srcObject = null;
    out.textContent = '';
    placeholder.style.display = 'flex';
    startBtn.textContent = '▶ START CAMERA';
    status.textContent = '● OFFLINE';
    snapBtn.style.display = 'none';
    document.body.style.background = '#000';
    return;
  }
  try {
    status.textContent = '○ CONNECTING...';
    const constraints = {
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    vid.srcObject = stream;
    
    // Wait for video to load metadata before playing
    vid.onloadedmetadata = () => {
      vid.play().then(() => {
        running = true;
        placeholder.style.display = 'none';
        startBtn.textContent = '⏹ STOP';
        status.textContent = '● LIVE';
        snapBtn.style.display = 'inline-block';
        render();
      }).catch(err => {
        status.textContent = '✕ ERROR: Could not play video';
        console.error('Video play error:', err);
      });
    };
  } catch (e) {
    let errorMsg = e.name;
    if (e.name === 'NotAllowedError') errorMsg = 'Camera permission denied';
    else if (e.name === 'NotFoundError') errorMsg = 'No camera found';
    else if (e.name === 'NotReadableError') errorMsg = 'Camera in use';
    else if (e.name === 'OverconstrainedError') errorMsg = 'Camera constraints not met';
    
    status.textContent = '✕ ERROR: ' + errorMsg;
    console.error('Camera access error:', e);
  }
});

snapBtn.addEventListener('click', () => {
  const outputArea = document.getElementById('canvas-area');
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCanvas.width = outputArea.offsetWidth;
  tempCanvas.height = outputArea.offsetHeight;

  const bgColor = document.body.style.background || '#000';
  tempCtx.fillStyle = bgColor;
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  const fontSize = parseInt(document.getElementById('fontSize').value);
  tempCtx.font = fontSize + 'px "Courier New", monospace';
  tempCtx.fillStyle = out.style.color || color;
  tempCtx.lineHeight = fontSize;

  const lines = out.textContent.split('\n');
  const lineHeight = fontSize * 1.2;
  let y = 20;

  for (let line of lines) {
    if (y > tempCanvas.height) break;
    tempCtx.fillText(line, 20, y);
    y += lineHeight;
  }

  tempCanvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'binary_art_' + Date.now() + '.jpg';
    a.click();
  }, 'image/jpeg', 0.95);
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    color = dot.dataset.color;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
  });
});

document.getElementById('fontSize').addEventListener('input', e => {
  document.getElementById('fsVal').textContent = e.target.value + 'px';
});
document.getElementById('contrast').addEventListener('input', e => {
  document.getElementById('ctVal').textContent = parseFloat(e.target.value).toFixed(1);
});
document.getElementById('threshold').addEventListener('input', e => {
  document.getElementById('thVal').textContent = e.target.value;
});
document.getElementById('brightness').addEventListener('input', e => {
  document.getElementById('brVal').textContent = parseFloat(e.target.value).toFixed(1);
});
