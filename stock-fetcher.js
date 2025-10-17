// Configuration - only store what's necessary for UI
const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8'];

let stockChart = null;
let currentTicker = null;
let currentMarket = null;

// Get API base URL from environment or data attribute
const API_BASE_URL = document.querySelector('[data-api-url]')?.getAttribute('data-api-url') || 
                     window.ENV?.API_URL || 
                     'https://web-production-7130.up.railway.app';

async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
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

  new Chart(ctx, {
    type: 'line',
    data: { 
      labels, 
      datasets: [{
        label: 'NSE All Share Index',
        data: prices,
        borderColor: colors[0],
        backgroundColor: colors[0],
        fill: false,
        tension: 0,
        pointRadius: 0
      }]
    },
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
    const data = await fetchData(`/api/stock/${market}/${ticker}`);

    if (!data.success) {
      statusDiv.innerHTML = `<p style="color: red;">Error: ${data.error || 'Stock not found'}</p>`;
      return;
    }

    currentTicker = ticker;
    currentMarket = market;
    displayStockInfo(data);
    statusDiv.innerHTML = '';
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: red;">Error fetching stock data: ${error.message}</p>`;
  }
}

function displayStockInfo(data) {
  const infoDiv = document.getElementById('stock-info-container');
  const latestPrice = data.data.latest_price || {};
  const growthData = data.data.growth_and_valuation || [];
  const calculatedPerformance = data.data.calculated_performance || {};
  const lastTradingVolume = data.data.last_trading_volume || 'N/A';

  // Price Information
  const priceHtml = latestPrice ? `
    <div class="info-card">
      <h4>Price Information</h4>
      <p><strong>Current Price:</strong> ${latestPrice.Price || latestPrice.price || 'N/A'}</p>
      <p><strong>Currency:</strong> ${latestPrice.currency || 'N/A'}</p>
      <p><strong>Date:</strong> ${latestPrice.Date || latestPrice.date || 'N/A'}</p>
    </div>
  ` : '';

  // Growth & Valuation
  const growthHtml = growthData.length > 0 ? `
    <div class="info-card">
      <h4>Growth & Valuation</h4>
      ${growthData.map(item => `
        <p><strong>${item["Growth & Valuation"]}:</strong> ${item["Growth & Valuation.1"] || 'N/A'}</p>
      `).join('')}
    </div>
  ` : '';

  // Performance Period Boxes
  const periodOrder = ['1WK', '4WK', '3MO', '6MO', 'YTD', '1YR', 'All-Time'];
  const performanceHtml = `
    <div class="performance-periods">
      <h4>Performance Periods</h4>
      <div class="period-boxes">
        ${periodOrder.map(period => {
          const value = calculatedPerformance[period] || 'N/A';
          const isPositive = value.startsWith('+');
          const boxClass = isPositive ? 'positive' : value === 'N/A' ? '' : 'negative';
          return `
            <div class="period-box ${boxClass}" data-period="${period}">
              <span class="period-label">${period}</span>
              <span class="period-value">${value}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    <div class="info-card">
      <h4>Last Trading Volume</h4>
      <p><strong>Volume:</strong> ${lastTradingVolume}</p>
    </div>
  `;

  infoDiv.innerHTML = `
    <div class="stock-info-section">
      <h3>${data.ticker} - ${data.market_name}</h3>
      <div class="info-cards-container">
        ${priceHtml}
        ${growthHtml}
      </div>
      ${performanceHtml}
    </div>
  `;

  // Add event listeners for period boxes
  document.querySelectorAll('.period-box').forEach(box => {
    box.addEventListener('click', () => {
      document.querySelectorAll('.period-box').forEach(b => b.classList.remove('active'));
      box.classList.add('active');
      const period = box.getAttribute('data-period');
      loadStockChart(period);
    });
  });

  // Initialize chart with All-Time view
  loadStockChart('All-Time');
}

async function loadStockChart(period = 'All-Time') {
  const chartContainer = document.getElementById('stock-chart-container');
  
  if (!chartContainer.querySelector('canvas')) {
    chartContainer.innerHTML = '<canvas id="stock-price-chart"></canvas>';
  }

  try {
    // Fetch filtered data from backend
    const data = await fetchData(`/api/stock/${currentMarket}/${currentTicker}/chart?period=${period}`);
    
    if (!data.success) {
      console.error('Error loading chart:', data.error);
      return;
    }

    createStockChart(data.data, currentTicker, period);
  } catch (error) {
    console.error('Error loading chart:', error);
  }
}

function createStockChart(priceData, ticker, period) {
  const ctx = document.getElementById('stock-price-chart').getContext('2d');

  if (stockChart) {
    stockChart.destroy();
  }

  // Data is already sorted and filtered by backend
  const labels = priceData.map(p => {
    const date = new Date(p.Date || p.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });
  const prices = priceData.map(p => p.Price || p.price);

  stockChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${ticker} Price`,
        data: prices,
        borderColor: colors[0],
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        fill: true,
        tension: 0,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { 
          title: { display: true, text: 'Date' },
          ticks: {
            callback: function(value, index) {
              if (index % Math.ceil(labels.length / 12) === 0) {
                return labels[index];
              }
              return '';
            }
          }
        },
        y: { title: { display: true, text: 'Price' } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
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
    populateTable('top-gainers-body', gainers.data, (item) => {
      const keys = Object.keys(item).filter(k => k.startsWith('Top Gainers'));
      const baseKey = keys[0];
      return `
        <td>${item[baseKey]}</td>
        <td>${item[baseKey + '.1']}</td>
        <td>${item[baseKey + '.2']}</td>
      `;
    });
  }

  if (losers.success) {
    populateTable('bottom-losers-body', losers.data, (item) => {
      const keys = Object.keys(item).filter(k => k.startsWith('Bottom Losers'));
      const baseKey = keys[0];
      return `
        <td>${item[baseKey]}</td>
        <td>${item[baseKey + '.1']}</td>
        <td>${item[baseKey + '.2']}</td>
      `;
    });
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
