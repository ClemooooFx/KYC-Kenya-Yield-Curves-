// Debug version of compare.js
Chart.register(window.chartjsPluginZoom);
let compareChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Compare page loaded');
    
    // Wait a bit for inflation.js to load
    setTimeout(async () => {
        console.log('Checking for InflationDataLoader:', window.InflationDataLoader);
        
        if (window.InflationDataLoader) {
            console.log('Loading inflation data...');
            await window.InflationDataLoader.loadData();
            console.log('Inflation data loaded:', window.InflationDataLoader.getData());
        } else {
            console.error('InflationDataLoader not found');
        }
        
        // Initialize empty chart
        initializeCompareChart();
        
        // Add checkbox listeners
        setupCheckboxListeners();
        
        // Add control button listeners
        setupControlButtons();
    }, 1000);
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
    }
}

function setupControlButtons() {
    // Clear All button
    document.getElementById('clear-all').addEventListener('click', () => {
        console.log('Clear all clicked');
        compareChart.data.datasets = [];
        compareChart.data.labels = [];
        compareChart.update();
        
        // Uncheck all checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    
    // Reset Zoom button
    document.getElementById('reset-zoom').addEventListener('click', () => {
        console.log('Reset zoom clicked');
        compareChart.resetZoom();
    });
}

function addInflationSeries(type) {
    console.log('Adding inflation series:', type);
    
    const inflationData = window.InflationDataLoader.getData();
    if (!inflationData) {
        console.error('No inflation data available');
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
            pointRadius: 2,
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
            pointRadius: 2,
            fill: false
        };
    }
    
    // Set labels if chart is empty
    if (compareChart.data.labels.length === 0) {
        compareChart.data.labels = inflationData.labels;
    }
    
    // Check if dataset already exists
    const existingIndex = compareChart.data.datasets.findIndex(d => d.label === dataset.label);
    if (existingIndex === -1) {
        compareChart.data.datasets.push(dataset);
        console.log('Dataset added:', dataset.label);
    }
    
    compareChart.update();
    console.log('Chart updated');
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
    
    console.log('Compare chart initialized:', compareChart);
}
