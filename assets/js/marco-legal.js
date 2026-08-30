(function () {
  const search = document.getElementById('marco-search');
  const hearing = document.getElementById('marco-hearing');
  const list = document.getElementById('marco-invitee-list');
  const empty = document.getElementById('marco-empty');
  const count = document.getElementById('marco-count');
  if (!search || !hearing || !list) {
    return;
  }

  const cards = Array.from(list.querySelectorAll('.marco-invitee'));

  function pageLang() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'pt';
  }

  function selectedSector() {
    const checked = document.querySelector('input[name="marco-sector"]:checked');
    return checked ? checked.value : '';
  }

  function applyChrome() {
    const lang = pageLang();
    search.placeholder =
      lang === 'en' ? search.dataset.placeholderEn : search.dataset.placeholderPt;
    Array.from(hearing.options).forEach((opt) => {
      if (!opt.dataset.labelPt) {
        return;
      }
      opt.textContent = lang === 'en' ? opt.dataset.labelEn : opt.dataset.labelPt;
    });
  }

  function matches(card) {
    const query = (search.value || '').trim().toLocaleLowerCase('pt-BR');
    const sector = selectedSector();
    const hearingId = hearing.value;
    if (sector && card.dataset.sector !== sector) {
      return false;
    }
    if (hearingId) {
      const ids = (card.dataset.hearings || '').split(',').filter(Boolean);
      if (!ids.includes(hearingId)) {
        return false;
      }
    }
    if (!query) {
      return true;
    }
    const hay = [card.dataset.name, card.dataset.org, card.dataset.title]
      .join(' ')
      .toLocaleLowerCase('pt-BR');
    return hay.includes(query);
  }

  function render() {
    let visible = 0;
    cards.forEach((card) => {
      const show = matches(card);
      card.classList.toggle('hidden', !show);
      if (show) {
        visible += 1;
      }
    });
    if (empty) {
      empty.classList.toggle('hidden', visible > 0);
    }
    if (count) {
      const total = count.dataset.total || String(cards.length);
      const lang = pageLang();
      count.textContent =
        lang === 'en'
          ? `${visible} of ${total} invitees`
          : `${visible} de ${total} convidados`;
    }
  }

  search.addEventListener('input', render);
  hearing.addEventListener('change', render);
  document.querySelectorAll('input[name="marco-sector"]').forEach((input) => {
    input.addEventListener('change', render);
  });
  document.addEventListener('site-language-change', () => {
    applyChrome();
    render();
  });

  applyChrome();
  render();
})();
