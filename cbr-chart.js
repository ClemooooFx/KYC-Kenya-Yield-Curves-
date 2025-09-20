// cbr-chart.js

Chart.register(window.ChartZoom);
let charts = {};
let tBillsData = null;
let tBondsData = null;
let pinnedCurveData = null;
let cbrData = null;
let cbrChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplay('data/Treasury Bills Average Rates.xlsx', 't-bills-chart', 't-bills-table');
    loadAndDisplay('data/Issues of Treasury Bonds.xlsx', 't-bonds-chart', 't-bonds-table');
    loadAndDisplay('data/Central Bank Rate (CBR).xlsx', 'cbr-chart', 'cbr-table');
    
});

function loadAndDisplay(filePath, chartId, tableId) {
    fetch(filePath)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.arrayBuffer();
        })
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            if (filePath.includes('Treasury Bills Average Rates.xlsx')) {
                processTBillData(worksheet, chartId, tableId);
            } else if (filePath.includes('Issues of Treasury Bonds.xlsx')) {
                processTBondData(worksheet, chartId, tableId);
            } else if (filePath.includes('Central Bank Rate (CBR).xlsx')) {
                processCBRData(worksheet, chartId, tableId);
            } 
        })
        .catch(error => console.error(`Failed to load or parse the file at ${filePath}:`, error));
}

function processCBRData(jsonData, chartId, tableId) {
    const dates = jsonData.map(row => {
        const dateParts = row['Date'].split('/');
        const date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
    });

    const rates = jsonData.map(row => parseFloat(row['Rate']));

    const datasets = [{
        label: 'Central Bank Rate',
        data: rates,
        borderColor: '#4e79a7',
        fill: false,
        stepped: 'after',
        tension: 0,
        pointRadius: 0
    }];

    renderCBRChart(chartId, dates, datasets);
    const headers = ['Date', 'Rate'];
    renderTable(tableId, headers, jsonData);
}

function renderCBRChart(chartId, labels, datasets) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }

    const steppedDatasets = datasets.map(dataset => ({
        ...dataset,
        stepped: 'after',
        tension: 0,
    }));

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
                        display: true,
                        text: 'Date (Month/Year)'
                    }
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
                }
            }
        }
    });
}
