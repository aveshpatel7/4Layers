"""
4Layers Web Admin Console - Embedded UI Provider
Guarantees 100% zero disk path error deployment on Docker & AWS App Runner.
"""

ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>4Layers Smart Home - Admin Management Console</title>
    <!-- Google Fonts & FontAwesome -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/admin/style.css?v=2.5.10">
</head>
<body>
    <div class="admin-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="brand-header">
                <img src="/admin/logo.png?v=2.5.10" alt="4Layers Logo" style="height: 36px; width: 36px; min-width: 36px; min-height: 36px; object-fit: contain; margin-right: 12px; border-radius: 8px;" />
                <div class="brand-info">
                    <h2>4Layers</h2>
                    <span class="brand-sub">Smart Admin Console v2.5.8</span>
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
                <button class="nav-item" data-tab="analytics">
                    <i class="fa-solid fa-shield-heart"></i>
                    <span>Usage & Warranty</span>
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
                    <div class="admin-user-badge" id="admin-user-badge" style="display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); padding: 6px 12px; border-radius: 20px;">
                        <i class="fa-solid fa-user-shield" style="color: #00E676;"></i>
                        <span id="admin-username-display" style="font-size: 12.5px; font-weight: 600; color: #f8fafc;">Admin: Qadir</span>
                        <button class="btn btn-outline" id="btn-admin-logout" style="padding: 3px 8px; font-size: 11px; border-radius: 6px; margin-left: 4px; border-color: rgba(239,68,68,0.4); color: #ef4444;" title="Logout">
                            <i class="fa-solid fa-right-from-bracket"></i>
                        </button>
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
                            <div class="filter-group">
                                <input type="text" id="user-search-input" class="search-input" placeholder="Search by name or email...">
                                <select id="user-status-filter" class="form-select" style="min-width: 140px;">
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active Only</option>
                                    <option value="blocked">Blocked Only</option>
                                </select>
                            </div>
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
                    <div class="pagination-footer" id="users-pagination">
                        <span class="pagination-info" id="users-pagination-info">Showing 0-0 of 0 records</span>
                        <div class="pagination-controls">
                            <button class="pagination-btn" id="users-prev-btn" disabled><i class="fa-solid fa-chevron-left"></i> Previous</button>
                            <span id="users-page-num" class="pagination-page">Page 1 of 1</span>
                            <button class="pagination-btn" id="users-next-btn" disabled>Next <i class="fa-solid fa-chevron-right"></i></button>
                        </div>
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
                            <div class="filter-group">
                                <input type="text" id="node-search-input" class="search-input" placeholder="Search node ID or owner...">
                                <select id="node-online-filter" class="form-select" style="min-width: 140px;">
                                    <option value="all">All Statuses</option>
                                    <option value="online">Online Only</option>
                                    <option value="offline">Offline Only</option>
                                </select>
                                <button class="btn btn-outline" id="btn-open-mqtt-tester">
                                    <i class="fa-solid fa-paper-plane"></i> Send Test Command
                                </button>
                            </div>
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
                    <div class="pagination-footer" id="nodes-pagination">
                        <span class="pagination-info" id="nodes-pagination-info">Showing 0-0 of 0 records</span>
                        <div class="pagination-controls">
                            <button class="pagination-btn" id="nodes-prev-btn" disabled><i class="fa-solid fa-chevron-left"></i> Previous</button>
                            <span id="nodes-page-num" class="pagination-page">Page 1 of 1</span>
                            <button class="pagination-btn" id="nodes-next-btn" disabled>Next <i class="fa-solid fa-chevron-right"></i></button>
                        </div>
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

            <!-- TAB 5: USAGE & WARRANTY REPORT -->
            <section id="tab-analytics" class="tab-pane">
                <div class="metrics-grid" style="margin-bottom: 20px;">
                    <div class="metric-card">
                        <div class="metric-icon green">
                            <i class="fa-solid fa-microchip"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Active Hardware Boards</span>
                            <h3 id="stat-active-warranties">--</h3>
                            <span class="metric-sub green" id="stat-sub-switches">-- Active Channels</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon red">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Voided Boards</span>
                            <h3 id="stat-void-warranties">--</h3>
                            <span class="metric-sub red">>100k Toggles / >50 Crashes</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon gray">
                            <i class="fa-solid fa-calendar-xmark"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Expired Boards</span>
                            <h3 id="stat-expired-warranties">--</h3>
                            <span class="metric-sub">> 1 Year Operational</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon purple">
                            <i class="fa-solid fa-users"></i>
                        </div>
                        <div class="metric-info">
                            <span class="metric-label">Registered Users</span>
                            <h3 id="stat-heavy-users">--</h3>
                            <span class="metric-sub purple" id="stat-sub-heavy">-- Heavy Users</span>
                        </div>
                    </div>
                </div>

                <div class="panel-card">
                    <div class="panel-header" style="flex-wrap: wrap; gap: 12px;">
                        <div>
                            <h3><i class="fa-solid fa-file-shield"></i> User Accounts & Hardware Usage Audit</h3>
                            <p class="card-desc" style="margin-top: 4px;">User profile activity tracking, physical board hardware telemetry, switch runtime audits, and instant data extraction.</p>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button class="btn btn-accent" id="btn-export-warranty-csv">
                                <i class="fa-solid fa-file-arrow-down"></i> Export Full Fleet Audit (CSV)
                            </button>
                        </div>
                    </div>

                    <div class="table-actions" style="margin: 15px 0; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                        <div class="search-box" style="flex: 1; min-width: 250px; position: relative;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                            <input type="text" id="warranty-search-input" placeholder="Search by user email, username, phone, or board Node ID..." class="form-input" style="padding-left: 36px; width: 100%;">
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <select id="warranty-hardware-filter" class="form-select" style="min-width: 190px;">
                                <option value="ACTIVE_BOARDS_ONLY">Hardware Owners Only</option>
                                <option value="ALL_ACCOUNTS">All User Accounts</option>
                            </select>
                            <select id="warranty-status-filter" class="form-select" style="min-width: 170px;">
                                <option value="ALL">All Warranty Status</option>
                                <option value="ACTIVE">Active Boards (Valid)</option>
                                <option value="VOID">Void Boards (Abused)</option>
                                <option value="EXPIRED">Expired Boards (>1 Year)</option>
                            </select>
                        </div>
                    </div>

                    <!-- User Account Cards Container -->
                    <div id="usage-warranty-cards-container" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="text-center" style="padding: 40px; color: var(--text-secondary);">
                            <i class="fa-solid fa-spinner fa-spin fa-2x" style="margin-bottom: 12px; color: var(--accent-blue);"></i>
                            <div>Loading user accounts and hardware warranty analytics...</div>
                        </div>
                    </div>

                    <div class="pagination-footer" style="margin-top: 20px;">
                        <div class="pagination-info" id="warranty-pagination-info">Showing 0 to 0 of 0 users</div>
                        <div class="pagination-controls">
                            <button class="pagination-btn" id="warranty-prev-btn" disabled><i class="fa-solid fa-chevron-left"></i> Previous</button>
                            <span id="warranty-page-num" class="pagination-page">Page 1 of 1</span>
                            <button class="pagination-btn" id="warranty-next-btn" disabled>Next <i class="fa-solid fa-chevron-right"></i></button>
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

    <!-- Admin Login Overlay -->
    <div id="admin-login-overlay" class="login-overlay">
        <div class="login-card">
            <div class="login-header">
                <img src="/admin/logo.png?v=2.5.10" alt="4Layers Logo" class="login-logo" />
                <h2>4Layers Admin Console</h2>
                <p>Secure Administrator Access</p>
            </div>
            <div id="login-error-banner" class="login-error" style="display: none;"></div>
            <form id="admin-login-form">
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500;"><i class="fa-solid fa-user"></i> Username</label>
                    <input type="text" id="login-username" class="form-input" placeholder="Enter admin username" required autofocus autocomplete="username" style="width: 100%; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 10px 14px; border-radius: var(--radius-md); font-size: 13.5px;">
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500;"><i class="fa-solid fa-lock"></i> Password</label>
                    <div style="position: relative;">
                        <input type="password" id="login-password" class="form-input" placeholder="Enter admin password" required autocomplete="current-password" style="width: 100%; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 10px 42px 10px 14px; border-radius: var(--radius-md); font-size: 13.5px;">
                        <button type="button" id="toggle-login-password" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">
                            <i class="fa-solid fa-eye" id="eye-icon"></i>
                        </button>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px; padding: 12px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In to Admin Console
                </button>
            </form>
            <div class="login-footer">
                <span><i class="fa-solid fa-shield-halved" style="color: #00E676;"></i> 256-Bit TLS Encrypted Connection</span>
            </div>
        </div>
    </div>

    <script src="/admin/app.js?v=2.5.10"></script>
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

.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.97);
    backdrop-filter: blur(20px);
    z-index: 99999;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 20px;
}
.login-card {
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 20px;
    padding: 36px 32px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 230, 118, 0.15);
}
.login-header {
    text-align: center;
    margin-bottom: 24px;
}
.login-logo {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    object-fit: contain;
    margin-bottom: 12px;
    box-shadow: 0 0 20px rgba(0, 230, 118, 0.35);
}
.login-header h2 {
    font-size: 19px;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: 0.5px;
}
.login-header p {
    font-size: 13px;
    color: #94a3b8;
    margin-top: 4px;
}
.login-error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #ef4444;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
    text-align: center;
}
.login-footer {
    text-align: center;
    margin-top: 22px;
    font-size: 12px;
    color: #64748b;
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
.pagination-footer { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-top: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); background: rgba(15, 23, 42, 0.4); border-bottom-left-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg); }
.pagination-controls { display: flex; align-items: center; gap: 12px; }
.pagination-btn { padding: 6px 14px; font-size: 12px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; transition: all 0.2s ease; }
.pagination-btn:hover:not(:disabled) { background: var(--accent-green); color: #000; border-color: var(--accent-green); }
.pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info { font-weight: 500; }
.filter-group { display: flex; align-items: center; gap: 10px; }
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
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

/* --- User Account & Hardware Warranty Cards CSS --- */
.user-analytics-card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 20px;
    transition: var(--transition);
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.user-analytics-card:hover {
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}
.user-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.user-avatar-circle {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
    flex-shrink: 0;
}
.hardware-board-strip {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-md);
    margin-top: 14px;
    padding: 16px;
    transition: var(--transition);
}
.hardware-board-strip:hover {
    border-color: rgba(255, 255, 255, 0.12);
}
.hardware-board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}
.board-stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
    margin: 14px 0;
    padding: 12px;
    background: rgba(2, 6, 23, 0.4);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.03);
}
.board-stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.board-stat-item .stat-lbl {
    font-size: 10.5px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.board-stat-item .stat-val {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-mono);
}
.switch-channels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 10px;
    margin-top: 12px;
}
.switch-channel-card {
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.switch-channel-card.on {
    border-color: rgba(0, 230, 118, 0.35);
    background: rgba(0, 230, 118, 0.04);
}
"""

ADMIN_JS = """document.addEventListener('DOMContentLoaded', () => {
    let allUsers = [];
    let allDevices = [];
    let serialPort = null;

    const ADMIN_TOKEN_KEY = '4layers_admin_token';
    const ADMIN_USER_KEY = '4layers_admin_user';

    function getAdminToken() {
        return localStorage.getItem(ADMIN_TOKEN_KEY);
    }

    function setAdminToken(token, username) {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        localStorage.setItem(ADMIN_USER_KEY, username);
        const nameEl = document.getElementById('admin-username-display');
        if (nameEl) nameEl.textContent = `Admin: ${username || 'Qadir'}`;
    }

    function clearAdminToken() {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
    }

    function showLoginModal(errorMsg = '') {
        const modal = document.getElementById('admin-login-overlay');
        if (modal) {
            modal.style.display = 'flex';
            const errBox = document.getElementById('login-error-banner');
            if (errBox) {
                if (errorMsg) {
                    errBox.textContent = errorMsg;
                    errBox.style.display = 'block';
                } else {
                    errBox.style.display = 'none';
                }
            }
        }
    }

    function hideLoginModal() {
        const modal = document.getElementById('admin-login-overlay');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async function authFetch(url, options = {}) {
        const token = getAdminToken();
        if (!token) {
            showLoginModal("Please sign in to access the Admin Console.");
            throw new Error("Unauthorized");
        }
        if (!options.headers) {
            options.headers = {};
        }
        if (options.headers instanceof Headers) {
            options.headers.set('Authorization', `Bearer ${token}`);
        } else {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, options);
        if (response.status === 401 || response.status === 403) {
            clearAdminToken();
            showLoginModal("Session expired or unauthorized. Please log in again.");
            throw new Error("Unauthorized");
        }
        return response;
    }

    // Connect Admin Login Form & Password Eye Toggle
    const adminLoginForm = document.getElementById('admin-login-form');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const toggleLoginPasswordBtn = document.getElementById('toggle-login-password');
    const btnAdminLogout = document.getElementById('btn-admin-logout');

    if (toggleLoginPasswordBtn) {
        toggleLoginPasswordBtn.addEventListener('click', () => {
            const isPassword = loginPasswordInput.type === 'password';
            loginPasswordInput.type = isPassword ? 'text' : 'password';
            const icon = toggleLoginPasswordBtn.querySelector('i');
            if (icon) {
                icon.className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            }
        });
    }

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();
            const submitBtn = adminLoginForm.querySelector('button[type="submit"]');

            if (!username || !password) {
                showLoginModal("Please enter both username and password.");
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';
            }

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (res.ok) {
                    const data = await res.json();
                    setAdminToken(data.token, data.username);
                    hideLoginModal();
                    logTerminal(`Administrator '${data.username}' authenticated successfully!`, 'success');
                    loadAllData();
                } else {
                    const err = await res.json();
                    showLoginModal(err.detail || "Invalid administrator credentials.");
                }
            } catch (err) {
                showLoginModal(`Connection error: ${err.message}`);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In to Admin Console';
                }
            }
        });
    }

    if (btnAdminLogout) {
        btnAdminLogout.addEventListener('click', () => {
            if (confirm("Are you sure you want to log out of the Admin Console?")) {
                clearAdminToken();
                showLoginModal("You have been logged out.");
                logTerminal("Administrator logged out.", "info");
            }
        });
    }

    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const activeTitle = document.getElementById('active-tab-title');
    const activeSubtitle = document.getElementById('active-tab-subtitle');
    const btnRefresh = document.getElementById('btn-refresh-data');
    const usersTableBody = document.getElementById('users-table-body');
    const nodesTableBody = document.getElementById('nodes-table-body');
    const userSearchInput = document.getElementById('user-search-input');
    const userStatusFilter = document.getElementById('user-status-filter');
    const nodeSearchInput = document.getElementById('node-search-input');
    const nodeOnlineFilter = document.getElementById('node-online-filter');

    const usersPrevBtn = document.getElementById('users-prev-btn');
    const usersNextBtn = document.getElementById('users-next-btn');
    const usersPageNum = document.getElementById('users-page-num');
    const usersPaginationInfo = document.getElementById('users-pagination-info');

    const nodesPrevBtn = document.getElementById('nodes-prev-btn');
    const nodesNextBtn = document.getElementById('nodes-next-btn');
    const nodesPageNum = document.getElementById('nodes-page-num');
    const nodesPaginationInfo = document.getElementById('nodes-pagination-info');

    let userCurrentPage = 1;
    let userTotalPages = 1;
    let userTotalRecords = 0;

    let nodeCurrentPage = 1;
    let nodeTotalPages = 1;
    let nodeTotalRecords = 0;
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
        flasher: { title: "Firmware & OTA Center", subtitle: "Remote MQTT OTA updates and WebSerial browser USB flashing" },
        analytics: { title: "IoT Usage & Warranty Validation Report", subtitle: "Comprehensive appliance runtime analysis, cycle stress audits, and legal warranty status classification" }
    };

    let currentActiveTab = 'overview';

    navItems.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            currentActiveTab = targetTab;
            navItems.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            if (tabMeta[targetTab]) {
                activeTitle.textContent = tabMeta[targetTab].title;
                activeSubtitle.textContent = tabMeta[targetTab].subtitle;
            }
            if (targetTab === 'analytics') fetchUsageAnalytics(warrantyCurrentPage, false);
            else if (targetTab === 'users') fetchUsers(userCurrentPage, false);
            else if (targetTab === 'nodes') fetchDevices(nodeCurrentPage, false);
            else if (targetTab === 'overview') fetchStats(false);
        });
    });

    function logTerminal(message, type = 'info') {
        if (!liveTerminal) return;
        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        liveTerminal.appendChild(line);
        liveTerminal.scrollTop = liveTerminal.scrollHeight;
    }

    async function fetchStats(isSilent = false) {
        try {
            const res = await authFetch('/api/admin/stats');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('stat-total-users').textContent = data.total_users;
                document.getElementById('stat-active-users').textContent = `${data.active_users} active accounts`;
                document.getElementById('stat-online-devices').textContent = data.online_devices;
                document.getElementById('stat-total-devices').textContent = `${data.total_devices} registered boards`;
                if (!isSilent) logTerminal(`Fetched Dashboard Stats: ${data.active_users} Active Users, ${data.online_devices} Online Nodes.`, 'success');
            }
        } catch (err) {
            if (!isSilent) logTerminal(`Failed to fetch stats: ${err.message}`, 'warn');
        }
    }

    async function fetchUsers(page = 1, isSilent = false) {
        userCurrentPage = page;
        if (!isSilent && usersTableBody) {
            usersTableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading users data...</td></tr>`;
        }
        
        const search = userSearchInput ? userSearchInput.value.trim() : '';
        const status = userStatusFilter ? userStatusFilter.value : 'all';
        
        try {
            const url = `/api/admin/users?page=${userCurrentPage}&limit=50&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
            const res = await authFetch(url);
            if (res.ok) {
                const responseData = await res.json();
                allUsers = responseData.data || [];
                userTotalRecords = responseData.total_records || 0;
                userTotalPages = responseData.total_pages || 1;
                userCurrentPage = responseData.current_page || 1;

                renderUsers(allUsers);
                updateUsersPaginationUI();
                if (!isSilent) logTerminal(`Loaded ${allUsers.length} users (Page ${userCurrentPage} of ${userTotalPages}, Total: ${userTotalRecords}).`, 'info');
            }
        } catch (err) {
            if (!isSilent && usersTableBody) {
                usersTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error loading users: ${err.message}</td></tr>`;
            }
        }
    }

    function updateUsersPaginationUI() {
        if (!usersPaginationInfo) return;
        const startRecord = userTotalRecords > 0 ? (userCurrentPage - 1) * 50 + 1 : 0;
        const endRecord = Math.min(userCurrentPage * 50, userTotalRecords);
        usersPaginationInfo.textContent = `Showing ${startRecord}-${endRecord} of ${userTotalRecords} records`;
        usersPageNum.textContent = `Page ${userCurrentPage} of ${userTotalPages}`;
        
        usersPrevBtn.disabled = (userCurrentPage <= 1);
        usersNextBtn.disabled = (userCurrentPage >= userTotalPages);
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
                        ? '<span style="color:var(--accent-green);font-weight:bold;font-size:14px;">\u2705</span>' 
                        : '<span style="color:var(--accent-red);font-weight:bold;font-size:14px;">\u274C</span>'}
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

    async function fetchDevices(page = 1, isSilent = false) {
        nodeCurrentPage = page;
        if (!isSilent && nodesTableBody) {
            nodesTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px;"><i class="fa-solid fa-spinner fa-spin"></i> Scanning active MQTT nodes...</td></tr>`;
        }

        const search = nodeSearchInput ? nodeSearchInput.value.trim() : '';
        const online = nodeOnlineFilter ? nodeOnlineFilter.value : 'all';

        try {
            const url = `/api/admin/devices?page=${nodeCurrentPage}&limit=50&search=${encodeURIComponent(search)}&online=${encodeURIComponent(online)}`;
            const res = await authFetch(url);
            if (res.ok) {
                const responseData = await res.json();
                allDevices = responseData.data || [];
                nodeTotalRecords = responseData.total_records || 0;
                nodeTotalPages = responseData.total_pages || 1;
                nodeCurrentPage = responseData.current_page || 1;

                renderDevices(allDevices);
                populateOtaDropdown(allDevices);
                updateNodesPaginationUI();
                if (!isSilent) logTerminal(`Loaded ${allDevices.length} nodes (Page ${nodeCurrentPage} of ${nodeTotalPages}, Total: ${nodeTotalRecords}).`, 'info');

                allDevices.forEach(d => {
                    const nodeId = (d.node_id || d.device_id || '').replace(/\\s*-\\s*/g, '-').trim();
                    if (otaPendingRebootNodes.has(nodeId)) {
                        const pendingInfo = otaPendingRebootNodes.get(nodeId);
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
            if (!isSilent && nodesTableBody) {
                nodesTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading devices: ${err.message}</td></tr>`;
            }
        }
    }

    function updateNodesPaginationUI() {
        if (!nodesPaginationInfo) return;
        const startRecord = nodeTotalRecords > 0 ? (nodeCurrentPage - 1) * 50 + 1 : 0;
        const endRecord = Math.min(nodeCurrentPage * 50, nodeTotalRecords);
        nodesPaginationInfo.textContent = `Showing ${startRecord}-${endRecord} of ${nodeTotalRecords} records`;
        nodesPageNum.textContent = `Page ${nodeCurrentPage} of ${nodeTotalPages}`;

        nodesPrevBtn.disabled = (nodeCurrentPage <= 1);
        nodesNextBtn.disabled = (nodeCurrentPage >= nodeTotalPages);
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
            const nodeId = (d.node_id || d.device_id || '').replace(/\\s*-\\s*/g, '-').trim();
            opt.value = nodeId;
            opt.textContent = `${nodeId} (${d.switch_count || 6}-Ch Board) - ${d.is_online ? 'Online' : 'Offline'}`;
            otaTargetDevice.appendChild(opt);
        });
    }

    let userSearchTimeout = null;
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            clearTimeout(userSearchTimeout);
            userSearchTimeout = setTimeout(() => {
                fetchUsers(1);
            }, 300);
        });
    }

    if (userStatusFilter) {
        userStatusFilter.addEventListener('change', () => {
            fetchUsers(1);
        });
    }

    if (usersPrevBtn) {
        usersPrevBtn.addEventListener('click', () => {
            if (userCurrentPage > 1) fetchUsers(userCurrentPage - 1);
        });
    }

    if (usersNextBtn) {
        usersNextBtn.addEventListener('click', () => {
            if (userCurrentPage < userTotalPages) fetchUsers(userCurrentPage + 1);
        });
    }

    let nodeSearchTimeout = null;
    if (nodeSearchInput) {
        nodeSearchInput.addEventListener('input', () => {
            clearTimeout(nodeSearchTimeout);
            nodeSearchTimeout = setTimeout(() => {
                fetchDevices(1);
            }, 300);
        });
    }

    if (nodeOnlineFilter) {
        nodeOnlineFilter.addEventListener('change', () => {
            fetchDevices(1);
        });
    }

    if (nodesPrevBtn) {
        nodesPrevBtn.addEventListener('click', () => {
            if (nodeCurrentPage > 1) fetchDevices(nodeCurrentPage - 1);
        });
    }

    if (nodesNextBtn) {
        nodesNextBtn.addEventListener('click', () => {
            if (nodeCurrentPage < nodeTotalPages) fetchDevices(nodeCurrentPage + 1);
        });
    }

    window.toggleUserStatus = async function(userId, newStatus) {
        let reason = null;
        if (!newStatus) {
            reason = prompt("Enter reason for blocking this user account:", "Violation of Terms of Service");
            if (reason === null) return;
            reason = reason.trim() || "Account blocked by administrator";
        }

        try {
            const res = await authFetch(`/api/admin/users/${userId}/status`, {
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
                fetchUsers(userCurrentPage);
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
        const reason = prompt("Are you sure you want to delete this user? All linked devices will be unlinked.\\n\\nEnter reason for account removal/locking:", "Account deleted by administrator");
        if (reason === null) return;
        const finalReason = reason.trim() || "Account deleted by administrator";

        try {
            const res = await authFetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: finalReason })
            });
            if (res.ok) {
                logTerminal(`User #${userId} account deleted and resources purged (Reason: ${finalReason}).`, 'warn');
                allUsers = allUsers.filter(u => String(u.id) !== String(userId));
                fetchUsers(userCurrentPage);
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
            
            const res = await authFetch('/api/admin/ota/trigger', {
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
        if (!getAdminToken()) return;
        if (isPollingOta) return; // Prevent concurrent overlapping requests
        isPollingOta = true;

        try {
            const res = await authFetch('/api/admin/ota/status');
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
                const res = await authFetch('/api/admin/firmware/upload', {
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
            const res = await authFetch('/api/admin/mqtt/publish', {
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
        if (!getAdminToken()) return;
        if (isPollingLogs) return;
        isPollingLogs = true;
        const targetNode = monitorTargetNodeSelect ? monitorTargetNodeSelect.value : 'ALL';
        const queryTarget = targetNode || 'ALL';

        try {
            const res = await authFetch(`/api/admin/devices/${queryTarget}/logs`);
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

    /* --- Usage Analytics & Warranty Validation Controller (User & Board Hierarchy) --- */
    let warrantyCurrentPage = 1;
    let warrantyTotalPages = 1;
    let warrantyTotalRecords = 0;
    const warrantyCardsContainer = document.getElementById('usage-warranty-cards-container');
    const warrantySearchInput = document.getElementById('warranty-search-input');
    const warrantyStatusFilter = document.getElementById('warranty-status-filter');
    const warrantyHardwareFilter = document.getElementById('warranty-hardware-filter');
    const warrantyPrevBtn = document.getElementById('warranty-prev-btn');
    const warrantyNextBtn = document.getElementById('warranty-next-btn');
    const warrantyPageNum = document.getElementById('warranty-page-num');
    const warrantyPaginationInfo = document.getElementById('warranty-pagination-info');
    const btnExportWarrantyCsv = document.getElementById('btn-export-warranty-csv');

    async function fetchUsageAnalytics(page = 1, isSilent = false) {
        warrantyCurrentPage = page;
        if (!warrantyCardsContainer) return;
        if (!isSilent) {
            warrantyCardsContainer.innerHTML = `
                <div class="text-center" style="padding: 40px; color: var(--text-secondary);">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="margin-bottom: 12px; color: var(--accent-blue);"></i>
                    <div>Loading user accounts and hardware warranty analytics...</div>
                </div>
            `;
        }

        const search = warrantySearchInput ? warrantySearchInput.value.trim() : '';
        const filterVal = warrantyStatusFilter ? warrantyStatusFilter.value : 'ALL';
        const hwFilter = warrantyHardwareFilter ? warrantyHardwareFilter.value : 'ACTIVE_BOARDS_ONLY';
        const hardwareOnly = (hwFilter === 'ACTIVE_BOARDS_ONLY');

        try {
            const url = `/api/admin/analytics/usage?page=${warrantyCurrentPage}&page_size=10&search=${encodeURIComponent(search)}&filter_warranty=${encodeURIComponent(filterVal)}&hardware_only=${hardwareOnly}`;
            const res = await authFetch(url);
            if (res.ok) {
                const data = await res.json();
                const summary = data.summary || {};
                const pagination = data.pagination || {};
                const users = data.records || [];

                // Update Metric Cards
                const activeEl = document.getElementById('stat-active-warranties');
                const subSwitchesEl = document.getElementById('stat-sub-switches');
                const voidEl = document.getElementById('stat-void-warranties');
                const expEl = document.getElementById('stat-expired-warranties');
                const usersEl = document.getElementById('stat-heavy-users');
                const subHeavyEl = document.getElementById('stat-sub-heavy');

                if (activeEl) activeEl.textContent = `${summary.active_warranties ?? 0} Boards`;
                if (subSwitchesEl) subSwitchesEl.textContent = `${summary.total_switches ?? 0} Active Channels`;
                if (voidEl) voidEl.textContent = `${summary.void_warranties ?? 0} Boards`;
                if (expEl) expEl.textContent = `${summary.expired_warranties ?? 0} Boards`;
                if (usersEl) usersEl.textContent = `${summary.total_users ?? 0} Users`;
                if (subHeavyEl) subHeavyEl.textContent = `${summary.heavy_users_count ?? 0} Heavy Users (>5000h)`;

                warrantyTotalRecords = pagination.total_records || 0;
                warrantyTotalPages = pagination.total_pages || 1;
                warrantyCurrentPage = pagination.page || 1;

                if (warrantyPageNum) warrantyPageNum.textContent = `Page ${warrantyCurrentPage} of ${warrantyTotalPages}`;
                if (warrantyPaginationInfo) {
                    const startRec = users.length > 0 ? (warrantyCurrentPage - 1) * pagination.page_size + 1 : 0;
                    const endRec = (warrantyCurrentPage - 1) * pagination.page_size + users.length;
                    warrantyPaginationInfo.textContent = `Showing ${startRec} to ${endRec} of ${warrantyTotalRecords} user accounts`;
                }
                if (warrantyPrevBtn) warrantyPrevBtn.disabled = warrantyCurrentPage <= 1;
                if (warrantyNextBtn) warrantyNextBtn.disabled = warrantyCurrentPage >= warrantyTotalPages;

                if (users.length === 0) {
                    warrantyCardsContainer.innerHTML = `
                        <div class="text-center" style="padding: 48px; background: rgba(30, 41, 59, 0.4); border-radius: var(--radius-lg); border: 1px dashed var(--border-color); color: var(--text-secondary);">
                            <i class="fa-solid fa-folder-open fa-2x" style="margin-bottom: 10px; color: #64748b;"></i>
                            <div>No user accounts or hardware boards matched your criteria.</div>
                        </div>
                    `;
                    return;
                }

                warrantyCardsContainer.innerHTML = users.map(u => {
                    const avatarLetter = (u.username || u.email || 'U')[0].toUpperCase();
                    const heavyBadge = u.is_heavy_user ? `<span class="badge purple" style="font-size: 10px;" title="Heavy Appliance User: >5000 hrs"><i class="fa-solid fa-crown"></i> Heavy User</span>` : '';
                    const boards = u.hardware_boards || [];

                    const boardsHtml = boards.map((b, bIdx) => {
                        let badgeClass = 'green';
                        let iconClass = 'fa-shield-halved';
                        if (b.warranty_status === 'VOID') {
                            badgeClass = 'red';
                            iconClass = 'fa-triangle-exclamation';
                        } else if (b.warranty_status === 'EXPIRED') {
                            badgeClass = 'gray';
                            iconClass = 'fa-calendar-xmark';
                        }

                        const statusPulse = b.is_online ? `<span class="status-indicator online"></span> <span style="color: #00E676; font-size: 12px; font-weight: 600;">Online</span>` : `<span class="status-indicator offline"></span> <span style="color: #94a3b8; font-size: 12px;">Offline</span>`;
                        const actDateFormatted = b.activated_at ? new Date(b.activated_at).toLocaleDateString() : 'N/A';

                        const switchesList = b.switches || [];
                        const switchesHtml = switchesList.map(s => {
                            const isChOn = (s.current_state && (s.current_state.status === 'ON' || s.current_state.state === 'ON'));
                            const icon = s.device_type === 'fan' ? 'fa-fan' : (s.switch_channel.includes('Master') ? 'fa-power-off' : 'fa-lightbulb');
                            return `
                                <div class="switch-channel-card ${isChOn ? 'on' : ''}">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="font-weight: 600; font-size: 12.5px; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                                            <i class="fa-solid ${icon}" style="color: ${isChOn ? '#00E676' : '#94a3b8'};"></i>
                                            ${escapeHtml(s.switch_channel)}
                                        </div>
                                        <span style="font-size: 10.5px; font-weight: 700; color: ${isChOn ? '#00E676' : '#94a3b8'};">${isChOn ? 'ON' : 'OFF'}</span>
                                    </div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(s.device_name)}</div>
                                    <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.05);">
                                        <span style="color: #cbd5e1;"><i class="fa-solid fa-rotate"></i> <strong>${Number(s.toggles).toLocaleString()}</strong></span>
                                        <span style="color: #38bdf8;"><i class="fa-solid fa-clock"></i> <strong>${s.on_hours}h</strong></span>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        return `
                            <div class="hardware-board-strip">
                                <div class="hardware-board-header">
                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            ${statusPulse}
                                        </div>
                                        <div style="font-weight: 600; font-size: 13.5px; color: #ffffff;">${escapeHtml(b.board_name)}</div>
                                        <span class="badge blue font-mono" style="font-size: 11px;">${escapeHtml(b.base_node_id)}</span>
                                        <span style="font-size: 11px; color: var(--text-secondary);">IP: <code style="color: #38bdf8;">${escapeHtml(b.local_ip)}</code></span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="badge ${badgeClass}" style="font-size: 11.5px; padding: 4px 10px;">
                                            <i class="fa-solid ${iconClass}"></i> Warranty: ${b.warranty_status}
                                        </span>
                                    </div>
                                </div>

                                <div class="board-stats-row">
                                    <div class="board-stat-item">
                                        <span class="stat-lbl">Cumulative Cycles</span>
                                        <span class="stat-val" style="color: ${b.total_board_toggles > 100000 ? '#ef4444' : '#00E676'};">${Number(b.total_board_toggles).toLocaleString()}</span>
                                    </div>
                                    <div class="board-stat-item">
                                        <span class="stat-lbl">Active Runtime</span>
                                        <span class="stat-val" style="color: #38bdf8;">${b.total_board_on_hours} hrs</span>
                                    </div>
                                    <div class="board-stat-item">
                                        <span class="stat-lbl">Power Restarts</span>
                                        <span class="stat-val" style="color: #94a3b8;">${b.boot_count} boots</span>
                                    </div>
                                    <div class="board-stat-item">
                                        <span class="stat-lbl">Brownout Crashes</span>
                                        <span class="stat-val" style="color: ${b.crash_count > 50 ? '#ef4444' : (b.crash_count > 0 ? '#f59e0b' : '#94a3b8')};">${b.crash_count}</span>
                                    </div>
                                    <div class="board-stat-item">
                                        <span class="stat-lbl">Activated On</span>
                                        <span class="stat-val" style="font-size: 12px; color: var(--text-secondary);">${actDateFormatted}</span>
                                    </div>
                                </div>

                                <div style="margin-top: 10px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="font-size: 12px; font-weight: 600; color: #cbd5e1;">
                                            <i class="fa-solid fa-toggle-on" style="color: var(--accent-blue);"></i> 6 Switch Channels & Appliances (${switchesList.length} Connected)
                                        </div>
                                    </div>
                                    <div class="switch-channels-grid">
                                        ${switchesHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div class="user-analytics-card" id="user-card-${u.user_id}">
                            <div class="user-card-header">
                                <div style="display: flex; align-items: center; gap: 14px;">
                                    <div class="user-avatar-circle">${avatarLetter}</div>
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${escapeHtml(u.email)}</span>
                                            ${heavyBadge}
                                        </div>
                                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                            <strong>@${escapeHtml(u.username)}</strong> &bull; Phone: ${escapeHtml(u.phone)}
                                        </div>
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                    <span class="badge blue" style="font-size: 11px;"><i class="fa-solid fa-microchip"></i> ${u.total_boards_count} Hardware Board${u.total_boards_count !== 1 ? 's' : ''}</span>
                                    <span class="badge gray" style="font-size: 11px;"><i class="fa-solid fa-sliders"></i> ${u.total_switches_count} Switches</span>
                                    <span class="badge green" style="font-size: 11px;"><i class="fa-solid fa-clock"></i> ${u.total_user_on_hours}h Total ON</span>
                                    <button class="btn btn-outline btn-sm btn-export-user-csv" data-user-id="${u.user_id}" data-user-email="${escapeHtml(u.email)}" style="font-size: 11.5px; padding: 6px 12px;">
                                        <i class="fa-solid fa-file-csv"></i> Extract User Data (CSV)
                                    </button>
                                </div>
                            </div>

                            <div class="user-card-body" style="margin-top: 6px;">
                                ${boards.length > 0 ? boardsHtml : '<div style="padding: 16px; color: var(--text-secondary); font-size: 12.5px;">No physical hardware boards linked to this account yet.</div>'}
                            </div>
                        </div>
                    `;
                }).join('');

                // Attach Per-User CSV Download Handlers
                document.querySelectorAll('.btn-export-user-csv').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const userId = btn.getAttribute('data-user-id');
                        const userEmail = btn.getAttribute('data-user-email') || 'User';
                        try {
                            btn.disabled = true;
                            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Exporting...`;
                            const token = getAdminToken();
                            const res = await fetch(`/api/admin/analytics/usage/export?user_id=${encodeURIComponent(userId)}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                                const blob = await res.blob();
                                const downloadUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = downloadUrl;
                                a.download = `4Layers_Audit_${userEmail.split('@')[0]}_${new Date().toISOString().slice(0,10)}.csv`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(downloadUrl);
                                logTerminal(`Exported warranty audit report for ${userEmail}.`, 'success');
                            } else {
                                alert("Failed to export user CSV report.");
                            }
                        } catch (err) {
                            alert(`Export error: ${err.message}`);
                        } finally {
                            btn.disabled = false;
                            btn.innerHTML = `<i class="fa-solid fa-file-csv"></i> Extract User Data (CSV)`;
                        }
                    });
                });

            } else {
                if (!isSilent) {
                    warrantyCardsContainer.innerHTML = `<div class="text-center" style="padding: 30px; color: var(--accent-red);">Failed to load usage analytics (HTTP ${res.status}).</div>`;
                }
            }
        } catch (err) {
            if (!isSilent && warrantyCardsContainer) {
                warrantyCardsContainer.innerHTML = `<div class="text-center" style="padding: 30px; color: var(--accent-red);">Error: ${err.message}</div>`;
            }
        }
    }

    if (warrantySearchInput) {
        let debounceTimer;
        warrantySearchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchUsageAnalytics(1, false), 300);
        });
    }

    if (warrantyStatusFilter) {
        warrantyStatusFilter.addEventListener('change', () => fetchUsageAnalytics(1, false));
    }

    if (warrantyHardwareFilter) {
        warrantyHardwareFilter.addEventListener('change', () => fetchUsageAnalytics(1, false));
    }

    if (warrantyPrevBtn) {
        warrantyPrevBtn.addEventListener('click', () => {
            if (warrantyCurrentPage > 1) fetchUsageAnalytics(warrantyCurrentPage - 1, false);
        });
    }

    if (warrantyNextBtn) {
        warrantyNextBtn.addEventListener('click', () => {
            if (warrantyCurrentPage < warrantyTotalPages) fetchUsageAnalytics(warrantyCurrentPage + 1, false);
        });
    }

    if (btnExportWarrantyCsv) {
        btnExportWarrantyCsv.addEventListener('click', async () => {
            try {
                btnExportWarrantyCsv.disabled = true;
                btnExportWarrantyCsv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Fleet CSV...`;
                const search = warrantySearchInput ? warrantySearchInput.value.trim() : '';
                const filterVal = warrantyStatusFilter ? warrantyStatusFilter.value : 'ALL';
                
                const token = getAdminToken();
                const exportUrl = `/api/admin/analytics/usage/export?search=${encodeURIComponent(search)}&filter_warranty=${encodeURIComponent(filterVal)}`;
                
                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `4Layers_Fleet_Warranty_Audit_${new Date().toISOString().slice(0,10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(downloadUrl);
                    logTerminal("Exported Full Fleet Warranty Audit CSV report successfully.", "success");
                } else {
                    alert("Failed to export CSV. Please ensure you are logged in.");
                }
            } catch (e) {
                alert(`Export Error: ${e.message}`);
            } finally {
                btnExportWarrantyCsv.disabled = false;
                btnExportWarrantyCsv.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i> Export Full Fleet Audit (CSV)`;
            }
        });
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    let isLoadingAllData = false;
    async function loadAllData(isSilent = false) {
        if (!getAdminToken()) return;
        if (isLoadingAllData) return;
        isLoadingAllData = true;
        try {
            await Promise.all([
                fetchStats(isSilent),
                fetchUsers(userCurrentPage, isSilent),
                fetchDevices(nodeCurrentPage, isSilent),
                fetchUsageAnalytics(warrantyCurrentPage, isSilent)
            ]);
        } finally {
            isLoadingAllData = false;
        }
    }

    btnRefresh.addEventListener('click', () => {
        if (getAdminToken()) {
            loadAllData(false);
        } else {
            showLoginModal();
        }
    });

    const initialToken = getAdminToken();
    if (!initialToken) {
        showLoginModal();
    } else {
        const savedUser = localStorage.getItem(ADMIN_USER_KEY);
        const nameEl = document.getElementById('admin-username-display');
        if (nameEl) nameEl.textContent = `Admin: ${savedUser || 'Qadir'}`;
        loadAllData(false);
    }

    // Background live refresh: Only update the currently active tab silently without disrupting the UI
    setInterval(() => {
        if (!getAdminToken()) return;
        if (currentActiveTab === 'analytics') {
            fetchUsageAnalytics(warrantyCurrentPage, true);
        } else if (currentActiveTab === 'users') {
            fetchUsers(userCurrentPage, true);
        } else if (currentActiveTab === 'nodes') {
            fetchDevices(nodeCurrentPage, true);
        } else if (currentActiveTab === 'overview') {
            fetchStats(true);
        }
    }, 10000);
});
"""
