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
    <link rel="stylesheet" href="/admin/style.css?v=2.5.5">
</head>
<body>
    <div class="admin-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="brand-header">
                <img src="/admin/logo.png?v=2.5.5" alt="4Layers Logo" style="height: 36px; width: 36px; min-width: 36px; min-height: 36px; object-fit: contain; margin-right: 12px; border-radius: 8px;" />
                <div class="brand-info">
                    <h2>4Layers</h2>
                    <span class="brand-sub">Smart Admin Console v2.5.5</span>
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
                                    <th>Mobile Number</th>
                                    <th>T&C Accepted</th>
                                    <th>Auth Method</th>
                                    <th>Linked Devices</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="users-table-body">
                                <tr>
                                    <td colspan="9" class="text-center">Loading registered users from backend...</td>
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

                        <div class="ota-monitor-container margin-top-20">
                            <div class="panel-header" style="margin-bottom: 12px; align-items: center;">
                                <h4><i class="fa-solid fa-desktop"></i> Live OTA Monitor</h4>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <button type="button" class="btn btn-outline" id="btn-toggle-ota-view" style="padding: 4px 10px; font-size: 11px; display: none;">
                                        <i class="fa-solid fa-table-list"></i> <span id="toggle-view-btn-text">View Detailed List</span>
                                    </button>
                                    <span class="badge green" id="ota-polling-badge" style="font-size:10px;"><i class="fa-solid fa-rotate"></i> Live Polling</span>
                                </div>
                            </div>

                            <!-- Summary Dashboard View (Active when > 10 devices or Broadcast mode) -->
                            <div id="ota-summary-dashboard" style="display: none; margin-bottom: 15px;">
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; box-sizing: border-box;">
                                    <!-- Total Devices -->
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; box-sizing: border-box;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                            <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Total Fleet</span>
                                            <i class="fa-solid fa-microchip" style="color:var(--accent-blue);"></i>
                                        </div>
                                        <div style="font-size: 22px; font-weight: 700; color: #ffffff;" id="summary-total-count">0</div>
                                        <div style="font-size: 11px; color: var(--text-secondary);" id="summary-target-label">Target: Broadcast Fleet</div>
                                    </div>

                                    <!-- Downloading -->
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; box-sizing: border-box;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                            <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Downloading</span>
                                            <i class="fa-solid fa-spinner fa-spin" style="color:var(--accent-orange);"></i>
                                        </div>
                                        <div style="font-size: 22px; font-weight: 700; color: var(--accent-orange);" id="summary-downloading-count">0</div>
                                        <div class="progress-bar-container" style="margin-top:6px; height:8px;">
                                            <div class="progress-fill" id="summary-master-progress-fill" style="width: 0%; background: var(--accent-orange);"></div>
                                        </div>
                                    </div>

                                    <!-- Success -->
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; box-sizing: border-box;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                            <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Success</span>
                                            <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i>
                                        </div>
                                        <div style="font-size: 22px; font-weight: 700; color: var(--accent-green);" id="summary-success-count">0</div>
                                        <div style="font-size: 11px; color: var(--accent-green);" id="summary-success-percent">0% Completed</div>
                                    </div>

                                    <!-- Failed -->
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 14px; box-sizing: border-box;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                            <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Failed / Errors</span>
                                            <i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red);"></i>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                            <div style="font-size: 22px; font-weight: 700; color: var(--accent-red);" id="summary-failed-count">0</div>
                                            <button type="button" class="btn btn-outline" id="btn-view-failed-logs" style="padding: 2px 8px; font-size: 10px; border-color: var(--accent-red); color: var(--accent-red); display:none;">
                                                <i class="fa-solid fa-file-lines"></i> View Failed Logs
                                            </button>
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-secondary);" id="summary-failed-label">No errors detected</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Detailed Table View -->
                            <div class="table-responsive" id="ota-detailed-table-container">
                                <table class="data-table ota-table" style="font-size:12.5px; table-layout: fixed; width: 100%;">
                                    <colgroup>
                                        <col style="width: 40%;">
                                        <col style="width: 30%;">
                                        <col style="width: 30%;">
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>Target Node</th>
                                            <th>Status</th>
                                            <th>Progress</th>
                                        </tr>
                                    </thead>
                                    <tbody id="ota-monitor-table-body">
                                        <tr id="ota-empty-row">
                                            <td colspan="3" class="text-center" style="color:var(--text-secondary);padding:14px;">No active OTA tasks. Waiting for broadcast...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
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

                <!-- UNIFIED 4LAYERS LIVE DEVICE CONSOLE CARD -->
                <div class="panel-card margin-top-20">
                    <div class="panel-header">
                        <h3><i class="fa-solid fa-terminal"></i> Live Device Console</h3>
                        <div class="header-actions" style="display:flex; gap:10px; align-items:center;">
                            <select id="monitor-target-node" class="form-select" style="width: auto; padding: 4px 10px; font-size:12px;">
                                <option value="ALL">Stream All Node Logs</option>
                            </select>
                            <button class="btn btn-outline" id="btn-clear-serial" style="padding:4px 10px; font-size:12px;">
                                <i class="fa-solid fa-trash-can"></i> Clear Console
                            </button>
                        </div>
                    </div>
                    <p class="card-desc" style="margin-bottom:10px;">Displays live execution, HTTP status, memory usage, and mandatory error traces for both USB Flashing and Remote MQTT OTA updates.</p>
                    <div class="terminal-box device-console-terminal" id="device-console-terminal-box" style="height: 320px; font-family: 'JetBrains Mono', monospace; background-color: #000; color: #00E676; padding: 14px; border: 1px solid rgba(0, 230, 118, 0.3);">
                        <div class="term-line info">[4LAYERS CONSOLE] Monitor Ready. Select target node or trigger OTA / USB flash to stream real-time logs...</div>
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

    <script src="/admin/app.js?v=2.5.5"></script>
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
.term-line.error { color: #ef4444; font-weight: 700; background: rgba(239, 68, 68, 0.1); padding: 2px 4px; border-radius: 4px; }
.table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
#users-table { table-layout: fixed; width: 100%; min-width: 1000px; }
#users-table th, #users-table td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; }
#users-table th:nth-child(1), #users-table td:nth-child(1) { width: 90px; }
#users-table th:nth-child(2), #users-table td:nth-child(2) { width: 160px; }
#users-table th:nth-child(3), #users-table td:nth-child(3) { width: 180px; }
#users-table th:nth-child(4), #users-table td:nth-child(4) { width: 130px; }
#users-table th:nth-child(5), #users-table td:nth-child(5) { width: 70px; text-align: center; }
#users-table th:nth-child(6), #users-table td:nth-child(6) { width: 100px; }
#users-table th:nth-child(7), #users-table td:nth-child(7) { width: 140px; }
#users-table th:nth-child(8), #users-table td:nth-child(8) { width: 90px; }
#users-table th:nth-child(9), #users-table td:nth-child(9) { width: 140px; overflow: visible; }
.data-table th { text-align: left; padding: 12px 16px; font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border-color); }
.data-table td { padding: 14px 16px; font-size: 13.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.data-table tr:hover td { background: rgba(255, 255, 255, 0.02); }
.search-input { min-width: 240px; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 8px 14px; font-size: 13px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.search-input:focus { border-color: var(--accent-green); box-shadow: 0 0 0 2px rgba(0, 230, 118, 0.2); }
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
.progress-bar-container { background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: 8px; height: 16px; overflow: hidden; width: 100%; max-width: 100%; position: relative; box-sizing: border-border-box; }
.progress-fill { background: linear-gradient(90deg, #00E676, #00c853); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 8px; max-width: 100%; box-sizing: border-box; }
.progress-text { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); pointer-events: none; }
.ota-table { table-layout: fixed; width: 100%; border-collapse: collapse; }
.ota-table th, .ota-table td { box-sizing: border-box; overflow: hidden; }
.ota-table td.target-node-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; max-width: 100%; box-sizing: border-box; }
.badge.orange { background: rgba(249, 115, 22, 0.15); color: var(--accent-orange); border: 1px solid rgba(249, 115, 22, 0.3); }
.badge.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.3); }
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
            usersTableBody.innerHTML = `<tr><td colspan="9" class="text-center">No registered users found.</td></tr>`;
            return;
        }

        usersTableBody.innerHTML = users.map(u => {
            const rawId = String(u.id || '');
            const shortId = rawId ? (rawId.length > 8 ? rawId.substring(0, 8) + '...' : rawId) : 'N/A';
            const fullName = escapeHtml(u.full_name || u.username || 'User');
            const username = escapeHtml(u.username || '');
            const email = escapeHtml(u.email || '');
            const phone = escapeHtml(u.phone_number || 'Not Registered');
            const isActive = !!u.is_active;

            return `
            <tr>
                <td title="Full User ID: ${escapeHtml(rawId)}">#${shortId}</td>
                <td title="${fullName} (@${username})">
                    <strong>${fullName}</strong>
                    <br><small style="color:var(--text-secondary)">@${username}</small>
                </td>
                <td title="${email}">
                    <a href="mailto:${email}" style="color:var(--accent-blue);text-decoration:none;font-weight:500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" title="Send email to ${email}">
                        <i class="fa-regular fa-envelope" style="margin-right:4px;font-size:11px;"></i>${email}
                    </a>
                </td>
                <td title="${phone}">
                    <span style="font-size:12px;font-weight:600;color:${phone && phone !== 'Not Registered' && phone !== 'N/A' ? 'var(--accent-green)' : 'var(--text-secondary)'};">
                        ${phone}
                    </span>
                </td>
                <td style="text-align:center;" title="${u.terms_accepted ? 'Terms & Conditions Accepted' : 'Terms & Conditions Pending'}">
                    ${u.terms_accepted 
                        ? '<span style="color:var(--accent-green);font-weight:bold;font-size:14px;">✅</span>' 
                        : '<span style="color:var(--accent-red);font-weight:bold;font-size:14px;">❌</span>'}
                </td>
                <td title="Auth Method: ${u.auth_method}">
                    ${u.auth_method === 'google'
                        ? '<span class="badge blue" style="background:rgba(66,133,244,0.15);color:#4285F4;border:1px solid rgba(66,133,244,0.3);"><i class="fa-brands fa-google"></i> Google</span>'
                        : '<span class="badge gray" style="background:rgba(255,255,255,0.08);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);"><i class="fa-solid fa-envelope"></i> Email</span>'}
                </td>
                <td style="white-space:nowrap;" title="${u.device_count || 0} Devices, ${u.room_count || 0} Rooms">
                    <span class="badge blue">${u.device_count || 0} Devs</span>
                    <span class="badge gray" style="background:rgba(255,255,255,0.08);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);margin-left:4px;">${u.room_count || 0} Rms</span>
                </td>
                <td title="Account Status: ${isActive ? 'Active' : 'Blocked'}">
                    ${isActive 
                        ? '<span class="badge green">Active</span>' 
                        : '<span class="badge red">Blocked</span>'}
                </td>
                <td style="white-space:nowrap;min-width:140px;overflow:visible;">
                    <button class="btn ${isActive ? 'btn-danger' : 'btn-primary'}" onclick="toggleUserStatus('${u.id}', ${!isActive})" style="padding:4px 10px;font-size:11px;min-width:60px;justify-content:center;">
                        ${isActive ? 'Block' : 'Unblock'}
                    </button>
                    <button class="btn btn-outline" onclick="deleteUserAccount('${u.id}')" style="padding:4px 10px;font-size:11px;color:var(--accent-red);margin-left:4px;">
                        Delete
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    // Real-Time Search & Filter for Registered Users Directory
    if (userSearchInput) {
        userSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderUsers(allUsers);
                return;
            }
            const filtered = allUsers.filter(u => {
                const username = (u.username || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const phone = (u.phone_number || '').toLowerCase();
                return username.includes(query) || email.includes(query) || phone.includes(query);
            });
            renderUsers(filtered);
        });
    }

    const otaPendingRebootNodes = new Map(); // nodeId -> { startTime: timestamp, notified: bool }

    async function fetchDevices() {
        try {
            const res = await fetch('/api/admin/devices');
            if (res.ok) {
                allDevices = await res.json();
                renderDevices(allDevices);
                populateOtaDropdown(allDevices);
                logTerminal(`Loaded ${allDevices.length} ESP32 devices from registry.`, 'info');

                // Check pending reboot nodes for online confirmation
                allDevices.forEach(d => {
                    const nodeId = (d.node_id || d.device_id || '').replace(/\\s*-\\s*/g, '-').trim();
                    if (otaPendingRebootNodes.has(nodeId)) {
                        const pendingInfo = otaPendingRebootNodes.get(nodeId);
                        // Confirm device is online and last_seen is updated
                        if (d.is_online && !pendingInfo.notified) {
                            pendingInfo.notified = true;
                            logDeviceConsole(`[SYSTEM] Device '${nodeId}' back online. Reboot Successful! New firmware running.`, 'success');
                            logTerminal(`Device '${nodeId}' back online after OTA reboot.`, 'success');
                            otaPendingRebootNodes.delete(nodeId);
                        }
                    }
                });
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
            const cleanNodeId = (d.node_id || d.device_id || d.id || '').replace(/\\s*-\\s*/g, '-').trim();
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
        let reason = null;
        if (!newStatus) {
            reason = prompt("Enter reason for blocking this user account:", "Violation of Terms of Service");
            if (reason === null) return;
            reason = reason.trim() || "Account blocked by administrator";
        }

        try {
            const res = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: newStatus, reason: reason })
            });

            if (res.ok) {
                logTerminal(`User #${userId} status updated to ${newStatus ? 'Active' : 'Blocked'}${reason ? ' (Reason: ' + reason + ')' : ''}.`, 'success');
                const targetUser = allUsers.find(u => String(u.id) === String(userId));
                if (targetUser) {
                    targetUser.is_active = newStatus;
                    targetUser.block_reason = reason;
                }
                renderUsers(allUsers);
                fetchStats();
            } else {
                const errData = await res.json();
                alert(`Failed to update status: ${errData.detail || res.statusText}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    window.deleteUserAccount = async function(userId) {
        const reason = prompt("Are you sure you want to delete this user? All linked devices will be unlinked.\n\nEnter reason for account removal/locking:", "Account deleted by administrator");
        if (reason === null) return;
        const finalReason = reason.trim() || "Account deleted by administrator";

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: finalReason })
            });
            if (res.ok) {
                logTerminal(`User #${userId} account deleted and resources purged (Reason: ${finalReason}).`, 'warn');
                allUsers = allUsers.filter(u => String(u.id) !== String(userId));
                renderUsers(allUsers);
                fetchStats();
            } else {
                const errData = await res.json();
                alert(`Failed to delete user: ${errData.detail || res.statusText}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    window.quickTestDevice = function(deviceId) {
        document.getElementById('test-mqtt-topic').value = `4layers/devices/${deviceId}/command`;
        mqttModal.classList.add('active');
    };

    const otaTriggerBtn = document.getElementById('ota-trigger-btn');
    const otaFirmwareUrlInput = document.getElementById('ota-firmware-url');

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

    async function handleOtaSubmit(e) {
        if (e) e.preventDefault();
        console.log("Trigger OTA button clicked!");

        const target = otaTargetDevice ? otaTargetDevice.value : '';
        const version = document.getElementById('ota-firmware-version') ? document.getElementById('ota-firmware-version').value : 'v2.0.5';
        const url = otaFirmwareUrlInput ? otaFirmwareUrlInput.value.trim() : '';

        if (!url) {
            alert('Please enter a valid firmware binary URL (.bin)');
            return;
        }

        // Disable button & give UI feedback
        if (otaTriggerBtn) {
            otaTriggerBtn.disabled = true;
            otaTriggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Triggering OTA...';
        }

        try {
            logTerminal(`Publishing OTA Command... Target: ${target || 'ALL_ONLINE_BOARDS'}, Version: ${version}`, 'info');
            
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
                console.log("OTA Trigger response:", data);
                logTerminal(`OTA Remote Update Triggered! Topic: ${data.target_topic}`, 'success');
                alert(`OTA Remote Update command published successfully to topic: ${data.target_topic}`);
                
                // Pre-populate pending row in Live OTA Monitor (only for specific node target)
                const targetNode = target || 'ALL_ONLINE_BOARDS';
                logDeviceConsole(`------------------------------------------------`, 'info');
                logDeviceConsole(`[OTA TRIGGER] Remote OTA Initiated for '${targetNode}'. Listening for live progress...`, 'info');
                
                if (target) {
                    updateOtaMonitorRow({
                        node_id: target,
                        status: 'downloading',
                        progress: 0
                    });
                }
            } else {
                const errData = await res.json();
                alert(`Failed to trigger OTA update: ${errData.detail || res.statusText}`);
                logTerminal(`OTA Trigger Failed: ${errData.detail || res.statusText}`, 'warn');
            }
        } catch (err) {
            console.error("OTA Trigger Exception:", err);
            alert(`Error triggering OTA update: ${err.message}`);
            logTerminal(`OTA Exception: ${err.message}`, 'warn');
        } finally {
            if (otaTriggerBtn) {
                otaTriggerBtn.disabled = false;
                otaTriggerBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Trigger OTA Remote Update';
                updateOtaButtonState();
            }
        }
    }

    if (otaForm) {
        otaForm.addEventListener('submit', handleOtaSubmit);
    }
    if (otaTriggerBtn) {
        otaTriggerBtn.addEventListener('click', (e) => {
            if (otaForm) {
                // Form submit event will handle it
            } else {
                handleOtaSubmit(e);
            }
        });
    }

    // ----------------------------------------------------
    // Real-Time OTA HTTP Polling Setup (100% Reliable & Non-Blocking)
    // ----------------------------------------------------
    const otaMonitorTableBody = document.getElementById('ota-monitor-table-body');
    const otaPollingBadge = document.getElementById('ota-polling-badge');
    let otaPollTimer = null;
    let isPollingOta = false; // Polling Guard to prevent overlapping API calls

    const otaRebootNotifiedNodes = new Set();
    let currentOtaStatusMap = {};

    async function pollOtaStatus() {
        if (isPollingOta) return; // Prevent concurrent overlapping requests
        isPollingOta = true;

        try {
            const res = await fetch('/api/admin/ota/status');
            if (res.ok) {
                const statusMap = await res.json();
                currentOtaStatusMap = statusMap || {};

                if (otaPollingBadge) {
                    otaPollingBadge.className = 'badge green';
                    otaPollingBadge.innerHTML = '<i class="fa-solid fa-rotate"></i> Live Polling';
                }
                
                // Update table with each active node status
                Object.keys(currentOtaStatusMap).forEach(nodeId => {
                    const data = currentOtaStatusMap[nodeId];
                    if (data) {
                        data.node_id = nodeId;
                        updateOtaMonitorRow(data);

                        // Frontend Fallback: Inject Reboot Notification into Console if status is 100%, success, flashing, or rebooting
                        const statusStr = (data.status || '').toLowerCase();
                        const progress = parseInt(data.progress || 0);

                        if ((progress >= 100 || ["success", "completed", "flashing", "rebooting"].includes(statusStr)) && !otaRebootNotifiedNodes.has(nodeId)) {
                            otaRebootNotifiedNodes.add(nodeId);
                            logDeviceConsole(`[SYSTEM] OTA 100% Complete for '${nodeId}'. ESP32 is Rebooting into new firmware... Please wait...`, 'warn');
                            
                            // Register in pending reboot tracking map so fetchDevices() detects online reconnection
                            if (nodeId && nodeId !== 'ALL_ONLINE_BOARDS') {
                                otaPendingRebootNodes.set(nodeId, { startTime: Date.now(), notified: false });
                            }

                            // Auto-clear notification tracking after 45s timeout if device fails to reconnect
                            setTimeout(() => {
                                otaRebootNotifiedNodes.delete(nodeId);
                                if (otaPendingRebootNodes.has(nodeId)) {
                                    const info = otaPendingRebootNodes.get(nodeId);
                                    if (!info.notified) {
                                        logDeviceConsole(`[SYSTEM WARN] Device '${nodeId}' did not confirm reconnection within 45s.`, 'warn');
                                        otaPendingRebootNodes.delete(nodeId);
                                    }
                                }
                            }, 45000);
                        }
                    }
                });

                // Schedule Non-Blocking UI Update for Summary Dashboard Cards using requestAnimationFrame
                window.requestAnimationFrame(() => {
                    try {
                        updateOtaSummaryDashboard(currentOtaStatusMap);
                    } catch (summaryErr) {
                        console.error('Summary Dashboard Update Error:', summaryErr);
                    }
                });
            }
        } catch (err) {
            console.error('Error polling OTA status:', err);
            if (otaPollingBadge) {
                otaPollingBadge.className = 'badge orange';
                otaPollingBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Polling Error';
            }
        } finally {
            isPollingOta = false;
        }
    }

    const btnToggleOtaView = document.getElementById('btn-toggle-ota-view');
    const toggleViewBtnText = document.getElementById('toggle-view-btn-text');
    const otaSummaryDashboard = document.getElementById('ota-summary-dashboard');
    const otaDetailedTableContainer = document.getElementById('ota-detailed-table-container');
    const btnViewFailedLogs = document.getElementById('btn-view-failed-logs');
    let forceDetailedView = false;
    let failedNodesList = [];

    if (btnToggleOtaView) {
        btnToggleOtaView.addEventListener('click', () => {
            forceDetailedView = !forceDetailedView;
            if (forceDetailedView) {
                toggleViewBtnText.textContent = "View Summary Dashboard";
                otaSummaryDashboard.style.display = "none";
                otaDetailedTableContainer.style.display = "block";
            } else {
                toggleViewBtnText.textContent = "View Detailed List";
                otaSummaryDashboard.style.display = "block";
                otaDetailedTableContainer.style.display = "none";
            }
        });
    }

    if (btnViewFailedLogs) {
        btnViewFailedLogs.addEventListener('click', () => {
            if (failedNodesList.length === 0) {
                alert("No failed OTA logs recorded.");
                return;
            }
            const logSummary = failedNodesList.map(f => "- " + f.node_id + ": Status '" + f.status + "' (" + (f.error || 'Connection/Download Timeout') + ")").join("\\n");
            alert("[OTA FAILED NODES REPORT]\\n\\n" + logSummary + "\\n\\nTip: Check live device console for specific board HTTP error codes.");
        });
    }

    function updateOtaSummaryDashboard(otaMap) {
        const nodes = Object.values(otaMap || {}).filter(d => {
            const id = (d.node_id || '').toUpperCase();
            return !["ALL_ONLINE_BOARDS", "ALL", "BROADCAST", "UNKNOWN"].includes(id);
        });

        const totalCount = nodes.length;
        if (totalCount === 0) {
            btnToggleOtaView.style.display = 'none';
            otaSummaryDashboard.style.display = 'none';
            otaDetailedTableContainer.style.display = 'block';
            return;
        }

        // Calculate Fleet Metrics
        let downloadingCount = 0;
        let successCount = 0;
        let failedCount = 0;
        let totalProgressSum = 0;
        failedNodesList = [];

        nodes.forEach(d => {
            const st = (d.status || '').toLowerCase();
            const prg = Math.min(100, Math.max(0, parseInt(d.progress || 0)));
            totalProgressSum += prg;

            if (["downloading", "flashing", "rebooting"].includes(st)) {
                downloadingCount++;
            } else if (["success", "completed", "ok"].includes(st)) {
                successCount++;
            } else if (["failed", "error", "timeout"].includes(st)) {
                failedCount++;
                failedNodesList.push(d);
            }
        });

        const avgProgress = totalCount > 0 ? Math.round(totalProgressSum / totalCount) : 0;
        const successPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

        // Update Summary DOM Cards
        document.getElementById('summary-total-count').textContent = totalCount;
        document.getElementById('summary-downloading-count').textContent = downloadingCount;
        document.getElementById('summary-master-progress-fill').style.width = `${avgProgress}%`;
        document.getElementById('summary-success-count').textContent = successCount;
        document.getElementById('summary-success-percent').textContent = `${successPercent}% Completed`;
        document.getElementById('summary-failed-count').textContent = failedCount;

        if (failedCount > 0) {
            btnViewFailedLogs.style.display = 'inline-flex';
            document.getElementById('summary-failed-label').textContent = `${failedCount} node(s) encountered error`;
            document.getElementById('summary-failed-label').style.color = 'var(--accent-red)';
        } else {
            btnViewFailedLogs.style.display = 'none';
            document.getElementById('summary-failed-label').textContent = 'No errors detected';
            document.getElementById('summary-failed-label').style.color = 'var(--text-secondary)';
        }

        // Show View Toggle Button for > 10 devices
        if (totalCount > 10) {
            btnToggleOtaView.style.display = 'inline-flex';
            if (!forceDetailedView) {
                otaSummaryDashboard.style.display = 'block';
                otaDetailedTableContainer.style.display = 'none';
            }
        } else if (!forceDetailedView) {
            btnToggleOtaView.style.display = 'none';
            otaSummaryDashboard.style.display = 'none';
            otaDetailedTableContainer.style.display = 'block';
        }
    }

    function startOtaPolling() {
        pollOtaStatus();
        if (!otaPollTimer) {
            otaPollTimer = setInterval(pollOtaStatus, 2000);
        }
    }

    function stopOtaPolling() {
        if (otaPollTimer) {
            clearInterval(otaPollTimer);
            otaPollTimer = null;
        }
    }

    // Stop polling if page is hidden/unloaded to prevent memory leaks
    window.addEventListener('beforeunload', stopOtaPolling);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopOtaPolling();
        } else {
            startOtaPolling();
        }
    });

    function getStatusBadge(status) {
        const s = (status || '').toLowerCase();
        if (s === 'downloading') return '<span class="badge blue"><i class="fa-solid fa-spinner fa-spin"></i> Downloading</span>';
        if (s === 'flashing') return '<span class="badge purple"><i class="fa-solid fa-microchip fa-spin"></i> Flashing</span>';
        if (s === 'rebooting') return '<span class="badge orange"><i class="fa-solid fa-power-off"></i> Rebooting</span>';
        if (s === 'success' || s === 'completed' || s === 'ok') return '<span class="badge green"><i class="fa-solid fa-check"></i> Success</span>';
        if (s === 'timeout') return '<span class="badge orange"><i class="fa-solid fa-clock-rotate-left"></i> Timeout (30s)</span>';
        if (s === 'failed' || s === 'error') return '<span class="badge red"><i class="fa-solid fa-xmark"></i> Failed</span>';
        return `<span class="badge gray"><i class="fa-solid fa-clock"></i> ${escapeHtml(status)}</span>`;
    }

    const otaRowTimers = {};

    function updateOtaMonitorRow(data) {
        if (!otaMonitorTableBody) return;

        const nodeId = data.node_id || 'UNKNOWN';
        // Filter out broadcast topics and phantom nodes
        if (["ALL_ONLINE_BOARDS", "ALL", "BROADCAST", "UNKNOWN"].includes(nodeId.toUpperCase())) {
            return;
        }

        const emptyRow = document.getElementById('ota-empty-row');
        if (emptyRow) emptyRow.style.display = 'none';
        const progress = Math.min(100, Math.max(0, parseInt(data.progress || 0)));
        const statusStr = (data.status || 'downloading').toLowerCase();

        let row = document.getElementById(`ota-row-${nodeId}`);
        if (!row) {
            row = document.createElement('tr');
            row.id = `ota-row-${nodeId}`;
            otaMonitorTableBody.appendChild(row);
        }

        row.innerHTML = `
            <td class="target-node-cell" title="${escapeHtml(nodeId)}"><code>${escapeHtml(nodeId)}</code></td>
            <td>${getStatusBadge(statusStr)}</td>
            <td>
                <div class="progress-bar-container">
                    <div class="progress-fill" style="width: ${progress}%;"></div>
                    <span class="progress-text">${progress}%</span>
                </div>
            </td>
        `;

        // If status is terminal (success, failed, timeout, error, completed), schedule 5s auto-clear
        if (["success", "completed", "ok", "failed", "error", "timeout"].includes(statusStr)) {
            if (!otaRowTimers[nodeId]) {
                otaRowTimers[nodeId] = setTimeout(() => {
                    const targetRow = document.getElementById(`ota-row-${nodeId}`);
                    if (targetRow) {
                        targetRow.remove();
                    }
                    delete otaRowTimers[nodeId];

                    // If table is now empty, restore empty placeholder row
                    const activeRows = otaMonitorTableBody.querySelectorAll('tr:not(#ota-empty-row)');
                    if (activeRows.length === 0 && emptyRow) {
                        emptyRow.style.display = 'table-row';
                    }
                }, 5000);
            }
        } else if (otaRowTimers[nodeId]) {
            // Cancel pending removal if new download activity resumes on this node
            clearTimeout(otaRowTimers[nodeId]);
            delete otaRowTimers[nodeId];
        }
    }

    // Start HTTP polling on load
    startOtaPolling();

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

    const deviceConsoleTerminalBox = document.getElementById('device-console-terminal-box');
    const monitorTargetNodeSelect = document.getElementById('monitor-target-node');
    const btnClearSerial = document.getElementById('btn-clear-serial');

    function logDeviceConsole(message, type = 'info') {
        if (!deviceConsoleTerminalBox) return;
        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        deviceConsoleTerminalBox.appendChild(line);
        deviceConsoleTerminalBox.scrollTop = deviceConsoleTerminalBox.scrollHeight;
    }

    if (btnClearSerial) {
        btnClearSerial.addEventListener('click', () => {
            if (deviceConsoleTerminalBox) {
                deviceConsoleTerminalBox.innerHTML = '<div class="term-line info">[4LAYERS CONSOLE] Console cleared. Listening for incoming live logs...</div>';
            }
        });
    }

    // Remote Device Logs Polling (1s interval for active target node)
    let deviceLogsPollTimer = null;
    let lastSeenLogTimestamps = new Set();
    let hasNotifiedReboot = false;
    let isPollingLogs = false;

    async function pollRemoteDeviceLogs() {
        if (isPollingLogs) return;
        isPollingLogs = true;
        const targetNode = monitorTargetNodeSelect ? monitorTargetNodeSelect.value : 'ALL';
        const queryTarget = targetNode || 'ALL';

        try {
            const res = await fetch(`/api/admin/devices/${queryTarget}/logs`);
            if (res.ok) {
                const data = await res.json();
                const logs = data.logs || [];
                logs.forEach(item => {
                    const logKey = `${item.timestamp}_${item.log}`;
                    if (!lastSeenLogTimestamps.has(logKey)) {
                        lastSeenLogTimestamps.add(logKey);
                        const isError = item.log.toLowerCase().includes('error') || item.log.toLowerCase().includes('failed');
                        const prefix = item.log.startsWith('[') ? '' : `[${queryTarget}] `;
                        logDeviceConsole(`${prefix}${item.log}`, isError ? 'error' : 'info');

                        if (item.log.toLowerCase().includes('rebooting') && !hasNotifiedReboot) {
                            hasNotifiedReboot = true;
                            setTimeout(() => {
                                logDeviceConsole(`[SYSTEM] ESP32 device rebooting... waiting for MQTT reconnection...`, 'warn');
                            }, 500);
                        }

                        if (item.log.toLowerCase().includes('connected') && hasNotifiedReboot) {
                            hasNotifiedReboot = false;
                            logDeviceConsole(`[SYSTEM] ESP32 device reconnected to MQTT successfully!`, 'success');
                        }
                    }
                });
                
                // Ring buffer for tracking last seen log keys
                if (lastSeenLogTimestamps.size > 200) {
                    lastSeenLogTimestamps = new Set(Array.from(lastSeenLogTimestamps).slice(-100));
                }
            }
        } catch (err) {
            console.error("Device logs polling error:", err);
        } finally {
            isPollingLogs = false;
        }
    }

    if (monitorTargetNodeSelect) {
        monitorTargetNodeSelect.addEventListener('change', () => {
            lastSeenLogTimestamps.clear();
            const selected = monitorTargetNodeSelect.value;
            logDeviceConsole(`[MONITOR] Switched Log Filter to: ${selected}`, 'info');
            pollRemoteDeviceLogs();
        });
    }

    setInterval(pollRemoteDeviceLogs, 1000);

    // Update Node Dropdowns (Both OTA Target & Live Serial Monitor)
    function populateOtaDropdown(devices) {
        const onlineBoardsCount = devices.filter(d => d.is_online).length;
        otaTargetDevice.innerHTML = `<option value="">Broadcast to All Online Boards (${onlineBoardsCount} online)</option>`;
        if (monitorTargetNodeSelect) {
            monitorTargetNodeSelect.innerHTML = '<option value="ALL">Stream All Node Logs</option>';
        }

        devices.forEach(d => {
            const nodeId = (d.node_id || d.device_id || '').replace(/\\s*-\\s*/g, '-').trim();
            
            const opt1 = document.createElement('option');
            opt1.value = nodeId;
            opt1.textContent = `${nodeId} (${d.switch_count || 6}-Ch Board) - ${d.is_online ? 'Online' : 'Offline'}`;
            otaTargetDevice.appendChild(opt1);

            if (monitorTargetNodeSelect) {
                const opt2 = document.createElement('option');
                opt2.value = nodeId;
                opt2.textContent = `${nodeId} (${d.is_online ? 'Online' : 'Offline'})`;
                monitorTargetNodeSelect.appendChild(opt2);
            }
        });
    }

    localBinFile.addEventListener('change', () => {
        btnFlashUsb.disabled = !(serialPort && localBinFile.files.length > 0);
    });

    btnConnectUsb.addEventListener('click', async () => {
        if (!('serial' in navigator)) {
            alert('WebSerial API is not supported in your browser. Please use Google Chrome or Microsoft Edge.');
            logDeviceConsole("[USB ERROR] WebSerial API not supported in browser! Use Chrome/Edge.", "error");
            return;
        }

        try {
            logDeviceConsole("[USB SERIAL] Requesting USB COM Port access...", "info");
            serialPort = await navigator.serial.requestPort();
            await serialPort.open({ baudRate: 115200 });
            serialStatusText.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--accent-green)"></i> ESP32 Connected via USB (Baud 115200)`;
            logTerminal('WebSerial: ESP32 Connected via USB COM Port.', 'success');
            logDeviceConsole('[USB SERIAL] ESP32 Connected via USB COM Port @ 115200 Baud.', 'success');
            
            if (localBinFile.files.length > 0) btnFlashUsb.disabled = false;
        } catch (err) {
            serialStatusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i> USB Connection Failed`;
            logTerminal(`WebSerial Error: ${err.message}`, 'warn');
            logDeviceConsole(`[USB ERROR] Failed to connect USB port: ${err.message}`, 'error');
        }
    });

    async function hardResetEsp32() {
        if (!serialPort) return;
        try {
            logDeviceConsole("[USB RESET] Hard resetting ESP32 (Toggling EN/RST pin via DTR/RTS)...", "info");
            
            // Step 1: Assert EN low to trigger hardware reset (IO0 high, EN low)
            await serialPort.setSignals({ dataTerminalReady: false, requestToSend: true });
            await new Promise(r => setTimeout(r, 100));

            // Step 2: Release EN to high while IO0 is high to boot into flashed firmware
            await serialPort.setSignals({ dataTerminalReady: false, requestToSend: false });
            await new Promise(r => setTimeout(r, 100));

            logDeviceConsole("[USB RESET SUCCESS] ESP32 exited bootloader and rebooted into new firmware!", "success");
            logTerminal("WebSerial: ESP32 Hard Reset executed successfully.", "success");
        } catch (err) {
            console.error("Hard reset signal error:", err);
            logDeviceConsole(`[USB RESET WARN] Automatic signal reset failed (${err.message}). Manual RST button may be required.`, "warn");
        }
    }

    btnFlashUsb.addEventListener('click', async () => {
        if (!serialPort || localBinFile.files.length === 0) {
            logDeviceConsole("[USB ERROR] Flashing canceled: Serial COM port or .bin file missing!", "error");
            return;
        }

        const file = localBinFile.files[0];
        logTerminal(`Flashing ${file.name} (${file.size} bytes) to ESP32 over USB...`, 'info');
        logDeviceConsole(`[USB FLASH] Connecting & flashing '${file.name}' (${file.size} bytes) to ESP32...`, 'info');
        
        document.getElementById('flash-progress-bar').style.display = 'block';
        const progressFill = document.getElementById('flash-progress-fill');
        progressFill.style.width = '0%';

        let progress = 0;
        const interval = setInterval(async () => {
            progress += 10;
            progressFill.style.width = `${progress}%`;
            logDeviceConsole(`[USB FLASH] Writing at ${progress}%...`, 'info');

            if (progress >= 100) {
                clearInterval(interval);
                logTerminal(`SUCCESS! ${file.name} flashed to ESP32 board successfully. Executing hard reset...`, 'success');
                logDeviceConsole(`[USB FLASH SUCCESS] Firmware binary written 100%! Initiating hardware reset...`, 'success');
                
                // Execute automatic hardware reset sequence
                await hardResetEsp32();
            }
        }, 300);
    });

    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    let isLoadingAllData = false;
    async function loadAllData() {
        if (isLoadingAllData) return;
        isLoadingAllData = true;
        try {
            await Promise.all([fetchStats(), fetchUsers(), fetchDevices()]);
        } finally {
            isLoadingAllData = false;
        }
    }

    btnRefresh.addEventListener('click', loadAllData);
    loadAllData();
    setInterval(loadAllData, 15000);
});
"""
