const API_BASE_URL = 'https://web-production-7130.up.railway.app';

async function fetchNSEData() {
    const tableBody = document.getElementById('stock-table-body');
    const message = document.getElementById('message');

    try {
        const response = await fetch(`${API_BASE_URL}/api/nse`);
        const result = await response.json();

        // Clear table
        tableBody.innerHTML = '';
        message.textContent = '';

        if (result.success && result.data && result.data.length > 0) {
            displayStockData(result.data);
        } else {
            message.textContent = 'No data available at the moment.';
        }
    } catch (error) {
        console.error('Fetch error:', error);
        message.textContent = 'Error fetching data. Please try again later.';
    }
}

function displayStockData(data) {
    const tableBody = document.getElementById('stock-table-body');
    tableBody.innerHTML = '';

    data.forEach(stock => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.name || stock.Company || '-'}</td>
            <td>${stock.price || stock.Price || '-'}</td>
            <td>${stock.change || stock.Change || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchNSEData();
    setInterval(fetchNSEData, 5 * 60 * 1000); // refresh every 5 min
});
