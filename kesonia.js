Chart.register(window.ChartZoom);
let charts = {};
let kesoniaData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadKesoniaData();
});

async function loadKesoniaData() {
    try {
        // Load both files
        const [interbankData, kesoniaFileData] = await Promise.all([
            loadExcelFile('data/Interbank Rates.xlsx'),
            loadExcelFile('data/KESONIA.xlsx')
        ]);
        
        // Combine the datasets
        const combinedData = [...interbankData, ...kesoniaFileData];
        
        // Sort by date
        const sortedData = combinedData.sort((a, b) => {
            const dateA = parseDate(a['Date']);
            const dateB = parseDate(b['Date']);
            return dateA - dateB;
        });
        
        // Process and display the data
        processKesoniaData(sortedData, 'kesonia-chart', 'kesonia-table');
        
    } catch (error) {
        console.error('Failed to load Kesonia data:', error);
    }
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

function parseDate(dateStr) {
    const dateParts = dateStr.split('/');
    return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
}

function processKesoniaData(jsonData, chartId, tableId) {
    // Group data by month/year and calculate monthly averages
    const monthlyData = {};
    
    jsonData.forEach(row => {
        const date = parseDate(row['Date']);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        const rate = parseFloat(row['Rate']);
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = {
                rates: [],
                date: date
            };
        }
        monthlyData[monthYear].rates.push(rate);
    });
    
    // Calculate averages and prepare chart data
    const chartData = [];
    Object.keys(monthlyData).forEach(monthYear => {
        const rates = monthlyData[monthYear].rates;
        const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        chartData.push({
            monthYear: monthYear,
            average: parseFloat(average.toFixed(2)),
            date: monthlyData[monthYear].date
        });
    });
    
    // Sort by date
    chartData.sort((a, b) => a.date - b.date);
    
    // Extract labels and data for chart
    const dates = chartData.map(item => item.monthYear);
    const averages = chartData.map(item => item.average);
    
    const datasets = [{
        label: 'Kesonia Rate (Monthly Average)',
        data: averages,
        borderColor: '#4e79a7',
        backgroundColor: '#4e79a7',
        fill: false,
        stepped: 'after',
        tension: 0,
        pointRadius: 0,
        pointBackgroundColor: '#4e79a7'
    }];
    
    renderKesoniaChart(chartId, dates, datasets);
    
    // Prepare table data
    const tableData = chartData.map(item => ({
        'Date': item.monthYear,
        'Average Rate': item.average.toFixed(2)
    }));
    
    const headers = ['Date', 'Average Rate'];
    renderTable(tableId, headers, tableData);
}

function renderKesoniaChart(chartId, labels, datasets) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    const steppedDatasets = datasets.map(dataset => ({
        ...dataset,
        stepped: 'after',
        tension: 0,
    }));
    
    // Calculate the maximum index for the x-axis
    // Add a value to the last index to create space
    const maxIndex = labels.length - 1 + 1; // You can adjust the '1' to a larger number for more space
    
    charts[chartId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: steppedDatasets,
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
                        display: false,
                        text: 'Date (Month/Year)'
                    },
                    // Set the maximum value of the scale to create space on the right
                    max: maxIndex,
                    // min: 0 // Optional, to ensure it starts from the first point
                },
                y: {
                    title: {
                        display: true,
                        text: 'Rate (%)'
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
                                label += `${context.parsed.y.toFixed(2)}%`;
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
                            enabled: true,
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
