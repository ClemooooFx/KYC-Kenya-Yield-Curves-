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
let currentData = null; // Store API data for chart updates

async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    const text = await response.text();
    // Replace all NaN with null for valid JSON
    const safeText = text.replace(/NaN/g, 'null');
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
    const text = await response.text();
    // Replace NaN with null to make it valid JSON
    const safeText = text.replace(/NaN/g, 'null');
    const data = JSON.parse(safeText);

    if (!data.success) {
      statusDiv.innerHTML = `<p style="color: red;">Error: ${data.error || 'Stock not found'}</p>`;
      return;
    }

    currentData = data; // Store data for chart updates
    displayStockInfo(data);
    statusDiv.innerHTML = '';
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: red;">Error fetching stock data: ${error.message}</p>`;
  }
}

function displayStockInfo(data) {
  const infoDiv = document.getElementById('stock-info-container');
  const priceData = data.data.price || [];
  const growthData = data.data.growth_and_valuation || [];
  const performanceData = data.data.performance_period ? data.data.performance_period[0] : {};
  const lastTradingVolume = data.data.last_trading_results ? data.data.last_trading_results[0]["Last Trading Results.1"] : 'N/A';

  let priceHtml = '';
  let growthHtml = '';
  let performanceHtml = '';

  // Price Information (use latest price)
  if (Array.isArray(priceData) && priceData.length > 0) {
    // Sort by date descending to get latest price
    const sortedPriceData = [...priceData].sort((a, b) => new Date(b.Date || b.date) - new Date(a.Date || a.date));
    const latestPrice = sortedPriceData[0];
    priceHtml = `
      <div class="info-card">
        <h4>Price Information</h4>
        <p><strong>Current Price:</strong> ${latestPrice.Price || latestPrice.price || 'N/A'}</p>
        <p><strong>Currency:</strong> ${latestPrice.currency || 'N/A'}</p>
        <p><strong>Date:</strong> ${latestPrice.Date || latestPrice.date || 'N/A'}</p>
      </div>
    `;
  }

  // Growth & Valuation
  if (Array.isArray(growthData) && growthData.length > 0) {
    growthHtml = `
      <div class="info-card">
        <h4>Growth & Valuation</h4>
        ${growthData.map(item => `
          <p><strong>${item["Growth & Valuation"]}:</strong> ${item["Growth & Valuation.1"] || 'N/A'}</p>
        `).join('')}
      </div>
    `;
  }

  // Calculate All-Time percentage return
  let allTimeReturn = 'N/A';
  if (priceData.length > 1) {
    const sortedByDate = [...priceData].sort((a, b) => new Date(a.Date || a.date) - new Date(b.Date || b.date));
    const earliestPrice = parseFloat(sortedByDate[0].Price || sortedByDate[0].price);
    const latestPrice = parseFloat(sortedByDate[sortedByDate.length - 1].Price || sortedByDate[sortedByDate.length - 1].price);
    if (!isNaN(earliestPrice) && !isNaN(latestPrice) && earliestPrice !== 0) {
      const percentageReturn = ((latestPrice - earliestPrice) / earliestPrice * 100).toFixed(2);
      allTimeReturn = percentageReturn >= 0 ? `+${percentageReturn}%` : `${percentageReturn}%`;
    }
  }

  // Performance Period Boxes (ordered: 1WK, 4WK, 3MO, 6MO, YTD, 1YR, All-Time)
  const periodOrder = ['1WK', '4WK', '3MO', '6MO', 'YTD', '1YR', 'All-Time'];
  if (performanceData && Object.keys(performanceData).length > 0 || allTimeReturn !== 'N/A') {
    performanceHtml = `
      <div class="performance-periods">
        <h4>Performance Periods</h4>
        <div class="period-boxes">
          ${periodOrder.map(period => {
            if (period === 'All-Time') {
              const isPositive = allTimeReturn.startsWith('+');
              const boxClass = allTimeReturn === 'N/A' ? '' : isPositive ? 'positive' : 'negative';
              return `
                <div class="period-box ${boxClass}" data-period="All-Time">
                  <span class="period-label">All-Time</span>
                  <span class="period-value">${allTimeReturn}</span>
                </div>
              `;
            }
            const value = performanceData[period] || 'N/A';
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
  }

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
      createStockChart(data, period);
    });
  });

  // Initialize chart with All-Time view
  createStockChart(data, 'All-Time');
}

function createStockChart(data, selectedPeriod = 'All-Time') {
  const ticker = data.ticker;
  const priceData = data.data.price || [];
  const chartContainer = document.getElementById('stock-chart-container');
  
  if (!chartContainer.querySelector('canvas')) {
    chartContainer.innerHTML = '<canvas id="stock-price-chart"></canvas>';
  }

  const ctx = document.getElementById('stock-price-chart').getContext('2d');

  if (stockChart) {
    stockChart.destroy();
  }

  // Sort price data by date
  const sortedData = [...priceData].sort((a, b) => new Date(a.Date || a.date) - new Date(b.Date || b.date));

  // Filter data by selected period
  const now = new Date();
  let filteredData = sortedData;
  if (selectedPeriod !== 'All-Time') {
    const periods = {
      '1WK': 7 * 24 * 60 * 60 * 1000, // 7 days
      '4WK': 28 * 24 * 60 * 60 * 1000, // 28 days
      '3MO': 90 * 24 * 60 * 60 * 1000, // 90 days
      '6MO': 180 * 24 * 60 * 60 * 1000, // 180 days
      'YTD': (() => {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return now - startOfYear;
      })(),
      '1YR': 365 * 24 * 60 * 60 * 1000 // 365 days
    };
    const timeRange = periods[selectedPeriod];
    filteredData = sortedData.filter(p => {
      const date = new Date(p.Date || p.date);
      return (now - date) <= timeRange;
    });
  }

  // Extract labels and prices
  const labels = filteredData.map(p => new Date(p.Date || p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  const prices = filteredData.map(p => p.Price || p.price);

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
        tension: 0.4,
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
