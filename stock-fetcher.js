const API_BASE_URL = 'https://web-production-7130.up.railway.app';

// Fetch listed companies on the NSE
async function fetchNSEData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/nse/listed`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            console.log('NSE Listed Companies:', result.data);
            displayStockData(result.data);
        } else {
            console.warn('No NSE data available:', result);
            displayMessage('No NSE data available at the moment.');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        displayMessage('Error fetching data. Please try again later.');
    }
}

// Fetch NSE top gainers
async function fetchTopGainers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/nse/top_gainers`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            console.log('Top Gainers:', result.data);
            displayTopGainers(result.data);
        } else {
            console.warn('No Top Gainers data available:', result);
        }
    } catch (error) {
        console.error('Top Gainers fetch error:', error);
    }
}

// Display NSE listed companies in a table
function displayStockData(data) {
    const tableBody = document.getElementById('stock-table-body');
    if (!tableBody) return console.error('Table body element not found.');
    
    tableBody.innerHTML = '';

    data.forEach(stock => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.Ticker || stock.ticker || '-'}</td>
            <td>${stock.Name || stock.name || '-'}</td>
            <td>${stock.Price?.toFixed(2) || stock.price || '-'}</td>
            <td>${stock.Change || stock.change || '-'}</td>
            <td>${stock.Volume || stock.volume || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Display top gainers in a separate section/table
function displayTopGainers(data) {
    const gainersBody = document.getElementById('top-gainers-body');
    if (!gainersBody) return;

    gainersBody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item["Top Gainers (21)"] || item.ticker || '-'}</td>
            <td>${item["Top Gainers (21).1"] || item.price || '-'}</td>
            <td>${item["Top Gainers (21).2"] || item.change || '-'}</td>
        `;
        gainersBody.appendChild(row);
    });
}

// Show message in case of no data or errors
function displayMessage(message) {
    const msgContainer = document.getElementById('message');
    if (msgContainer) {
        msgContainer.textContent = message;
        msgContainer.style.display = 'block';
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchNSEData();
    fetchTopGainers();

    // Refresh every 5 minutes
    setInterval(() => {
        fetchNSEData();
        fetchTopGainers();
    }, 5 * 60 * 1000);
});
