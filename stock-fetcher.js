const API_BASE_URL = 'https://web-production-7130.up.railway.app';

async function fetchNSEData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/nse`);
        const result = await response.json();
        
        if (result.success) {
            console.log('NSE Data:', result.data);
            displayStockData(result.data);
        } else {
            console.error('API Error:', result.error);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

function displayStockData(data) {
    // Your chart/table display code here
    console.log('Stock data received:', data);
    
    // Example: Display in a table
    const tableBody = document.getElementById('stock-table-body');
    tableBody.innerHTML = '';
    
    data.forEach(stock => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.name || stock.Company}</td>
            <td>${stock.price || stock.Price}</td>
            <td>${stock.change || stock.Change}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Call when page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchNSEData();
    
    // Refresh every 5 minutes
    setInterval(fetchNSEData, 5 * 60 * 1000);
});
