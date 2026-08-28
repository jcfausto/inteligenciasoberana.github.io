(function () {
  const dataEl = document.getElementById('city-tip-data');
  if (!dataEl) {
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(dataEl.textContent);
  } catch (err) {
    return;
  }

  const cities = payload && payload.cities;
  const brazil = payload && payload.brazil;
  if (!cities || !brazil) {
    return;
  }

  const triggers = document.querySelectorAll('.city-tip');
  if (!triggers.length) {
    return;
  }

  const copy = {
    pt: {
      kicker: 'Indicadores sociais',
      pop: 'População (Censo 2022)',
      water: 'Água (rede geral)',
      sewage: 'Esgoto (rede geral)',
      garbage: 'Lixo coletado',
      pib: 'PIB per capita (2023)',
      vs: 'Brasil',
      source: 'IBGE, Censo Demográfico 2022 (universo) e PIB dos Municípios 2023. A PNAD Contínua não publica recorte municipal para cidades desta escala.',
      flags: {
        no_hospital: 'Sem hospital municipal',
        unpaved_low_income: 'Vias sem pavimentação / baixa renda',
      },
    },
    en: {
      kicker: 'Social indicators',
      pop: 'Population (2022 Census)',
      water: 'Piped water (network)',
      sewage: 'Sewer network',
      garbage: 'Waste collection',
      pib: 'GDP per capita (2023)',
      vs: 'Brazil',
      source: 'IBGE, 2022 Demographic Census (universe) and 2023 Municipal GDP. PNAD Contínua is not published at this municipal grain.',
      flags: {
        no_hospital: 'No municipal hospital',
        unpaved_low_income: 'Unpaved streets / low income',
      },
    },
  };

  const tip = document.createElement('div');
  tip.id = 'city-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  let active = null;
  let hideTimer = null;

  function currentLang() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'pt';
  }

  function loc() {
    return currentLang() === 'pt' ? 'pt-BR' : 'en-US';
  }

  function fmtInt(n) {
    return Number(n).toLocaleString(loc());
  }

  function fmtPct(n) {
    const v = Number(n).toFixed(1);
    return currentLang() === 'pt' ? `${v.replace('.', ',')}%` : `${v}%`;
  }

  function fmtMoney(n) {
    return `R$ ${fmtInt(Math.round(n))}`;
  }

  function clearHideTimer() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function positionTip(el) {
    const margin = 12;
    const gap = 8;
    const rect = el.getBoundingClientRect();
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    let top = rect.bottom + gap;
    let left = rect.left;

    if (top + tipHeight > window.innerHeight - margin) {
      top = rect.top - tipHeight - gap;
    }
    if (top < margin) {
      top = Math.min(rect.bottom + gap, window.innerHeight - tipHeight - margin);
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - tipWidth - margin));

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }

  function rowHtml(barPct, isLow) {
    const bar = barPct == null
      ? ''
      : `<span class="city-tip-bar" aria-hidden="true"><span style="width:${Math.max(1.5, Math.min(100, barPct))}%"></span></span>`;
    const cmpLine = barPct == null ? '' : `<span class="city-tip-cmp"></span>`;
    return (
      `<div class="city-tip-row">` +
        `<span class="city-tip-label"></span>` +
        `<span class="city-tip-value${isLow ? ' is-low' : ''}"></span>` +
        bar +
        cmpLine +
      `</div>`
    );
  }

  function fillTip(city) {
    const lang = currentLang();
    const t = copy[lang];
    const flags = city.flags || [];
    const flagHtml = flags.map(() => '<p class="city-tip-flag"></p>').join('');
    const waterLow = city.water_net < brazil.water_net;
    const sewLow = city.sewage_net < brazil.sewage_net;
    const trashLow = city.garbage < brazil.garbage;
    const pibLow = city.pib_pc < brazil.pib_pc;

    tip.innerHTML =
      `<p class="city-tip-kicker"></p>` +
      `<p class="city-tip-title"></p>` +
      flagHtml +
      `<div class="city-tip-grid">` +
        rowHtml() +
        rowHtml(city.water_net, waterLow) +
        rowHtml(city.sewage_net, sewLow) +
        rowHtml(city.garbage, trashLow) +
        rowHtml((city.pib_pc / brazil.pib_pc) * 100, pibLow) +
      `</div>` +
      `<p class="city-tip-src"></p>`;

    tip.querySelector('.city-tip-kicker').textContent = t.kicker;
    tip.querySelector('.city-tip-title').textContent = `${city.name} (${city.uf})`;
    tip.querySelectorAll('.city-tip-flag').forEach((el, i) => {
      el.textContent = t.flags[flags[i]] || flags[i];
    });

    const rows = tip.querySelectorAll('.city-tip-row');
    const specs = [
      { label: t.pop, value: fmtInt(city.pop), cmp: null },
      { label: t.water, value: fmtPct(city.water_net), cmp: `${t.vs} ${fmtPct(brazil.water_net)}` },
      { label: t.sewage, value: fmtPct(city.sewage_net), cmp: `${t.vs} ${fmtPct(brazil.sewage_net)}` },
      { label: t.garbage, value: fmtPct(city.garbage), cmp: `${t.vs} ${fmtPct(brazil.garbage)}` },
      { label: t.pib, value: fmtMoney(city.pib_pc), cmp: `${t.vs} ${fmtMoney(brazil.pib_pc)}` },
    ];
    rows.forEach((row, i) => {
      row.querySelector('.city-tip-label').textContent = specs[i].label;
      row.querySelector('.city-tip-value').textContent = specs[i].value;
      const cmpEl = row.querySelector('.city-tip-cmp');
      if (cmpEl && specs[i].cmp) {
        cmpEl.textContent = specs[i].cmp;
      }
    });
    tip.querySelector('.city-tip-src').textContent = t.source;
  }

  function showTip(el) {
    const city = cities[el.dataset.city];
    if (!city) {
      return;
    }
    clearHideTimer();
    if (active && active !== el) {
      active.setAttribute('aria-expanded', 'false');
      active.removeAttribute('aria-describedby');
    }
    active = el;
    fillTip(city);
    tip.hidden = false;
    positionTip(el);
    el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-describedby', 'city-tip');
  }

  function hideTip() {
    clearHideTimer();
    tip.hidden = true;
    if (active) {
      active.setAttribute('aria-expanded', 'false');
      active.removeAttribute('aria-describedby');
      active = null;
    }
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      hideTip();
    }, 180);
  }

  triggers.forEach((el) => {
    el.addEventListener('mouseenter', () => showTip(el));
    el.addEventListener('mouseleave', scheduleHide);
    el.addEventListener('focus', () => showTip(el));
    el.addEventListener('blur', (event) => {
      if (tip.contains(event.relatedTarget)) {
        return;
      }
      scheduleHide();
    });
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const touchLike = window.matchMedia('(hover: none)').matches;
      if (touchLike && active === el && !tip.hidden) {
        hideTip();
      } else {
        showTip(el);
      }
    });
  });

  tip.addEventListener('mouseenter', clearHideTimer);
  tip.addEventListener('mouseleave', scheduleHide);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideTip();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!active) {
      return;
    }
    if (active.contains(event.target) || tip.contains(event.target)) {
      return;
    }
    hideTip();
  });

  window.addEventListener('scroll', () => {
    if (active && !tip.hidden) {
      positionTip(active);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (active && !tip.hidden) {
      positionTip(active);
    }
  });

  new MutationObserver(() => {
    if (active && !tip.hidden) {
      const city = cities[active.dataset.city];
      if (city) {
        fillTip(city);
        positionTip(active);
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
})();
