(function () {
  const table = document.getElementById('uni-table');
  if (!table) {
    return;
  }

  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('.uni-row'));
  const searchInput = document.getElementById('uni-search');
  const ufSelect = document.getElementById('uni-uf');
  const empty = document.getElementById('uni-empty');
  const sortButtons = table.querySelectorAll('.uni-sort');

  let sortKey = 'name';
  let sortDir = 'asc';
  let sortType = 'text';

  function pageLang() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'pt';
  }

  function formatMoney(value, lang, mode) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return '';
    }
    const loc = lang === 'en' ? 'en-US' : 'pt-BR';
    if (mode === 'bi') {
      const formatted = (n / 1e9).toLocaleString(loc, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return lang === 'en' ? `R$ ${formatted}B` : `R$ ${formatted} bi`;
    }
    if (mode === 'mi') {
      const millions = n / 1e6;
      const digits = millions >= 100 ? 0 : 1;
      const formatted = millions.toLocaleString(loc, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
      return lang === 'en' ? `R$ ${formatted}M` : `R$ ${formatted} mi`;
    }
    return n.toLocaleString(loc, {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });
  }

  function applyMoney() {
    const lang = pageLang();
    document.querySelectorAll('[data-money]').forEach((el) => {
      el.textContent = formatMoney(el.dataset.money, lang, el.dataset.moneyMode || 'brl');
    });
  }

  function applyChrome() {
    const lang = pageLang();
    if (searchInput) {
      searchInput.placeholder =
        lang === 'en' ? searchInput.dataset.placeholderEn : searchInput.dataset.placeholderPt;
    }
    if (ufSelect) {
      const allOpt = ufSelect.querySelector('option[value=""]');
      if (allOpt) {
        allOpt.textContent = lang === 'en' ? allOpt.dataset.labelEn : allOpt.dataset.labelPt;
      }
    }
  }

  function rowVisible(row) {
    const uf = ufSelect ? ufSelect.value : '';
    if (uf && row.dataset.uf !== uf) {
      return false;
    }
    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    if (!q) {
      return true;
    }
    const hay = [
      row.dataset.acronym,
      row.dataset.namePt,
      row.dataset.nameEn,
      row.dataset.city,
      row.dataset.uf,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }

  function compareRows(a, b) {
    let av;
    let bv;
    if (sortType === 'num') {
      av = Number(a.dataset[sortKey]) || 0;
      bv = Number(b.dataset[sortKey]) || 0;
    } else if (sortKey === 'name') {
      av = (a.dataset.acronym || '').toLocaleLowerCase('pt-BR');
      bv = (b.dataset.acronym || '').toLocaleLowerCase('pt-BR');
    } else {
      av = (a.dataset[sortKey] || '').toLocaleLowerCase('pt-BR');
      bv = (b.dataset[sortKey] || '').toLocaleLowerCase('pt-BR');
    }
    if (av < bv) {
      return sortDir === 'asc' ? -1 : 1;
    }
    if (av > bv) {
      return sortDir === 'asc' ? 1 : -1;
    }
    return a.dataset.acronym.localeCompare(b.dataset.acronym, 'pt-BR');
  }

  function applySortIndicators() {
    sortButtons.forEach((btn) => {
      const th = btn.closest('th');
      const active = btn.dataset.sort === sortKey;
      btn.setAttribute('aria-pressed', String(active));
      if (th) {
        if (active) {
          th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
        } else {
          th.removeAttribute('aria-sort');
        }
      }
    });
  }

  function render() {
    const visible = [];
    const hidden = [];
    rows.forEach((row) => {
      if (rowVisible(row)) {
        visible.push(row);
        row.hidden = false;
      } else {
        hidden.push(row);
        row.hidden = true;
      }
    });
    visible.sort(compareRows);
    visible.concat(hidden).forEach((row) => tbody.appendChild(row));
    const none = visible.length === 0;
    if (empty) {
      empty.classList.toggle('hidden', !none);
    }
    applySortIndicators();
  }

  sortButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortType = btn.dataset.type === 'num' ? 'num' : 'text';
        sortDir = sortType === 'num' ? 'desc' : 'asc';
      }
      render();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', render);
  }
  if (ufSelect) {
    ufSelect.addEventListener('change', render);
  }

  function syncLanguage() {
    applyMoney();
    applyChrome();
    render();
  }

  const originalSetLanguage = window.setLanguage;
  window.setLanguage = function setLanguagePatched(lang) {
    if (typeof originalSetLanguage === 'function') {
      originalSetLanguage(lang);
    }
    syncLanguage();
  };

  syncLanguage();
})();
