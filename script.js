function loadExcel(filePath) {
  fetch(filePath)
    .then(res => res.arrayBuffer())
    .then(ab => {
      const workbook = XLSX.read(ab, { type: "array" });
      const sheetName = workbook.SheetNames[0]; // first sheet
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log("Parsed Data:", jsonData);

      // Extract fields dynamically
      const headers = Object.keys(jsonData[0]);
      const xField = headers[0]; // Assume first column = Maturity/Date
      const yField = headers[1]; // Assume second column = Yield/Rate

      const labels = jsonData.map(row => row[xField]);
      const values = jsonData.map(row => parseFloat(row[yField]));

      // Render Chart
      const ctx = document.getElementById("yieldChart").getContext("2d");
      if (window.yieldChart) window.yieldChart.destroy(); // clear old chart
      window.yieldChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: `${filePath}`,
            data: values,
            borderColor: "blue",
            fill: false
          }]
        }
      });

      // Render Table
      const tableHead = document.querySelector("#dataTable thead");
      const tableBody = document.querySelector("#dataTable tbody");

      // Clear old data
      tableHead.innerHTML = "";
      tableBody.innerHTML = "";

      // Headers
      let headerRow = "<tr>";
      headers.forEach(h => headerRow += `<th>${h}</th>`);
      headerRow += "</tr>";
      tableHead.innerHTML = headerRow;

      // Rows
      jsonData.forEach(row => {
        let rowHTML = "<tr>";
        headers.forEach(h => rowHTML += `<td>${row[h]}</td>`);
        rowHTML += "</tr>";
        tableBody.innerHTML += rowHTML;
      });
    });
}
