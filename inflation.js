Chart.register(window.ChartZoom);
let charts = {};
let inflationData = null;
let globalInflationData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadInflationData();
});

async function loadInflationData() {
    try {
        const data = await loadExcelFile('data/Inflation Rates.xlsx');
        processInflationData(data, 'inflation-chart', 'inflation-table');
    } catch (error) {
        console.error('Failed to load inflation data:', error);
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

function getMonthNumber(monthName) {
    const months = {
        'january': 1, 'jan': 1,
        'february': 2, 'feb': 2,
        'march': 3, 'mar': 3,
        'april': 4, 'apr': 4,
        'may': 5,
        'june': 6, 'jun': 6,
        'july': 7, 'jul': 7,
        'august': 8, 'aug': 8,
        'september': 9, 'sep': 9, 'sept': 9,
        'october': 10, 'oct': 10,
        'november': 11, 'nov': 11,
        'december': 12, 'dec': 12
    };
    
    if (!monthName) return null;
    const cleanMonth = monthName.toString().toLowerCase().trim();
    return months[cleanMonth] || null;
}

function processInflationData(jsonData, chartId, tableId) {
    console.log('Processing inflation data:', jsonData.length, 'records');
    
    // Process and sort data
    const processedData = jsonData.map(row => {
        const year = parseInt(row['Year']);
        const monthNum = getMonthNumber(row['Month']);
        const annualInflation = parseFloat(row['Annual Average Inflation']);
        const monthlyInflation = parseFloat(row['12-Month Inflation']);
        
        if (!year || !monthNum || isNaN(annualInflation) || isNaN(monthlyInflation)) {
            return null;
        }
        
        // Create date string in mm/yyyy format with zero-padding
        const monthStr = monthNum.toString().padStart(2, '0');
        const dateStr = `${monthStr}/${year}`;
        
        return {
            dateStr: dateStr,
            year: year,
            month: monthNum,
            monthName: row['Month'],
            annualInflation: annualInflation,
            monthlyInflation: monthlyInflation,
            sortDate: new Date(year, monthNum - 1, 1) // For sorting
        };
    }).filter(item => item !== null);
    
    // Sort by date
    processedData.sort((a, b) => a.sortDate - b.sortDate);
    
    console.log('Processed data sample:', processedData.slice(0, 5));
    
    // Extract data for chart
    const labels = processedData.map(item => item.dateStr);
    const monthlyInflationData = processedData.map(item => item.monthlyInflation);
    const annualInflationData = processedData.map(item => item.annualInflation);
    
    // Create datasets
    const datasets = [
        {
            label: '12-Month Inflation',
            type: 'bar',
            data: monthlyInflationData,
            backgroundColor: '#4e79a7',
            borderColor: '#4e79a7',
            borderWidth: 1,
            order: 2,
            yAxisID: 'y'
        },
        {
            label: 'Annual Average Inflation',
            type: 'line',
            data: annualInflationData,
            borderColor: '#f28e2c',
            backgroundColor: '#f28e2c',
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointBackgroundColor: '#f28e2c',
            pointBorderColor: '#f28e2c',
            yAxisID: 'y',
            order: 1
        }
    ];
    
    renderInflationChart(chartId, labels, datasets);
    
    // Prepare table data
    const tableData = processedData.map(item => ({
        'Date': item.dateStr,
        'Month': item.monthName,
        'Year': item.year,
        'Annual Average Inflation': item.annualInflation.toFixed(2) + '%',
        '12-Month Inflation': item.monthlyInflation.toFixed(2) + '%'
    }));
    
    const headers = ['Date', 'Month', 'Year', 'Annual Average Inflation', '12-Month Inflation'];
    renderTable(tableId, headers, tableData);
    globalInflationData = {
        labels: labels,
        monthlyInflation: monthlyInflationData,
        annualInflation: annualInflationData,
        processedData: processedData
    };
}

function renderInflationChart(chartId, labels, datasets) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    // Calculate the maximum index for the x-axis
    const maxIndex = labels.length - 1 + 1;
    
    charts[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets,
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
                    },
                    max: maxIndex
                },
                y: {
                    title: {
                        display: true,
                        text: 'Inflation Rate (%)'
                    },
                    beginAtZero: true
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
                legend: {
                    display: true,
                    position: 'top'
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

window.InflationDataLoader = {
    getData: () => globalInflationData,
    loadData: loadInflationData,
    isLoaded: () => globalInflationData !== null
};
