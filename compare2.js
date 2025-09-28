// compare.js
// Self-contained compare loader + UI integration for compare.html
// Assumes Chart, chartjs-plugin-zoom, and XLSX are already loaded.
// Also uses window.InflationDataLoader and window.CBWARDataLoader if present.

(function () {
  // safe plugin register
  try { Chart.register(window.ChartZoom); } catch(e){}

  // Files this script will fetch directly
  const FILES = {
    tbills: 'data/Treasury Bills Average Rates.xlsx',
    tbonds: 'data/Issues of Treasury Bonds.xlsx',
    repo: 'data/Repo and Reverse Repo.xlsx',
    interbank: 'data/Interbank Rates.xlsx',
    kesonia: 'data/KESONIA.xlsx',
    cbr: 'data/Central Bank Rate (CBR).xlsx'
  };

  // Color palette
  const COLORS = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#af7aa1','#ff9da7','#9c755f','#bab0ac'];

  // Utilities ----------------------------------------------------------------
  function parseDateFlexible(v) {
    if (!v && v !== 0) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'number') {
      // Excel serial date (assume 1900 system)
      const epoch = new Date(Date.UTC(1899,11,30));
      const days = Math.floor(v);
      const ms = Math.round((v - days) * 24 * 3600 * 1000);
      return new Date(epoch.getTime() + days * 24*3600*1000 + ms);
    }
    if (typeof v === 'string') {
      v = v.trim();
      if (v.includes('/')) {
        // dd/mm/yyyy expected
        const parts = v.split('/');
        if (parts.length === 3) {
          const d = parseInt(parts[0],10), m = parseInt(parts[1],10)-1, y = parseInt(parts[2],10);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y,m,d);
        }
      }
      const dt = new Date(v);
      if (!isNaN(dt)) return dt;
    }
    return null;
  }

  function toMonthKey(date) {
    return `${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`; // MM/YYYY
  }

  function getNumeric(row, candidates = []) {
    for (const k of candidates) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
        if (typeof row[k] === 'number') return row[k];
        const cleaned = String(row[k]).replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        if (!isNaN(n)) return n;
      }
    }
    // fallback - try any numeric-like cell
    for (const k in row) {
      if (!row.hasOwnProperty(k)) continue;
      const v = row[k];
      if (typeof v === 'number') return v;
      const cleaned = String(v || '').replace(/[^0-9.\-]/g,'');
      const n = parseFloat(cleaned);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  async function readSheet(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path} - ${res.status}`);
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    const s = wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[s], { defval: null });
  }

  // Processors: returns Map(seriesLabel => Map(monthKey => avgValue)) ----------------
  function processTBills(rows) {
    // Tenors mapped to monthly arrays. Expect 'Issue Date'/'Date', 'Tenor', 'Weighted Average Rate'
    const buckets = {};
    rows.forEach(r => {
      const date = parseDateFlexible(r['Issue Date'] || r['Date']);
      const tenor = r['Tenor'] !== undefined ? Number(r['Tenor']) : null;
      const val = getNumeric(r, ['Weighted Average Rate','WeightedAverageRate','Weighted Avg Rate']);
      if (!date || isNaN(tenor) || val === null) return;
      const mk = toMonthKey(date);
      const key = `${tenor} Day Bill`; // e.g., "91 Day Bill"
      if (!buckets[key]) buckets[key] = new Map();
      if (!buckets[key].has(mk)) buckets[key].set(mk, []);
      buckets[key].get(mk).push(val);
    });
    const out = new Map();
    Object.keys(buckets).forEach(k => {
      const mm = buckets[k];
      const avg = new Map();
      for (const [m, arr] of mm.entries()) avg.set(m, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set(k, avg);
    });
    return out;
  }

  function processTBonds(rows) {
    // Filter only FXD issues if column present; expect 'Issue Date'/'Date', 'Tenor', 'Coupon Rate', 'Issue No'
    const filtered = rows.filter(r => {
      const inum = r['Issue No'] || r['IssueNo'] || r['Issue_Number'];
      if (inum === null || inum === undefined) return true;
      return String(inum).startsWith('FXD');
    });
    const buckets = {};
    filtered.forEach(r => {
      const date = parseDateFlexible(r['Issue Date'] || r['Date']);
      const tenor = r['Tenor'] !== undefined ? Number(r['Tenor']) : null;
      const val = getNumeric(r, ['Coupon Rate','CouponRate','Coupon']);
      if (!date || isNaN(tenor) || val === null) return;
      const mk = toMonthKey(date);
      const key = `${tenor} Year Bond`;
      if (!buckets[key]) buckets[key] = new Map();
      if (!buckets[key].has(mk)) buckets[key].set(mk, []);
      buckets[key].get(mk).push(val);
    });
    const out = new Map();
    Object.keys(buckets).forEach(k => {
      const mm = buckets[k];
      const avg = new Map();
      for (const [m, arr] of mm.entries()) avg.set(m, arr.reduce((a,b)=>a+b,0)/arr.length);
      out.set(k, avg);
    });
    return out;
  }

  function processRepo(rows) {
    // Expect 'Date','Repo','Reverse Repo'
    const repo = new Map(), rrev = new Map();
    rows.forEach(r => {
      const date = parseDateFlexible(r['Date'] || r['DATE']);
      if (!date) return;
      const mk = toMonthKey(date);
      const rv = getNumeric(r, ['Repo']);
      const rrv = getNumeric(r, ['Reverse Repo','ReverseRepo']);
      if (rv !== null) {
        if (!repo.has(mk)) repo.set(mk, []);
        repo.get(mk).push(rv);
      }
      if (rrv !== null) {
        if (!rrev.has(mk)) rrev.set(mk, []);
        rrev.get(mk).push(rrv);
      }
    });
    const out = new Map();
    if (repo.size) {
      const rAvg = new Map();
      for (const [m,a] of repo.entries()) rAvg.set(m, a.reduce((x,y)=>x+y,0)/a.length);
      out.set('Repo Rate', rAvg);
    }
    if (rrev.size) {
      const rrAvg = new Map();
      for (const [m,a] of rrev.entries()) rrAvg.set(m, a.reduce((x,y)=>x+y,0)/a.length);
      out.set('Reverse Repo Rate', rrAvg);
    }
    return out;
  }

  function processKesonia(interbankRows, kesoniaRows) {
    const all = [...(interbankRows||[]), ...(kesoniaRows||[])];
    const map = new Map();
    all.forEach(r => {
      const date = parseDateFlexible(r['Date'] || r['DATE']);
      const val = getNumeric(r, ['Rate','KESONIA']);
      if (!date || val === null) return;
      const mk = toMonthKey(date);
      if (!map.has(mk)) map.set(mk, []);
      map.get(mk).push(val);
    });
    const avg = new Map();
    for (const [m,a] of map.entries()) avg.set(m, a.reduce((x,y)=>x+y,0)/a.length);
    return new Map([['KESONIA (monthly avg)', avg]]);
  }

  function processCBR(rows) {
    const m = new Map();
    rows.forEach(r => {
      const date = parseDateFlexible(r['Date'] || r['DATE']);
      const val = getNumeric(r, ['Rate','CBR']);
      if (!date || val === null) return;
      const mk = toMonthKey(date);
      if (!m.has(mk)) m.set(mk, []);
      m.get(mk).push(val);
    });
    const avg = new Map();
    for (const [k,a] of m.entries()) avg.set(k, a.reduce((x,y)=>x+y,0)/a.length);
    return new Map([['Central Bank Rate', avg]]);
  }

  // Build global months array from earliest to latest month across maps
  function findGlobalMonthRange(maps) {
    let minD=null, maxD=null;
    maps.forEach(m => {
      for (const mm of m.values()) {
        for (const key of mm.keys()) {
          const [mo,yr] = key.split('/').map(Number);
          const d = new Date(yr, mo-1, 1);
          if (!minD || d < minD) minD = d;
          if (!maxD || d > maxD) maxD = d;
        }
      }
    });
    return { minD, maxD };
  }
  function buildMonthsArray(start, end) {
    const out = [];
    if (!start || !end) return out;
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endD = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endD) {
      out.push(toMonthKey(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
    }
    return out;
  }

  // Align monthly Map to months array, forward-fill after first observed, keep null before first
  function alignSeries(months, monthlyMap) {
    const arr = [];
    let last = null, seen=false;
    for (const m of months) {
      if (monthlyMap.has(m)) {
        const v = monthlyMap.get(m);
        last = v;
        arr.push(Number.isFinite(v) ? +v : null);
        seen = true;
      } else {
        if (!seen) arr.push(null);
        else arr.push(last !== null ? last : null);
      }
    }
    return arr;
  }

  // Charting / UI infra ------------------------------------------------------
  let compareChart = null;
  const seriesStore = new Map(); // label => { monthsMap } (Map month->value)
  let monthsTimeline = [];

  function createOrUpdateChart(datasets) {
    const canvas = document.getElementById('compare-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (compareChart) compareChart.destroy();
    compareChart = new Chart(ctx, {
      type: 'line',
      data: { labels: monthsTimeline, datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction: { mode: 'index', intersect:false },
        spanGaps: false, // don't connect nulls
        scales: {
          x: { title:{ display:true, text:'Date (MM/YYYY)' } },
          y: { title:{ display:true, text:'Rate (%)' } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => {
                let lab = ctx.dataset.label || '';
                if (lab) lab += ': ';
                if (ctx.parsed.y !== null && ctx.parsed.y !== undefined) lab += `${parseFloat(ctx.parsed.y).toFixed(2)}%`;
                return lab;
              }
            }
          },
          zoom: {
            pan: { enabled:true, mode:'x' },
            zoom: { wheel:{ enabled:true }, drag:{ enabled:true }, pinch:{ enabled:true }, mode:'x' }
          }
        }
      }
    });
  }

  // Build dataset objects for selected labels (preserve color consistency)
  function buildDatasets(selectedLabels) {
    const datasets = [];
    selectedLabels.forEach((label, idx) => {
      const entry = seriesStore.get(label);
      if (!entry) return;
      const data = alignSeries(monthsTimeline, entry.monthly);
      datasets.push({
        label,
        data,
        borderColor: COLORS[idx % COLORS.length],
        backgroundColor: COLORS[idx % COLORS.length],
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        spanGaps: false
      });
    });
    return datasets;
  }

  // Helpers to read inflation & cbwar from their loaders when available; otherwise rely on our own file reads
  async function fetchInflationFromLoaderIfPresent() {
    if (window.InflationDataLoader && typeof window.InflationDataLoader.loadData === 'function') {
      await window.InflationDataLoader.loadData();
      const d = window.InflationDataLoader.getData();
      if (d) {
        // month labels => monthlyInflation and annualInflation arrays
        // d.labels are MM/YYYY consistent with inflation.js
        const mmMap12 = new Map();
        for (let i=0;i<d.labels.length;i++) {
          const key = d.labels[i];
          const val12 = d.monthlyInflation ? d.monthlyInflation[i] : null;
          const valAnn = d.annualInflation ? d.annualInflation[i] : null;
          if (val12 !== undefined && val12 !== null) mmMap12.set(key, val12);
        }
        const mmMapAnn = new Map();
        for (let i=0;i<d.labels.length;i++) {
          const key = d.labels[i];
          const valAnn = d.annualInflation ? d.annualInflation[i] : null;
          if (valAnn !== undefined && valAnn !== null) mmMapAnn.set(key, valAnn);
        }
        if (mmMap12.size) seriesStore.set('12-Month Inflation', mmMap12);
        if (mmMapAnn.size) seriesStore.set('Annual Average Inflation', mmMapAnn);
      }
    }
  }

  async function fetchCBWARFromLoaderIfPresent() {
    if (window.CBWARDataLoader && typeof window.CBWARDataLoader.loadData === 'function') {
      await window.CBWARDataLoader.loadData();
      const d = window.CBWARDataLoader.getData();
      if (d && d.labels) {
        // d.labels are mm/yyyy and properties available under d.deposit,d.savings,d.lending,d.overdraft
        const props = { deposit: 'Deposit', savings:'Savings', lending:'Lending', overdraft:'Overdraft' };
        Object.keys(props).forEach(k => {
          if (d[k] && Array.isArray(d[k])) {
            const map = new Map();
            for (let i=0;i<d.labels.length;i++) {
              const lab = d.labels[i];
              const val = d[k][i];
              if (val !== undefined && val !== null) map.set(lab, val);
            }
            if (map.size) seriesStore.set(props[k], map);
          }
        });
      }
    }
  }

  // Map of HTML checkbox IDs -> series labels that we create in seriesStore
  const CHECK_TO_LABEL = {
    'cbk-benchmark': 'Central Bank Rate',
    'repo': 'Repo Rate',
    'reverse-repo': 'Reverse Repo Rate',
    'kesonia': 'KESONIA (monthly avg)',
    'lending': 'Lending',
    'overdraft': 'Overdraft',
    'savings': 'Savings',
    'deposit': 'Deposit',
    'cpi-yoy': '12-Month Inflation',
    'cpi-annual': 'Annual Average Inflation',
    // government securities mapping (checkbox id -> seriesStore label)
    '3-month': '91 Day Bill',
    '6-month': '182 Day Bill',
    '1-year': '364 Day Bill',
    '2-year': '2 Year Bond',
    '3-year': '3 Year Bond',
    '5-year': '5 Year Bond',
    '10-year': '10 Year Bond',
    '15-year': '15 Year Bond',
    '20-year': '20 Year Bond',
    '25-year': '25 Year Bond'
  };

  // yield differential definitions: checkbox id -> {a: labelA, b: labelB, label: seriesLabel}
  const YIELD_DIFFS = {
    'yield-10y-2y': { a: '10 Year Bond', b: '2 Year Bond', label: '10Y - 2Y' },
    'yield-20y-2y': { a: '20 Year Bond', b: '2 Year Bond', label: '20Y - 2Y' },
    'yield-15y-2y': { a: '15 Year Bond', b: '2 Year Bond', label: '15Y - 2Y' },
    'yield-10y-3y': { a: '10 Year Bond', b: '3 Year Bond', label: '10Y - 3Y' },
    'yield-20y-3y': { a: '20 Year Bond', b: '3 Year Bond', label: '20Y - 3Y' },
    'yield-15y-3y': { a: '15 Year Bond', b: '3 Year Bond', label: '15Y - 3Y' }
  };

  // Build yield differential series from existing bond series (aligned arrays)
  function computeYieldDiff(labelA, labelB) {
    const eA = seriesStore.get(labelA);
    const eB = seriesStore.get(labelB);
    if (!eA || !eB) return null;
    const arrA = alignSeries(monthsTimeline, eA);
    const arrB = alignSeries(monthsTimeline, eB);
    const out = arrA.map((v,i) => {
      if (v === null || arrB[i] === null || arrB[i] === undefined) return null;
      return v - arrB[i];
    });
    return out;
  }

  // Hook UI ---------------------------------------------------------------
  function setupCheckboxes() {
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(cb => cb.addEventListener('change', onCheckboxChange));
    document.getElementById('clear-all').addEventListener('click', () => {
      allCheckboxes.forEach(cb => { cb.checked = false; });
      createOrUpdateChart([]);
    });
    document.getElementById('reset-zoom').addEventListener('click', () => {
      if (compareChart && compareChart.resetZoom) compareChart.resetZoom();
    });
    document.getElementById('export-chart').addEventListener('click', () => {
      if (!compareChart) return;
      const url = document.getElementById('compare-chart').toDataURL('image/png', 1);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compare-chart-${(new Date()).toISOString().slice(0,10)}.png`;
      a.click();
    });
  }

  function onCheckboxChange() {
    // gather selected series labels
    const selected = [];
    // normal checkboxes -> series
    Object.entries(CHECK_TO_LABEL).forEach(([cbId, seriesLabel]) => {
      const cb = document.getElementById(cbId);
      if (cb && cb.checked && seriesStore.has(seriesLabel)) selected.push(seriesLabel);
    });
    // yield diffs (compute & add as synthetic series)
    Object.entries(YIELD_DIFFS).forEach(([cbId, def]) => {
      const cb = document.getElementById(cbId);
      if (cb && cb.checked) {
        // ensure the underlying bond series exist
        if (seriesStore.has(def.a) && seriesStore.has(def.b)) {
          // compute on the fly and add synthetic Map into a temporary store
          const arr = computeYieldDiff(def.a, def.b);
          // we will add dataset for this synthetic series directly (no permanent Map)
          // We'll add label as e.g., '10Y - 2Y' to selected list and build dataset later specially
          selected.push(def.label);
        }
      }
    });

    // build datasets: regular series first (we keep consistent color usage)
    const datasets = [];
    let colorIndex = 0;
    selected.forEach(lbl => {
      // if it's a synthetic yield diff, compute and add dataset
      const yDefKey = Object.keys(YIELD_DIFFS).find(k => YIELD_DIFFS[k].label === lbl);
      if (yDefKey) {
        const def = Object.values(YIELD_DIFFS).find(d => d.label === lbl);
        const arr = computeYieldDiff(def.a, def.b);
        datasets.push({
          label: def.label,
          data: arr,
          borderColor: COLORS[colorIndex % COLORS.length],
          backgroundColor: COLORS[colorIndex % COLORS.length],
          fill: false,
          pointRadius: 0,
          tension: 0.3
        });
        colorIndex++;
        return;
      }
      const entry = seriesStore.get(lbl);
      if (!entry) return;
      const data = alignSeries(monthsTimeline, entry.monthly);
      datasets.push({
        label: lbl,
        data,
        borderColor: COLORS[colorIndex % COLORS.length],
        backgroundColor: COLORS[colorIndex % COLORS.length],
        fill: false,
        pointRadius: 0,
        tension: 0.3
      });
      colorIndex++;
    });

    createOrUpdateChart(datasets);
  }

  // Main initialization ----------------------------------------------------
  async function init() {
    try {
      // load files in parallel (some may be missing; we catch individually)
      const promises = Object.entries(FILES).map(async ([k, path]) => {
        try {
          const data = await readSheet(path);
          return { k, data };
        } catch (e) {
          console.warn(`compare.js: failed to load ${path}: ${e.message}`);
          return { k, data: [] };
        }
      });
      const results = await Promise.all(promises);
      const loaded = {};
      results.forEach(r => loaded[r.k] = r.data);

      // process and populate seriesStore
      const tbillMap = processTBills(loaded.tbills || []);
      for (const [label, map] of tbillMap.entries()) seriesStore.set(label, { monthly: map });

      const tbondMap = processTBonds(loaded.tbonds || []);
      for (const [label, map] of tbondMap.entries()) seriesStore.set(label, { monthly: map });

      const repoMap = processRepo(loaded.repo || []);
      for (const [label, map] of repoMap.entries()) seriesStore.set(label, { monthly: map });

      const kesMap = processKesonia(loaded.interbank || [], loaded.kesonia || []);
      for (const [label, map] of kesMap.entries()) seriesStore.set(label, { monthly: map });

      const cbrMap = processCBR(loaded.cbr || []);
      for (const [label, map] of cbrMap.entries()) seriesStore.set(label, { monthly: map });

      // Pull inflation and cbwar data from their loaders if present (overwrites or adds)
      await Promise.all([ fetchInflationFromLoaderIfPresent(), fetchCBWARFromLoaderIfPresent() ]);

      // Build global timeline
      const allMaps = Array.from(seriesStore.values()).map(e => e.monthly);
      const { minD, maxD } = findGlobalMonthRange(allMaps);
      if (!minD || !maxD) {
        console.warn('compare.js: no month range found - nothing to plot');
        monthsTimeline = [];
      } else {
        monthsTimeline = buildMonthsArray(minD, maxD);
      }

      // Hook up UI
      setupCheckboxes();

      // Pre-check some defaults (optional): none checked by default - comment/uncomment if you want defaults
      // document.getElementById('cbk-benchmark').checked = true;
      // document.getElementById('kesonia').checked = true;

      // initial render (nothing selected)
      createOrUpdateChart([]);

      console.log('compare.js initialized. Series available:', Array.from(seriesStore.keys()));
    } catch (err) {
      console.error('compare.js fatal error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
