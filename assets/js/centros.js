(function () {
  const payload = document.getElementById('centros-data');
  const mapEl = document.getElementById('centros-map');
  const table = document.getElementById('centros-table');
  if (!payload || !mapEl || !table || typeof L === 'undefined') {
    return;
  }

  const data = JSON.parse(payload.textContent);
  const centers = data.centers || [];
  const rows = Array.from(table.querySelectorAll('.centros-row'));
  const searchInput = document.getElementById('centros-search');
  const ufSelect = document.getElementById('centros-uf');
  const empty = document.getElementById('centros-empty');
  const cityBody = document.getElementById('centros-city-body');
  const cityTotal = document.getElementById('centros-city-total');
  const sortButtons = table.querySelectorAll('.centros-sort');
  const tbody = table.querySelector('tbody');

  const AREA_EN = {
    Agricultura: 'Agriculture',
    Agro: 'Agribusiness',
    Saúde: 'Health',
    Administração: 'Administration',
    Agronegócio: 'Agribusiness',
    'Ciência, Tecnologia e Inovação': 'Science, Technology and Innovation',
    Educação: 'Education',
    Governo: 'Government',
    'Meio Ambiente': 'Environment',
    Energia: 'Energy',
    Indústria: 'Industry',
    Segurança: 'Security',
    Cidades: 'Cities',
    TICs: 'ICTs',
    'Segurança alimentar': 'Food security',
    Sociedade: 'Society',
    'Ciência da Informação': 'Information Science',
    'Mobilidade e Transportes': 'Mobility and Transport',
    'Óleo e Gás': 'Oil and Gas',
    Telecomunicações: 'Telecommunications',
    Território: 'Territory',
    Bioeconomia: 'Bioeconomy',
    Ecologia: 'Ecology',
    'Saúde, Mobilidade e Transporte': 'Health, Mobility and Transport',
  };

  const COPY = {
    pt: {
      host: 'Sede',
      areas: 'Áreas',
      link: 'Site',
      cpa: 'Centro de Pesquisa Aplicada',
      inct: 'Instituto Nacional de Ciência e Tecnologia',
    },
    en: {
      host: 'Host',
      areas: 'Areas',
      link: 'Website',
      cpa: 'Applied Research Center',
      inct: 'National Institute of Science and Technology',
    },
  };

  let sortKey = 'name';
  let sortDir = 'asc';
  let map;
  const markersById = {};

  function pageLang() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'pt';
  }

  function selectedLayer() {
    const checked = document.querySelector('input[name="centros-layer"]:checked');
    return checked ? checked.value : 'cpa';
  }

  function formatAreas(areas, lang) {
    if (!areas || !areas.length) {
      return '—';
    }
    return areas
      .map((area) => (lang === 'en' ? AREA_EN[area] || area : area))
      .join('; ');
  }

  function centerVisible(center) {
    const layer = selectedLayer();
    if (layer !== 'both' && center.kind !== layer) {
      return false;
    }
    const uf = ufSelect ? ufSelect.value : '';
    if (uf && center.uf !== uf) {
      return false;
    }
    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    if (!q) {
      return true;
    }
    const hay = [center.name, center.host, center.city, center.uf, center.kind, (center.areas || []).join(' ')]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }

  function offsetPositions(list) {
    const groups = new Map();
    list.forEach((center) => {
      const key = `${center.lat.toFixed(4)}|${center.lng.toFixed(4)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(center);
    });
    const positioned = new Map();
    groups.forEach((group) => {
      if (group.length === 1) {
        positioned.set(group[0].id, [group[0].lat, group[0].lng]);
        return;
      }
      group.forEach((center, index) => {
        const angle = (2 * Math.PI * index) / group.length;
        const radius = 0.012;
        positioned.set(center.id, [
          center.lat + radius * Math.cos(angle),
          center.lng + radius * Math.sin(angle),
        ]);
      });
    });
    return positioned;
  }

  function popupHtml(center) {
    const lang = pageLang();
    const copy = COPY[lang];
    const areas = formatAreas(center.areas, lang);
    const host = center.host || '—';
    const kindLabel = copy[center.kind] || center.kind.toUpperCase();
    const link = center.url
      ? `<p class="centros-popup-link"><a href="${center.url}" target="_blank" rel="noopener noreferrer">${copy.link}</a></p>`
      : '';
    return `
      <div class="centros-popup">
        <p class="centros-popup-kind">${kindLabel}</p>
        <p class="centros-popup-name">${center.name}</p>
        <p><strong>${copy.host}:</strong> ${host}<br>${center.sede || `${center.city} · ${center.uf}`}</p>
        <p><strong>${copy.areas}:</strong> ${areas}</p>
        ${link}
      </div>
    `;
  }

  function markerIcon(kind) {
    const color = kind === 'inct' ? '#0f172a' : '#c45c26';
    return L.divIcon({
      className: 'centros-marker',
      html: `<span class="centros-marker-dot" style="background:${color}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }

  function initMap() {
    map = L.map(mapEl, {
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([-14.235, -51.9253], 4);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);

    mapEl.addEventListener('click', () => {
      map.scrollWheelZoom.enable();
    });
    map.on('mouseout', () => {
      map.scrollWheelZoom.disable();
    });

    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }

  function renderMarkers(visible) {
    Object.values(markersById).forEach((marker) => {
      map.removeLayer(marker);
    });
    Object.keys(markersById).forEach((key) => {
      delete markersById[key];
    });

    const positions = offsetPositions(visible);
    visible.forEach((center) => {
      const latlng = positions.get(center.id);
      const marker = L.marker(latlng, { icon: markerIcon(center.kind), title: center.name });
      marker.bindPopup(popupHtml(center), { maxWidth: 280 });
      marker.addTo(map);
      markersById[center.id] = marker;
    });
  }

  function renderCities(visible) {
    const counts = new Map();
    visible.forEach((center) => {
      const key = `${center.city} · ${center.uf}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const rowsHtml = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(
        ([city, count]) =>
          `<tr class="border-b border-gray-100"><td class="py-2 pr-3 text-navy">${city}</td><td class="py-2 pl-3 text-right tabular-nums text-gray-700">${count}</td></tr>`
      )
      .join('');
    cityBody.innerHTML = rowsHtml;
    cityTotal.textContent = String(visible.length);
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
    document.querySelectorAll('.centros-areas').forEach((el) => {
      const areas = el.dataset.areas ? el.dataset.areas.split('|').filter(Boolean) : [];
      el.textContent = formatAreas(areas, lang);
    });
    Object.keys(markersById).forEach((id) => {
      const center = centers.find((item) => item.id === id);
      if (center) {
        markersById[id].setPopupContent(popupHtml(center));
      }
    });
  }

  function rowVisible(row) {
    const center = centers.find((item) => item.id === row.dataset.id);
    return center ? centerVisible(center) : false;
  }

  function compareRows(a, b) {
    const av = (a.dataset[sortKey] || '').toLocaleLowerCase('pt-BR');
    const bv = (b.dataset[sortKey] || '').toLocaleLowerCase('pt-BR');
    if (av < bv) {
      return sortDir === 'asc' ? -1 : 1;
    }
    if (av > bv) {
      return sortDir === 'asc' ? 1 : -1;
    }
    return (a.dataset.name || '').localeCompare(b.dataset.name || '', 'pt-BR');
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
    const visible = centers.filter(centerVisible);
    renderMarkers(visible);
    renderCities(visible);

    const shown = [];
    const hidden = [];
    rows.forEach((row) => {
      if (rowVisible(row)) {
        shown.push(row);
        row.hidden = false;
      } else {
        hidden.push(row);
        row.hidden = true;
      }
    });
    shown.sort(compareRows);
    shown.concat(hidden).forEach((row) => tbody.appendChild(row));
    if (empty) {
      empty.classList.toggle('hidden', shown.length !== 0);
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
        sortDir = 'asc';
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
  document.querySelectorAll('input[name="centros-layer"]').forEach((input) => {
    input.addEventListener('change', render);
  });

  rows.forEach((row) => {
    row.addEventListener('click', () => {
      const marker = markersById[row.dataset.id];
      if (!marker) {
        return;
      }
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 8));
      marker.openPopup();
    });
  });

  document.addEventListener('site-language-change', () => {
    applyChrome();
  });

  initMap();
  applyChrome();
  render();
})();
