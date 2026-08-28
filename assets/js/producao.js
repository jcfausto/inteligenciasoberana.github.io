(function () {
  const root = document.querySelector("article[data-works-base]");
  if (!root) {
    return;
  }

  const PAGE_SIZE = 50;
  const yearFrom = Number(root.dataset.yearFrom);
  const worksBase = root.dataset.worksBase || "/assets/data/producao-ia/";
  const yearsJson = document.getElementById("producao-years");
  const yearRows = yearsJson ? JSON.parse(yearsJson.textContent) : [];

  const instTable = document.getElementById("prod-inst-table");
  const instBody = instTable ? instTable.querySelector("tbody") : null;
  const instRows = instBody ? Array.from(instBody.querySelectorAll(".prod-inst-row")) : [];
  const instSearch = document.getElementById("prod-inst-search");
  const instYearSelect = document.getElementById("prod-inst-year");
  const instUfSelect = document.getElementById("prod-inst-uf");
  const instEmpty = document.getElementById("prod-inst-empty");
  const instSortButtons = instTable ? instTable.querySelectorAll(".uni-sort") : [];

  const paperBody = document.getElementById("prod-paper-body");
  const paperSearch = document.getElementById("prod-paper-search");
  const paperYearSelect = document.getElementById("prod-paper-year");
  const paperInstSelect = document.getElementById("prod-paper-inst");
  const paperStatus = document.getElementById("prod-paper-status");
  const paperPrev = document.getElementById("prod-paper-prev");
  const paperNext = document.getElementById("prod-paper-next");

  let instSortKey = "total";
  let instSortDir = "desc";
  let instSortType = "num";

  const paperCache = {};
  let paperYear = paperYearSelect ? paperYearSelect.value : "";
  let paperPage = 0;
  let paperFiltered = [];
  let yearChart = null;

  function pageLang() {
    return document.documentElement.dataset.lang === "en" ? "en" : "pt";
  }

  function formatInt(value, lang) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return "";
    }
    return n.toLocaleString(lang === "en" ? "en-US" : "pt-BR");
  }

  function yearIndex(year) {
    if (!year) {
      return -1;
    }
    return Number(year) - yearFrom;
  }

  function rowCounts(row) {
    try {
      const parsed = JSON.parse(row.dataset.counts || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function rowYearCount(row, year) {
    if (!year) {
      return Number(row.dataset.total) || 0;
    }
    const idx = yearIndex(year);
    const counts = rowCounts(row);
    return Number(counts[idx]) || 0;
  }

  function applyInts() {
    const lang = pageLang();
    document.querySelectorAll("[data-int]").forEach((el) => {
      el.textContent = formatInt(el.dataset.int, lang);
    });
    instRows.forEach((row) => {
      const totalCell = row.querySelector(".prod-total-cell");
      if (totalCell) {
        totalCell.textContent = formatInt(row.dataset.total, lang);
      }
    });
  }

  function applyChrome() {
    const lang = pageLang();
    [instSearch, paperSearch].forEach((input) => {
      if (!input) {
        return;
      }
      input.placeholder = lang === "en" ? input.dataset.placeholderEn : input.dataset.placeholderPt;
    });
    [instYearSelect, instUfSelect, paperInstSelect].forEach((select) => {
      if (!select) {
        return;
      }
      const allOpt = select.querySelector('option[value=""]');
      if (allOpt && allOpt.dataset.labelEn) {
        allOpt.textContent = lang === "en" ? allOpt.dataset.labelEn : allOpt.dataset.labelPt;
      }
    });
  }

  function instRowVisible(row) {
    const year = instYearSelect ? instYearSelect.value : "";
    const yearCount = rowYearCount(row, year);
    row.dataset.year = String(yearCount);
    if (year && yearCount === 0) {
      return false;
    }
    const uf = instUfSelect ? instUfSelect.value : "";
    if (uf && row.dataset.uf !== uf) {
      return false;
    }
    const q = (instSearch ? instSearch.value : "").trim().toLowerCase();
    if (!q) {
      return true;
    }
    const hay = [row.dataset.short, row.dataset.name, row.dataset.city, row.dataset.uf]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  function compareInstRows(a, b) {
    let av;
    let bv;
    if (instSortType === "num") {
      av = Number(a.dataset[instSortKey]) || 0;
      bv = Number(b.dataset[instSortKey]) || 0;
    } else if (instSortKey === "name") {
      av = (a.dataset.short || "").toLocaleLowerCase("pt-BR");
      bv = (b.dataset.short || "").toLocaleLowerCase("pt-BR");
    } else {
      av = (a.dataset[instSortKey] || "").toLocaleLowerCase("pt-BR");
      bv = (b.dataset[instSortKey] || "").toLocaleLowerCase("pt-BR");
    }
    if (av < bv) {
      return instSortDir === "asc" ? -1 : 1;
    }
    if (av > bv) {
      return instSortDir === "asc" ? 1 : -1;
    }
    return (a.dataset.short || "").localeCompare(b.dataset.short || "", "pt-BR");
  }

  function applyInstSortIndicators() {
    instSortButtons.forEach((btn) => {
      const th = btn.closest("th");
      const active = btn.dataset.sort === instSortKey;
      btn.setAttribute("aria-pressed", String(active));
      if (th) {
        if (active) {
          th.setAttribute("aria-sort", instSortDir === "asc" ? "ascending" : "descending");
        } else {
          th.removeAttribute("aria-sort");
        }
      }
    });
  }

  function renderInstitutions() {
    if (!instBody) {
      return;
    }
    const lang = pageLang();
    const year = instYearSelect ? instYearSelect.value : "";
    const visible = [];
    const hidden = [];
    instRows.forEach((row) => {
      const count = rowYearCount(row, year);
      const yearCell = row.querySelector(".prod-year-cell");
      if (yearCell) {
        yearCell.textContent = formatInt(count, lang);
      }
      if (instRowVisible(row)) {
        visible.push(row);
        row.hidden = false;
      } else {
        hidden.push(row);
        row.hidden = true;
      }
    });
    visible.sort(compareInstRows);
    visible.concat(hidden).forEach((row) => instBody.appendChild(row));
    if (instEmpty) {
      instEmpty.classList.toggle("hidden", visible.length !== 0);
    }
    applyInstSortIndicators();
  }

  function paperUrl(paper) {
    if (paper.doi) {
      return "https://doi.org/" + paper.doi;
    }
    if (paper.id) {
      return "https://openalex.org/" + paper.id;
    }
    return "";
  }

  function setPaperStatus(text) {
    if (paperStatus) {
      paperStatus.textContent = text;
    }
  }

  function renderPapers() {
    if (!paperBody) {
      return;
    }
    const lang = pageLang();
    const total = paperFiltered.length;
    const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    if (paperPage > maxPage) {
      paperPage = maxPage;
    }
    const start = total === 0 ? 0 : paperPage * PAGE_SIZE;
    const slice = paperFiltered.slice(start, start + PAGE_SIZE);
    paperBody.replaceChildren();
    slice.forEach((paper) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-100 hover:bg-[#faf9f6] transition-colors";
      const titleTd = document.createElement("th");
      titleTd.scope = "row";
      titleTd.className = "py-3 px-4 font-medium text-navy";
      const href = paperUrl(paper);
      if (href) {
        const a = document.createElement("a");
        a.href = href;
        a.className = "hover:text-terracotta transition-colors";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = paper.title || "(untitled)";
        titleTd.appendChild(a);
      } else {
        titleTd.textContent = paper.title || "(untitled)";
      }
      if (paper.topic) {
        const topic = document.createElement("span");
        topic.className = "block text-xs font-normal text-gray-500 mt-0.5";
        topic.textContent = paper.topic;
        titleTd.appendChild(topic);
      }
      const yearTd = document.createElement("td");
      yearTd.className = "py-3 px-3 text-gray-600 whitespace-nowrap";
      yearTd.textContent = String(paper.year || "");
      const instTd = document.createElement("td");
      instTd.className = "py-3 px-3 text-gray-600 text-xs leading-relaxed";
      instTd.textContent = (paper.inst || []).join(", ") || "—";
      const citedTd = document.createElement("td");
      citedTd.className = "py-3 px-4 text-right tabular-nums text-gray-700";
      citedTd.textContent = formatInt(paper.cited || 0, lang);
      tr.append(titleTd, yearTd, instTd, citedTd);
      paperBody.appendChild(tr);
    });

    if (total === 0) {
      setPaperStatus(
        lang === "en" ? "No works match this search." : "Nenhum trabalho corresponde à busca."
      );
    } else {
      const from = start + 1;
      const to = start + slice.length;
      setPaperStatus(
        lang === "en"
          ? `${formatInt(from, lang)}–${formatInt(to, lang)} of ${formatInt(total, lang)}`
          : `${formatInt(from, lang)}–${formatInt(to, lang)} de ${formatInt(total, lang)}`
      );
    }
    if (paperPrev) {
      paperPrev.disabled = paperPage <= 0 || total === 0;
    }
    if (paperNext) {
      paperNext.disabled = paperPage >= maxPage || total === 0;
    }
  }

  function filterPapers(papers) {
    const inst = paperInstSelect ? paperInstSelect.value : "";
    const q = (paperSearch ? paperSearch.value : "").trim().toLowerCase();
    return papers.filter((paper) => {
      if (inst && !(paper.inst || []).includes(inst)) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = [paper.title, paper.topic, (paper.inst || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function fillPaperInstOptions(papers) {
    if (!paperInstSelect) {
      return;
    }
    const previous = paperInstSelect.value;
    const uniques = Array.from(
      new Set(papers.flatMap((paper) => paper.inst || []).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const allOpt = paperInstSelect.querySelector('option[value=""]');
    paperInstSelect.replaceChildren();
    if (allOpt) {
      paperInstSelect.appendChild(allOpt);
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.dataset.labelPt = "Todas";
      opt.dataset.labelEn = "All";
      opt.textContent = pageLang() === "en" ? "All" : "Todas";
      paperInstSelect.appendChild(opt);
    }
    uniques.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      paperInstSelect.appendChild(opt);
    });
    if (previous && uniques.includes(previous)) {
      paperInstSelect.value = previous;
    } else {
      paperInstSelect.value = "";
    }
    applyChrome();
  }

  function applyPaperFilters() {
    const papers = paperCache[paperYear];
    if (!papers) {
      return;
    }
    paperFiltered = filterPapers(papers);
    paperPage = 0;
    renderPapers();
  }

  async function loadPaperYear(year) {
    paperYear = String(year);
    if (paperCache[paperYear]) {
      fillPaperInstOptions(paperCache[paperYear]);
      applyPaperFilters();
      return;
    }
    const lang = pageLang();
    setPaperStatus(lang === "en" ? "Loading…" : "Carregando…");
    if (paperBody) {
      paperBody.replaceChildren();
    }
    const url = worksBase.replace(/\/?$/, "/") + paperYear + ".json";
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error("missing");
      }
      paperCache[paperYear] = await resp.json();
      fillPaperInstOptions(paperCache[paperYear]);
      applyPaperFilters();
    } catch (err) {
      paperCache[paperYear] = [];
      fillPaperInstOptions([]);
      paperFiltered = [];
      paperPage = 0;
      renderPapers();
      setPaperStatus(
        lang === "en"
          ? "No snapshot file for this year."
          : "Não há arquivo de snapshot para este ano."
      );
    }
  }

  function initChart() {
    const canvas = document.getElementById("producaoYearChart");
    if (!canvas || typeof Chart === "undefined" || yearRows.length === 0) {
      return;
    }
    const labels = yearRows.map((row) => String(row.year));
    const values = yearRows.map((row) => Number(row.works) || 0);
    const max = Math.max(...values, 1);
    yearChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: "#c45c26",
            borderWidth: 0,
            borderRadius: 4,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(item) {
                const lang = pageLang();
                const n = formatInt(item.raw, lang);
                return lang === "en" ? `${n} works` : `${n} trabalhos`;
              },
            },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#6b7280",
              font: { size: 11, family: "Inter, system-ui, sans-serif" },
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: Math.ceil(max * 1.08),
            ticks: {
              color: "#9ca3af",
              font: { size: 11, family: "Inter, system-ui, sans-serif" },
              callback(value) {
                return formatInt(value, pageLang());
              },
            },
            grid: { color: "#f3f4f6" },
            border: { display: false },
          },
        },
      },
    });
  }

  instSortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      if (instSortKey === key) {
        instSortDir = instSortDir === "asc" ? "desc" : "asc";
      } else {
        instSortKey = key;
        instSortType = btn.dataset.type === "num" ? "num" : "text";
        instSortDir = instSortType === "num" ? "desc" : "asc";
      }
      renderInstitutions();
    });
  });

  if (instSearch) {
    instSearch.addEventListener("input", renderInstitutions);
  }
  if (instYearSelect) {
    instYearSelect.addEventListener("change", renderInstitutions);
  }
  if (instUfSelect) {
    instUfSelect.addEventListener("change", renderInstitutions);
  }
  if (paperSearch) {
    paperSearch.addEventListener("input", applyPaperFilters);
  }
  if (paperInstSelect) {
    paperInstSelect.addEventListener("change", applyPaperFilters);
  }
  if (paperYearSelect) {
    paperYearSelect.addEventListener("change", () => {
      loadPaperYear(paperYearSelect.value);
    });
  }
  if (paperPrev) {
    paperPrev.addEventListener("click", () => {
      if (paperPage > 0) {
        paperPage -= 1;
        renderPapers();
      }
    });
  }
  if (paperNext) {
    paperNext.addEventListener("click", () => {
      paperPage += 1;
      renderPapers();
    });
  }

  function syncLanguage() {
    applyInts();
    applyChrome();
    renderInstitutions();
    if (paperCache[paperYear]) {
      renderPapers();
    }
    if (yearChart) {
      yearChart.update("none");
    }
  }

  document.addEventListener("site-language-change", syncLanguage);

  applyInts();
  applyChrome();
  renderInstitutions();
  initChart();
  if (paperYearSelect) {
    loadPaperYear(paperYearSelect.value);
  }
})();
