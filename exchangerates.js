Chart.register(window.ChartZoom);
let charts = {};
let exchangeRateData = null;
let allCurrencies = [];
let sortedData = [];
const defaultCurrencies = ["US DOLLAR", "EURO", "STG POUND"];

document.addEventListener('DOMContentLoaded', () => {
    loadExchangeRateData();
});

async function loadExchangeRateData() {
    try {
        const [historicalData, tradeWeightedData] = await Promise.all([
            loadCSVFile('data/historical_data.csv'),
            loadExcelFile('data/TRADE WEIGHTED AVERAGE INDICATIVE RATES.xlsx')
        ]);
        
        const processedHistoricalData = processHistoricalData(historicalData);
        const processedTradeWeightedData = processTradeWeightedData(tradeWeightedData);
        const combinedData = [...processedHistoricalData, ...processedTradeWeightedData];
        
        processExchangeRateData(combinedData, 'exchange-rate-chart', 'exchange-rate-table');
    } catch (error) {
        console.error('Failed to load exchange rate data:', error);
    }
}

// ===== CSV + Excel loaders (same as before) =====
function splitCSVRow(row) {
    return row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(col => col.trim().replace(/^"|"$/g, ''));
}

function loadCSVFile(filePath) {
    return fetch(filePath)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.text();
        })
        .then(csvText => {
            const rows = csvText.trim().split('\n').filter(line => line.trim().length > 0);
            if (rows.length > 0) {
                const firstCols = splitCSVRow(rows[0]);
                if (firstCols.some(c => /Date|Currency|Mean|Buy|Sell/i.test(c))) {
                    rows.shift();
                }
            }
            return rows.map(row => {
                const columns = splitCSVRow(row);
                if (columns.length < 3) return null;
                return {
                    Date: columns[0],
                    Currency: columns[1],
                    Mean: columns[2],
                    Buy: columns[3] || '',
                    Sell: columns[4] || ''
                };
            }).filter(r => r && r.Date && r.Currency && r.Mean);
        });
}

function loadExcelFile(filePath) {
    return fetch(filePath)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.arrayBuffer();
        })
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        });
}

// ===== Date parsers + cleaners (same as before) =====
function parseHistoricalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    dateStr = dateStr.trim();
    let sep = '/';
    if (dateStr.includes('-')) sep = '-';
    const parts = dateStr.split(sep).map(p => p.trim());
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
                return new Date(year, month - 1, 1);
            }
        } else {
            const month = parseInt(parts[0], 10);
            const day = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (!isNaN(month) && !isNaN(day) && !isNaN(year) && month >= 1 && month <= 12) {
                return new Date(year, month - 1, 1);
            }
        }
    } else if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt(parts[1], 10);
        if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
            return new Date(year, month - 1, 1);
        }
    }
    return null;
}

function parseTradeWeightedDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    dateStr = dateStr.trim();
    let sep = '/';
    if (dateStr.includes('-')) sep = '-';
    const parts = dateStr.split(sep).map(p => p.trim());
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            if (!isNaN(year) && !isNaN(month)) return new Date(year, month - 1, 1);
        } else {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
                return new Date(year, month - 1, 1);
            }
        }
    } else if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt(parts[1], 10);
        if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
            return new Date(year, month - 1, 1);
        }
    }
    return null;
}

function cleanCurrencyName(name) {
    if (!name) return '';
    return name.toString()
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, '/')
        .trim()
        .toUpperCase();
}

// ===== Data processors (same as before) =====
function processHistoricalData(csvData) {
    const monthlyData = {};
    csvData.forEach(row => {
        const date = parseHistoricalDate(row.Date);
        if (!date) return;
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        const currency = cleanCurrencyName(row.Currency);
        const meanString = String(row.Mean).trim().replace(/[, ]+/g, '').replace(/[^\d.\-]/g, '');
        const mean = parseFloat(meanString);
        if (isNaN(mean)) return;
        const key = `${currency}_${monthYear}`;
        if (!monthlyData[key]) {
            monthlyData[key] = { currency, monthYear, date, rates: [] };
        }
        monthlyData[key].rates.push(mean);
    });
    const result = Object.values(monthlyData).map(item => ({
        Currency: item.currency,
        Date: item.monthYear,
        ExchangeRate: parseFloat((item.rates.reduce((s, r) => s + r, 0) / item.rates.length).toFixed(2)),
        sortDate: item.date,
        Source: 'CSV'
    }));
    console.log('Processed historical CSV rows:', result.length);
    return result;
}

function processTradeWeightedData(excelData) {
    const monthlyData = {};
    excelData.forEach(row => {
        let parsedDate = null;
        if (row.Date instanceof Date && !isNaN(row.Date)) {
            parsedDate = new Date(row.Date.getFullYear(), row.Date.getMonth(), 1);
        } else {
            parsedDate = parseTradeWeightedDate(String(row.Date));
        }
        if (!parsedDate || !row.Currency) return;
        const monthYear = `${parsedDate.getMonth() + 1}/${parsedDate.getFullYear()}`;
        const currency = cleanCurrencyName(row.Currency);
        const rate = parseFloat(String(row['EXCHANGE RATE']).replace(/[, ]+/g, ''));
        if (isNaN(rate)) return;
        const key = `${currency}_${monthYear}`;
        if (!monthlyData[key]) {
            monthlyData[key] = { currency, monthYear, date: parsedDate, rates: [] };
        }
        monthlyData[key].rates.push(rate);
    });
    const result = Object.values(monthlyData).map(item => ({
        Currency: item.currency,
        Date: item.monthYear,
        ExchangeRate: parseFloat((item.rates.reduce((s, r) => s + r, 0) / item.rates.length).toFixed(2)),
        sortDate: item.date,
        Source: 'Excel'
    }));
    console.log('Processed trade-weighted Excel rows:', result.length);
    return result;
}

// ===== Main processor with checkbox controls =====
function processExchangeRateData(combinedData, chartId, tableId) {
    sortedData = combinedData.sort((a, b) => a.sortDate - b.sortDate);
    console.table(sortedData, ["Date", "Currency", "ExchangeRate", "Source"]);

    allCurrencies = [...new Set(sortedData.map(item => item.Currency))].sort();
    const allDates = [...new Set(sortedData.map(item => item.Date))];
    allDates.sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
        return yearA - yearB || monthA - monthB;
    });

    createCurrencyControls(chartId, allDates);
    updateChart(chartId, allDates, defaultCurrencies);

    const headers = ['Date', 'Currency', 'Exchange Rate'];
    renderTable(tableId, headers, sortedData.map(item => ({
        'Date': item.Date,
        'Currency': item.Currency,
        'Exchange Rate': item.ExchangeRate.toFixed(2)
    })));
}

// ===== Chart & controls =====
function createCurrencyControls(chartId, allDates) {
    const controlsDiv = document.getElementById("currency-controls");
    if (!controlsDiv) return;
    controlsDiv.innerHTML = "";
    allCurrencies.forEach(currency => {
        const label = document.createElement("label");
        label.style.display = "block";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = currency;
        checkbox.checked = defaultCurrencies.includes(currency);
        checkbox.addEventListener("change", () => {
            const checkedCurrencies = Array.from(
                document.querySelectorAll("#currency-controls input:checked")
            ).map(cb => cb.value);
            updateChart(chartId, allDates, checkedCurrencies);
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(" " + currency));
        controlsDiv.appendChild(label);
    });
}

function updateChart(chartId, allDates, selectedCurrencies) {
    const colors = [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
    ];
    const datasets = selectedCurrencies.map((currency, index) => {
        const currencyData = sortedData.filter(item => item.Currency === currency);
        const dataPoints = allDates.map(date => {
            const dataPoint = currencyData.find(item => item.Date === date);
            return dataPoint ? dataPoint.ExchangeRate : null;
        });
        return {
            label: currency,
            data: dataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length],
            fill: false,
            tension: 0.4,
            pointRadius: 0
        };
    });
    renderMultiLineChart(chartId, allDates, datasets);
}

function renderMultiLineChart(chartId, labels, datasets) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    charts[chartId] = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { title: { display: true, text: 'Date (Month/Year)' } },
                y: { title: { display: true, text: 'Exchange Rate' } }
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
                        mode: 'x',
                    }
                }
            }
        }
    });
}

// ===== Table (unchanged) =====
function renderTable(tableId, headers, data) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.innerHTML = '';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}
