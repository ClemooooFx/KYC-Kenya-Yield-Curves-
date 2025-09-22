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
            const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

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
    // Filter out rows that are not valid objects, or have a blank "Date"
    const filteredData = jsonData.filter(row => row && row['Date']);

    // Sort the data by date
    const sortedData = filteredData.sort((a, b) => {
        const dateA = new Date(a['Date'].split('/').reverse().join('-'));
        const dateB = new Date(b['Date'].split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Create a continuous sequence of dates from the earliest date to the latest
    const firstDate = new Date(sortedData[0]['Date'].split('/').reverse().join('-'));
    const lastDate = new Date(sortedData[sortedData.length - 1]['Date'].split('/').reverse().join('-'));
    const dates = [];
    const currentDate = new Date(firstDate);
    while (currentDate <= lastDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    const dateLabels = dates.map(date => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    });

    const repoData = [];
    const reverseRepoData = [];
    let lastRepoValue = 0;
    let lastReverseRepoValue = 0;

    // Map the continuous dates to the data from the JSON
    const dataMap = new Map();
    sortedData.forEach(row => {
        const repoValue = cleanAndParse(row['Repo']);
        const reverseRepoValue = cleanAndParse(row['Reverse Repo']);

        dataMap.set(row['Date'], {
            repo: repoValue,
            reverseRepo: reverseRepoValue
        });
    });

    // Populate the datasets for the chart, filling in missing values
    dates.forEach(date => {
        const dateString = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
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

    const datasets = [{
        label: 'Repo Rate',
        data: repoData,
        borderColor: '#4e79a7',
        backgroundColor: '#4e79a7',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointBackgroundColor: '#4e79a7'
    }, {
        label: 'Reverse Repo Rate',
        data: reverseRepoData,
        borderColor: '#e15759',
        backgroundColor: '#e15759',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointBackgroundColor: '#e15759'
    }];

    renderMultiLineChart(chartId, dateLabels, datasets);
    const headers = ['Date', 'Repo', 'Reverse Repo'];
    renderTable(tableId, headers, sortedData);
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

function cleanAndParse(value) {
    if (typeof value === 'string') {
        // Remove all characters except digits and the decimal point
        const cleanedString = value.replace(/[^0-9.]/g, '');
        return parseFloat(cleanedString) || 0; // Return the number or 0 if it's not a valid number
    }
    return parseFloat(value) || 0;
}
