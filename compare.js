// compare.js (Corrected initialization)
let compareChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Compare page loaded');
    
    if (window.InflationDataLoader) {
        console.log('Starting data load...');
        // CRUCIAL: AWAIT the data load here before doing anything else.
        await window.InflationDataLoader.loadData(); 
        console.log('Inflation data loaded (status check):', window.InflationDataLoader.isLoaded());
    } else {
        console.error('InflationDataLoader not found. Check script loading order.');
    }
    
    // Initialize chart and setup listeners *after* data load attempt
    initializeCompareChart();
    setupCheckboxListeners();
    setupControlButtons();
});

function setupCheckboxListeners() {
    console.log('Setting up checkbox listeners');
    
    // CPI YoY checkbox
    const cpiYoyCheckbox = document.getElementById('cpi-yoy');
    if (cpiYoyCheckbox) {
        cpiYoyCheckbox.addEventListener('change', (e) => {
            console.log('CPI YoY checkbox changed:', e.target.checked);
            if (e.target.checked) {
                addInflationSeries('monthly');
            } else {
                removeInflationSeries('12-Month Inflation');
            }
        });
    } else {
        console.error('CPI YoY checkbox not found');
    }
    
    // CPI Annual Average checkbox  
    const cpiAnnualCheckbox = document.getElementById('cpi-annual');
    if (cpiAnnualCheckbox) {
        cpiAnnualCheckbox.addEventListener('change', (e) => {
            console.log('CPI Annual checkbox changed:', e.target.checked);
            if (e.target.checked) {
                addInflationSeries('annual');
            } else {
                removeInflationSeries('Annual Average Inflation');
            }
        });
    } else {
        console.error('CPI Annual checkbox not found');
    }
}

function setupControlButtons() {
    // Clear All button
    const clearBtn = document.getElementById('clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            console.log('Clear all clicked');
            compareChart.data.datasets = [];
            compareChart.data.labels = [];
            compareChart.update();
            
            // Uncheck all checkboxes
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        });
    }
    
    // Reset Zoom button (disabled for now)
    const resetBtn = document.getElementById('reset-zoom');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log('Reset zoom clicked - zoom not available');
            // compareChart.resetZoom(); // Disabled until zoom works
        });
    }
}

function addInflationSeries(type) {
    console.log('Adding inflation series:', type);
    
    if (!window.InflationDataLoader) {
        console.error('InflationDataLoader not available');
        return;
    }
    
    const inflationData = window.InflationDataLoader.getData();
    // This is the line that's failing. It means globalInflationData is NULL.
    if (!inflationData) { 
        console.error('No inflation data available. Data loading must have failed or not completed.');
        return;
    }
    
    console.log('Inflation data available:', inflationData);
    
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
    
    // Set labels if chart is empty
    if (compareChart.data.labels.length === 0) {
        compareChart.data.labels = inflationData.labels;
        console.log('Set chart labels:', inflationData.labels.length, 'dates');
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

function removeInflationSeries(label) {
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
    
    console.log('Canvas found, creating chart context');
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
                legend: {
                    display: true,
                    position: 'top'
                }
                // Removed zoom plugin for now
            }
        }
    });
    
    console.log('Compare chart initialized successfully');
}
