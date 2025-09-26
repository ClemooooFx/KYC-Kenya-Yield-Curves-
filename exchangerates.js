Chart.register(window.ChartZoom);
let charts = {};
let exchangeRateData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadExchangeRateData();
});

async function loadExchangeRateData() {
    try {
        // Load both files
        const [historicalData, tradeWeightedData] = await Promise.all([
            loadCSVFile('data/historical_data.csv'),
            loadExcelFile('data/TRADE WEIGHTED AVERAGE INDICATIVE RATES.xlsx')
        ]);
        
        // Process historical CSV data
        const processedHistoricalData = processHistoricalData(historicalData);
        
        // Process trade weighted Excel data
        const processedTradeWeightedData = processTradeWeightedData(tradeWeightedData);
        
        // Combine the datasets
        const combinedData = [...processedHistoricalData, ...processedTradeWeightedData];
        
        // Process and display the data
        processExchangeRateData(combinedData, 'exchange-rate-chart', 'exchange-rate-table');
        
    } catch (error) {
        console.error('Failed to load exchange rate data:', error);
    }
}

function loadCSVFile(filePath) {
    return fetch(filePath)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.text();
        })
        .then(csvText => {
            // Parse CSV manually since there are no headers
            const rows = csvText.trim().split('\n').filter(line => line.trim().length > 0); // Filter empty lines

            return rows.map(row => {
                // Use a regex for a more robust split, accommodating possible extra spaces
                const columns = row.split(',').map(col => col.trim()); 
                
                // Assuming exactly 5 columns: Date, Currency, Mean, Buy, Sell
                if (columns.length < 5) {
                    // console.warn('Skipping row with insufficient columns:', row); // Optional debugging
                    return null;
                }
                
                return {
                    Date: columns[0],
                    Currency: columns[1],
                    Mean: columns[2],
                    Buy: columns[3],
                    Sell: columns[4]
                };
            }).filter(row => row && row.Date && row.Currency && row.Mean); // Filter out rows that are null or missing key data
        });
}

function loadExcelFile(filePath) {
    return fetch(filePath)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.arrayBuffer();
        })
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        });
}

function isValidDate(dateStr) {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

function parseHistoricalDate(dateStr) {
    // Format: mm/dd/yyyy
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return null;
    
    const month = parseInt(dateParts[0]);
    const day = parseInt(dateParts[1]);
    const year = parseInt(dateParts[2]);
    
    // Validate date components
    if (isNaN(month) || isNaN(day) || isNaN(year) || 
        month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
        return null;
    }
    
    const date = new Date(year, month - 1, day);
    return isValidDate(date) ? date : null;
}

function parseTradeWeightedDate(dateStr) {
    // Format: dd/mm/yyyy
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const year = parseInt(dateParts[2]);
    
    // Validate date components
    if (isNaN(day) || isNaN(month) || isNaN(year) || 
        month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
        return null;
    }
    
    const date = new Date(year, month - 1, day);
    return isValidDate(date) ? date : null;
}

function processHistoricalData(csvData) {
    const monthlyData = {};
    
    csvData.forEach(row => {
        // 1. Validate and clean Date
        const date = parseHistoricalDate(row.Date);
        if (!date || !row.Currency) return;
        
        // 2. Clean and validate Mean value
        // Remove all non-numeric characters except for the decimal point and a leading minus sign
        const meanString = String(row.Mean).trim().replace(/[^\d.]/g, ''); 
        const mean = parseFloat(meanString);
        
        if (isNaN(mean)) {
             // console.warn(`Skipping row due to invalid Mean: ${row.Mean}`); // Optional debugging
             return; 
        }

        // 3. Aggregate by month/year
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        const currency = row.Currency;
        
        const key = `${currency}_${monthYear}`;
        
        if (!monthlyData[key]) {
            // Store the Date object corresponding to the *first* date encountered for sorting
            // The first day of the month is a better, canonical sort date
            const canonicalDate = new Date(date.getFullYear(), date.getMonth(), 1); 
            
            monthlyData[key] = {
                currency: currency,
                monthYear: monthYear,
                date: canonicalDate, 
                rates: []
            };
        }
        monthlyData[key].rates.push(mean);
    });
    
    // Calculate monthly averages
    return Object.values(monthlyData).map(item => ({
        Currency: item.currency,
        Date: item.monthYear,
        ExchangeRate: parseFloat((item.rates.reduce((sum, rate) => sum + rate, 0) / item.rates.length).toFixed(2)),
        sortDate: item.date // Use the canonical date for sorting
    }));
}

function processTradeWeightedData(excelData) {
    const monthlyData = {};
    
    excelData.forEach(row => {
        const date = parseTradeWeightedDate(row.Date);
        if (!date || !row.Currency || !row['EXCHANGE RATE']) return;
        
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        const currency = row.Currency;
        const exchangeRate = parseFloat(row['EXCHANGE RATE']);
        
        if (isNaN(exchangeRate)) return;
        
        const key = `${currency}_${monthYear}`;
        
        if (!monthlyData[key]) {
            monthlyData[key] = {
                currency: currency,
                monthYear: monthYear,
                date: date,
                rates: []
            };
        }
        monthlyData[key].rates.push(exchangeRate);
    });
    
    // Calculate monthly averages
    return Object.values(monthlyData).map(item => ({
        Currency: item.currency,
        Date: item.monthYear,
        ExchangeRate: parseFloat((item.rates.reduce((sum, rate) => sum + rate, 0) / item.rates.length).toFixed(2)),
        sortDate: item.date
    }));
}

function processExchangeRateData(combinedData, chartId, tableId) {
    // Sort all data by date
    const sortedData = combinedData.sort((a, b) => a.sortDate - b.sortDate);
    
    // Get unique currencies and dates
    const currencies = [...new Set(sortedData.map(item => item.Currency))];
    const allDates = [...new Set(sortedData.map(item => item.Date))];
    
    // Sort dates chronologically
    allDates.sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
        return yearA - yearB || monthA - monthB;
    });
    
    // Create datasets for each currency
    const colors = [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
    ];
    
    const datasets = currencies.map((currency, index) => {
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
            pointRadius: 2,
            pointBackgroundColor: colors[index % colors.length]
        };
    });
    
    renderMultiLineChart(chartId, allDates, datasets);
    
    // Prepare table data
    const headers = ['Date', 'Currency', 'Exchange Rate'];
    renderTable(tableId, headers, sortedData.map(item => ({
        'Date': item.Date,
        'Currency': item.Currency,
        'Exchange Rate': item.ExchangeRate.toFixed(2)
    })));
}

function renderMultiLineChart(chartId, labels, datasets) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }

    const smoothDatasets = datasets.map(dataset => {
        return {
            ...dataset,
            tension: 0.4
        };
    });

    charts[chartId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: smoothDatasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date (Month/Year)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Exchange Rate'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `${context.parsed.y.toFixed(2)}`;
                            }
                            return label;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        drag: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    }
                }
            }
        }
    });
}

function renderTable(tableId, headers, data) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // Clear existing content
    table.innerHTML = '';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
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
