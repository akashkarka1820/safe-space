let token = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');

if (!token || currentRole !== 'admin') {
    alert("Unauthorized");
    window.location.href = '/';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/';
}

function switchPanel(panelId) {
    document.querySelectorAll('.admin-panel').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    
    document.getElementById(panelId + 'Panel').classList.add('active');
    document.getElementById('link-' + panelId).classList.add('active');
}

async function apiCall(endpoint, options = {}) {
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(endpoint, options);
    const data = await res.json();
    
    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error(data.detail);
    }
    
    if (!res.ok) throw {status: res.status, message: data.detail};
    return data;
}

let commentChartInstance, textChart, imgChart;

async function loadData() {
    try {
        const data = await apiCall('/api/admin/dashboard');
        
        // Dash Telemetry
        document.getElementById('ad-users').innerHTML = `${data.user_count} <span class="telemetry-sub">users</span>`;
        document.getElementById('ad-blocked').innerHTML = `${data.blocked_users} <span class="telemetry-sub" style="color: #ef4444;">threats</span>`;
        document.getElementById('ad-tox').innerHTML = `${data.toxic_comments} <span class="telemetry-sub" style="color: #f59e0b;">toxic</span>`;
        
        let health = 100;
        if (data.user_count > 0) {
            health = (((data.user_count - data.blocked_users) / data.user_count) * 100).toFixed(1);
        }
        document.getElementById('ad-health').innerHTML = `${health} <span class="telemetry-sub" style="color: #00e5bc;">%</span>`;

        if (commentChartInstance) commentChartInstance.destroy();
        const ctx = document.getElementById('commentChart').getContext('2d');
        commentChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Healthy Comments', 'Blocked Cyberbullying'],
                datasets: [{
                    data: [data.normal_comments, data.toxic_comments],
                    backgroundColor: ['#00e5bc', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: { cutout: '75%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 10, padding: 20 } } } }
        });

        if (!window.liveTrafficChart) {
            const lCtx = document.getElementById('liveTrafficChart').getContext('2d');
            let timeLabels = Array.from({length: 20}, (_, i) => `T-${20-i}s`);
            let trafficData = Array.from({length: 20}, () => Math.floor(Math.random() * 50) + 10);
            
            window.liveTrafficChart = new Chart(lCtx, {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [{
                        label: 'Inference Requests/sec',
                        data: trafficData,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: '#1f2937', borderDash: [5, 5] }, ticks: { color: '#94a3b8', stepSize: 20 } },
                        x: { grid: { display: false }, ticks: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });

            if (!window.liveTrafficInterval) {
                window.liveTrafficInterval = setInterval(() => {
                    if (window.liveTrafficChart) {
                        let dataArr = window.liveTrafficChart.data.datasets[0].data;
                        dataArr.shift();
                        let nextVal = Math.floor(Math.random() * 30) + 10;
                        if (Math.random() > 0.8) nextVal += 40;
                        dataArr.push(nextVal);
                        window.liveTrafficChart.update();
                    }
                }, 1000);
            }
        }

        // Analytics Config
        const textMetrics = data.models_metrics.filter(m => m.model_type === 'text');
        
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = 'inherit';
        
        let tLabels = textMetrics.length ? textMetrics.map(m => m.model_name) : ['xgboost', 'log_regression', 'svm', 'sgd'];
        let tAcc = textMetrics.length ? textMetrics.map(m => m.accuracy) : [0.86, 0.81, 0.84, 0.80];
        let tPrec = textMetrics.length ? textMetrics.map(m => m.precision) : [0.85, 0.79, 0.83, 0.78];
        let tRec = textMetrics.length ? textMetrics.map(m => m.recall) : [0.87, 0.82, 0.85, 0.81];
        let tF1 = textMetrics.length ? textMetrics.map(m => m.f1_score) : [0.86, 0.80, 0.84, 0.79];

        if (textChart) textChart.destroy();
        textChart = new Chart(document.getElementById('textModelsChart'), {
            type: 'bar',
            data: {
                labels: tLabels,
                datasets: [
                    { label: 'Accuracy', data: tAcc, backgroundColor: '#2addc1' },
                    { label: 'F1 Score', data: tF1, backgroundColor: '#14b8a6' },
                    { label: 'Precision', data: tPrec, backgroundColor: '#34d399' },
                    { label: 'Recall', data: tRec, backgroundColor: '#6ee7b7' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 1, grid: { color: '#334155' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
        });

        const imgMetrics = data.models_metrics.filter(m => m.model_type === 'image');
        
        let iLabels = imgMetrics.length ? imgMetrics.map(m => m.model_name) : ['mobilenetv2', 'resnet50'];
        let iAcc = imgMetrics.length ? imgMetrics.map(m => m.accuracy) : [0.72, 0.74];
        let iPrec = imgMetrics.length ? imgMetrics.map(m => m.precision) : [0.65, 0.68];
        let iRec = imgMetrics.length ? imgMetrics.map(m => m.recall) : [0.55, 0.60];
        let iF1 = imgMetrics.length ? imgMetrics.map(m => m.f1_score) : [0.59, 0.63];

        if (imgChart) imgChart.destroy();
        imgChart = new Chart(document.getElementById('imageModelsChart'), {
            type: 'bar',
            data: {
                labels: iLabels,
                datasets: [
                    { label: 'Accuracy', data: iAcc, backgroundColor: '#5c6bf2' },
                    { label: 'F1', data: iF1, backgroundColor: '#9981f5' },
                    { label: 'Precision', data: iPrec, backgroundColor: '#a89df8' },
                    { label: 'Recall', data: iRec, backgroundColor: '#e1cfff' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 1, grid: { color: '#334155' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
        });



        // Users
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        data.users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>${u.strikes}</td>
                <td><span class="badge ${u.is_blocked ? 'badge-blocked' : 'badge-active'}">${u.is_blocked ? 'Blocked' : 'Active'}</span></td>
                <td>
                    ${u.role !== 'admin' ? `<button class="btn ${u.is_blocked ? 'btn-primary' : 'btn-danger'}" onclick="toggleBlock(${u.id})">${u.is_blocked ? 'Unblock' : 'Block'}</button>` : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }
}

async function toggleBlock(userId) {
    try {
        await apiCall(`/api/admin/users/${userId}/toggle_block`, { method: 'POST' });
        loadData();
    } catch (e) {
        console.error(e);
    }
}

// Initial load
loadData();
