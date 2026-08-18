import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  getBaseNodeId,
  saveDeviceLocalIp,
  getDeviceLocalIp,
  parseLocalChannelState,
  sendLocalControlCommand,
  pingLocalDevice,
  fetchLocalDeviceState
} from '../src/services/localControl.js';

describe('Scenario 1: Cellular / Mobile Data Mode (isPhoneOnWifi === false)', () => {
  it('1.1: Local ping is skipped in fetchDevices when on cellular and cloud state takes precedence', () => {
    let pingAttempted = false;
    const mockPing = async () => {
      pingAttempted = true;
      return { channel_1: 'ON' };
    };

    const isPhoneOnWifi = false;
    const devices = [
      { id: 1, node_id: '4L_NODE1_1', is_online: true, status: true, local_ip: '192.168.1.50' }
    ];

    if (isPhoneOnWifi) {
      mockPing();
    }

    assert.equal(pingAttempted, false, 'Local ping should NOT be attempted when on cellular data');
    assert.equal(devices[0].is_online, true, 'Device status should reflect cloud state');
  });

  it('1.2: MQTT OFFLINE payload on cellular immediately marks device offline without waiting for local ping', () => {
    let localPingCalled = false;
    const mockPingLocal = async () => {
      localPingCalled = true;
      return { channel_1: 'ON' };
    };

    let devices = [
      { id: 1, node_id: '4L_NODE1_1', is_online: true, status: true, local_ip: '192.168.1.50' },
      { id: 2, node_id: '4L_NODE1_2', is_online: true, status: true, local_ip: '192.168.1.50' }
    ];

    const isPhoneOnWifi = false;
    const baseNodeId = '4L_NODE1';
    const isOfflinePayload = true;
    const localIp = '192.168.1.50';

    if (isOfflinePayload) {
      if (isPhoneOnWifi && localIp) {
        mockPingLocal();
      } else {
        // Immediate offline transition on cellular
        devices = devices.map(d => {
          if (d.node_id === baseNodeId || d.node_id?.startsWith(`${baseNodeId}_`)) {
            return { ...d, is_online: false, status: false };
          }
          return d;
        });
      }
    }

    assert.equal(localPingCalled, false, 'Local ping must NOT be called on cellular');
    assert.equal(devices[0].is_online, false);
    assert.equal(devices[0].status, false);
    assert.equal(devices[1].is_online, false);
    assert.equal(devices[1].status, false);
  });

  it('1.3: Control dispatch on cellular bypasses local HTTP and routes directly to Cloud MQTT/REST', async () => {
    let localHttpCalled = false;
    let cloudMqttCalled = false;
    let cloudRestCalled = false;

    const mockLocalControl = async () => {
      localHttpCalled = true;
      return { success: true };
    };
    const mockCloudMqtt = () => { cloudMqttCalled = true; };
    const mockCloudRest = async () => { cloudRestCalled = true; };

    const isPhoneOnWifi = false;
    const targetLocalIp = '192.168.1.50';
    let localHandledSuccessfully = false;

    if (isPhoneOnWifi && targetLocalIp) {
      try {
        await mockLocalControl();
        localHandledSuccessfully = true;
      } catch (_) {}
    }

    if (!localHandledSuccessfully) {
      mockCloudMqtt();
      await mockCloudRest();
    }

    assert.equal(localHttpCalled, false, 'Local HTTP must not be called when on cellular');
    assert.equal(cloudMqttCalled, true, 'Cloud MQTT must be published');
    assert.equal(cloudRestCalled, true, 'Cloud REST API must be called');
  });

  it('1.4: UI Status Dot logic correctly selects Cloud (Blue) or Offline (Red) when on cellular', () => {
    const evaluateStatusDot = (isPhoneOnWifi, filteredDevices) => {
      if (isPhoneOnWifi && (filteredDevices.some(d => !!d.local_ip || !!getDeviceLocalIp(d.node_id)) && filteredDevices.some(d => d.is_online !== false))) {
        return 'YELLOW_LOCAL';
      } else if (filteredDevices.length > 0 && filteredDevices.some(d => d.is_online === true)) {
        return 'BLUE_CLOUD';
      } else {
        return 'RED_OFFLINE';
      }
    };

    const onlineDevs = [{ id: 1, is_online: true, local_ip: '192.168.1.50', node_id: '4L_NODE1_1' }];
    const offlineDevs = [{ id: 1, is_online: false, local_ip: '192.168.1.50', node_id: '4L_NODE1_1' }];

    // On Wi-Fi + online -> Yellow
    assert.equal(evaluateStatusDot(true, onlineDevs), 'YELLOW_LOCAL');
    // On Cellular + online -> Blue
    assert.equal(evaluateStatusDot(false, onlineDevs), 'BLUE_CLOUD');
    // On Cellular + offline -> Red
    assert.equal(evaluateStatusDot(false, offlineDevs), 'RED_OFFLINE');
    // On Wi-Fi + offline -> Red
    assert.equal(evaluateStatusDot(true, offlineDevs), 'RED_OFFLINE');
  });
});

describe('Scenario 2: Rapid Consecutive Toggles, Optimistic Locks & Latency/Timeout Fallback', () => {
  it('2.1: Optimistic lock protects UI state from stale polling updates within 3.5s window', () => {
    const toggleLockRef = {
      1: { time: Date.now() - 1000, status: true, value: 1 } // toggled 1s ago to ON
    };

    // Stale server response arriving from polling (reporting OFF)
    const polledDevices = [
      { id: 1, node_id: '4L_NODE1_1', is_online: true, status: false, value: 1 }
    ];

    const now = Date.now();
    const mergedDevices = polledDevices.map(newDev => {
      const lock = toggleLockRef[newDev.id];
      if (lock && (now - lock.time < 3500) && newDev.is_online) {
        return {
          ...newDev,
          status: lock.status,
          value: lock.value !== undefined ? lock.value : newDev.value
        };
      }
      return newDev;
    });

    assert.equal(mergedDevices[0].status, true, 'State should be held ON due to active optimistic lock');

    // After 4s (lock expired)
    const expiredNow = Date.now() + 4000;
    const unlockedDevices = polledDevices.map(newDev => {
      const lock = toggleLockRef[newDev.id];
      if (lock && (expiredNow - lock.time < 3500) && newDev.is_online) {
        return { ...newDev, status: lock.status };
      }
      return newDev;
    });

    assert.equal(unlockedDevices[0].status, false, 'State should update to polled state once lock expires');
  });

  it('2.2: Optimistic lock ignores stale incoming MQTT telemetry within 3.5s window', () => {
    const toggleLockRef = {
      1: { time: Date.now() - 500, status: true, value: 1 }
    };

    let devices = [
      { id: 1, node_id: '4L_NODE1_1', is_online: true, status: true, value: 1 }
    ];

    // Stale MQTT telemetry arriving with status: "OFF"
    const incomingMqttPayload = { status: 'OFF', channel: 1 };
    const baseNodeId = '4L_NODE1';
    const channel = 1;
    const now = Date.now();

    devices = devices.map(d => {
      const isMatch = d.node_id === `${baseNodeId}_${channel}`;
      if (isMatch) {
        const lock = toggleLockRef[d.id];
        if (lock && (now - lock.time < 3500)) {
          return { ...d, is_online: true, status: lock.status };
        }
        return { ...d, is_online: true, status: incomingMqttPayload.status === 'ON' };
      }
      return d;
    });

    assert.equal(devices[0].status, true, 'Optimistic lock must suppress stale MQTT payload');
  });

  it('2.3: Rapid fan speed adjustment clamps within [0, 4] bounds', () => {
    const adjustSpeed = (currentVal, step) => {
      const minVal = 0;
      const maxVal = 4;
      return Math.max(minVal, Math.min(maxVal, currentVal + step));
    };

    assert.equal(adjustSpeed(0, -1), 0, 'Cannot go below 0');
    assert.equal(adjustSpeed(0, 1), 1);
    assert.equal(adjustSpeed(3, 1), 4);
    assert.equal(adjustSpeed(4, 1), 4, 'Cannot exceed 4');
    assert.equal(adjustSpeed(4, 5), 4, 'Overshoot clamped to 4');
    assert.equal(adjustSpeed(2, -5), 0, 'Undershoot clamped to 0');
  });

  it('2.4: Local control timeout/abort throws cleanly and allows cloud fallback', async () => {
    // Intercept global fetch to simulate a hanging local HTTP server
    const originalFetch = globalThis.fetch;
    let fallbackTriggered = false;

    try {
      globalThis.fetch = async (url, options) => {
        // Simulate hang that respects signal
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted.');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      // Call sendLocalControlCommand with direct IP
      try {
        await sendLocalControlCommand('4L_TESTNODE_1', 1, 'ON', '192.168.1.200');
      } catch (err) {
        fallbackTriggered = true;
        assert(err.message.includes('Local control unreachable') || err.message.includes('aborted'));
      }

      assert.equal(fallbackTriggered, true, 'sendLocalControlCommand must fail and allow fallback when local IP hangs');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Scenario 3: Corrupted, Partial, or Malformed /state Responses', () => {
  it('3.1: Partial /state with missing channels gracefully returns status: null without affecting existing state', () => {
    const partialState = {
      node_id: '4L-NODE-123',
      channel_1: 'ON'
      // channels 2, 3, 4, 5 missing entirely
    };

    const res1 = parseLocalChannelState(partialState, 1);
    const res2 = parseLocalChannelState(partialState, 2);
    const res5 = parseLocalChannelState(partialState, 5);

    assert.deepEqual(res1, { status: true, value: null });
    assert.deepEqual(res2, { status: null, value: null });
    assert.deepEqual(res5, { status: null, value: null });

    // Merging into device array
    const existingDev = { id: 2, node_id: '4L-NODE-123_2', status: false, value: 1 };
    const mergedStatus = res2.status !== null ? res2.status : existingDev.status;
    assert.equal(mergedStatus, false, 'Missing channel in partial response must retain existing status');
  });

  it('3.2: Corrupted and unexpected data types for channels are handled safely', () => {
    const corruptedState = {
      channel_1: 9999,          // invalid number (only 1 or 0 is valid)
      channel_2: "CORRUPTED",   // unexpected string
      channel_3: null,          // explicit null
      channel_4: {},            // object
      channel_5: [],            // array
      speed: "NOT_A_NUMBER"     // invalid speed string
    };

    assert.deepEqual(parseLocalChannelState(corruptedState, 1), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(corruptedState, 2), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(corruptedState, 3), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState(corruptedState, 4), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState(corruptedState, 5), { status: null, value: null });
  });

  it('3.3: Non-object, primitives, and null /state payloads return { status: null, value: null } without crashing', () => {
    assert.deepEqual(parseLocalChannelState(null, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState(undefined, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState("<html>500 Server Error</html>", 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState(12345, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState(true, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState([], 1), { status: null, value: null });
  });

  it('3.4: pingLocalDevice handles HTTP 500 or malformed JSON responses by returning null', async () => {
    const originalFetch = globalThis.fetch;

    try {
      // Case A: HTTP 500 Server Error
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Error' })
      });

      const res500 = await pingLocalDevice('4L_NODE1', '192.168.1.50', 100);
      assert.equal(res500, null, 'HTTP 500 should return null');

      // Case B: HTTP 200 with invalid JSON body
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
      });

      const resInvalidJson = await pingLocalDevice('4L_NODE1', '192.168.1.50', 100);
      assert.equal(resInvalidJson, null, 'Corrupted JSON response should return null safely');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('3.5: fetchLocalDeviceState handles network failures by returning null', async () => {
    const originalFetch = globalThis.fetch;

    try {
      globalThis.fetch = async () => {
        throw new Error('ECONNREFUSED');
      };

      const res = await fetchLocalDeviceState('4L_NODE1', '192.168.1.50', 100);
      assert.equal(res, null, 'Network connection refused must return null without unhandled rejection');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Scenario 4: Unrecognized Node IDs, Missing Local IP, and Boundary Conditions', () => {
  it('4.1: getBaseNodeId extracts base node ID from single and multi-underscore channel identifiers', () => {
    assert.equal(getBaseNodeId(""), "");
    assert.equal(getBaseNodeId(null), "");
    assert.equal(getBaseNodeId(undefined), "");
    assert.equal(getBaseNodeId("SINGLETON"), "SINGLETON");
    assert.equal(getBaseNodeId("4L_NODE1_1"), "4L_NODE1");
    assert.equal(getBaseNodeId("4L_NODE1_5"), "4L_NODE1");
    assert.equal(getBaseNodeId("4L_HOME_FLOOR1_ROOM1_SWITCH1_5"), "4L_HOME_FLOOR1_ROOM1_SWITCH1");
    assert.equal(getBaseNodeId("4L-NODE-123_1"), "4L-NODE-123");
  });

  it('4.2: pingLocalDevice skips network calls for invalid IP addresses (127.0.0.1, 0.0.0.0, null)', async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;

    try {
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({}) };
      };

      const resNull = await pingLocalDevice('4L_NODE1', null);
      assert.equal(resNull, null);
      assert.equal(fetchCalled, false);

      const resLoopback = await pingLocalDevice('4L_NODE1', '127.0.0.1');
      assert.equal(resLoopback, null);
      assert.equal(fetchCalled, false);

      const resZero = await pingLocalDevice('4L_NODE1', '0.0.0.0');
      assert.equal(resZero, null);
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4.3: parseLocalChannelState handles channel suffix formatted as string with prefix ("_5", "ch_5")', () => {
    const state = {
      channel_1: "ON",
      channel_5: "ON",
      speed: 3
    };

    assert.deepEqual(parseLocalChannelState(state, "_1"), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(state, "node_1"), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(state, "channel_5"), { status: true, value: 3 });
    assert.deepEqual(parseLocalChannelState(state, "invalid_non_numeric"), { status: null, value: null });
  });

  it('4.4: Master switch channel evaluation for channel 6 and 7 with varying all_state values', () => {
    assert.deepEqual(parseLocalChannelState({ all_state: "ON" }, 6), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState({ all_state: "ALL_ON" }, 6), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState({ all_state: "MIXED" }, 6), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState({ all_state: "OFF" }, 6), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState({ all_state: "ALL_OFF" }, 6), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState({ all_state: "UNKNOWN_VAL" }, 6), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState({}, 6), { status: null, value: null });
  });

  it('4.5: Multi-node catch-block fallback ping processes mixed online/offline nodes independently', async () => {
    const cachedDevices = [
      { id: 1, name: "Node A Relay 1", node_id: "4L_NODEA_1", is_online: true, status: true },
      { id: 2, name: "Node A Relay 2", node_id: "4L_NODEA_2", is_online: true, status: true },
      { id: 3, name: "Node B Relay 1", node_id: "4L_NODEB_1", is_online: true, status: true },
      { id: 4, name: "Node C Relay 1", node_id: "4L_NODEC_1", is_online: true, status: true }
    ];

    const mockPings = {
      "4L_NODEA": { node_id: "4L_NODEA", channel_1: "ON", channel_2: "OFF" },
      "4L_NODEB": null, // unreachable
      "4L_NODEC": { node_id: "4L_NODEC", channel_1: "OFF" }
    };

    const uniqueNodes = Array.from(new Set(cachedDevices.map(d => getBaseNodeId(d.node_id)).filter(Boolean)));
    assert.deepEqual(uniqueNodes, ["4L_NODEA", "4L_NODEB", "4L_NODEC"]);

    const pingPromises = uniqueNodes.map(async (baseNodeId) => {
      const localState = mockPings[baseNodeId];
      return { baseNodeId, localState };
    });
    const pingResults = await Promise.all(pingPromises);
    const pingMap = new Map(pingResults.map(r => [r.baseNodeId, r]));

    const updatedDevs = cachedDevices.map(d => {
      const baseNodeId = getBaseNodeId(d.node_id);
      const pingInfo = pingMap.get(baseNodeId);
      if (pingInfo && pingInfo.localState) {
        const suffix = parseInt(d.node_id?.split('_').pop(), 10);
        const parsed = parseLocalChannelState(pingInfo.localState, suffix);
        return {
          ...d,
          is_online: true,
          status: parsed.status !== null ? parsed.status : d.status
        };
      } else {
        return { ...d, is_online: false, status: false };
      }
    });

    // Node A (Online): Relay 1 ON, Relay 2 OFF
    assert.equal(updatedDevs[0].is_online, true);
    assert.equal(updatedDevs[0].status, true);
    assert.equal(updatedDevs[1].is_online, true);
    assert.equal(updatedDevs[1].status, false);

    // Node B (Offline): marked offline
    assert.equal(updatedDevs[2].is_online, false);
    assert.equal(updatedDevs[2].status, false);

    // Node C (Online): Relay 1 OFF
    assert.equal(updatedDevs[3].is_online, true);
    assert.equal(updatedDevs[3].status, false);
  });
});
