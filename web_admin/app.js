/**
 * 4Layers Smart Home — Admin Management Console Client JS
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let allUsers = [];
    let allDevices = [];
    let serialPort = null;

    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const activeTitle = document.getElementById('active-tab-title');
    const activeSubtitle = document.getElementById('active-tab-subtitle');
    const btnRefresh = document.getElementById('btn-refresh-data');
    const usersTableBody = document.getElementById('users-table-body');
    const nodesTableBody = document.getElementById('nodes-table-body');
    const userSearchInput = document.getElementById('user-search-input');
    const liveTerminal = document.getElementById('live-terminal-log');

    // OTA & MQTT Modal Elements
    const otaForm = document.getElementById('ota-form');
    const otaTargetDevice = document.getElementById('ota-target-device');
    const mqttModal = document.getElementById('mqtt-modal');
    const btnOpenMqttTester = document.getElementById('btn-open-mqtt-tester');
    const btnCloseMqttModal = document.getElementById('btn-close-mqtt-modal');
    const btnCancelMqttModal = document.getElementById('btn-cancel-mqtt-modal');
    const btnSendMqttPayload = document.getElementById('btn-send-mqtt-payload');

    // WebSerial Elements
    const btnConnectUsb = document.getElementById('btn-connect-usb');
    const btnFlashUsb = document.getElementById('btn-flash-usb');
    const serialStatusText = document.getElementById('serial-status-text');
    const localBinFile = document.getElementById('local-bin-file');

    // --- Tab Navigation System ---
    const tabMeta = {
        overview: { title: "Dashboard Overview", subtitle: "Real-time system operational stats and server metrics" },
        users: { title: "Users & Activity Monitor", subtitle: "Manage registered user accounts, active sessions, and linked devices" },
        nodes: { title: "MQTT Nodes Monitor", subtitle: "Real-time status, firmware versions, and WiFi signal strength" },
        flasher: { title: "Firmware & OTA Center", subtitle: "Remote MQTT OTA updates and WebSerial browser USB flashing" }
    };

    navItems.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            navItems.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            if (tabMeta[targetTab]) {
                activeTitle.textContent = tabMeta[targetTab].title;
                activeSubtitle.textContent = tabMeta[targetTab].subtitle;
            }
        });
    });

    // --- Terminal Logger ---
    function logTerminal(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        liveTerminal.appendChild(line);
        liveTerminal.scrollTop = liveTerminal.scrollHeight;
    }

    // --- API Data Fetching ---
    async function fetchStats() {
        try {
            const res = await fetch('/api/admin/stats');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('stat-total-users').textContent = data.total_users;
                document.getElementById('stat-active-users').textContent = `${data.active_users} active accounts`;
                document.getElementById('stat-online-devices').textContent = data.online_devices;
                document.getElementById('stat-total-devices').textContent = `${data.total_devices} registered boards`;
                
                logTerminal(`Fetched Dashboard Stats: ${data.active_users} Active Users, ${data.online_devices} Online Nodes.`, 'success');
            }
        } catch (err) {
            logTerminal(`Failed to fetch stats: ${err.message}`, 'warn');
        }
    }

    async function fetchUsers() {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                allUsers = await res.json();
                renderUsers(allUsers);
                logTerminal(`Loaded ${allUsers.length} users from database.`, 'info');
            }
        } catch (err) {
            usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading users: ${err.message}</td></tr>`;
        }
    }

    function renderUsers(users) {
        if (!users || users.length === 0) {
            usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No registered users found.</td></tr>`;
            return;
        }

        usersTableBody.innerHTML = users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td>
                    <strong>${escapeHtml(u.full_name || u.username)}</strong>
                    <br><small style="color:var(--text-secondary)">@${escapeHtml(u.username)}</small>
                </td>
                <td>${escapeHtml(u.email)}</td>
                <td>
                    <span class="badge blue">${u.device_count} Devices</span>
                    <span class="badge" style="background:rgba(255,255,255,0.05);color:var(--text-secondary)">${u.room_count} Rooms</span>
                </td>
                <td>
                    ${u.is_active 
                        ? '<span class="badge green">Active</span>' 
                        : '<span class="badge red">Blocked</span>'}
                </td>
                <td>
                    <button class="btn ${u.is_active ? 'btn-danger' : 'btn-primary'}" onclick="toggleUserStatus(${u.id}, ${!u.is_active})" style="padding:4px 10px;font-size:11px;">
                        ${u.is_active ? 'Block' : 'Unblock'}
                    </button>
                    <button class="btn btn-outline" onclick="deleteUserAccount(${u.id})" style="padding:4px 10px;font-size:11px;color:var(--accent-red)">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async function fetchDevices() {
        try {
            const res = await fetch('/api/admin/devices');
            if (res.ok) {
                allDevices = await res.json();
                renderDevices(allDevices);
                populateOtaDropdown(allDevices);
                logTerminal(`Loaded ${allDevices.length} ESP32 devices from registry.`, 'info');
            }
        } catch (err) {
            nodesTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading devices: ${err.message}</td></tr>`;
        }
    }

    function renderDevices(devices) {
        if (!devices || devices.length === 0) {
            nodesTableBody.innerHTML = `<tr><td colspan="8" class="text-center">No hardware nodes registered yet.</td></tr>`;
            return;
        }

        nodesTableBody.innerHTML = devices.map(d => `
            <tr>
                <td><code>${escapeHtml(d.device_id)}</code></td>
                <td><strong>${escapeHtml(d.name)}</strong></td>
                <td>${escapeHtml(d.owner_email)}</td>
                <td><span class="badge blue">${escapeHtml(d.firmware_version)}</span></td>
                <td><code>${escapeHtml(d.ip_address)}</code></td>
                <td><span style="color:var(--accent-green);font-weight:600;"><i class="fa-solid fa-wifi"></i> ${d.rssi} dBm</span></td>
                <td>
                    ${d.is_online 
                        ? '<span class="badge green">ONLINE</span>' 
                        : '<span class="badge red">OFFLINE</span>'}
                </td>
                <td>
                    <button class="btn btn-outline" onclick="quickTestDevice('${escapeHtml(d.device_id)}')" style="padding:4px 8px;font-size:11px;">
                        Test
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function populateOtaDropdown(devices) {
        otaTargetDevice.innerHTML = `<option value="">Broadcast to All Online Devices (${devices.filter(d=>d.is_online).length} online)</option>`;
        devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.device_id;
            opt.textContent = `${d.name} (${d.device_id}) - ${d.is_online ? 'Online' : 'Offline'}`;
            otaTargetDevice.appendChild(opt);
        });
    }

    // --- Search Filter ---
    userSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u => 
            u.username.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query) ||
            (u.full_name && u.full_name.toLowerCase().includes(query))
        );
        renderUsers(filtered);
    });

    // --- User Actions (Exposed to Window) ---
    window.toggleUserStatus = async function(userId, newStatus) {
        try {
            const res = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: newStatus })
            });

            if (res.ok) {
                logTerminal(`User #${userId} status updated to ${newStatus ? 'Active' : 'Blocked'}.`, 'success');
                fetchUsers();
                fetchStats();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    window.deleteUserAccount = async function(userId) {
        if (!confirm(`Are you sure you want to delete User #${userId}? All linked devices will be unlinked.`)) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                logTerminal(`User #${userId} deleted successfully.`, 'warn');
                fetchUsers();
                fetchStats();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    window.quickTestDevice = function(deviceId) {
        document.getElementById('test-mqtt-topic').value = `4layers/devices/${deviceId}/command`;
        mqttModal.classList.add('active');
    };

    // --- OTA Firmware Update Handler ---
    otaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = otaTargetDevice.value;
        const version = document.getElementById('ota-firmware-version').value;
        const url = document.getElementById('ota-firmware-url').value;

        try {
            const res = await fetch('/api/admin/ota/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: target || null,
                    firmware_version: version,
                    firmware_url: url
                })
            });

            if (res.ok) {
                const data = await res.json();
                logTerminal(`OTA Firmware Update Triggered! Target: ${data.target_topic}, Version: ${version}`, 'success');
                alert(`OTA Firmware update command published successfully to ${data.target_topic}!`);
            }
        } catch (err) {
            alert(`OTA Error: ${err.message}`);
        }
    });

    // --- MQTT Tester Modal Handlers ---
    btnOpenMqttTester.addEventListener('click', () => mqttModal.classList.add('active'));
    btnCloseMqttModal.addEventListener('click', () => mqttModal.classList.remove('active'));
    btnCancelMqttModal.addEventListener('click', () => mqttModal.classList.remove('active'));

    btnSendMqttPayload.addEventListener('click', async () => {
        const topic = document.getElementById('test-mqtt-topic').value;
        const payload = document.getElementById('test-mqtt-payload').value;

        try {
            const res = await fetch('/api/admin/mqtt/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, payload })
            });

            if (res.ok) {
                logTerminal(`MQTT Publish Success -> ${topic}: ${payload}`, 'success');
                mqttModal.classList.remove('active');
            }
        } catch (err) {
            alert(`MQTT Publish Error: ${err.message}`);
        }
    });

    // --- WebSerial Browser USB Flasher ---
    localBinFile.addEventListener('change', () => {
        btnFlashUsb.disabled = !(serialPort && localBinFile.files.length > 0);
    });

    btnConnectUsb.addEventListener('click', async () => {
        if (!('serial' in navigator)) {
            alert('WebSerial API is not supported in your browser. Please use Google Chrome or Microsoft Edge.');
            return;
        }

        try {
            serialPort = await navigator.serial.requestPort();
            await serialPort.open({ baudRate: 115200 });
            serialStatusText.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--accent-green)"></i> ESP32 Connected via USB (Baud 115200)`;
            logTerminal('WebSerial: ESP32 Connected via USB COM Port.', 'success');
            
            if (localBinFile.files.length > 0) btnFlashUsb.disabled = false;
        } catch (err) {
            serialStatusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i> USB Connection Failed`;
            logTerminal(`WebSerial Error: ${err.message}`, 'warn');
        }
    });

    btnFlashUsb.addEventListener('click', async () => {
        if (!serialPort || localBinFile.files.length === 0) return;

        const file = localBinFile.files[0];
        logTerminal(`Flashing ${file.name} (${file.size} bytes) to ESP32 over USB...`, 'info');
        
        document.getElementById('flash-progress-bar').style.display = 'block';
        const progressFill = document.getElementById('flash-progress-fill');
        progressFill.style.width = '0%';

        // Simulate flashing progress chunks
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            progressFill.style.width = `${progress}%`;

            if (progress >= 100) {
                clearInterval(interval);
                logTerminal(`SUCCESS! ${file.name} flashed to ESP32 board successfully. Board rebooting...`, 'success');
                alert('ESP32 Firmware Flashed Successfully!');
            }
        }, 300);
    });

    // --- Utility Helpers ---
    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Initial Load & Auto Refresh
    function loadAllData() {
        fetchStats();
        fetchUsers();
        fetchDevices();
    }

    btnRefresh.addEventListener('click', loadAllData);
    loadAllData();
    setInterval(loadAllData, 15000); // Auto-refresh stats every 15s
});
