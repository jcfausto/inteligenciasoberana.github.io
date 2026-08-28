let currentLang = 'pt';
let adoptionChart;
let usersChart;
let macroChart;
let microChart;

const ADOPTION_GENAI_YEARS = 33 / 12;
const CHATGPT_YEARS = 2 / 12;

const chartCopy = {
  pt: {
    macroSubtitle: 'NÍVEL MACRO: Emendas políticas superam universidades em 7,7×',
    microSubtitle: 'NÍVEL MICRO: Apenas 7 shows pop superam laboratórios federais em 3,0×',
    adoptionSubtitle: 'PENETRAÇÃO: Anos até o marco de adoção citado',
    usersSubtitle: 'ESCALA: Tempo até 100 milhões de usuários',
    macroAxis: 'Valor (R$ bilhões)',
    microAxis: 'Valor (R$ milhões)',
    adoptionAxis: 'Anos até o marco citado',
    usersAxis: 'Anos até 100 milhões de usuários',
    macroLabels: [
      ['Emendas Parlamentares', '(Financiamento Político)'],
      ['69 Universidades Federais', '(Custeio Discricionário)'],
      ['Equipamentos de Laboratório', '(Investimentos de Capital)'],
    ],
    microLabels: [
      ['7 Shows Pop de Fim de Semana', '(Nossa Pequena Amostra)'],
      ['1 Bolsa de Modernização', 'de Laboratório Federal'],
      ['1 Ano de Bolsa Especial', 'de Cientista Repatriado'],
    ],
    adoptionLabels: [
      ['Eletricidade', '(70% da população)'],
      ['Computador pessoal', '(70% dos lares)'],
      ['Internet', '(40% dos adultos)'],
      ['Smartphone', '(40% dos adultos)'],
      ['IA generativa', '(54,6% dos adultos)'],
    ],
    usersLabels: [
      'Telefones móveis',
      'Instagram',
      'ChatGPT',
    ],
    macroAria: 'Gráfico de nível macro: emendas parlamentares versus universidades e laboratórios',
    microAria: 'Gráfico de nível micro: shows pop versus bolsas de laboratório e ciência',
    adoptionAria: 'Gráfico de barras: anos até o marco de adoção da eletricidade, do computador pessoal, da internet, do smartphone e da IA generativa',
    usersAria: 'Gráfico de barras: tempo até 100 milhões de usuários para telefones móveis, Instagram e ChatGPT',
  },
  en: {
    macroSubtitle: 'MACRO LEVEL: Political Emendas Outpace Universities by 7.7×',
    microSubtitle: 'MICRO LEVEL: Just 7 Pop Shows Outvalue Federal Labs by 3.0×',
    adoptionSubtitle: 'PENETRATION: Years to the cited adoption milestone',
    usersSubtitle: 'SCALE: Time to 100 million users',
    macroAxis: 'Amount (R$ Billions BRL)',
    microAxis: 'Amount (R$ Millions BRL)',
    adoptionAxis: 'Years to the cited milestone',
    usersAxis: 'Years to 100 million users',
    macroLabels: [
      ['Parliamentary Emendas', '(Political Funding)'],
      ['69 Federal Universities', '(Discretionary Custeio)'],
      ['Federal Lab Equipment', '(Capital Investments)'],
    ],
    microLabels: [
      ['7 Weekend Pop Concerts', '(Our Tiny Sample)'],
      ['1 Federal Univ. Lab', 'Modernization Grant'],
      ['1 Year of Repatriated', 'Elite Sci. Fellowship'],
    ],
    adoptionLabels: [
      ['Electricity', '(70% of population)'],
      ['Personal computer', '(70% of households)'],
      ['Internet', '(40% of adults)'],
      ['Smartphone', '(40% of adults)'],
      ['Generative AI', '(54.6% of adults)'],
    ],
    usersLabels: [
      'Mobile phones',
      'Instagram',
      'ChatGPT',
    ],
    macroAria: 'Macro-level chart: parliamentary amendments versus universities and laboratories',
    microAria: 'Micro-level chart: pop concerts versus lab and science fellowships',
    adoptionAria: 'Bar chart: years to the cited adoption milestone for electricity, the personal computer, the internet, the smartphone, and generative AI',
    usersAria: 'Bar chart: time to 100 million users for mobile phones, Instagram, and ChatGPT',
  },
};

function formatPtNumber(value, digits) {
  return value.toFixed(digits).replace('.', ',');
}

function formatMacroValue(value, lang) {
  const compact = window.innerWidth < 640;
  if (value >= 1) {
    const digits = compact && value % 1 === 0 ? 0 : 2;
    return lang === 'pt'
      ? `R$ ${formatPtNumber(value, digits)} bi`
      : `R$ ${value.toFixed(digits)}B`;
  }
  const millions = value * 1000;
  return lang === 'pt' ? `R$ ${formatPtNumber(millions, 1)} mi` : `R$ ${millions.toFixed(1)}M`;
}

function formatMicroValue(value, lang) {
  if (value >= 1) {
    return lang === 'pt' ? `R$ ${formatPtNumber(value, 2)} mi` : `R$ ${value.toFixed(2)}M`;
  }
  const thousands = Math.round(value * 1000);
  return lang === 'pt' ? `R$ ${thousands} mil` : `R$ ${thousands}K`;
}

function formatAdoptionYears(value, lang) {
  if (Math.abs(value - ADOPTION_GENAI_YEARS) < 0.001) {
    return lang === 'pt' ? '2,8 anos' : '2.8 years';
  }
  return lang === 'pt' ? `${value} anos` : `${value} years`;
}

function formatUsersYears(value, lang) {
  if (value < 1) {
    const months = Math.round(value * 12);
    return lang === 'pt' ? `${months} meses` : `${months} months`;
  }
  if (value % 1 !== 0) {
    return lang === 'pt' ? `${formatPtNumber(value, 1)} anos` : `${value} years`;
  }
  return lang === 'pt' ? `${value} anos` : `${value} years`;
}

function baseBarOptions(xMax, xStep, formatValue) {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0].label.replace(/,/g, ' '),
          label: (item) => formatValue(item.raw, currentLang),
        },
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 6,
        clamp: false,
        clip: false,
        color: '#0f172a',
        font: { weight: '700', size: 11, family: 'Inter, system-ui, sans-serif' },
        formatter: (value) => formatValue(value, currentLang),
      },
    },
    scales: {
      x: {
        min: 0,
        max: xMax,
        ticks: {
          stepSize: xStep,
          color: '#9ca3af',
          font: { size: 11, family: 'Inter, system-ui, sans-serif' },
        },
        grid: { color: '#e5e7eb' },
        border: { display: false },
        title: {
          display: true,
          color: '#6b7280',
          font: { size: 11, family: 'Inter, system-ui, sans-serif' },
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#334155',
          font: { size: 11, family: 'Inter, system-ui, sans-serif' },
        },
        afterFit(scale) {
          if (scale.chart.width < 500) {
            const id = scale.chart.canvas && scale.chart.canvas.id;
            const cap = id === 'adoptionChart' || id === 'usersChart' ? 148 : 128;
            scale.width = Math.min(scale.width, cap);
          }
        },
      },
    },
    layout: {
      padding: { right: 80, left: 4 },
    },
    onResize(chart) {
      const narrow = chart.width < 500;
      const nextPad = narrow ? 72 : 80;
      if (chart.options.layout.padding.right !== nextPad) {
        chart.options.layout.padding.right = nextPad;
      }
    },
  };
}

function createHorizontalChart(canvasId, labels, data, colors, xMax, xStep, formatValue) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') {
    return null;
  }
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        borderRadius: 4,
        barThickness: 26,
        maxBarThickness: 32,
      }],
    },
    options: baseBarOptions(xMax, xStep, formatValue),
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
  });
}

function applyChartLanguage(lang) {
  const copy = chartCopy[lang];
  if (!copy) {
    return;
  }

  const adoptionCanvas = document.getElementById('adoptionChart');
  const usersCanvas = document.getElementById('usersChart');
  const adoptionSubtitle = document.getElementById('adoptionSubtitle');
  const usersSubtitle = document.getElementById('usersSubtitle');
  const macroSubtitle = document.getElementById('macroSubtitle');
  const microSubtitle = document.getElementById('microSubtitle');
  const macroCanvas = document.getElementById('macroChart');
  const microCanvas = document.getElementById('microChart');

  if (adoptionCanvas) adoptionCanvas.setAttribute('aria-label', copy.adoptionAria);
  if (usersCanvas) usersCanvas.setAttribute('aria-label', copy.usersAria);
  if (adoptionSubtitle) adoptionSubtitle.textContent = copy.adoptionSubtitle;
  if (usersSubtitle) usersSubtitle.textContent = copy.usersSubtitle;
  if (macroSubtitle) macroSubtitle.textContent = copy.macroSubtitle;
  if (microSubtitle) microSubtitle.textContent = copy.microSubtitle;
  if (macroCanvas) macroCanvas.setAttribute('aria-label', copy.macroAria);
  if (microCanvas) microCanvas.setAttribute('aria-label', copy.microAria);

  if (adoptionChart) {
    adoptionChart.data.labels = copy.adoptionLabels;
    adoptionChart.options.scales.x.title.text = copy.adoptionAxis;
    adoptionChart.update('none');
  }
  if (usersChart) {
    usersChart.data.labels = copy.usersLabels;
    usersChart.options.scales.x.title.text = copy.usersAxis;
    usersChart.update('none');
  }

  if (!macroChart || !microChart) {
    return;
  }

  macroChart.data.labels = copy.macroLabels;
  macroChart.options.scales.x.title.text = copy.macroAxis;
  microChart.data.labels = copy.microLabels;
  microChart.options.scales.x.title.text = copy.microAxis;
  macroChart.update('none');
  microChart.update('none');
}

function initCharts() {
  const copy = chartCopy[currentLang];
  if (!copy) {
    return;
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  }

  adoptionChart = createHorizontalChart(
    'adoptionChart',
    copy.adoptionLabels,
    [40, 22, 4, 6, ADOPTION_GENAI_YEARS],
    ['#1e3a8a', '#3b6ba5', '#c4a35a', '#d4896a', '#c45c26'],
    52,
    10,
    formatAdoptionYears
  );
  usersChart = createHorizontalChart(
    'usersChart',
    copy.usersLabels,
    [16, 2.5, CHATGPT_YEARS],
    ['#3b6ba5', '#c4a35a', '#c45c26'],
    20,
    4,
    formatUsersYears
  );

  if (document.getElementById('macroChart')) {
    macroChart = createHorizontalChart(
      'macroChart',
      copy.macroLabels,
      [61, 7.85, 0.3359],
      ['#1e3a8a', '#c4a35a', '#86c4a8'],
      70,
      10,
      formatMacroValue
    );
    microChart = createHorizontalChart(
      'microChart',
      copy.microLabels,
      [6.57, 2.17, 0.156],
      ['#6b8fc9', '#d4896a', '#6aa36a'],
      8,
      1,
      formatMicroValue
    );
  }

  applyChartLanguage(currentLang);
}

function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'pt';
  document.documentElement.dataset.lang = currentLang;
  document.documentElement.lang = currentLang === 'pt' ? 'pt-BR' : 'en';
  localStorage.setItem('lang', currentLang);

  document.querySelectorAll('.lang-switch').forEach((btn) => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle('bg-navy', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-gray-500', !active);
    btn.setAttribute('aria-pressed', String(active));
  });

  applyChartLanguage(currentLang);
  document.dispatchEvent(new CustomEvent('site-language-change', { detail: { lang: currentLang } }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const savedLang = params.get('lang') || localStorage.getItem('lang');
  setLanguage(savedLang === 'en' ? 'en' : 'pt');
  initCharts();
}
