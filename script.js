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

            // Dynamically extract headers
            const headers = Object.keys(jsonData[0]);
            const xField = headers[0];
            const yField = headers[1];

            const labels = jsonData.map(row => row[xField]);
            const values = jsonData.map(row => parseFloat(row[yField]));

            // Render the chart
            renderChart(chartId, filePath, labels, values);
            
            // Render the table
            renderTable(tableId, headers, jsonData);
        })
        .catch(error => console.error(`Failed to load or parse the file at ${filePath}:`, error));
}

function renderChart(chartId, label, labels, values) {
    const ctx = document.getElementById(chartId).getContext("2d");
    
    // Check if a chart with this ID already exists and destroy it to prevent duplicates
    if (charts[chartId]) {
        charts[chartId].destroy();
    }

    charts[chartId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: label.split('/').pop().replace('.xlsx', ''), // Clean up the label
                data: values,
                borderColor: "blue",
                fill: false
            }]
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
