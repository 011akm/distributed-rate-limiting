const ctx = document.getElementById('chart').getContext('2d');
const labels      = [];
const allowedData = [];
const blockedData = [];

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Allowed',
        data: allowedData,
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0,255,136,0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Blocked',
        data: blockedData,
        borderColor: '#ff4444',
        backgroundColor: 'rgba(255,68,68,0.1)',
        tension: 0.4,
        fill: true
      },
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#555', font: { family: 'monospace' } }
      }
    },
    scales: {
      x: { ticks: { color: '#555', font: { family: 'monospace' } }, grid: { color: '#2a2a2a' } },
      y: { ticks: { color: '#555', font: { family: 'monospace' } }, grid: { color: '#2a2a2a' }, beginAtZero: true }
    }
  }
});

function renderTable(tbodyId, data) {
  const tbody = document.getElementById(tbodyId);
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#555">No data yet</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${row.ip}</td>
      <td>${row.count}</td>
      <td>${row.remaining}</td>
      <td>${row.ttl}</td>
      <td><span class="badge ${row.blocked ? 'blocked' : 'allowed'}">${row.blocked ? 'BLOCKED' : 'ALLOWED'}</span></td>
    </tr>
  `).join('');
}

async function fetchStats() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();

    const fixedData   = data.fixedWindow   || [];
    const slidingData = data.slidingWindow || [];

    const totalIPs = fixedData.length + slidingData.length;
    const blocked  = [...fixedData, ...slidingData].filter(r => r.blocked).length;
    const allowed  = totalIPs - blocked;

    document.getElementById('total-ips').textContent     = totalIPs;
    document.getElementById('blocked-count').textContent = blocked;
    document.getElementById('fixed-count').textContent   = fixedData.length;
    document.getElementById('sliding-count').textContent = slidingData.length;

    renderTable('fixed-table',   fixedData);
    renderTable('sliding-table', slidingData);

    const time = new Date().toLocaleTimeString();
    labels.push(time);
    allowedData.push(allowed);
    blockedData.push(blocked);
    if (labels.length > 20) {
      labels.shift();
      allowedData.shift();
      blockedData.shift();
    }
    chart.update();

  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

fetchStats();
setInterval(fetchStats, 2000);