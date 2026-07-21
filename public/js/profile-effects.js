(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const effect = canvas.dataset.effect || 'none';
  const accent = canvas.dataset.accent || '#a01c2c';
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Particles (floating dots connected by lines) ----------
  function runParticles() {
    const COUNT = Math.min(70, Math.floor((w * h) / 18000));
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4
    }));
    function tick() {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = accent + Math.floor((1 - dist / 120) * 40).toString(16).padStart(2, '0');
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ---------- Snow ----------
  function runSnow() {
    const COUNT = 90;
    const flakes = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 2.5 + 1, vy: Math.random() * 1 + 0.4, drift: Math.random() * 0.6 - 0.3
    }));
    function tick() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      flakes.forEach(f => {
        f.y += f.vy; f.x += f.drift;
        if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ---------- Matrix rain ----------
  function runMatrix() {
    const fontSize = 15;
    const cols = Math.floor(w / fontSize);
    const drops = Array(cols).fill(0);
    const chars = 'アイウエオカキクケコサシスセソ0123456789';
    function tick() {
      ctx.fillStyle = 'rgba(10,10,15,0.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.font = fontSize + 'px monospace';
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, y * fontSize);
        if (y * fontSize > h && Math.random() > 0.975) drops[i] = 0;
        else drops[i] = y + 1;
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  if (effect === 'particles') runParticles();
  else if (effect === 'snow') runSnow();
  else if (effect === 'matrix') runMatrix();

  // ---------- Cursor effect ----------
  const cursorMode = document.body.dataset.cursor || 'none';
  if (cursorMode !== 'none') {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.style.background = accent;
    document.body.appendChild(glow);
    window.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  }

  // ---------- Typing bio effect ----------
  const bioEl = document.querySelector('[data-typing]');
  if (bioEl) {
    const full = bioEl.dataset.typing;
    bioEl.textContent = '';
    let i = 0;
    function type() {
      if (i <= full.length) {
        bioEl.textContent = full.slice(0, i);
        i++;
        setTimeout(type, 45);
      }
    }
    type();
  }

  // ---------- Audio toggle ----------
  const audioEl = document.getElementById('profile-audio');
  const toggleBtn = document.getElementById('audio-toggle');
  if (audioEl && toggleBtn) {
    let playing = false;

    // محاولة تشغيل تلقائي فور فتح الصفحة
    audioEl.play().then(() => {
      playing = true;
      toggleBtn.textContent = '⏸';
    }).catch(() => {
      // المتصفح منع التشغيل التلقائي (سياسة شائعة) — نبدأ عند أول تفاعل بالصفحة
      playing = false;
      toggleBtn.textContent = '▶';
      const startOnFirstInteraction = () => {
        if (!playing) {
          audioEl.play().then(() => {
            playing = true;
            toggleBtn.textContent = '⏸';
          }).catch(() => {});
        }
        document.removeEventListener('click', startOnFirstInteraction);
        document.removeEventListener('touchstart', startOnFirstInteraction);
      };
      document.addEventListener('click', startOnFirstInteraction, { once: true });
      document.addEventListener('touchstart', startOnFirstInteraction, { once: true });
    });

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (playing) { audioEl.pause(); toggleBtn.textContent = '▶'; }
      else { audioEl.play().catch(() => {}); toggleBtn.textContent = '⏸'; }
      playing = !playing;
    });
  }
})();
