// A new object to store chart instances so we can manage them easily.
let charts = {};

function loadAndDisplay(filePath, chartId, tableId) {
    fetch(filePath)
        .then(res => res.arrayBuffer())
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            // Handle the specific T-Bills file differently
            if (filePath.includes('Treasury Bills Average Rates.xlsx')) {
                processTBillData(worksheet, chartId, tableId);
            } else {
                // Existing logic for other files
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

function processTBillData(jsonData, chartId, tableId) {
    const dates = [...new Set(jsonData.map(row => {
        const date = new Date(row['Issue Date']);
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
    }))];

    // Corrected sorting logic
    dates.sort((a, b) => {
        const [aMonth, aYear] = a.split('/').map(Number);
        const [bMonth, bYear] = b.split('/').map(Number);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
    });

    const tenors = [91, 182, 364];
    const datasets = tenors.map(tenor => {
        const tenorData = jsonData.filter(row => row['Tenor'] === tenor);
        const avgRatesByDate = dates.map(date => {
            const matchingEntries = tenorData.filter(row => {
                const rowDate = new Date(row['Issue Date']);
                return `${rowDate.getMonth() + 1}/${rowDate.getFullYear()}` === date;
            });
            const sum = matchingEntries.reduce((acc, row) => acc + (parseFloat(row['Weighted Average Rate']) || 0), 0);
            return sum / (matchingEntries.length || 1);
        });

        const labelMap = { 91: '3 Month Bill', 182: '6 Month Bill', 364: '1 Year Bill' };
        return {
            label: labelMap[tenor],
            data: avgRatesByDate,
            borderColor: tenor === 91 ? 'blue' : tenor === 182 ? 'green' : 'red',
            fill: false,
        };
    });

    renderMultiLineChart(chartId, dates, datasets);
    const headers = ['Issue Date', 'Tenor', 'Weighted Average Rate'];
    renderTable(tableId, headers, jsonData);
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
            }
        }
    });
}
