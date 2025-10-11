const API_BASE_URL = 'https://web-production-7130.up.railway.app';
const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8'];

async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    const text = await response.text();
    const safeText = text.replace(/\bNaN\b/g, 'null');
    return JSON.parse(safeText);
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return { success: false, data: [] };
  }
}

function populateTable(tbodyId, data, mapper) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No data available</td></tr>`;
    return;
  }

  data.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = mapper(item);
    tbody.appendChild(row);
  });
}

function renderIndexChart(data) {
  if (!data || data.length === 0) return;

  const ctx = document.getElementById('indexChart').getContext('2d');
  const labels = data.map(d => d.Date || d.date);
  const prices = data.map(d => d.Price || d.price);

  const datasets = [{
    label: 'NSE All Share Index',
    data: prices,
    borderColor: colors[0],
    backgroundColor: colors[0],
    fill: false,
    tension: 0.4,
    pointRadius: 0
  }];

  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Index Price (KES)' } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += `${context.parsed.y.toFixed(2)}`;
              }
              return label;
            }
          }
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            drag: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        }
      }
    }
  });
}

async function renderDashboard() {
  const message = document.getElementById('message');
  message.textContent = 'Loading data...';

  const [gainers, losers, listed, indexData] = await Promise.all([
    fetchData('/api/nse/top_gainers'),
    fetchData('/api/nse/bottom_losers'),
    fetchData('/api/nse/listed'),
    fetchData('/api/nse/index_price')
  ]);

  message.textContent = '';

  if (gainers.success) {
    populateTable('top-gainers-body', gainers.data, (item) => `
      <td>${item["Top Gainers (21)"]}</td>
      <td>${item["Top Gainers (21).1"]}</td>
      <td>${item["Top Gainers (21).2"]}</td>
    `);
  }

  if (losers.success) {
    populateTable('bottom-losers-body', losers.data, (item) => `
      <td>${item["Bottom Losers (21)"]}</td>
      <td>${item["Bottom Losers (21).1"]}</td>
      <td>${item["Bottom Losers (21).2"]}</td>
    `);
  }

  if (listed.success) {
    populateTable('listed-companies-body', listed.data, (item) => `
      <td>${item.Name}</td>
      <td>${item.Ticker}</td>
      <td>${item.Price}</td>
      <td>${item.Change ?? '-'}</td>
      <td>${item.Volume ?? '-'}</td>
    `);
  }

  if (indexData.success) {
    renderIndexChart(indexData.data);
  }
}

document.addEventListener('DOMContentLoaded', renderDashboard);
