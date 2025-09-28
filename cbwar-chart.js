// cbwar-chart.js - Commercial Banks Weighted Average Rates data loader

// Global Variables
Chart.register(window.ChartZoom);
let cbwarCharts = {};
let globalCBWARData = null;

const CBWAR_FILE_PATH = 'data/Commercial Banks Weighted Average Rates.xlsx';

// Map of month names to their numerical index (1-based)
const monthMap = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
    'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
};

// Data properties and their colors
const chartProperties = ['Deposit', 'Savings', 'Lending', 'Overdraft'];
const colors = ['#4A90E2', '#50E3C2', '#F5A623', '#D0021B'];

/**
 * Loads the Excel file and returns JSON data
 */
function loadExcelFile(filePath) {
    return fetch(filePath)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status} for file: ${filePath}`);
            }
            return res.arrayBuffer();
        })
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            return XLSX.utils.sheet_to_json(sheet);
        });
}

/**
 * Processes the raw CBWAR data into a structured format
 */
function processData(jsonData) {
    console.log('Processing CBWAR data:', jsonData.length, 'records');
    
    // Sort data chronologically
    const sortedData = jsonData.sort((a, b) => {
        const yearA = parseInt(a.Year);
        const yearB = parseInt(b.Year);
        const monthA = monthMap[a.Month.trim()];
        const monthB = monthMap[b.Month.trim()];
        
        if (yearA !== yearB) {
            return yearA - yearB;
        }
        return monthA - monthB;
    });

    // Create labels in mm/yyyy format
    const labels = sortedData.map(d => {
        const monthIndex = monthMap[d.Month.trim()];
        const formattedMonth = String(monthIndex).padStart(2, '0');
        return `${formattedMonth}/${d.Year}`;
    });
    
    // Extract data for each property
    const processedData = {};
    chartProperties.forEach(prop => {
        processedData[prop.toLowerCase()] = sortedData.map(d => parseFloat(d[prop]));
    });

    return {
        labels: labels,
        deposit: processedData.deposit,
        savings: processedData.savings,
        lending: processedData.lending,
        overdraft: processedData.overdraft,
        rawData: sortedData
    };
}

/**
 * Fetches and processes CBWAR data
 */
async function fetchAndProcessData() {
    try {
        const rawJsonData = await loadExcelFile(CBWAR_FILE_PATH);
        return processData(rawJsonData);
    } catch (error) {
        console.error("Error during CBWAR fetch or processing:", error);
        throw error;
    }
}

/**
 * Renders the dedicated CBWAR chart (for individual page)
 */
function renderCBWARChart(data) {
    const chartId = 'cbwar-chart';
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (cbwarCharts[chartId]) {
        cbwarCharts[chartId].destroy();
    }

    const datasets = chartProperties.map((prop, index) => {
        return {
            label: prop,
            data: data[prop.toLowerCase()],
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length],
            fill: false,
            pointRadius: 0,
            pointBackgroundColor: colors[index % colors.length],
            tension: 0.4
        };
    });

    cbwarCharts[chartId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.labels,
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
    
    console.log('CBWAR chart rendered successfully');
}

/**
 * Main public function to load CBWAR data
 */
async function loadCBWARData() {
    if (globalCBWARData) {
        console.log("CBWAR data already loaded from global scope.");
    } else {
        try {
            const data = await fetchAndProcessData();
            globalCBWARData = data;
            console.log("CBWAR data successfully fetched and stored.");
        } catch (error) {
            console.error("Critical error during CBWAR data load:", error);
            throw error;
        }
    }
    
    // Render chart only if on dedicated CBWAR page
    const cbwarChartCanvas = document.getElementById('cbwar-chart');
    if (cbwarChartCanvas) {
        console.log("Rendering chart for dedicated CBWAR page.");
        renderCBWARChart(globalCBWARData);
    }
}

// --- Public Interface ---
window.CBWARDataLoader = {
    getData: () => globalCBWARData,
    isLoaded: () => globalCBWARData !== null,
    loadData: loadCBWARData,
    renderChart: renderCBWARChart,
    
    // Helper function to get specific rate data with color
    getRateData: (rateType) => {
        if (!globalCBWARData) return null;
        
        const colorMap = {
            'deposit': '#4A90E2',
            'savings': '#50E3C2', 
            'lending': '#F5A623',
            'overdraft': '#D0021B'
        };
        
        return {
            labels: globalCBWARData.labels,
            data: globalCBWARData[rateType.toLowerCase()],
            color: colorMap[rateType.toLowerCase()]
        };
    }
};
