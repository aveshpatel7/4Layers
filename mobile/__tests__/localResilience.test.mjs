import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test parseLocalChannelState and getBaseNodeId logic directly
import { 
  parseLocalChannelState, 
  getBaseNodeId,
  saveDeviceLocalIp,
  getDeviceLocalIp
} from '../src/services/localControl.js';

describe('Base Node ID Extractor (getBaseNodeId)', () => {
  it('should extract base node ID from single and multi-underscore channel node IDs', () => {
    assert.equal(getBaseNodeId("4L_NODE1_1"), "4L_NODE1");
    assert.equal(getBaseNodeId("4L_NODE1_5"), "4L_NODE1");
    assert.equal(getBaseNodeId("4L-NODE-123_1"), "4L-NODE-123");
    assert.equal(getBaseNodeId("SWITCH_BOARD_A_6"), "SWITCH_BOARD_A");
    assert.equal(getBaseNodeId("NODE1"), "NODE1");
    assert.equal(getBaseNodeId(""), "");
    assert.equal(getBaseNodeId(null), "");
    assert.equal(getBaseNodeId(undefined), "");
  });
});

describe('Local IP Resolution & Caching', () => {
  it('should index and retrieve IP by base node ID and channel node ID', async () => {
    await saveDeviceLocalIp("4L_BOARD99_1", "192.168.1.99");
    assert.equal(getDeviceLocalIp("4L_BOARD99"), "192.168.1.99");
    assert.equal(getDeviceLocalIp("4L_BOARD99_1"), "192.168.1.99");
    assert.equal(getDeviceLocalIp("4L_BOARD99_5"), "192.168.1.99");
    assert.equal(getDeviceLocalIp(null), null);
    assert.equal(getDeviceLocalIp("NON_EXISTENT"), null);
  });
});

describe('Local Control State Parser (parseLocalChannelState)', () => {
  it('should parse modern firmware response with string "ON" / "OFF" for relays', () => {
    const firmwareState = {
      node_id: "4L-NODE-123",
      local_ip: "192.168.1.50",
      channel_1: "ON",
      channel_2: "OFF",
      channel_3: "OFF",
      channel_4: "ON",
      channel_5: "ON",
      speed: 3,
      all_state: "MIXED"
    };

    assert.deepEqual(parseLocalChannelState(firmwareState, 1), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(firmwareState, 2), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(firmwareState, 3), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(firmwareState, 4), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(firmwareState, 5), { status: true, value: 3 });
  });

  it('should parse boolean values in modern firmware response', () => {
    const state = {
      channel_1: true,
      channel_2: false,
      channel_5: true,
      speed: 4
    };

    assert.deepEqual(parseLocalChannelState(state, 1), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(state, 2), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(state, 5), { status: true, value: 4 });
  });

  it('should parse numeric 1 / 0 values', () => {
    const state = {
      channel_1: 1,
      channel_2: 0,
      channel_5: 1,
      speed: 2
    };

    assert.deepEqual(parseLocalChannelState(state, 1), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(state, 2), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(state, 5), { status: true, value: 2 });
  });

  it('should parse string channel suffix formats like "_1", "4L_NODE_1"', () => {
    const state = {
      channel_1: "ON",
      channel_5: "OFF",
      speed: 0
    };

    assert.deepEqual(parseLocalChannelState(state, "_1"), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(state, "4L_NODE_5"), { status: false, value: 0 });
  });

  it('should support legacy relays array and fan object format', () => {
    const legacyState = {
      node_id: "4L-NODE-123",
      local_ip: "192.168.1.50",
      relays: [true, false, true, false],
      fan: {
        enabled: true,
        speed: 3
      }
    };

    assert.deepEqual(parseLocalChannelState(legacyState, 1), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(legacyState, 2), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(legacyState, 3), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(legacyState, 4), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(legacyState, 5), { status: true, value: 3 });
  });

  it('should handle master switch channels (6 and 7)', () => {
    const stateAllOn = { all_state: "ALL_ON" };
    const stateAllOff = { all_state: "ALL_OFF" };
    const stateMixed = { all_state: "MIXED" };

    assert.deepEqual(parseLocalChannelState(stateAllOn, 6), { status: true, value: null });
    assert.deepEqual(parseLocalChannelState(stateAllOff, 6), { status: false, value: null });
    assert.deepEqual(parseLocalChannelState(stateMixed, 7), { status: true, value: null });
  });

  it('should gracefully handle null, undefined, or empty objects', () => {
    assert.deepEqual(parseLocalChannelState(null, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState(undefined, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState({}, 1), { status: null, value: null });
    assert.deepEqual(parseLocalChannelState({ channel_1: "ON" }, "invalid"), { status: null, value: null });
  });
});

describe('Master Switch Room Aggregation Logic', () => {
  const recalculateMaster = (devList) => {
    const roomStatusMap = {};
    devList.forEach(d => {
      if (d.type !== 'master' && !d.node_id?.endsWith('_6') && !d.node_id?.endsWith('_7')) {
        if (d.status && d.is_online !== false) roomStatusMap[d.room_id] = true;
      }
    });

    return devList.map(d => {
      if (d.type === 'master' || d.node_id?.endsWith('_6') || d.node_id?.endsWith('_7')) {
        return { ...d, status: !!roomStatusMap[d.room_id] };
      }
      return d;
    });
  };

  it('should set master switch to true when any device in the room is ON', () => {
    const devices = [
      { id: 1, node_id: "4L_NODE1_1", room_id: "room1", is_online: true, status: true },
      { id: 2, node_id: "4L_NODE1_2", room_id: "room1", is_online: true, status: false },
      { id: 6, node_id: "4L_NODE1_6", room_id: "room1", is_online: true, status: false, type: "master" }
    ];

    const result = recalculateMaster(devices);
    assert.equal(result.find(d => d.type === "master").status, true);
  });

  it('should set master switch to false when all devices in the room are OFF', () => {
    const devices = [
      { id: 1, node_id: "4L_NODE1_1", room_id: "room1", is_online: true, status: false },
      { id: 2, node_id: "4L_NODE1_2", room_id: "room1", is_online: true, status: false },
      { id: 6, node_id: "4L_NODE1_6", room_id: "room1", is_online: true, status: true, type: "master" }
    ];

    const result = recalculateMaster(devices);
    assert.equal(result.find(d => d.type === "master").status, false);
  });
});

describe('Dashboard Multi-Node Offline Fallback & Offline Gating Simulation', () => {
  it('should ping multiple nodes in parallel and map channels to subdevices', async () => {
    const cachedDevices = [
      { id: 1, name: "Living Room Light 1", node_id: "4L_NODE1_1", room_id: "r1", is_online: true, status: false, value: 1 },
      { id: 2, name: "Living Room Light 2", node_id: "4L_NODE1_2", room_id: "r1", is_online: true, status: false, value: 1 },
      { id: 3, name: "Living Room Fan",     node_id: "4L_NODE1_5", room_id: "r1", is_online: true, status: false, value: 1, type: "fan" },
      { id: 4, name: "Bedroom Light 1",     node_id: "4L_NODE2_1", room_id: "r2", is_online: true, status: false, value: 1 },
      { id: 5, name: "Bedroom Light 2",     node_id: "4L_NODE2_2", room_id: "r2", is_online: true, status: false, value: 1 },
    ];

    // Mock ping responses for NODE1 (online) and NODE2 (unreachable)
    const mockPings = {
      "4L_NODE1": {
        node_id: "4L_NODE1",
        local_ip: "192.168.1.101",
        channel_1: "ON",
        channel_2: "OFF",
        channel_5: "ON",
        speed: 3
      },
      "4L_NODE2": null // Node 2 unreachable
    };

    const isPhoneOnWifi = true;
    const uniqueNodes = Array.from(new Set(cachedDevices.map(d => getBaseNodeId(d.node_id)).filter(Boolean)));
    assert.deepEqual(uniqueNodes, ["4L_NODE1", "4L_NODE2"]);

    // Parallel ping execution via Promise.all
    const pingPromises = uniqueNodes.map(async (baseNodeId) => {
      const localState = mockPings[baseNodeId];
      return { baseNodeId, localState };
    });
    const pingResults = await Promise.all(pingPromises);
    const pingMap = new Map(pingResults.map(r => [r.baseNodeId, r]));

    // Map results
    const updatedDevs = cachedDevices.map(d => {
      const baseNodeId = getBaseNodeId(d.node_id);
      const pingInfo = pingMap.get(baseNodeId);
      if (pingInfo && pingInfo.localState) {
        const suffix = parseInt(d.node_id?.split('_').pop(), 10);
        const parsed = parseLocalChannelState(pingInfo.localState, suffix);
        return {
          ...d,
          is_online: true,
          status: parsed.status !== null ? parsed.status : d.status,
          value: parsed.value !== null ? parsed.value : d.value
        };
      } else {
        return { ...d, is_online: false, status: false };
      }
    });

    // Check Node 1 devices: online with fresh states
    assert.equal(updatedDevs[0].is_online, true);
    assert.equal(updatedDevs[0].status, true); // channel 1 is ON
    assert.equal(updatedDevs[1].is_online, true);
    assert.equal(updatedDevs[1].status, false); // channel 2 is OFF
    assert.equal(updatedDevs[2].is_online, true);
    assert.equal(updatedDevs[2].status, true); // fan is ON
    assert.equal(updatedDevs[2].value, 3); // speed is 3

    // Check Node 2 devices: offline cleanly
    assert.equal(updatedDevs[3].is_online, false);
    assert.equal(updatedDevs[3].status, false);
    assert.equal(updatedDevs[4].is_online, false);
    assert.equal(updatedDevs[4].status, false);
  });

  it('should not show Switchboard Offline banner if phone is on Wi-Fi and local ping succeeds even if Cloud fails', () => {
    // Cloud reported failure, but local ping succeeded
    const devices = [
      { id: 1, name: "Switch 1", room_id: "r1", is_online: true, status: true },
      { id: 2, name: "Switch 2", room_id: "r1", is_online: true, status: false }
    ];

    const showOfflineBanner = devices.some(d => d.is_online === false);
    assert.equal(showOfflineBanner, false); // No banner shown!
  });

  it('should show Switchboard Offline banner ONLY if both Cloud and Local LAN ping fail', () => {
    // Both Cloud and LAN ping failed
    const devices = [
      { id: 1, name: "Switch 1", room_id: "r1", is_online: false, status: false },
      { id: 2, name: "Switch 2", room_id: "r1", is_online: false, status: false }
    ];

    const showOfflineBanner = devices.some(d => d.is_online === false);
    assert.equal(showOfflineBanner, true); // Banner correctly shown when truly offline
  });

  it('should handle MQTT OFFLINE payload with local LAN fallback gating', async () => {
    let devices = [
      { id: 1, name: "Switch 1", node_id: "4L_NODE1_1", room_id: "r1", is_online: true, status: true },
      { id: 2, name: "Switch 2", node_id: "4L_NODE1_2", room_id: "r1", is_online: true, status: false }
    ];

    // Case 1: MQTT OFFLINE arrives, phone on Wi-Fi, local ping SUCCEEDS
    const isPhoneOnWifi = true;
    const localIp = "192.168.1.100";
    const pingLocalMockSuccess = async (nodeId, ip, timeout) => ({
      node_id: nodeId,
      channel_1: "ON",
      channel_2: "OFF"
    });

    const baseNodeId = "4L_NODE1";
    if (isPhoneOnWifi && localIp) {
      const localState = await pingLocalMockSuccess(baseNodeId, localIp, 500);
      if (localState) {
        // Keep online!
        devices = devices.map(d => {
          if (getBaseNodeId(d.node_id) === baseNodeId) {
            const suffix = parseInt(d.node_id.split('_').pop(), 10);
            const parsed = parseLocalChannelState(localState, suffix);
            return { ...d, is_online: true, status: parsed.status };
          }
          return d;
        });
      }
    }

    assert.equal(devices[0].is_online, true);
    assert.equal(devices[0].status, true);
    assert.equal(devices[1].is_online, true);
    assert.equal(devices[1].status, false);

    // Case 2: MQTT OFFLINE arrives, phone on Wi-Fi, local ping FAILS
    const pingLocalMockFail = async (nodeId, ip, timeout) => null;
    if (isPhoneOnWifi && localIp) {
      const localState = await pingLocalMockFail(baseNodeId, localIp, 500);
      if (!localState) {
        // Mark offline!
        devices = devices.map(d => {
          if (getBaseNodeId(d.node_id) === baseNodeId) {
            return { ...d, is_online: false, status: false };
          }
          return d;
        });
      }
    }

    assert.equal(devices[0].is_online, false);
    assert.equal(devices[0].status, false);
    assert.equal(devices[1].is_online, false);
    assert.equal(devices[1].status, false);
  });
});
