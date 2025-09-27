Chart.register(window.chartjsPluginZoom);
let compareChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Load inflation data
    await window.InflationDataLoader.loadData();
    
    // Initialize empty chart
    initializeCompareChart();
    
    // Add checkbox listeners
    setupCheckboxListeners();
});

function setupCheckboxListeners() {
    // CPI YoY checkbox
    document.getElementById('cpi-yoy').addEventListener('change', (e) => {
        if (e.target.checked) {
            addInflationSeries('monthly');
        } else {
            removeInflationSeries('12-Month Inflation');
        }
    });
    
    // CPI Annual Average checkbox  
    document.getElementById('cpi-annual').addEventListener('change', (e) => {
        if (e.target.checked) {
            addInflationSeries('annual');
        } else {
            removeInflationSeries('Annual Average Inflation');
        }
    });
}

function addInflationSeries(type) {
    const inflationData = window.InflationDataLoader.getData();
    if (!inflationData) return;
    
    let dataset;
    if (type === 'monthly') {
        dataset = {
            label: '12-Month Inflation',
            data: inflationData.monthlyInflation,
            borderColor: '#4e79a7',
            backgroundColor: '#4e79a7',
            type: 'line',
            tension: 0.4,
            pointRadius: 2
        };
    } else if (type === 'annual') {
        dataset = {
            label: 'Annual Average Inflation',
            data: inflationData.annualInflation,
            borderColor: '#f28e2c',
            backgroundColor: '#f28e2c', 
            type: 'line',
            tension: 0.4,
            pointRadius: 2
        };
    }
    
    compareChart.data.labels = inflationData.labels;
    compareChart.data.datasets.push(dataset);
    compareChart.update();
}

function removeInflationSeries(label) {
    compareChart.data.datasets = compareChart.data.datasets.filter(
        dataset => dataset.label !== label
    );
    compareChart.update();
}

function initializeCompareChart() {
    const ctx = document.getElementById('compare-chart').getContext('2d');
    
    compareChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Rate (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date (Month/Year)'
                    }
                }
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
