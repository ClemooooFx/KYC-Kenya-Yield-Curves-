// compare.js - Updated with CBWAR support
Chart.register(window.ChartZoom);
let compareChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Compare page loaded');
    
    // Load all available data sources
    const loaders = [
        { loader: window.InflationDataLoader, name: 'Inflation' },
        { loader: window.CBWARDataLoader, name: 'CBWAR' }
    ];
    
    for (const { loader, name } of loaders) {
        if (loader) {
            try {
                await loader.loadData();
                console.log(`${name} data loaded successfully`);
            } catch (error) {
                console.error(`Failed to load ${name} data:`, error);
            }
        } else {
            console.log(`${name} loader not found`);
        }
    }
    
    initializeCompareChart();
    setupAllCheckboxListeners();
    setupControlButtons();
});

function setupAllCheckboxListeners() {
    setupInflationCheckboxes();
    setupCBWARCheckboxes();
}

function setupInflationCheckboxes() {
    console.log('Setting up inflation checkbox listeners');
    
    const cpiYoyCheckbox = document.getElementById('cpi-yoy');
    if (cpiYoyCheckbox) {
        cpiYoyCheckbox.addEventListener('change', (e) => {
            console.log('CPI YoY checkbox changed:', e.target.checked);
            if (e.target.checked) {
                addInflationSeries('monthly');
            } else {
                removeSeriesByLabel('12-Month Inflation');
            }
        });
    }
    
    const cpiAnnualCheckbox = document.getElementById('cpi-annual');
    if (cpiAnnualCheckbox) {
        cpiAnnualCheckbox.addEventListener('change', (e) => {
            console.log('CPI Annual checkbox changed:', e.target.checked);
            if (e.target.checked) {
                addInflationSeries('annual');
            } else {
                removeSeriesByLabel('Annual Average Inflation');
            }
        });
    }
}

function setupCBWARCheckboxes() {
    console.log('Setting up CBWAR checkbox listeners');
    
    const rateTypes = ['lending', 'overdraft', 'savings', 'deposit'];
    
    rateTypes.forEach(rateType => {
        const checkbox = document.getElementById(rateType);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                console.log(`${rateType} checkbox changed:`, e.target.checked);
                if (e.target.checked) {
                    addCBWARSeries(rateType);
                } else {
                    removeSeriesByLabel(rateType.charAt(0).toUpperCase() + rateType.slice(1));
                }
            });
        } else {
            console.error(`${rateType} checkbox not found`);
        }
    });
}

function setupControlButtons() {
    const clearBtn = document.getElementById('clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            console.log('Clear all clicked');
            compareChart.data.datasets = [];
            compareChart.data.labels = [];
            compareChart.update();
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        });
    }
    
    const resetZoomBtn = document.getElementById('reset-zoom');
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            if (compareChart) {
                compareChart.resetZoom();
            }
        });
    }
}

function addInflationSeries(type) {
    console.log('Adding inflation series:', type);
    
    if (!window.InflationDataLoader || !window.InflationDataLoader.getData()) {
        console.error('Inflation data not available');
        return;
    }
    
    const inflationData = window.InflationDataLoader.getData();
    
    let dataset;
    if (type === 'monthly') {
        dataset = {
            label: '12-Month Inflation',
            data: inflationData.monthlyInflation,
            borderColor: '#4e79a7',
            backgroundColor: '#4e79a7',
            type: 'line',
            tension: 0.4,
            pointRadius: 0,
            fill: false
        };
    } else if (type === 'annual') {
        dataset = {
            label: 'Annual Average Inflation',
            data: inflationData.annualInflation,
            borderColor: '#f28e2c',
            backgroundColor: '#f28e2c',
            type: 'line',
            tension: 0.4,
            pointRadius: 0,
            fill: false
        };
    }
    
    if (inflationData.labels) {
    addDatasetToChart(dataset, inflationData.labels);
    } else {
    console.error('Inflation data missing labels:', inflationData);
    }
}

function addCBWARSeries(rateType) {
    console.log('Adding CBWAR series:', rateType);
    
    if (!window.CBWARDataLoader || !window.CBWARDataLoader.getData()) {
        console.error('CBWAR data not available');
        return;
    }
    
    const rateData = window.CBWARDataLoader.getRateData(rateType);
    if (!rateData) {
        console.error(`No data found for rate type: ${rateType}`);
        return;
    }
    
    const dataset = {
        label: rateType.charAt(0).toUpperCase() + rateType.slice(1),
        data: rateData.data,
        borderColor: rateData.color,
        backgroundColor: rateData.color,
        type: 'line',
        tension: 0.4,
        pointRadius: 0,
        fill: false
    };
    
    addDatasetToChart(dataset, rateData.labels);
}

function addDatasetToChart(dataset, dataLabels) {
    // Set labels if chart is empty, or merge if different
    if (compareChart.data.labels.length === 0) {
        compareChart.data.labels = dataLabels;
        console.log('Set chart labels:', dataLabels.length, 'dates');
    } else if (JSON.stringify(compareChart.data.labels) !== JSON.stringify(dataLabels)) {
        // Handle different date ranges - for now, we'll use the longer range
        if (dataLabels.length > compareChart.data.labels.length) {
            console.log('Updating chart labels to longer range');
            compareChart.data.labels = dataLabels;
            // Note: This might require re-aligning existing datasets
        }
    }
    
    // Check if dataset already exists
    const existingIndex = compareChart.data.datasets.findIndex(d => d.label === dataset.label);
    if (existingIndex === -1) {
        compareChart.data.datasets.push(dataset);
        console.log('Dataset added:', dataset.label, 'with', dataset.data.length, 'data points');
    } else {
        console.log('Dataset already exists:', dataset.label);
    }
    
    compareChart.update();
    console.log('Chart updated, total datasets:', compareChart.data.datasets.length);
}

function removeSeriesByLabel(label) {
    console.log('Removing series:', label);
    
    const initialLength = compareChart.data.datasets.length;
    compareChart.data.datasets = compareChart.data.datasets.filter(
        dataset => dataset.label !== label
    );
    
    console.log(`Removed ${initialLength - compareChart.data.datasets.length} datasets`);
    compareChart.update();
}

function initializeCompareChart() {
    console.log('Initializing compare chart');
    
    const canvas = document.getElementById('compare-chart');
    if (!canvas) {
        console.error('Compare chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    compareChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Rate (%)'
                    },
                    beginAtZero: true
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date (Month/Year)'
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
                        wheel: { enabled: true },
                        drag: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    }
                }
            }
        }
    });
    
    console.log('Compare chart initialized successfully');
}
