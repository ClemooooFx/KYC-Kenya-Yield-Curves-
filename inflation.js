// inflation.js - Central data loading and processing for Inflation data

// Global Variables
Chart.register(window.ChartZoom);
let charts = {};
// We only need one global variable to hold the processed data
let globalInflationData = null;

// The file path for the Excel data
const EXCEL_FILE_PATH = 'data/Inflation Rates.xlsx'; // Adjust path if necessary

/**
 * Helper function to convert month name/abbreviation to a number (1-12).
 */
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

/**
 * Fetches the Excel file and parses it into a JSON array using the XLSX library.
 * @param {string} filePath - The path to the Excel file.
 * @returns {Promise<Array<Object>>} - A promise resolving to the JSON data array.
 */
function loadExcelFile(filePath) {
    return fetch(filePath)
        .then(res => {
            if (!res.ok) {
                // Throw an error with status code if fetch failed
                throw new Error(`HTTP error! Status: ${res.status} for file: ${filePath}`);
            }
            return res.arrayBuffer();
        })
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        });
}

/**
 * Processes the raw JSON data, calculates date strings, and formats the data.
 * NOTE: This function only processes the data, it does not render the chart or table.
 * @param {Array<Object>} jsonData - The raw JSON data from the Excel file.
 * @returns {Object} - An object containing all processed data arrays.
 */
function processData(jsonData) {
    console.log('Processing inflation data:', jsonData.length, 'records');
    
    const processedData = jsonData.map(row => {
        const year = parseInt(row['Year']);
        const monthNum = getMonthNumber(row['Month']);
        const annualInflation = parseFloat(row['Annual Average Inflation']);
        const monthlyInflation = parseFloat(row['12-Month Inflation']);
        
        if (!year || !monthNum || isNaN(annualInflation) || isNaN(monthlyInflation)) {
            return null; // Skip invalid rows
        }
        
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
    
    // Final structured data object for chart and table use
    return {
        labels: processedData.map(item => item.dateStr),
        monthlyInflation: processedData.map(item => item.monthlyInflation),
        annualInflation: processedData.map(item => item.annualInflation),
        processedData: processedData
    };
}

/**
 * Main wrapper function to fetch, process, and set the data.
 * This replaces the undefined fetchAndProcessData() call.
 * @returns {Promise<Object>} - The final processed data object.
 */
async function fetchAndProcessData() {
    try {
        const rawJsonData = await loadExcelFile(EXCEL_FILE_PATH);
        return processData(rawJsonData);
    } catch (error) {
        console.error("Error during fetch or processing:", error);
        throw error;
    }
}

/**
 * Renders the dedicated inflation chart on inflation-rate.html.
 * This is only called when 'inflation-chart' is present in the DOM.
 */
function renderInflationChart(data) {
    const chartId = 'inflation-chart';
    const canvas = document.getElementById(chartId);
    if (!canvas) return; // Safety check
    
    const ctx = canvas.getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    const datasets = [
        {
            label: '12-Month Inflation',
            type: 'bar',
            data: data.monthlyInflation,
            backgroundColor: '#4e79a7',
            borderColor: '#4e79a7',
            order: 2, yAxisID: 'y'
        },
        {
            label: 'Annual Average Inflation',
            type: 'line',
            data: data.annualInflation,
            borderColor: '#f28e2c',
            backgroundColor: '#f28e2c',
            fill: false, tension: 0.4, pointRadius: 0, order: 1, yAxisID: 'y'
        }
    ];

    charts[chartId] = new Chart(ctx, {
        type: 'bar',
        data: { labels: data.labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // ... (rest of your chart options: interaction, scales, plugins)
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

/**
 * Renders the dedicated inflation table on inflation-rate.html.
 */
function renderInflationTable(data) {
    const tableId = 'inflation-table';
    const headers = ['Date', 'Month', 'Year', 'Annual Average Inflation', '12-Month Inflation'];
    const tableData = data.processedData.map(item => ({
        'Date': item.dateStr,
        'Month': item.monthName,
        'Year': item.year,
        'Annual Average Inflation': item.annualInflation.toFixed(2) + '%',
        '12-Month Inflation': item.monthlyInflation.toFixed(2) + '%'
    }));
    // Re-use your generic table rendering function
    renderTable(tableId, headers, tableData); 
}

/**
 * Generic table rendering function (Moved from your original script).
 */
function renderTable(tableId, headers, data) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // Clear existing content and build table...
    table.innerHTML = '';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
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


/**
 * The main public function called by both inflation-rate.html and compare.html.
 */
async function loadInflationData() {
    // 1. Check if data is already loaded (optimization)
    if (globalInflationData) {
        console.log("Inflation data already loaded from global scope.");
    } else {
        try {
            // 2. Fetch and process the data
            const data = await fetchAndProcessData();
            
            // 3. Set the global data for all scripts to use
            globalInflationData = data;
            
            console.log("Inflation data successfully fetched and stored.");
            
        } catch (error) {
            console.error("Critical error during data load:", error);
            // Re-throw the error to be caught by the calling script (e.g., compare.js)
            throw error;
        }
    }
    
    // 4. Page-Specific Rendering: ONLY run chart/table rendering if the canvas exists.
    const inflationChartCanvas = document.getElementById('inflation-chart');
    if (inflationChartCanvas) {
        console.log("Rendering chart for dedicated inflation page.");
        renderInflationChart(globalInflationData);
        renderInflationTable(globalInflationData);
    }
}


// --- Public Interface ---

window.InflationDataLoader = {
    /** @returns {Object|null} The processed inflation data. */
    getData: () => globalInflationData,
    
    /** @returns {boolean} True if data has been successfully loaded. */
    isLoaded: () => globalInflationData !== null,
    
    /** Public function to start the data loading process. */
    loadData: loadInflationData,
    
    // Expose the raw chart rendering for the 'compare.js' script to use if needed
    renderChart: renderInflationChart 
};

// Check out the console logs now! You should see 'Inflation data successfully fetched and stored.'
// and 'Rendering chart for dedicated inflation page.' ONLY if you are on inflation-rate.html.
