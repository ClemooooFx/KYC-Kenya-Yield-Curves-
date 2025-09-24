// cbwar-chart.js

Chart.register(window.ChartZoom);
let charts = {};


document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplay('data/Commercial Banks Weighted Average Rates.xlsx', 'cbwar-chart', 'cbwar-table');
});

// Map of month names to their numerical index (1-based)
const monthMap = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
    'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
};

// Data properties to be plotted on the chart
const chartProperties = ['Deposit', 'Savings', 'Lending', 'Overdraft'];
// Colors for each line in the chart
const colors = ['#4A90E2', '#50E3C2', '#F5A623', '#D0021B'];

function loadAndDisplay(filePath, chartId, tableId) {
    fetch(filePath)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.arrayBuffer();
        })
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            processCbwarData(json, chartId, tableId);
        })
        .catch(err => {
            console.error('Error loading or processing file:', err);
        });
}

function processCbwarData(data, chartId, tableId) {
    // Sort data chronologically based on Year and Month
    const sortedData = data.sort((a, b) => {
        const yearA = parseInt(a.Year);
        const yearB = parseInt(b.Year);
        const monthA = monthMap[a.Month.trim()];
        const monthB = monthMap[b.Month.trim()];
        
        if (yearA !== yearB) {
            return yearA - yearB;
        }
        return monthA - monthB;
    });

    const labels = sortedData.map(d => {
        const monthIndex = monthMap[d.Month.trim()];
        const formattedMonth = String(monthIndex).padStart(2, '0');
        return `${formattedMonth}/${d.Year}`;
    });
    
    const datasets = chartProperties.map((prop, index) => {
        return {
            label: prop,
            data: sortedData.map(d => parseFloat(d[prop])),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length],
            fill: false,
            pointRadius: 0,
            pointBackgroundColor: colors[index % colors.length],
            tension: 0.4
        };
    });

    renderMultiLineChart(chartId, labels, datasets);
    // Optional: You can call a function here to render a table with the data
    // renderTable(sortedData, tableId);
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
                        text: 'Weighted Average Rate (%)'
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
                        mode: 'x', // Enable panning along the x-axis
                    },
                    zoom: {
                        wheel: {
                            enabled: true, // Enable zoom via mouse wheel
                        },
                        drag: { // This is the new part for fixing the drag
                            enabled: true, // Enable dragging to pan
                        },
                        pinch: {
                            enabled: true // Enable zoom via pinch gesture
                        },
                        mode: 'x', // Zoom along the x-axis
                        // You can adjust the zoom factor here if needed
                        // speed: 0.1,
                    }
                }
            }
        }
    });
}
