(function () {
  const payload = document.getElementById('custo-data');
  const form = document.getElementById('custo-form');
  const textarea = document.getElementById('custo-prompt');
  const live = document.getElementById('custo-token-live');
  const hud = document.getElementById('custo-hud');
  const hudText = document.getElementById('custo-hud-text');
  const simSection = document.getElementById('custo-sim');
  if (!payload || !form || !textarea) return;

  const data = JSON.parse(payload.textContent);
  const sim = data.simulator;
  const stages = Array.from(document.querySelectorAll('.custo-stage'));
  const receiptRows = Array.from(document.querySelectorAll('.custo-receipt-row'));

  const COPY = {
    pt: {
      tokensLive: function (n) {
        return n + ' token' + (n === 1 ? '' : 's') + ' de entrada (regra de ~4 caracteres)';
      },
      vitrine: 'US$ 0,00 no gratuito · ~US$ 20/mês no pago',
      tokens: function (input, outMin, outMax) {
        if (outMin === outMax) return input + ' → ' + outMin;
        return input + ' → ' + outMin + '–' + outMax + ' (inclui raciocínio oculto)';
      },
      labor: 'US$ 1,32–2,00/h no Quênia · não entra no token',
      footnote:
        'O amortizado é pequeno porque o denominador é enorme. O treino absoluto e o trabalho humano não diminuem com a sua consulta.',
      hud: function (mode, input, outMin, outMax, eMin, eMax, apiMin, apiMax) {
        const modeLabel = mode === 'reasoning' ? 'Raciocínio' : 'Chat';
        const out = outMin === outMax ? String(outMax) : outMin + '–' + outMax;
        return (
          modeLabel +
          ' · ' +
          input +
          ' → ' +
          out +
          ' tok · ' +
          fmtRange(eMin, eMax, 2) +
          ' Wh · ' +
          fmtUsdRange(apiMin, apiMax)
        );
      },
      amortNote: 'por consulta, se 1–10 bilhões de pedidos',
    },
    en: {
      tokensLive: function (n) {
        return n + ' input token' + (n === 1 ? '' : 's') + ' (rule of thumb: ~4 characters)';
      },
      vitrine: 'US$ 0.00 on free tier · ~US$ 20/month paid',
      tokens: function (input, outMin, outMax) {
        if (outMin === outMax) return input + ' → ' + outMin;
        return input + ' → ' + outMin + '–' + outMax + ' (includes hidden reasoning)';
      },
      labor: 'US$ 1.32–2.00/h in Kenya · not in the token',
      footnote:
        'Amortized looks small because the denominator is huge. Absolute training and human labor do not shrink with your query.',
      hud: function (mode, input, outMin, outMax, eMin, eMax, apiMin, apiMax) {
        const modeLabel = mode === 'reasoning' ? 'Reasoning' : 'Chat';
        const out = outMin === outMax ? String(outMax) : outMin + '–' + outMax;
        return (
          modeLabel +
          ' · ' +
          input +
          ' → ' +
          out +
          ' tok · ' +
          fmtRange(eMin, eMax, 2) +
          ' Wh · ' +
          fmtUsdRange(apiMin, apiMax)
        );
      },
      amortNote: 'per query, if 1–10 billion requests',
    },
  };

  let lastReceipt = null;
  let journeyTimer = 0;
  let journeying = false;
  const STEP_MS = 10000;

  function lang() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'pt';
  }

  function locale() {
    return lang() === 'pt' ? 'pt-BR' : 'en-US';
  }

  function fmtNum(n, digits) {
    return new Intl.NumberFormat(locale(), {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(n);
  }

  function fmtRange(min, max, digits) {
    if (Math.abs(min - max) < 1e-9) return fmtNum(min, digits);
    return fmtNum(min, digits) + '–' + fmtNum(max, digits);
  }

  function fmtUsd(n) {
    const digits = n < 0.01 ? 4 : n < 1 ? 3 : 2;
    return 'US$ ' + fmtNum(n, digits);
  }

  function fmtUsdRange(min, max) {
    if (Math.abs(min - max) < 1e-9) return fmtUsd(min);
    return fmtUsd(min) + '–' + fmtUsd(max);
  }

  function currentMode() {
    const checked = form.querySelector('input[name="custo-mode"]:checked');
    return checked && checked.value === 'reasoning' ? 'reasoning' : 'chat';
  }

  function inputTokens(text) {
    const chars = (text || '').length;
    return Math.max(1, Math.round(chars / sim.chars_per_token));
  }

  function compute(text, mode) {
    const input = inputTokens(text);
    let visible = Math.round(input * sim.chat.output_ratio);
    visible = Math.max(sim.chat.output_tokens_min, Math.min(sim.chat.output_tokens_cap, visible));
    let outMin = visible;
    let outMax = visible;
    const spec = mode === 'reasoning' ? sim.reasoning : sim.chat;
    if (mode === 'reasoning') {
      outMin = visible * sim.reasoning.output_multiplier.min;
      outMax = visible * sim.reasoning.output_multiplier.max;
    }
    const energyMin = (outMin / 1000) * spec.energy_wh_per_1k_output.min;
    const energyMax = (outMax / 1000) * spec.energy_wh_per_1k_output.max;
    const waterMin = (energyMin / 1000) * sim.water_l_per_kwh.min * 1000;
    const waterMax = (energyMax / 1000) * sim.water_l_per_kwh.max * 1000;
    const apiMin = (input / 1000) * spec.api_usd_per_1k_input + (outMin / 1000) * spec.api_usd_per_1k_output;
    const apiMax = (input / 1000) * spec.api_usd_per_1k_input + (outMax / 1000) * spec.api_usd_per_1k_output;
    const amortMin = sim.training_usd.min / sim.amortization_queries.max;
    const amortMax = sim.training_usd.max / sim.amortization_queries.min;
    return {
      mode: mode,
      input: input,
      outMin: outMin,
      outMax: outMax,
      energyMin: energyMin,
      energyMax: energyMax,
      waterMin: waterMin,
      waterMax: waterMax,
      apiMin: apiMin,
      apiMax: apiMax,
      amortMin: amortMin,
      amortMax: amortMax,
      trainingMin: sim.training_usd.min,
      trainingMax: sim.training_usd.max,
    };
  }

  function renderLive() {
    const n = inputTokens(textarea.value);
    if (live) live.textContent = COPY[lang()].tokensLive(n);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderReceipt(receipt) {
    lastReceipt = receipt;
    const t = COPY[lang()];
    setText('custo-val-vitrine', t.vitrine);
    setText('custo-val-tokens', t.tokens(receipt.input, receipt.outMin, receipt.outMax));
    setText('custo-val-energy', fmtRange(receipt.energyMin, receipt.energyMax, 2) + ' Wh');
    setText('custo-val-water', fmtRange(receipt.waterMin, receipt.waterMax, 1) + ' ml');
    setText('custo-val-api', fmtUsdRange(receipt.apiMin, receipt.apiMax));
    setText(
      'custo-val-training',
      'US$ ' +
        fmtNum(receipt.trainingMin / 1e6, 0) +
        '–' +
        fmtNum(receipt.trainingMax / 1e6, 0) +
        (lang() === 'pt' ? ' milhões' : ' million')
    );
    setText('custo-val-amort', fmtUsdRange(receipt.amortMin, receipt.amortMax));
    setText('custo-val-labor', t.labor);
    const foot = document.getElementById('custo-receipt-footnote');
    if (foot) foot.textContent = t.footnote;
    if (hudText) {
      hudText.textContent = t.hud(
        receipt.mode,
        receipt.input,
        receipt.outMin,
        receipt.outMax,
        receipt.energyMin,
        receipt.energyMax,
        receipt.apiMin,
        receipt.apiMax
      );
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function lightStage(el, on) {
    if (!el) return;
    el.classList.toggle('is-lit', on);
  }

  function setActive(el) {
    stages.forEach(function (s) {
      s.classList.toggle('is-active', s === el);
    });
    const key = el && el.getAttribute('data-receipt');
    receiptRows.forEach(function (row) {
      row.classList.toggle('is-hot', Boolean(key) && row.getAttribute('data-row') === key);
    });
  }

  function clearJourney() {
    window.clearTimeout(journeyTimer);
    journeyTimer = 0;
  }

  function walkPath() {
    const receipt = compute(textarea.value, currentMode());
    renderReceipt(receipt);
    stages.forEach(function (s) {
      s.classList.remove('is-lit', 'is-active', 'is-pulse');
    });
    receiptRows.forEach(function (row) {
      row.classList.remove('is-hot');
    });
    if (hud) hud.hidden = false;

    journeying = true;
    if (prefersReducedMotion() || stages.length === 0) {
      stages.forEach(function (s) {
        s.classList.add('is-lit');
      });
      const last = stages[stages.length - 1];
      setActive(last);
      if (last) last.scrollIntoView({ block: 'center' });
      journeying = false;
      return;
    }

    let i = 0;
    function step() {
      if (i >= stages.length) {
        journeying = false;
        return;
      }
      const el = stages[i];
      lightStage(el, true);
      setActive(el);
      el.classList.add('is-pulse');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      i += 1;
      journeyTimer = window.setTimeout(function () {
        el.classList.remove('is-pulse');
        step();
      }, STEP_MS);
    }
    step();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearJourney();
    walkPath();
  });

  textarea.addEventListener('input', renderLive);

  form.querySelectorAll('input[name="custo-mode"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (lastReceipt) renderReceipt(compute(textarea.value, currentMode()));
    });
  });

  function maybeSwapSample() {
    const pt = sim.sample_prompt.pt;
    const en = sim.sample_prompt.en;
    const value = textarea.value.trim();
    if (lang() === 'en' && value === pt) textarea.value = en;
    else if (lang() === 'pt' && value === en) textarea.value = pt;
    renderLive();
    if (lastReceipt) renderReceipt(compute(textarea.value, currentMode()));
  }

  document.addEventListener('site-language-change', maybeSwapSample);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          lightStage(el, true);
          if (!journeying) setActive(el);
        });
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: 0.1 }
    );
    stages.forEach(function (s) {
      io.observe(s);
    });
  }

  if (simSection && hud && 'IntersectionObserver' in window) {
    const hudIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!lastReceipt) return;
          hud.hidden = entry.isIntersecting;
        });
      },
      { threshold: 0 }
    );
    hudIo.observe(simSection);
  }

  renderLive();
})();
