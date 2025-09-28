// compare.js
// Self-contained: loads Excel files, computes monthly averages, aligns series, and hooks up UI controls in compare.html

(function () {
  // Register zoom plugin (safe to call multiple times)
  try { Chart.register(window.ChartZoom); } catch (e) { /* plugin or Chart not present yet */ }

  // --- CONFIG: file paths used in your project ---
  const PATHS = {
    tbills: 'data/Treasury Bills Average Rates.xlsx',
    tbonds: 'data/Issues of Treasury Bonds.xlsx',
    cbr: 'data/Central Bank Rate (CBR).xlsx',
    repo: 'data/Repo and Reverse Repo.xlsx',
    interbank: 'data/Interbank Rates.xlsx',
    kesonia: 'data/KESONIA.xlsx',
    cbwar: 'data/Commercial Banks Weighted Average Rates.xlsx',
    inflation: 'data/Inflation Rates.xlsx'
  };

  // Color palette (reused / deterministic)
  const COLORS = [
    '#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#af7aa1','#ff9da7',
    '#9c755f','#bab0ac','#7bdff2','#c2b6ff'
  ];

  // Small date utilities
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toMonthKey(d){ return `${pad2(d.getMonth()+1)}/${d.getFullYear()}`; } // MM/YYYY
  function monthKeyToDate(mmYy){
    const [mm, yy] = mmYy.split('/').map(Number);
    return new Date(yy, mm - 1, 1);
  }

  // Flexible date parser (handles dd/mm/yyyy strings and Excel serial numbers and Date objects)
  function parseDateFlexible(v) {
    if (!v && v !== 0) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'number') {
      // treat as Excel serial (1900 system)
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const days = Math.floor(v);
      const ms = Math.round((v - days) * 24 * 3600 * 1000);
      return new Date(excelEpoch.getTime() + days * 24 * 3600 * 1000 + ms);
    }
    if (typeof v === 'string') {
      const s = v.trim();
      // dd/mm/yyyy
      if (s.includes('/') && s.split('/').length === 3) {
        const [d, m, y] = s.split('/').map(x => parseInt(x, 10));
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
      }
      // fallback: Date parse (ISO)
      const dt = new Date(s);
      if (!isNaN(dt)) return dt;
    }
    return null;
  }

  // Extract numeric from row given candidate column names (defensive)
  function getNumeric(row, candidates = []) {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== null && row[c] !== '') {
        const raw = row[c];
        if (typeof raw === 'number') return raw;
        const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
        if (cleaned === '' || cleaned === '-' || cleaned === '.') continue;
        const n = parseFloat(cleaned);
        if (!isNaN(n)) return n;
      }
    }
    // fallback: scan all cells for first numeric
    for (const k in row) {
      if (!row.hasOwnProperty(k)) continue;
      const raw = row[k];
      if (typeof raw === 'number') return raw;
      const cleaned = String(raw || '').replace(/[^0-9.\-]/g, '');
      const n = parseFloat(cleaned);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  // Read a workbook sheet (first sheet) and return json rows (defval used)
  async function readSheet(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab = await res.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const s = wb.SheetNames[0];
      return XLSX.utils.sheet_to_json(wb.Sheets[s], { defval: null });
    } catch (err) {
      console.warn(`Could not load ${path}: ${err.message}`);
      return [];
    }
  }

  // ===== Processors: each returns Map(seriesLabel => Map(monthKey => value)) =====

  // T-Bills: expect columns 'Issue Date'/'Date', 'Tenor' (days), 'Weighted Average Rate'
  function processTBills(rows) {
    const buckets = {}; // tenor -> Map(mm/yyyy => [vals])
    rows.forEach(r => {
      const dt = parseDateFlexible(r['Issue Date'] || r['Date']);
      const tenor = r['Tenor'] !== undefined ? Number(r['Tenor']) : null;
      const val = getNumeric(r, ['Weighted Average Rate', 'WeightedAverageRate','Weighted Avg Rate']);
      if (!dt || isNaN(tenor) || val === null) return;
      const mk = toMonthKey(dt);
      if (!buckets[tenor]) buckets[tenor] = new Map();
      if (!buckets[tenor].has(mk)) buckets[tenor].set(mk, []);
      buckets[tenor].get(mk).push(val);
    });
    const out = new Map();
    Object.keys(buckets).forEach(t => {
      const mmMap = new Map();
      for (const [k, arr] of buckets[t].entries()) mmMap.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
      // label like "91 Day Bill" so later we can map checkboxes -> 3-month (91)
      out.set(`${t} Day Bill`, mmMap);
    });
    return out;
  }

  // T-Bonds: filter Issue No starting with FXD (when present), Tenor in years, 'Coupon Rate'
  function processTBonds(rows) {
    const filtered = rows.filter(r => {
      const inum = r['Issue No'] || r['IssueNo'] || r['Issue_No'];
      if (inum === null || inum === undefined) return true;
      try { return String(inum).startsWith('FXD'); } catch(e) { return true; }
    });
    const buckets = {}; // tenorYears -> Map(mm/yyyy => [vals])
    filtered.forEach(r => {
      const dt = parseDateFlexible(r['Issue Date'] || r['Date']);
      const tenor = r['Tenor'] !== undefined ? Number(r['Tenor']) : null;
      const val = getNumeric(r, ['Coupon Rate','CouponRate','Coupon']);
      if (!dt || isNaN(tenor) || val === null) return;
      const mk = toMonthKey(dt);
      if (!buckets[tenor]) buckets[tenor] = new Map();
      if (!buckets[tenor].has(mk)) buckets[tenor].set(mk, []);
      buckets[tenor].get(mk).push(val);
    });
    const out = new Map();
    Object.keys(buckets).forEach(t => {
      const mmMap = new Map();
      for (const [k, arr] of buckets[t].entries()) mmMap.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set(`${t} Year Bond`, mmMap);
    });
    return out;
  }

  // CBR: 'Date' and 'Rate'
  function processCBR(rows) {
    const m = new Map();
    rows.forEach(r => {
      const dt = parseDateFlexible(r['Date']);
      const val = getNumeric(r, ['Rate','CBR','Value']);
      if (!dt || val === null) return;
      const mk = toMonthKey(dt);
      if (!m.has(mk)) m.set(mk, []);
      m.get(mk).push(val);
    });
    const mm = new Map();
    for (const [k, arr] of m.entries()) mm.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
    return new Map([['Central Bank Rate', mm]]);
  }

  // Repo & Reverse Repo: daily -> monthly average
  function processRepo(rows) {
    const repo = new Map(), rev = new Map();
    rows.forEach(r => {
      const dt = parseDateFlexible(r['Date'] || r['DATE']);
      const rv = getNumeric(r, ['Repo']);
      const rrv = getNumeric(r, ['Reverse Repo','ReverseRepo']);
      if (!dt) return;
      const mk = toMonthKey(dt);
      if (rv !== null) { if (!repo.has(mk)) repo.set(mk, []); repo.get(mk).push(rv); }
      if (rrv !== null) { if (!rev.has(mk)) rev.set(mk, []); rev.get(mk).push(rrv); }
    });
    const out = new Map();
    if (repo.size > 0) {
      const rAvg = new Map(); for (const [k, arr] of repo.entries()) rAvg.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set('Repo Rate', rAvg);
    }
    if (rev.size > 0) {
      const rrAvg = new Map(); for (const [k, arr] of rev.entries()) rrAvg.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set('Reverse Repo Rate', rrAvg);
    }
    return out;
  }

  // Interbank + KESONIA combined monthly average
  function processKesonia(interbankRows, kesoniaRows) {
    const all = [...(interbankRows || []), ...(kesoniaRows || [])];
    const m = new Map();
    all.forEach(r => {
      const dt = parseDateFlexible(r['Date'] || r['DATE']);
      const val = getNumeric(r, ['Rate','KESONIA','Overnight']);
      if (!dt || val === null) return;
      const mk = toMonthKey(dt);
      if (!m.has(mk)) m.set(mk, []);
      m.get(mk).push(val);
    });
    const mm = new Map();
for (const [k, arr] of m.entries()) {
  if (arr.length > 0) {
    mm.set(k, arr.reduce((a, b) => a + b, 0) / arr.length);
  } else {
    mm.set(k, null); // explicitly mark missing month
  }
}
return new Map([['KESONIA', mm]]);

  }

  // CBWAR: rows with Month (name), Year, and Deposit/Savings/Lending/Overdraft
  const monthNameMap = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12
  };
  function processCBWAR(rows) {
    const props = ['Deposit','Savings','Lending','Overdraft'];
    const maps = {}; props.forEach(p => maps[p] = new Map());
    rows.forEach(r => {
      const rawMonth = r['Month'] || r['MONTH'] || r['month'];
      const year = Number(r['Year'] || r['YEAR'] || r['year']);
      if (!rawMonth || !year) return;
      let monthNum = null;
      if (typeof rawMonth === 'string') {
        const cm = rawMonth.trim().toLowerCase();
        monthNum = monthNameMap[cm] || parseInt(cm,10) || null;
      } else {
        monthNum = Number(rawMonth);
      }
      if (!monthNum) return;
      const mk = `${pad2(monthNum)}/${year}`;
      props.forEach(p => {
        const v = getNumeric(r, [p]);
        if (v !== null) maps[p].set(mk, v);
      });
    });
    const out = new Map();
    props.forEach(p => { if (maps[p].size > 0) out.set(p, maps[p]); });
    return out;
  }

  // Inflation: handle both '12-Month Inflation' (CPI YoY) and 'Annual Average Inflation' if present
  function processInflation(rows) {
    const mm12 = new Map();
    const mmAnnual = new Map();
    rows.forEach(r => {
      const year = Number(r['Year'] || r['YEAR'] || r['year']);
      const rawMonth = r['Month'] || r['MONTH'] || r['month'];
      if (!year || !rawMonth) return;
      let monthNum = null;
      if (typeof rawMonth === 'string') {
        const cm = rawMonth.trim().toLowerCase();
        monthNum = monthNameMap[cm] || parseInt(cm,10) || null;
      } else {
        monthNum = Number(rawMonth);
      }
      if (!monthNum) return;
      const mk = `${pad2(monthNum)}/${year}`;
      const v12 = getNumeric(r, ['12-Month Inflation','12-Month','12 Month Inflation','Monthly Inflation']);
      if (v12 !== null) { if (!mm12.has(mk)) mm12.set(mk, []); mm12.get(mk).push(v12); }
      const van = getNumeric(r, ['Annual Average Inflation','AnnualInflation','Annual Average']);
      if (van !== null) { if (!mmAnnual.has(mk)) mmAnnual.set(mk, []); mmAnnual.get(mk).push(van); }
    });
    const out = new Map();
    if (mm12.size > 0) {
      const res = new Map(); for (const [k, arr] of mm12.entries()) res.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set('12-Month Inflation', res);
    }
    if (mmAnnual.size > 0) {
      const res = new Map(); for (const [k, arr] of mmAnnual.entries()) res.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set('Annual Average Inflation', res);
    }
    return out;
  }

  // ===== Alignment helpers =====
  function findGlobalRange(seriesMaps) {
    let minD = null, maxD = null;
    for (const m of seriesMaps) {
      for (const monthly of m.values()) {
        for (const key of monthly.keys()) {
          const d = monthKeyToDate(key);
          if (!minD || d < minD) minD = d;
          if (!maxD || d > maxD) maxD = d;
        }
      }
    }
    return { minD, maxD };
  }
  function buildMonths(startD, endD) {
    if (!startD || !endD) return [];
    const out = [];
    let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
    const end = new Date(endD.getFullYear(), endD.getMonth(), 1);
    while (cur <= end) {
      out.push(toMonthKey(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
    }
    return out;
  }
  function alignToMonths(months, monthlyMap) {
    const out = [];
    let last = null;
    let seen = false;
    for (const m of months) {
      if (monthlyMap.has(m)) {
        const v = monthlyMap.get(m);
        last = v;
        out.push(Number.isFinite(v) ? +v : null);
        seen = true;
      } else {
        if (!seen) out.push(null);      // leave blank before first observed datapoint
        else out.push(last !== null ? last : null); // forward-fill after first observation
      }
    }
    return out;
  }

  // Compute an element-wise difference arrA - arrB (both same length); if either null -> null
  function computeDiff(arrA, arrB) {
    const out = [];
    for (let i=0;i<Math.max(arrA.length, arrB.length);i++){
      const a = arrA[i], b = arrB[i];
      if (a === null || a === undefined || b === null || b === undefined) out.push(null);
      else out.push(a - b);
    }
    return out;
  }

  // ===== UI mapping: checkbox id -> series label(s) or differential config =====
  // We'll populate availableSeries after reading files and processing them
  let availableSeries = {}; // label => { monthlyMap: Map, aligned: [], color }
  let months = []; // global months
  let compareChart = null;

  // Map between checkbox ids and target series labels (some ids map to bill-day labels or bond-year labels)
  const checkboxToSeriesLabel = {
    // Central Bank Rates group
    'cbk-benchmark': 'Central Bank Rate',
    'repo': 'Repo Rate',
    'reverse-repo': 'Reverse Repo Rate',
    'kesonia': 'KESONIA',

    // CBWAR group (names must match map keys from CBWAR)
    'lending': 'Lending',
    'overdraft': 'Overdraft',
    'savings': 'Savings',
    'deposit': 'Deposit',

    // Inflation group
    'cpi-yoy': '12-Month Inflation',
    'cpi-annual': 'Annual Average Inflation',

    // GDP - not provided; will be ignored if not present
    'gdp-annual': 'GDP Annual Change'
  };

  // Government securities (map checkbox id -> series label that we'll produce from Tbills/Tbonds)
  const govCheckboxToSeriesLabel = {
    '3-month': '91 Day Bill',
    '6-month': '182 Day Bill',
    '1-year': '364 Day Bill', // 1-year bill typically 364 days in data
    '2-year': '2 Year Bond',
    '3-year': '3 Year Bond',
    '5-year': '5 Year Bond',
    '10-year': '10 Year Bond',
    '15-year': '15 Year Bond',
    '20-year': '20 Year Bond',
    '25-year': '25 Year Bond'
  };

  // Yield differentials: checkbox id -> [labelA, labelB]
  const yieldDifferentials = {
    'yield-10y-2y': ['10 Year Bond','2 Year Bond'],
    'yield-20y-2y': ['20 Year Bond','2 Year Bond'],
    'yield-15y-2y': ['15 Year Bond','2 Year Bond'],
    'yield-10y-3y': ['10 Year Bond','3 Year Bond'],
    'yield-20y-3y': ['20 Year Bond','3 Year Bond'],
    'yield-15y-3y': ['15 Year Bond','3 Year Bond']
  };

  // Event wiring helpers
  function getAllCheckboxElements() {
    return Array.from(document.querySelectorAll('input[type="checkbox"]'));
  }

  function clearChartDatasets() {
    if (compareChart) {
      compareChart.data.datasets = [];
      compareChart.update();
    }
  }

  // Build Chart.js datasets array from list of active labels (and differentials)
  function buildDatasetsFromSelections() {
    const datasets = [];
    const allCheckboxes = getAllCheckboxElements();
    // To ensure stable colors, create ordered list of labels then assign colors deterministically
    const activeLabels = [];

    // 1) Add simple mapped checkboxes
    allCheckboxes.forEach(cb => {
      if (!cb.checked) return;
      const id = cb.id;
      // Yield differentials handled below
      if (yieldDifferentials[id]) return;
      // Government securities handled separately
      if (govCheckboxToSeriesLabel[id]) {
        const label = govCheckboxToSeriesLabel[id];
        activeLabels.push({ label, cbid: id });
        return;
      }
      // Generic mapping
      const mapped = checkboxToSeriesLabel[id];
      if (mapped) activeLabels.push({ label: mapped, cbid: id });
    });

    // 2) Add differentials (if respective checkbox checked)
    const activeDifferentials = [];
    Object.keys(yieldDifferentials).forEach(id => {
      const cb = document.getElementById(id);
      if (!cb) return;
      if (cb.checked) {
        const [a,b] = yieldDifferentials[id];
        activeDifferentials.push({ id, a, b });
      }
    });

    // Assign colors to activeLabels in deterministic order
    // We'll map label -> color
    const labelToColor = {};
    let colorIndex = 0;
    activeLabels.forEach(x => {
      if (!labelToColor[x.label]) {
        labelToColor[x.label] = COLORS[colorIndex % COLORS.length];
        colorIndex++;
      }
    });
    // ensure differential series get their own colors
    activeDifferentials.forEach(d => {
      const diffLabel = `${d.a} - ${d.b}`;
      if (!labelToColor[diffLabel]) {
        labelToColor[diffLabel] = COLORS[colorIndex % COLORS.length];
        colorIndex++;
      }
    });

    // Now build datasets for visible series
    activeLabels.forEach(x => {
      const s = availableSeries[x.label];
      if (!s) {
        // not available (file/data didn't contain it) -> skip but keep checkbox toggles working
        return;
      }
      datasets.push({
        label: x.label,
        data: s.aligned.slice(), // copy
        borderColor: labelToColor[x.label],
        backgroundColor: labelToColor[x.label],
        fill: false,
        pointRadius: 0,
        tension: 0.4,
        spanGaps: false
      });
    });

    // Build differential datasets (compute arrA - arrB)
    activeDifferentials.forEach(d => {
      const sA = availableSeries[d.a];
      const sB = availableSeries[d.b];
      // only compute if both series exist
      if (!sA || !sB) return;
      const diffArr = computeDiff(sA.aligned, sB.aligned);
      datasets.push({
        label: `${d.a} - ${d.b}`,
        data: diffArr,
        borderColor: labelToColor[`${d.a} - ${d.b}`],
        backgroundColor: labelToColor[`${d.a} - ${d.b}`],
        fill: false,
        pointRadius: 0,
        tension: 0.4,
        spanGaps: false
      });
    });

    return datasets;
  }

  // Update chart with selected series
  function updateChart() {
    const labels = months.slice();
    const datasets = buildDatasetsFromSelections();
    // If chart exists, update; else create
    const ctxEl = document.getElementById('compare-chart');
    if (!ctxEl) {
      console.warn('#compare-chart not found');
      return;
    }
    const ctx = ctxEl.getContext('2d');

    if (compareChart) {
      compareChart.data.labels = labels;
      compareChart.data.datasets = datasets;
      compareChart.update();
    } else {
      compareChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          spanGaps: false,
          scales: {
            x: { title: { display: true, text: 'Date (MM/YYYY)' } },
            y: { title: { display: true, text: 'Rate / Differential' } }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  let label = ctx.dataset.label || '';
                  if (label) label += ': ';
                  const v = ctx.parsed.y;
                  if (v === null || v === undefined) label += '—';
                  else label += `${Number(v).toFixed(2)}%`;
                  return label;
                }
              }
            },
            zoom: {
              pan: { enabled: true, mode: 'x' },
              zoom: { wheel: { enabled: true }, drag: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
            },
            legend: {
              display: true,
              position: 'top'
            }
          }
        }
      });
    }
  }

  // Clear all checkboxes and chart
  function clearAll() {
    getAllCheckboxElements().forEach(cb => cb.checked = false);
    if (compareChart) {
      compareChart.data.datasets = [];
      compareChart.update();
    }
  }

  // Reset zoom (uses plugin method if available)
  function resetZoom() {
    if (compareChart && typeof compareChart.resetZoom === 'function') compareChart.resetZoom();
    else if (compareChart) {
      // fallback: re-render full chart
      compareChart.options.scales.x.min = undefined;
      compareChart.options.scales.x.max = undefined;
      compareChart.update();
    }
  }

  // Export chart as PNG
  function exportChartPNG() {
    const canvas = document.getElementById('compare-chart');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    a.download = `compare-chart-${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Attach UI listeners (checkboxes and buttons)
  function attachUIListeners() {
    // checkbox change -> update chart
    getAllCheckboxElements().forEach(cb => cb.addEventListener('change', updateChart));

    // Control buttons
    const clearBtn = document.getElementById('clear-all');
    if (clearBtn) clearBtn.addEventListener('click', () => { clearAll(); });

    const resetBtn = document.getElementById('reset-zoom');
    if (resetBtn) resetBtn.addEventListener('click', () => { resetZoom(); });

    const exportBtn = document.getElementById('export-chart');
    if (exportBtn) exportBtn.addEventListener('click', () => { exportChartPNG(); });
  }

  // After loading data, populate availableSeries and precompute aligned arrays
  function prepareAvailableSeries(seriesMaps) {
    // flatten all maps (an array of Map(label->Map(month->val)))
    const flat = [];
    seriesMaps.forEach(m => {
      for (const [label, mmMap] of m.entries()) flat.push({ label, mmMap });
    });

    // compute global months
    const { minD, maxD } = findGlobalRange(seriesMaps);
    months = buildMonths(minD, maxD);

    // deterministic sort labels for stable color assignment
    flat.sort((a,b) => a.label.localeCompare(b.label));

    const labelToColor = {};
    flat.forEach((s, idx) => {
      labelToColor[s.label] = COLORS[idx % COLORS.length];
    });

    availableSeries = {};
    flat.forEach(s => {
      availableSeries[s.label] = {
        monthlyMap: s.mmMap,
        aligned: alignToMonths(months, s.mmMap),
        color: labelToColor[s.label]
      };
    });

    // For convenience: ensure our govCheckboxToSeriesLabel labels exist if possible
    // (if not present in availableSeries they'll be ignored when toggled)
  }

  // Main: load files, process, prepare series and wire UI
  async function init() {
    // Read all sheets in parallel
    const [
      tbillsRows, tbondsRows, cbrRows, repoRows,
      interbankRows, kesRows, cbwarRows, inflRows
    ] = await Promise.all([
      readSheet(PATHS.tbills),
      readSheet(PATHS.tbonds),
      readSheet(PATHS.cbr),
      readSheet(PATHS.repo),
      readSheet(PATHS.interbank),
      readSheet(PATHS.kesonia),
      readSheet(PATHS.cbwar),
      readSheet(PATHS.inflation)
    ]);

    // Process each dataset
    const seriesMaps = [];
    seriesMaps.push(processTBills(tbillsRows));
    seriesMaps.push(processTBonds(tbondsRows));
    seriesMaps.push(processCBR(cbrRows));
    seriesMaps.push(processRepo(repoRows));
    seriesMaps.push(processKesonia(interbankRows, kesRows));
    seriesMaps.push(processCBWAR(cbwarRows));
    seriesMaps.push(processInflation(inflRows));

    // Prepare availableSeries (flatten + align)
    prepareAvailableSeries(seriesMaps);

    // Attach UI listeners
    attachUIListeners();

    // Chart starts empty (user selects what to compare)
    updateChart();

    // Optionally, disable checkboxes that map to non-existent series
    Object.keys(checkboxToSeriesLabel).forEach(cbId => {
      const lbl = checkboxToSeriesLabel[cbId];
      const el = document.getElementById(cbId);
      if (!el) return;
      if (availableSeries[lbl]) {
        el.disabled = false;
      } else {
        // Not present -> disable and add a tooltip (console note)
        el.disabled = true;
        el.title = `${lbl} not available in loaded data`;
        console.info(`Disabled ${cbId} because series "${lbl}" is not present in data.`);
      }
    });

    // Government securities checkboxes
    Object.keys(govCheckboxToSeriesLabel).forEach(cbId => {
      const lbl = govCheckboxToSeriesLabel[cbId];
      const el = document.getElementById(cbId);
      if (!el) return;
      if (availableSeries[lbl]) el.disabled = false;
      else {
        el.disabled = true;
        el.title = `${lbl} not available in loaded data`;
        console.info(`Disabled ${cbId} because series "${lbl}" is not present in data.`);
      }
    });

    // Yield differential checkboxes (enable only if both base series present)
    Object.keys(yieldDifferentials).forEach(cbId => {
      const el = document.getElementById(cbId);
      if (!el) return;
      const [a,b] = yieldDifferentials[cbId];
      if (availableSeries[a] && availableSeries[b]) el.disabled = false;
      else {
        el.disabled = true;
        el.title = `Need both ${a} and ${b} to compute differential`;
        console.info(`Disabled ${cbId} because series "${a}" or "${b}" missing.`);
      }
    });

    // Informational console log
    console.log('compare.js: ready. Months range:', months.length > 0 ? `${months[0]} → ${months[months.length-1]}` : 'no months');
    console.log('Available series:', Object.keys(availableSeries));
  }

  // Start when DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
