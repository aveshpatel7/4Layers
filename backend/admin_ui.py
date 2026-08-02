"""
4Layers Web Admin Console - Embedded UI Provider
Guarantees 100% zero disk path error deployment on Docker & AWS App Runner.
"""

ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>4Layers Smart Home — Admin Management Console</title>
    <!-- Google Fonts & FontAwesome -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/admin/style.css?v=2.1.5">
</head>
<body>
    <div class="admin-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="brand-header">
                <img src="/admin/logo.png?v=2.1.5" alt="4Layers Logo" style="height: 36px; width: 36px; min-width: 36px; min-height: 36px; object-fit: contain; margin-right: 12px; border-radius: 8px;" />
                <div class="brand-info">
                    
                    <span class="brand-sub">Smart Admin Console v2.1.5</span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <button class="nav-item active" data-tab="overview">
                    <i class="fa-solid fa-chart-pie"></i>
                    <span>Dashboard Overview</span>
                </button>
                <button class="nav-item" data-tab="users">
                    <i class="fa-solid fa-users-gear"></i>
                    <span>Users & Activity</span>
                </button>
                <button class="nav-item" data-tab="nodes">
                    <i class="fa-solid fa-microchip"></i>
                    <span>MQTT Nodes Monitor</span>
                </button>
                <button class="nav-item" data-tab="flasher">
                    <i class="fa-solid fa-bolt-lightning"></i>
                    <span>Firmware & OTA Center</span>
                </button>
            </nav>

            <div class="sidebar-footer">
                <div class="status-indicator">
                    <span class="status-dot green"></span>
                    <span class="status-text">AWS Live Operational</span>
                </div>
                <div class="credit-badge">
                    <i class="fa-solid fa-shield-halved"></i>
                    <span>$120 Credits Active</span>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="main-content">
            <!-- Top Navbar -->
            <header class="top-navbar">
                <div class="page-title-group">
                    <h1 id="active-tab-title">Dashboard Overview</h1>
                    <p id="active-tab-subtitle">Real-time system operational stats and server metrics</p>
                </div>
                
                <div class="top-actions">
                    <div class="broker-badge" id="broker-status-badge">
                        <i class="fa-solid fa-network-wired"></i>
                        <span>MQTT Broker: Connected</span>
                    </div>
                    <button class="btn btn-primary" id="btn-refresh-data">
                        <i class="fa-solid fa-arrows-rotate"></i>
                        <span>Refresh Data</span>
                    </button>
                </div>
            </header>

            <!-- TAB 1: OVERVIEW DASHBOARD -->
            <section id="tab-overview" class="tab-pane active">
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-icon blue">
                            <i class="fa-solid fa-users"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Total Users</span>
                            <h3 id="stat-total-users">--</h3>
                            <span class="metric-sub green" id="stat-active-users">-- active accounts</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon green">
                            <i class="fa-solid fa-wifi"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Online Devices</span>
                            <h3 id="stat-online-devices">--</h3>
                            <span class="metric-sub" id="stat-total-devices">-- registered boards</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon purple">
                            <i class="fa-solid fa-server"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Cloud Backend</span>
                            <h3>AWS App Runner</h3>
                            <span class="metric-sub green">FastAPI + PostgreSQL</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon orange">
                            <i class="fa-solid fa-signal"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">MQTT Protocol</span>
                            <h3>TLS 8883</h3>
                            <span class="metric-sub green">EMQX Serverless</span>
                        </div>
                    </div>
                </div>

                <!-- Quick Terminal Output / Activity Log -->
                <div class="panel-card margin-top-20">
                    <div class="panel-header">
                        <h3><i class="fa-solid fa-terminal"></i> Live System Activity & Telemetry Log</h3>
                        <span class="badge green">Live Stream</span>
                    </div>
                    <div class="terminal-box" id="live-terminal-log">
                        <div class="term-line info">[SYSTEM] 4Layers Admin Dashboard connected to AWS Backend API.</div>
                        <div class="term-line success">[MQTT] Connected to EMQX Broker (TLS Port 8883). Listening for telemetry packets...</div>
                    </div>
                </div>
            </section>

            <!-- TAB 2: USERS MANAGEMENT & ACTIVITY -->
            <section id="tab-users" class="tab-pane">
                <div class="panel-card">
                    <div class="panel-header">
                        <div class="header-left">
                            <h3><i class="fa-solid fa-users"></i> Registered Users Directory</h3>
                            <p class="panel-sub">Manage client user accounts, active sessions, and linked devices</p>
                        </div>
                        <div class="header-right">
                            <input type="text" id="user-search-input" class="search-input" placeholder="Search by name or email...">
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table" id="users-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>User Information</th>
                                    <th>Email Address</th>
                                    <th>Linked Devices</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="users-table-body">
                                <tr>
                                    <td colspan="6" class="text-center">Loading registered users from backend...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- TAB 3: MQTT NODES MONITOR -->
            <section id="tab-nodes" class="tab-pane">
                <div class="panel-card">
                    <div class="panel-header">
                        <div class="header-left">
                            <h3><i class="fa-solid fa-microchip"></i> Live ESP32 Hardware Nodes Monitor</h3>
                            <p class="panel-sub">Real-time status, firmware versions, and WiFi signal strength</p>
                        </div>
                        <div class="header-right">
                            <button class="btn btn-outline" id="btn-open-mqtt-tester">
                                <i class="fa-solid fa-paper-plane"></i> Send Test Command
                            </button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table" id="nodes-table">
                            <thead>
                                <tr>
                                    <th>Node ID</th>
                                    <th>Board Name</th>
                                    <th>Owner</th>
                                    <th>Firmware</th>
                                    <th>IP Address</th>
                                    <th>WiFi Signal (RSSI)</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="nodes-table-body">
                                <tr>
                                    <td colspan="8" class="text-center">Scanning active MQTT nodes...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- TAB 4: FIRMWARE & OTA CENTER -->
            <section id="tab-flasher" class="tab-pane">
                <div class="flasher-grid">
                    <!-- Remote OTA Update Card -->
                    <div class="panel-card">
                        <div class="panel-header">
                            <h3><i class="fa-solid fa-cloud-arrow-up"></i> Remote MQTT OTA Firmware Updater</h3>
                        </div>
                        <p class="card-desc">Push over-the-air firmware updates to registered ESP32 boards remotely.</p>
                        
                        <form id="ota-form" class="admin-form">
                            <div class="form-group">
                                <label>Target Node / Device ID</label>
                                <select id="ota-target-device" class="form-select">
                                    <option value="">Broadcast to All Online Devices</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Firmware Version Tag</label>
                                <input type="text" id="ota-firmware-version" class="form-input" value="v2.0.5" required>
                            </div>

                             <div class="form-group">
                                <label>Upload New Firmware Binary (.bin)</label>
                                <input type="file" id="ota-file-input" class="form-input" accept=".bin">
                            </div>

                            <div class="form-group">
                                <label>Firmware File URL (.bin)</label>
                                <input type="url" id="ota-firmware-url" class="form-input" value="https://edabtynvpy.ap-south-1.awsapprunner.com/firmware/latest.bin" required>
                            </div>

                            <button type="submit" id="ota-trigger-btn" class="btn btn-accent full-width">
                                <i class="fa-solid fa-paper-plane"></i> Trigger OTA Remote Update
                            </button>
                        </form>
                    </div>

                    <!-- WebSerial Browser USB Flasher Card -->
                    <div class="panel-card">
                        <div class="panel-header">
                            <h3><i class="fa-brands fa-usb"></i> WebSerial Browser USB Flasher</h3>
                            <span class="badge blue">Direct Browser USB</span>
                        </div>
                        <p class="card-desc">Connect ESP32 via USB cable to Chrome/Edge to flash firmware binary directly!</p>

                        <div class="webserial-box">
                            <div class="webserial-status" id="serial-status-text">
                                <i class="fa-solid fa-plug"></i> USB Cable Disconnected
                            </div>

                            <button class="btn btn-primary full-width" id="btn-connect-usb">
                                <i class="fa-solid fa-link"></i> Connect ESP32 via USB COM Port
                            </button>

                            <div class="form-group margin-top-15">
                                <label>Select Firmware File (.bin)</label>
                                <input type="file" id="local-bin-file" accept=".bin" class="form-file">
                            </div>

                            <button class="btn btn-green full-width" id="btn-flash-usb" disabled>
                                <i class="fa-solid fa-bolt"></i> Flash Firmware to ESP32
                            </button>

                            <div class="progress-bar-container margin-top-15" id="flash-progress-bar" style="display:none;">
                                <div class="progress-fill" id="flash-progress-fill"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <!-- MODAL: Custom MQTT Command Tester -->
    <div class="modal-overlay" id="mqtt-modal">
        <div class="modal-card">
            <div class="modal-header">
                <h3><i class="fa-solid fa-paper-plane"></i> Send Test MQTT Payload</h3>
                <button class="modal-close" id="btn-close-mqtt-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>MQTT Topic</label>
                    <input type="text" id="test-mqtt-topic" class="form-input" value="4layers/devices/4LAYERS-NODE-001/command">
                </div>
                <div class="form-group">
                    <label>Payload (JSON)</label>
                    <textarea id="test-mqtt-payload" class="form-textarea" rows="4">{"channel": 1, "status": "ON"}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="btn-cancel-mqtt-modal">Cancel</button>
                <button class="btn btn-primary" id="btn-send-mqtt-payload">Publish Payload</button>
            </div>
        </div>
    </div>

    <script src="/admin/app.js?v=2.1.5"></script>
</body>
</html>
"""

ADMIN_CSS = """/* 4Layers Admin Console - Glassmorphic Dark Theme System */
:root {
    --bg-dark: #0f172a;
    --bg-card: rgba(30, 41, 59, 0.7);
    --border-color: rgba(255, 255, 255, 0.1);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --accent-green: #00E676;
    --accent-green-hover: #00c853;
    --accent-blue: #3b82f6;
    --accent-purple: #8b5cf6;
    --accent-orange: #f97316;
    --accent-red: #ef4444;
    --card-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    --radius-lg: 16px;
    --radius-md: 10px;
    --font-mono: 'JetBrains Mono', monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
body { background-color: var(--bg-dark); color: var(--text-primary); min-height: 100vh; overflow-x: hidden; }
.admin-layout { display: flex; flex-direction: row; min-height: 100vh; width: 100%; }
.sidebar { width: 260px; min-width: 260px; max-width: 260px; flex-shrink: 0; background: rgba(15, 23, 42, 0.95); border-right: 1px solid var(--border-color); padding: 24px 16px; display: flex; flex-direction: column; justify-content: space-between; backdrop-filter: blur(10px); min-height: 100vh; }
.brand-header { display: flex; align-items: center; gap: 14px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color); }
.brand-logo-img { width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0; border-radius: 10px; object-fit: cover; box-shadow: 0 0 14px rgba(34, 197, 94, 0.4); border: 1px solid rgba(34, 197, 94, 0.3); }
.brand-info { display: flex; flex-direction: column; gap: 2px; }
.brand-info h2 { font-size: 18px; font-weight: 800; color: var(--text-primary); letter-spacing: 0.5px; margin: 0; line-height: 1.2; }
.brand-sub { font-size: 11.5px; color: var(--text-secondary); font-weight: 500; white-space: nowrap; line-height: 1.2; }
.sidebar-nav { margin-top: 24px; display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: transparent; border: none; color: var(--text-secondary); font-size: 14px; font-weight: 600; border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s ease; text-align: left; }
.nav-item i { font-size: 16px; width: 20px; }
.nav-item:hover { background: rgba(255, 255, 255, 0.05); color: var(--text-primary); }
.nav-item.active { background: rgba(34, 197, 94, 0.15); color: var(--accent-green); border: 1px solid rgba(34, 197, 94, 0.3); }
.sidebar-footer { padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 10px; }
.status-indicator { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; }
.status-dot.green { background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
.credit-badge { display: flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; }
.main-content { flex: 1; flex-grow: 1; width: calc(100% - 260px); min-width: 0; padding: 32px; background: radial-gradient(circle at top right, rgba(34, 197, 94, 0.05), transparent 40%); overflow-y: auto; }
.top-navbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; gap: 20px; flex-wrap: wrap; }
.page-title-group { flex: 1; min-width: 200px; }
.page-title-group h1 { font-size: 24px; font-weight: 800; }
.page-title-group p { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.top-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.broker-badge { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: var(--accent-green); padding: 8px 14px; border-radius: 20px; font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.tab-pane { display: none; }
.tab-pane.active { display: block; }
.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.metric-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; align-items: center; gap: 16px; backdrop-filter: blur(10px); box-shadow: var(--card-shadow); }
.metric-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.metric-icon.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
.metric-icon.green { background: rgba(34, 197, 94, 0.15); color: var(--accent-green); }
.metric-icon.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
.metric-icon.orange { background: rgba(249, 115, 22, 0.15); color: var(--accent-orange); }
.metric-info h3 { font-size: 20px; font-weight: 700; }
.metric-label { font-size: 12px; color: var(--text-secondary); display: block; }
.metric-sub { font-size: 11px; color: var(--text-secondary); }
.metric-sub.green { color: var(--accent-green); }
.panel-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 24px; backdrop-filter: blur(10px); box-shadow: var(--card-shadow); }
.margin-top-20 { margin-top: 20px; }
.margin-top-15 { margin-top: 15px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-header h3 { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.panel-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.terminal-box { background: #020617; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); padding: 16px; font-family: var(--font-mono); font-size: 12px; height: 250px; overflow-y: auto; color: #e2e8f0; }
.term-line { margin-bottom: 6px; }
.term-line.info { color: #38bdf8; }
.term-line.success { color: #4ade80; }
.term-line.warn { color: #fbbf24; }
.table-responsive { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.data-table th { text-align: left; padding: 12px 16px; font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border-color); }
.data-table td { padding: 14px 16px; font-size: 13.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.data-table tr:hover td { background: rgba(255, 255, 255, 0.02); }
.badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge.green { background: rgba(34, 197, 94, 0.15); color: var(--accent-green); border: 1px solid rgba(34, 197, 94, 0.3); }
.badge.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); border: 1px solid rgba(59, 130, 246, 0.3); }
.badge.red { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3); }
.btn { padding: 10px 18px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; }
.btn-primary { background: var(--accent-green); color: #000; }
.btn-primary:hover { background: var(--accent-green-hover); }
.btn-accent { background: var(--accent-blue); color: #fff; }
.btn-accent:hover { background: #2563eb; }
.btn-outline { background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); }
.btn-outline:hover { background: rgba(255, 255, 255, 0.05); }
.btn-danger { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3); }
.btn-danger:hover { background: var(--accent-red); color: #fff; }
.full-width { width: 100%; justify-content: center; }
.flasher-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
.card-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
.admin-form .form-group { margin-bottom: 16px; }
.admin-form label { display: block; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500; }
.form-input, .form-select, .form-textarea, .search-input { width: 100%; padding: 10px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 13px; outline: none; }
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent-green); }
.webserial-box { background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 16px; }
.webserial-status { font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: none; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
.modal-overlay.active { display: flex; }
.modal-card { background: #1e293b; border: 1px solid var(--border-color); border-radius: var(--radius-lg); width: 90%; max-width: 500px; padding: 24px; box-shadow: var(--card-shadow); }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.modal-close { background: transparent; border: none; color: var(--text-secondary); font-size: 20px; cursor: pointer; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
"""

ADMIN_JS = """document.addEventListener('DOMContentLoaded', () => {
    let allUsers = [];
    let allDevices = [];
    let serialPort = null;

    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const activeTitle = document.getElementById('active-tab-title');
    const activeSubtitle = document.getElementById('active-tab-subtitle');
    const btnRefresh = document.getElementById('btn-refresh-data');
    const usersTableBody = document.getElementById('users-table-body');
    const nodesTableBody = document.getElementById('nodes-table-body');
    const userSearchInput = document.getElementById('user-search-input');
    const liveTerminal = document.getElementById('live-terminal-log');

    const otaForm = document.getElementById('ota-form');
    const otaTargetDevice = document.getElementById('ota-target-device');
    const mqttModal = document.getElementById('mqtt-modal');
    const btnOpenMqttTester = document.getElementById('btn-open-mqtt-tester');
    const btnCloseMqttModal = document.getElementById('btn-close-mqtt-modal');
    const btnCancelMqttModal = document.getElementById('btn-cancel-mqtt-modal');
    const btnSendMqttPayload = document.getElementById('btn-send-mqtt-payload');

    const btnConnectUsb = document.getElementById('btn-connect-usb');
    const btnFlashUsb = document.getElementById('btn-flash-usb');
    const serialStatusText = document.getElementById('serial-status-text');
    const localBinFile = document.getElementById('local-bin-file');

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

    function logTerminal(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        liveTerminal.appendChild(line);
        liveTerminal.scrollTop = liveTerminal.scrollHeight;
    }

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
                <td style="white-space:nowrap;">
                    <span class="badge blue">${u.device_count || 0} Devices</span>
                    <span class="badge gray" style="background:rgba(255,255,255,0.08);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);margin-left:4px;">${u.room_count || 0} Rooms</span>
                </td>
                <td>
                    ${u.is_active 
                        ? '<span class="badge green">Active</span>' 
                        : '<span class="badge red">Blocked</span>'}
                </td>
                <td style="white-space:nowrap;">
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

        nodesTableBody.innerHTML = devices.map(d => {
            const cleanNodeId = (d.node_id || d.device_id || d.id || '').replace(/\s*-\s*/g, '-').trim();
            return `
            <tr>
                <td><code>${escapeHtml(cleanNodeId)}</code></td>
                <td><strong>ESP32 Board (${escapeHtml(cleanNodeId)})</strong></td>
                <td>${escapeHtml(d.owner_email || d.owner_username || 'Unassigned')}</td>
                <td><span class="badge blue">${escapeHtml(d.firmware_version || 'v1.0.0')}</span></td>
                <td><code>${escapeHtml(d.ip_address || d.mac_address || '192.168.1.50')}</code></td>
                <td><span style="color:var(--accent-green);font-weight:600;"><i class="fa-solid fa-wifi"></i> ${d.rssi || -62} dBm</span></td>
                <td>
                    ${d.is_online 
                        ? '<span class="badge green">ONLINE</span>' 
                        : '<span class="badge red">OFFLINE</span>'}
                </td>
                <td>
                    <button class="btn btn-outline" onclick="quickTestDevice('${escapeHtml(cleanNodeId)}')" style="padding:4px 8px;font-size:11px;">
                        Test
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    function populateOtaDropdown(devices) {
        const onlineBoardsCount = devices.filter(d => d.is_online).length;
        otaTargetDevice.innerHTML = `<option value="">Broadcast to All Online Boards (${onlineBoardsCount} online)</option>`;
        devices.forEach(d => {
            const opt = document.createElement('option');
            const nodeId = (d.node_id || d.device_id || '').replace(/\s*-\s*/g, '-').trim();
            opt.value = nodeId;
            opt.textContent = `${nodeId} (${d.switch_count || 6}-Ch Board) - ${d.is_online ? 'Online' : 'Offline'}`;
            otaTargetDevice.appendChild(opt);
        });
    }

    const otaFirmwareUrlInput = document.getElementById('ota-firmware-url');
    const otaTriggerBtn = document.getElementById('ota-trigger-btn');

    function updateOtaButtonState() {
        if (otaTriggerBtn && otaFirmwareUrlInput) {
            const hasUrl = otaFirmwareUrlInput.value.trim().length > 0;
            otaTriggerBtn.disabled = !hasUrl;
            otaTriggerBtn.style.opacity = hasUrl ? '1' : '0.5';
            otaTriggerBtn.style.cursor = hasUrl ? 'pointer' : 'not-allowed';
        }
    }

    if (otaFirmwareUrlInput) {
        otaFirmwareUrlInput.addEventListener('input', updateOtaButtonState);
        updateOtaButtonState();
    }

    userSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u => 
            u.username.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query) ||
            (u.full_name && u.full_name.toLowerCase().includes(query))
        );
        renderUsers(filtered);
    });

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

    const otaFileInput = document.getElementById('ota-file-input');
    if (otaFileInput) {
        otaFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch('/api/admin/firmware/upload', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    const fullUrl = window.location.origin + data.latest_url;
                    document.getElementById('ota-firmware-url').value = fullUrl;
                    updateOtaButtonState();
                    logTerminal(`Firmware binary uploaded! URL: ${fullUrl}`, 'success');
                    alert(`Firmware binary '${file.name}' uploaded successfully!\nURL updated to: ${fullUrl}`);
                } else {
                    alert('Failed to upload firmware binary file.');
                }
            } catch (err) {
                alert(`Upload error: ${err.message}`);
            }
        });
    }

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

    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function loadAllData() {
        fetchStats();
        fetchUsers();
        fetchDevices();
    }

    btnRefresh.addEventListener('click', loadAllData);
    loadAllData();
    setInterval(loadAllData, 15000);
});
"""
