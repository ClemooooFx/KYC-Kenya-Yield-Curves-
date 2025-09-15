// A new object to store chart instances so we can manage them easily.
let charts = {};

function loadAndDisplay(filePath, chartId, tableId) {
    fetch(filePath)
        .then(res => res.arrayBuffer())
        .then(ab => {
            const workbook = XLSX.read(ab, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            console.log(`Parsed Data from ${filePath}:`, jsonData);

            if (filePath.includes("Treasury Bills Average Rates.xlsx")) {
                processTBills(jsonData, chartId, tableId);
            } else {
                // Default behavior (like before)
                const headers = Object.keys(jsonData[0]);
                const xField = headers[0];
                const yField = headers[1];
                const labels = jsonData.map(row => row[xField]);
                const values = jsonData.map(row => parseFloat(row[yField]));
                renderChart(chartId, filePath, labels, values);
                renderTable(tableId, headers, jsonData);
            }
        })
        .catch(error => console.error(`Failed to load or parse the file at ${filePath}:`, error));
}

function processTBills(data, chartId, tableId) {
    // Group data by tenor and month-year
    const grouped = {};
    data.forEach(row => {
        const tenor = row["Tenor"];
        const rate = parseFloat(row["Weighted Average Rate"]);
        const dateParts = row["Issue Date"].split("/"); // dd/mm/yyyy
        if (dateParts.length !== 3) return;

        const monthYear = `${dateParts[1]}/${dateParts[2]}`; // mm/yyyy

        if (!grouped[tenor]) grouped[tenor] = {};
        if (!grouped[tenor][monthYear]) grouped[tenor][monthYear] = [];

        grouped[tenor][monthYear].push(rate);
    });

    // Compute averages per month-year per tenor
    const datasets = [];
    const allLabels = new Set();

    Object.keys(grouped).forEach(tenor => {
        const points = grouped[tenor];
        const labels = Object.keys(points).sort((a, b) => {
            const [ma, ya] = a.split("/").map(Number);
            const [mb, yb] = b.split("/").map(Number);
            return ya - yb || ma - mb;
        });

        labels.forEach(l => allLabels.add(l));

        const values = labels.map(l => {
            const arr = points[l];
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            return avg;
        });

        datasets.push({
            label: `Tenor ${tenor} days`,
            data: values,
            borderColor: tenor === 91 ? "blue" : tenor === 182 ? "green" : "red",
            fill: false
        });
    });

    const sortedLabels = Array.from(allLabels).sort((a, b) => {
        const [ma, ya] = a.split("/").map(Number);
        const [mb, yb] = b.split("/").map(Number);
        return ya - yb || ma - mb;
    });

    // Render Chart
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) charts[chartId].destroy();
    charts[chartId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: sortedLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: "Treasury Bills Weighted Average Rates"
                }
            }
        }
    });

    // Render Table (raw data as-is)
    const headers = Object.keys(data[0]);
    renderTable(tableId, headers, data);
}

function renderChart(chartId, label, labels, values) {
    const ctx = document.getElementById(chartId).getContext("2d");
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    charts[chartId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: label.split('/').pop().replace('.xlsx', ''),
                data: values,
                borderColor: "blue",
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Prevents the chart from maintaining its aspect ratio
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Your Chart Title'
                }
            }
        }
    });
}

function renderTable(tableId, headers, jsonData) {
    const tableHead = document.querySelector(`#${tableId} thead`);
    const tableBody = document.querySelector(`#${tableId} tbody`);

    // Clear old data
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    // Render Headers
    let headerRow = "<tr>";
    headers.forEach(h => headerRow += `<th>${h}</th>`);
    headerRow += "</tr>";
    tableHead.innerHTML = headerRow;

    // Render Rows
    jsonData.forEach(row => {
        let rowHTML = "<tr>";
        headers.forEach(h => rowHTML += `<td>${row[h]}</td>`);
        rowHTML += "</tr>";
        tableBody.innerHTML += rowHTML;
    });
}
