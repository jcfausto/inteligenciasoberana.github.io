(function () {
  const dataEl = document.getElementById('glossary-data');
  if (!dataEl) {
    return;
  }

  let entries = [];
  try {
    entries = JSON.parse(dataEl.textContent);
  } catch (err) {
    return;
  }

  const byId = {};
  entries.forEach((entry) => {
    if (entry && entry.id) {
      byId[entry.id] = entry;
    }
  });

  const terms = document.querySelectorAll('.glossary-term');
  if (!terms.length) {
    return;
  }

  const glossaryPage = dataEl.dataset.glossaryPage || '/glossario.html';
  const tip = document.createElement('div');
  tip.id = 'glossary-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  let activeTerm = null;
  let hideTimer = null;

  function currentLang() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'pt';
  }

  function clearHideTimer() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function positionTip(termEl) {
    const margin = 12;
    const gap = 8;
    const rect = termEl.getBoundingClientRect();
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - tipWidth / 2;

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

  function fillTip(entry) {
    const lang = currentLang();
    const label = (entry.label && entry.label[lang]) || entry.id;
    const def = (entry.def && entry.def[lang]) || '';
    const more = lang === 'pt' ? 'Ver no glossário' : 'Open glossary';
    tip.innerHTML =
      `<p class="glossary-tip-term"></p>` +
      `<p class="glossary-tip-def"></p>` +
      `<a class="glossary-tip-link" href="${glossaryPage}#${entry.id}"></a>`;
    tip.querySelector('.glossary-tip-term').textContent = label;
    tip.querySelector('.glossary-tip-def').textContent = def;
    const link = tip.querySelector('.glossary-tip-link');
    link.textContent = `${more} →`;
  }

  function showTip(termEl) {
    const entry = byId[termEl.dataset.glossary];
    if (!entry) {
      return;
    }
    clearHideTimer();
    if (activeTerm && activeTerm !== termEl) {
      activeTerm.setAttribute('aria-expanded', 'false');
      activeTerm.removeAttribute('aria-describedby');
    }
    activeTerm = termEl;
    fillTip(entry);
    tip.hidden = false;
    positionTip(termEl);
    termEl.setAttribute('aria-expanded', 'true');
    termEl.setAttribute('aria-describedby', 'glossary-tip');
  }

  function hideTip() {
    clearHideTimer();
    tip.hidden = true;
    if (activeTerm) {
      activeTerm.setAttribute('aria-expanded', 'false');
      activeTerm.removeAttribute('aria-describedby');
      activeTerm = null;
    }
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      hideTip();
    }, 180);
  }

  terms.forEach((termEl) => {
    termEl.addEventListener('mouseenter', () => showTip(termEl));
    termEl.addEventListener('mouseleave', scheduleHide);
    termEl.addEventListener('focus', () => showTip(termEl));
    termEl.addEventListener('blur', (event) => {
      if (tip.contains(event.relatedTarget)) {
        return;
      }
      scheduleHide();
    });
    termEl.addEventListener('click', (event) => {
      event.preventDefault();
      const touchLike = window.matchMedia('(hover: none)').matches;
      if (touchLike && activeTerm === termEl && !tip.hidden) {
        hideTip();
      } else {
        showTip(termEl);
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
    if (!activeTerm) {
      return;
    }
    if (activeTerm.contains(event.target) || tip.contains(event.target)) {
      return;
    }
    hideTip();
  });

  window.addEventListener('scroll', () => {
    if (activeTerm && !tip.hidden) {
      positionTip(activeTerm);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeTerm && !tip.hidden) {
      positionTip(activeTerm);
    }
  });

  new MutationObserver(() => {
    if (activeTerm && !tip.hidden) {
      const entry = byId[activeTerm.dataset.glossary];
      if (entry) {
        fillTip(entry);
        positionTip(activeTerm);
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
})();
