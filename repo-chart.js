Chart.register(window.ChartZoom);
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplay('data/Repo and Reverse Repo.xlsx', 'repo-chart', 'repo-table');
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
            const sheet = workbook.Sheets[sheetName];

            let worksheet = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            // 🧹 Clean rows: keep only those with a valid Date
            worksheet = worksheet.filter(row => row && row['Date'] && row['Date'].toString().trim() !== "");

            if (filePath.includes('Treasury Bills Average Rates.xlsx')) {
                processTBillData(worksheet, chartId, tableId);
            } else if (filePath.includes('Issues of Treasury Bonds.xlsx')) {
                processTBondData(worksheet, chartId, tableId);
            } else if (filePath.includes('Central Bank Rate (CBR).xlsx')) {
                const sortedData = worksheet.sort((a, b) => {
                    const dateA = new Date(a['Date'].split('/').reverse().join('-'));
                    const dateB = new Date(b['Date'].split('/').reverse().join('-'));
                    return dateA - dateB;
                });
                processCBRData(sortedData, chartId, tableId);
            } else if (filePath.includes('Repo and Reverse Repo.xlsx')) {
                processRepoData(worksheet, chartId, tableId);
            }
        })
        .catch(error => console.error(`Failed to load or parse the file at ${filePath}:`, error));
}

function processRepoData(jsonData, chartId, tableId) {
    // Filter out empty or invalid rows
    const validData = jsonData.filter(row => row && row['Date']);

    // Sort the data by date (dd/mm/yyyy → yyyy-mm-dd for sorting)
    const sortedData = validData.sort((a, b) => {
        const dateA = new Date(a['Date'].split('/').reverse().join('-'));
        const dateB = new Date(b['Date'].split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Extract labels
    const dateLabels = sortedData.map(row => row['Date']);

    // Map input data by normalized date
    const dataMap = new Map();
    sortedData.forEach(row => {
        const [d, m, y] = row['Date'].split('/');
        const day = d.padStart(2, '0');
        const month = m.padStart(2, '0');
        const year = y;
        const normalizedDate = `${day}/${month}/${year}`;

        dataMap.set(normalizedDate, {
            repo: cleanAndParse(row['Repo']),
            reverseRepo: cleanAndParse(row['Reverse Repo'])
        });
    });

    // Fill in missing values using last known values
    const repoData = [];
    const reverseRepoData = [];
    let lastRepoValue = 0;
    let lastReverseRepoValue = 0;

    dateLabels.forEach(dateString => {
        const values = dataMap.get(dateString);

        if (values && values.repo !== 0) {
            lastRepoValue = values.repo;
        }
        repoData.push(lastRepoValue.toFixed(3));

        if (values && values.reverseRepo !== 0) {
            lastReverseRepoValue = values.reverseRepo;
        }
        reverseRepoData.push(lastReverseRepoValue.toFixed(3));
    });

    // Chart datasets
    const datasets = [
        {
            label: 'Repo Rate',
            data: repoData,
            borderColor: '#4e79a7',
            backgroundColor: '#4e79a7',
            fill: false,
            tension: 0.4,       // smooth curve
            stepped: false,     // smooth
            pointRadius: 0
        },
        {
            label: 'Reverse Repo Rate',
            data: reverseRepoData,
            borderColor: '#e15759',
            backgroundColor: '#e15759',
            fill: false,
            tension: 0,         // no curve
            stepped: true,      // stepped line
            pointRadius: 0
        }
    ];

    // Render chart
    renderMultiLineChart(chartId, dateLabels, datasets);

    // Render table
    const headers = ['Date', 'Repo', 'Reverse Repo'];
    renderTable(tableId, headers, sortedData);
}

function renderMultiLineChart(chartId, labels, datasets) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }

    charts[chartId] = new Chart(ctx, {
        type: "line",
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
                        text: 'Date (dd/mm/yyyy)'
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

function cleanAndParse(value) {
    if (typeof value === 'string') {
        const cleanedString = value.replace(/[^0-9.]/g, '');
        return parseFloat(cleanedString) || 0;
    }
    return parseFloat(value) || 0;
}
