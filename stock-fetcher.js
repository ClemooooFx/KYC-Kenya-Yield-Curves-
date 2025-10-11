const API_BASE_URL = 'https://web-production-7130.up.railway.app';
const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8'];

const VALID_MARKETS = {
  'bse': 'Botswana Stock Exchange',
  'brvm': 'Bourse Régionale des Valeurs Mobilières',
  'gse': 'Ghana Stock Exchange',
  'jse': 'Johannesburg Stock Exchange',
  'luse': 'Lusaka Securities Exchange',
  'mse': 'Malawi Stock Exchange',
  'nse': 'Nairobi Securities Exchange',
  'ngx': 'Nigerian Stock Exchange',
  'use': 'Uganda Securities Exchange',
  'zse': 'Zimbabwe Stock Exchange'
};

let stockChart = null;

async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    const text = await response.text();
    // Replace NaN with null for valid JSON
    const safeText = text.replace(/:\s*NaN\b/g, ':null');
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
        x: { 
          title: { display: true, text: 'Date' },
          ticks: {
            callback: function(value, index) {
              const date = new Date(labels[value]);
              if (date.getDate() === 1 || index === 0) {
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              }
              return '';
            },
            maxTicksLimit: 12
          }
        },
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

async function searchStock() {
  const ticker = document.getElementById('stock-ticker').value.toUpperCase();
  const market = document.getElementById('market-select').value.toLowerCase();
  const statusDiv = document.getElementById('search-status');

  if (!ticker) {
    statusDiv.innerHTML = '<p style="color: red;">Please enter a ticker symbol</p>';
    return;
  }

  if (!market) {
    statusDiv.innerHTML = '<p style="color: red;">Please select a market</p>';
    return;
  }

  statusDiv.innerHTML = '<p style="color: blue;">Loading stock data...</p>';

  try {
    const response = await fetch(`${API_BASE_URL}/api/stock/${market}/${ticker}`);
    const data = await response.json();

    if (!data.success) {
      statusDiv.innerHTML = `<p style="color: red;">Error: ${data.error || 'Stock not found'}</p>`;
      return;
    }

    displayStockInfo(data);
    statusDiv.innerHTML = '';
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: red;">Error fetching stock data: ${error.message}</p>`;
  }
}

function displayStockInfo(data) {
  const infoDiv = document.getElementById('stock-info-container');
  const priceData = data.data.price;
  const growthData = data.data.growth_and_valuation;

  let priceHtml = '';
  let growthHtml = '';

  if (Array.isArray(priceData) && priceData.length > 0) {
    const price = priceData[0];
    priceHtml = `
      <div class="info-card">
        <h4>Price Information</h4>
        <p><strong>Current Price:</strong> ${price.price || 'N/A'}</p>
        <p><strong>Currency:</strong> ${price.currency || 'N/A'}</p>
        <p><strong>Date:</strong> ${price.date || 'N/A'}</p>
      </div>
    `;
  }

  if (Array.isArray(growthData) && growthData.length > 0) {
    const growth = growthData[0];
    growthHtml = `
      <div class="info-card">
        <h4>Growth & Valuation</h4>
        ${Object.entries(growth).map(([key, value]) => `
          <p><strong>${key}:</strong> ${value !== null && value !== undefined ? value : 'N/A'}</p>
        `).join('')}
      </div>
    `;
  }

  infoDiv.innerHTML = `
    <div class="stock-info-section">
      <h3>${data.ticker} - ${data.market_name}</h3>
      <div class="info-cards-container">
        ${priceHtml}
        ${growthHtml}
      </div>
    </div>
  `;

  // Create stock chart
  createStockChart(data.ticker);
}

function createStockChart(ticker) {
  const chartContainer = document.getElementById('stock-chart-container');
  
  if (!chartContainer.querySelector('canvas')) {
    chartContainer.innerHTML = '<canvas id="stock-price-chart"></canvas>';
  }

  // Placeholder chart - you can update this with actual historical data if available
  const ctx = document.getElementById('stock-price-chart').getContext('2d');

  if (stockChart) {
    stockChart.destroy();
  }

  stockChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      datasets: [{
        label: `${ticker} Price`,
        data: [100, 105, 103, 108, 110],
        borderColor: colors[0],
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { title: { display: true, text: 'Price (KES)' } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
            }
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

  console.log('Gainers data:', gainers.data);
  console.log('Losers data:', losers.data);

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
      <td>${item["Bottom Losers (30)"]}</td>
      <td>${item["Bottom Losers (30).1"]}</td>
      <td>${item["Bottom Losers (30).2"]}</td>
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
