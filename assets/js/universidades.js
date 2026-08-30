(function () {
  const table = document.getElementById('uni-table');
  const tbody = table ? table.querySelector('tbody') : null;
  const rows = tbody ? Array.from(tbody.querySelectorAll('.uni-row')) : [];
  const searchInput = document.getElementById('uni-search');
  const ufSelect = document.getElementById('uni-uf');
  const empty = document.getElementById('uni-empty');
  const sortButtons = table ? table.querySelectorAll('.uni-sort') : [];
  let investChart = null;

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
    if (mode === 'mi' || mode === 'mi1') {
      const millions = n / 1e6;
      const digits = mode === 'mi1' || millions < 100 ? 1 : 0;
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

  function millions(value) {
    return Math.round(Number(value) / 1e5) / 10;
  }

  function formatInvestMillions(value, lang) {
    const loc = lang === 'en' ? 'en-US' : 'pt-BR';
    const formatted = value.toLocaleString(loc, {
      minimumFractionDigits: value >= 100 ? 0 : 1,
      maximumFractionDigits: 1,
    });
    return lang === 'en' ? `R$ ${formatted}M` : `R$ ${formatted} mi`;
  }

  function investCopy(lang) {
    if (lang === 'en') {
      return {
        ploa: 'Executive bill (PLOA)',
        loa: 'Enacted budget (LOA)',
        axis: 'R$ millions (2026 prices)',
        aria: 'Bar chart of federal university capital investment from 2014 to 2026',
      };
    }
    return {
      ploa: 'Proposta do Executivo (PLOA)',
      loa: 'Orçamento autorizado (LOA)',
      axis: 'R$ milhões (preços de 2026)',
      aria: 'Gráfico de barras do investimento de capital das universidades federais de 2014 a 2026',
    };
  }

  function initInvestChart() {
    const canvas = document.getElementById('uniInvestChart');
    const dataEl = document.getElementById('uni-invest-data');
    if (!canvas || !dataEl || typeof Chart === 'undefined') {
      return;
    }
    let series;
    try {
      series = JSON.parse(dataEl.textContent);
    } catch (err) {
      return;
    }
    if (!Array.isArray(series) || series.length === 0) {
      return;
    }
    const lang = pageLang();
    const copy = investCopy(lang);
    const labels = series.map((row) => String(row.year));
    const ploa = series.map((row) => millions(row.ploa_real));
    const loa = series.map((row) => millions(row.loa_real));
    const last = labels.length - 1;
    const ploaColors = labels.map((_, i) => (i === last ? '#9a3f14' : '#c45c26'));
    const loaColors = labels.map((_, i) => (i === last ? '#334155' : '#0f172a'));
    canvas.setAttribute('aria-label', copy.aria);
    investChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: copy.ploa,
            data: ploa,
            backgroundColor: ploaColors,
            borderWidth: 0,
            borderRadius: 3,
            maxBarThickness: 18,
          },
          {
            label: copy.loa,
            data: loa,
            backgroundColor: loaColors,
            borderWidth: 0,
            borderRadius: 3,
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#334155',
              boxWidth: 12,
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            },
          },
          tooltip: {
            callbacks: {
              label(item) {
                return `${item.dataset.label}: ${formatInvestMillions(item.raw, pageLang())}`;
              },
            },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#6b7280',
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#9ca3af',
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              callback(value) {
                return formatInvestMillions(value, pageLang());
              },
            },
            grid: { color: '#f3f4f6' },
            border: { display: false },
            title: {
              display: true,
              text: copy.axis,
              color: '#6b7280',
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            },
          },
        },
      },
    });
  }

  function applyInvestChartLanguage() {
    if (!investChart) {
      return;
    }
    const copy = investCopy(pageLang());
    investChart.data.datasets[0].label = copy.ploa;
    investChart.data.datasets[1].label = copy.loa;
    investChart.options.scales.y.title.text = copy.axis;
    const canvas = document.getElementById('uniInvestChart');
    if (canvas) {
      canvas.setAttribute('aria-label', copy.aria);
    }
    investChart.update('none');
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
    if (!tbody) {
      return;
    }
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

  initInvestChart();

  function syncLanguage() {
    applyMoney();
    applyChrome();
    if (table) {
      render();
    }
    applyInvestChartLanguage();
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
