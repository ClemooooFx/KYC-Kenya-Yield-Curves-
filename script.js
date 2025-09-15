// A new object to store chart instances so we can manage them easily.
let charts = {};
// Global variables to store parsed data to avoid re-fetching
let tBillsData = null;
let tBondsData = null;

// The main function to handle all chart and table loading
document.addEventListener('DOMContentLoaded', () => {
    // Load and display all three charts and tables automatically
    loadAndDisplay('data/Treasury Bills Average Rates.xlsx', 't-bills-chart', 't-bills-table');
    loadAndDisplay('data/Issues of Treasury Bonds.xlsx', 't-bonds-chart', 't-bonds-table');
    loadYieldCurve('yield-curve-chart');
});

function loadAndDisplay(filePath, chartId, tableId) {
    fetch(filePath)
        .then(res => res.arrayBuffer())
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            if (filePath.includes('Treasury Bills Average Rates.xlsx')) {
                processTBillData(worksheet, chartId, tableId);
            } else if (filePath.includes('Issues of Treasury Bonds.xlsx')) {
                processTBondData(worksheet, chartId, tableId);
            } else {
                const headers = Object.keys(worksheet[0]);
                const xField = headers[0];
                const yField = headers[1];
                const labels = worksheet.map(row => row[xField]);
                const values = worksheet.map(row => parseFloat(row[yField]));

                renderChart(chartId, filePath, labels, values);
                renderTable(tableId, headers, worksheet);
            }
        })
        .catch(error => console.error(`Failed to load or parse the file at ${filePath}:`, error));
}

function loadYieldCurve(chartId) {
    Promise.all([
        fetch('data/Treasury Bills Average Rates.xlsx').then(res => res.arrayBuffer()),
        fetch('data/Issues of Treasury Bonds.xlsx').then(res => res.arrayBuffer())
    ])
    .then(([tBillsAb, tBondsAb]) => {
        tBillsData = XLSX.utils.sheet_to_json(XLSX.read(tBillsAb, { type: "array" }).Sheets["Sheet1"]);
        tBondsData = XLSX.utils.sheet_to_json(XLSX.read(tBondsAb, { type: "array" }).Sheets["Sheet1"]);

        const sortByDate = (a, b) => {
            const dateA = new Date(a['Issue Date'].split('/').reverse().join('-'));
            const dateB = new Date(b['Issue Date'].split('/').reverse().join('-'));
            return dateA - dateB;
        };
        tBillsData.sort(sortByDate);
        tBondsData.sort(sortByDate);
        
        // --- NEW: Set the date picker to the current date ---
        const today = new Date();
        const datePicker = document.getElementById('date-picker');
        datePicker.valueAsDate = today;
        
        // Render the initial chart for today's date
        updateYieldCurveChart(chartId, today);

        // Add event listener to the date picker
        datePicker.addEventListener('change', (event) => {
            const selectedDate = event.target.valueAsDate;
            updateYieldCurveChart(chartId, selectedDate);
        });
    })
    .catch(error => console.error("Failed to load yield curve data:", error));
}

function updateYieldCurveChart(chartId, targetDate) {
    const tenors = [
        { label: '3 Month', value: 91, type: 'bills' },
        { label: '6 Month', value: 182, type: 'bills' },
        { label: '1Y', value: 1, type: 'bonds' },
        { label: '2Y', value: 2, type: 'bonds' },
        { label: '3Y', value: 3, type: 'bonds' },
        { label: '5Y', value: 5, type: 'bonds' },
        { label: '10Y', value: 10, type: 'bonds' },
        { label: '15Y', value: 15, type: 'bonds' },
        { label: '20Y', value: 20, type: 'bonds' },
        { label: '25Y', value: 25, type: 'bonds' }
    ];

    const labels = tenors.map(t => t.label);
    const rates = tenors.map(t => {
        let dataSet = t.type === 'bills' ? tBillsData : tBondsData;
        
        let latestRate = null;
        for (let i = dataSet.length - 1; i >= 0; i--) {
            const row = dataSet[i];
            
            // For bonds, filter out non-FXD issues
            if (t.type === 'bonds' && row['Issue No'] && !row['Issue No'].startsWith('FXD')) {
                continue;
            }

            const issueDateParts = row['Issue Date'].split('/');
            const issueDate = new Date(issueDateParts[2], issueDateParts[1] - 1, issueDateParts[0]);

            const rowTenor = t.type === 'bills' ? row['Tenor'] : row['Tenor'];
            const rate = t.type === 'bills' ? parseFloat(row['Weighted Average Rate']) : parseFloat(row['Coupon Rate']);

            if (issueDate <= targetDate && rowTenor === t.value) {
                latestRate = rate;
                break;
            }
        }
        return latestRate;
    });

    const dataset = [{
        label: 'Yield Curve',
        data: rates,
        borderColor: 'purple',
        tension: 0.4,
        fill: false,
    }];
    
    if (charts[chartId]) {
        charts[chartId].destroy();
    }

    charts[chartId] = new Chart(document.getElementById(chartId).getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: dataset,
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
                        text: 'Maturity'
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

function processTBillData(jsonData, chartId, tableId) {
    const dates = [...new Set(jsonData.map(row => {
        const dateParts = row['Issue Date'].split('/');
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const date = new Date(year, month, day);
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
    }))].sort((a, b) => {
        const [aMonth, aYear] = a.split('/').map(Number);
        const [bMonth, bYear] = b.split('/').map(Number);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
    });

    const tenors = [91, 182, 364];
    const datasets = tenors.map(tenor => {
        const tenorData = jsonData.filter(row => row['Tenor'] === tenor);
        
        let avgRatesByDate = dates.map(date => {
            const matchingEntries = tenorData.filter(row => {
                const rowDateParts = row['Issue Date'].split('/');
                const rowDay = parseInt(rowDateParts[0], 10);
                const rowMonth = parseInt(rowDateParts[1], 10) - 1;
                const rowYear = parseInt(rowDateParts[2], 10);
                const rowDate = new Date(rowYear, rowMonth, rowDay);
                return `${rowDate.getMonth() + 1}/${rowDate.getFullYear()}` === date;
            });
            const sum = matchingEntries.reduce((acc, row) => acc + (parseFloat(row['Weighted Average Rate']) || 0), 0);
            return sum / (matchingEntries.length || 1);
        });
        
        for (let i = 1; i < avgRatesByDate.length; i++) {
            if (avgRatesByDate[i] === 0 && avgRatesByDate[i-1] !== 0) {
                avgRatesByDate[i] = avgRatesByDate[i-1];
            }
        }

        return {
            label: `${tenor} Day Bill`,
            data: avgRatesByDate,
            borderColor: tenor === 91 ? 'blue' : tenor === 182 ? 'green' : 'red',
            fill: false,
            tension: 0.4
        };
    });

    renderMultiLineChart(chartId, dates, datasets);
    const headers = ['Issue Date', 'Tenor', 'Weighted Average Rate'];
    renderTable(tableId, headers, jsonData);
}

function processTBondData(jsonData, chartId, tableId) {
    const filteredData = jsonData.filter(row => row['Issue No'].startsWith('FXD'));
    const dates = [...new Set(filteredData.map(row => {
        const dateParts = row['Issue Date'].split('/');
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const date = new Date(year, month, day);
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
    }))].sort((a, b) => {
        const [aMonth, aYear] = a.split('/').map(Number);
        const [bMonth, bYear] = b.split('/').map(Number);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
    });

    const tenors = [...new Set(filteredData.map(row => row['Tenor']))].sort((a, b) => a - b);
    const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#af7aa1', '#ff9da7'];
    
    const datasets = tenors.map((tenor, index) => {
        const tenorData = filteredData.filter(row => row['Tenor'] === tenor);
        const avgRatesByDate = dates.map(date => {
            const matchingEntries = tenorData.filter(row => {
                const rowDateParts = row['Issue Date'].split('/');
                const rowDay = parseInt(rowDateParts[0], 10);
                const rowMonth = parseInt(rowDateParts[1], 10) - 1;
                const rowYear = parseInt(rowDateParts[2], 10);
                const rowDate = new Date(rowYear, rowMonth, rowDay);
                return `${rowDate.getMonth() + 1}/${rowDate.getFullYear()}` === date;
            });
            const sum = matchingEntries.reduce((acc, row) => acc + (parseFloat(row['Coupon Rate']) || 0), 0);
            return sum / (matchingEntries.length || 1);
        });
        
        for (let i = 1; i < avgRatesByDate.length; i++) {
            if (avgRatesByDate[i] === 0 && avgRatesByDate[i-1] !== 0) {
                avgRatesByDate[i] = avgRatesByDate[i-1];
            }
        }

        return {
            label: `${tenor} Year Bond`,
            data: avgRatesByDate,
            borderColor: colors[index % colors.length],
            fill: false,
            tension: 0.4
        };
    });

    renderMultiLineChart(chartId, dates, datasets);
    const headers = ['Issue No', 'Issue Date', 'Tenor', 'Coupon Rate', 'Issue Amount'];
    renderTable(tableId, headers, jsonData);
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
                }
            }
        }
    });
}

function renderTable(tableId, headers, jsonData) {
    const tableHead = document.querySelector(`#${tableId} thead`);
    const tableBody = document.querySelector(`#${tableId} tbody`);

    if (!tableHead || !tableBody) {
        console.error(`Table with ID ${tableId} not found.`);
        return;
    }

    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    let headerRow = "<tr>";
    headers.forEach(h => headerRow += `<th>${h}</th>`);
    headerRow += "</tr>";
    tableHead.innerHTML = headerRow;

    jsonData.forEach(row => {
        let rowHTML = "<tr>";
        headers.forEach(h => rowHTML += `<td>${row[h]}</td>`);
        rowHTML += "</tr>";
        tableBody.innerHTML += rowHTML;
    });
}
