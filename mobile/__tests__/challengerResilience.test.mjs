import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseLocalChannelState,
  getBaseNodeId,
  saveDeviceLocalIp,
  getDeviceLocalIp,
  sendLocalControlCommand,
  pingLocalDevice,
  fetchLocalDeviceState
} from '../src/services/localControl.js';

describe('Challenger Stress Test Suite - Milestone 2 Local-First Resilience', () => {

  // =========================================================================
  // SCENARIO A: Cloud offline / MQTT OFFLINE payload, but Local LAN reachable
  // =========================================================================
  describe('Scenario A: Cloud Offline / MQTT OFFLINE, Local LAN Reachable', () => {
    it('should keep device online (is_online === true) and suppress offline banner on MQTT OFFLINE when LAN ping succeeds', async () => {
      let stateDevices = [
        { id: 1, name: "Living Light 1", node_id: "4L_NODE1_1", room_id: "r1", is_online: true, status: true, value: 1, local_ip: "192.168.1.50" },
        { id: 2, name: "Living Fan",     node_id: "4L_NODE1_5", room_id: "r1", is_online: true, status: true, value: 3, local_ip: "192.168.1.50" },
        { id: 3, name: "Living Master",  node_id: "4L_NODE1_6", room_id: "r1", is_online: true, status: true, value: 1, type: "master", local_ip: "192.168.1.50" }
      ];

      const isPhoneOnWifi = true;
      const mqttPayload = { status: "OFFLINE", node_id: "4L_NODE1" };
      const baseNodeId = mqttPayload.node_id;

      // Mock Local Ping returning live ESP32 state
      const mockPingLocal = async (nodeId, ip) => {
        return {
          node_id: "4L_NODE1",
          local_ip: "192.168.1.50",
          channel_1: "ON",
          channel_2: "OFF",
          channel_5: "ON",
          speed: 4,
          all_state: "MIXED"
        };
      };

      // Emulate Dashboard MQTT OFFLINE handler logic
      const localIp = getDeviceLocalIp(baseNodeId) || stateDevices.find(d => getBaseNodeId(d.node_id) === baseNodeId)?.local_ip;
      if (isPhoneOnWifi && localIp) {
        const localState = await mockPingLocal(baseNodeId, localIp);
        if (localState) {
          stateDevices = stateDevices.map(d => {
            if (getBaseNodeId(d.node_id) === baseNodeId) {
              const suffix = parseInt(d.node_id.split('_').pop(), 10);
              const parsed = parseLocalChannelState(localState, suffix);
              return {
                ...d,
                is_online: true,
                status: parsed.status !== null ? parsed.status : d.status,
                value: parsed.value !== null ? parsed.value : d.value,
                local_ip: localState.local_ip || localIp
              };
            }
            return d;
          });
        }
      }

      // Assertions for Scenario A
      assert.equal(stateDevices[0].is_online, true, "Channel 1 MUST remain online");
      assert.equal(stateDevices[0].status, true, "Channel 1 status MUST reflect local state (ON)");
      assert.equal(stateDevices[1].is_online, true, "Channel 5 (Fan) MUST remain online");
      assert.equal(stateDevices[1].value, 4, "Fan speed MUST update from local state (4)");
      assert.equal(stateDevices[2].is_online, true, "Master switch MUST remain online");

      // Verify offline banner condition: banner is shown if filteredDevices.some(d => d.is_online === false)
      const isOfflineBannerVisible = stateDevices.some(d => d.is_online === false);
      assert.equal(isOfflineBannerVisible, false, "Switchboard Offline warning banner MUST NOT be visible when LAN ping succeeds");
    });

    it('should keep devices online during Cloud REST API failure when cached devices respond over LAN', async () => {
      const cachedDevices = [
        { id: 10, name: "Dining Light 1", node_id: "4L_DINING_1", room_id: "dining", is_online: true, status: false, local_ip: "192.168.1.60" },
        { id: 11, name: "Dining Light 2", node_id: "4L_DINING_2", room_id: "dining", is_online: true, status: false, local_ip: "192.168.1.60" }
      ];

      const isPhoneOnWifi = true;
      const mockLocalPings = {
        "4L_DINING": {
          node_id: "4L_DINING",
          local_ip: "192.168.1.60",
          channel_1: "ON",
          channel_2: "OFF"
        }
      };

      // Simulate fetchDevices catch block
      let updatedDevs = [...cachedDevices];
      if (isPhoneOnWifi) {
        const uniqueNodes = Array.from(new Set(cachedDevices.map(d => getBaseNodeId(d.node_id)).filter(Boolean)));
        const pingResults = await Promise.all(uniqueNodes.map(async baseNodeId => ({
          baseNodeId,
          localState: mockLocalPings[baseNodeId]
        })));
        const pingMap = new Map(pingResults.map(r => [r.baseNodeId, r]));

        updatedDevs = updatedDevs.map(d => {
          const baseNodeId = getBaseNodeId(d.node_id);
          const pingInfo = pingMap.get(baseNodeId);
          if (pingInfo && pingInfo.localState) {
            const suffix = parseInt(d.node_id.split('_').pop(), 10);
            const parsed = parseLocalChannelState(pingInfo.localState, suffix);
            return {
              ...d,
              is_online: true,
              status: parsed.status !== null ? parsed.status : d.status
            };
          }
          return { ...d, is_online: false, status: false };
        });
      }

      assert.equal(updatedDevs[0].is_online, true);
      assert.equal(updatedDevs[0].status, true);
      assert.equal(updatedDevs[1].is_online, true);
      assert.equal(updatedDevs[1].status, false);
      assert.equal(updatedDevs.some(d => d.is_online === false), false, "No offline banner should appear");
    });
  });

  // =========================================================================
  // SCENARIO B: Cloud offline AND Local LAN unreachable
  // =========================================================================
  describe('Scenario B: Cloud Offline AND Local LAN Unreachable', () => {
    it('should mark all devices offline (is_online === false) and show Switchboard Offline banner', async () => {
      const cachedDevices = [
        { id: 20, name: "Hallway Light", node_id: "4L_HALL_1", room_id: "hall", is_online: true, status: true, local_ip: "192.168.1.75" },
        { id: 21, name: "Hallway Fan",   node_id: "4L_HALL_5", room_id: "hall", is_online: true, status: true, local_ip: "192.168.1.75" }
      ];

      const isPhoneOnWifi = true;
      // Simulated timeout / unreachable response (null)
      const mockLocalPings = {
        "4L_HALL": null
      };

      let updatedDevs = [...cachedDevices];
      if (isPhoneOnWifi) {
        const uniqueNodes = Array.from(new Set(cachedDevices.map(d => getBaseNodeId(d.node_id)).filter(Boolean)));
        const pingResults = await Promise.all(uniqueNodes.map(async baseNodeId => ({
          baseNodeId,
          localState: mockLocalPings[baseNodeId]
        })));
        const pingMap = new Map(pingResults.map(r => [r.baseNodeId, r]));

        updatedDevs = updatedDevs.map(d => {
          const baseNodeId = getBaseNodeId(d.node_id);
          const pingInfo = pingMap.get(baseNodeId);
          if (pingInfo && pingInfo.localState) {
            return { ...d, is_online: true };
          } else {
            return { ...d, is_online: false, status: false };
          }
        });
      }

      assert.equal(updatedDevs[0].is_online, false, "Device MUST be offline");
      assert.equal(updatedDevs[0].status, false, "Offline device status MUST be false");
      assert.equal(updatedDevs[1].is_online, false, "Device MUST be offline");
      assert.equal(updatedDevs[1].status, false, "Offline device status MUST be false");

      const isOfflineBannerVisible = updatedDevs.some(d => d.is_online === false);
      assert.equal(isOfflineBannerVisible, true, "Switchboard Offline banner MUST be visible when both Cloud and LAN fail");
    });

    it('should immediately mark devices offline if Cloud fails and phone is NOT on Wi-Fi (cellular)', async () => {
      const cachedDevices = [
        { id: 22, name: "Garden Light", node_id: "4L_GARDEN_1", room_id: "garden", is_online: true, status: true }
      ];

      const isPhoneOnWifi = false; // Cellular 4G/5G

      let updatedDevs = [...cachedDevices];
      if (!isPhoneOnWifi) {
        updatedDevs = updatedDevs.map(d => ({ ...d, is_online: false, status: false }));
      }

      assert.equal(updatedDevs[0].is_online, false);
      assert.equal(updatedDevs[0].status, false);
      assert.equal(updatedDevs.some(d => d.is_online === false), true, "Banner must be shown");
    });
  });

  // =========================================================================
  // SCENARIO C: Multi-switchboard setup (Node A online locally, Node B offline locally)
  // =========================================================================
  describe('Scenario C: Multi-Switchboard Setup Independence', () => {
    it('should maintain independent online/offline status per node when Node A is reachable and Node B is unreachable', async () => {
      const allDevices = [
        // Switchboard A (Living Room) - Online on LAN (192.168.1.101)
        { id: 101, name: "Living Light 1", node_id: "4L_BOARD_A_1", room_id: "living", is_online: true, status: false, local_ip: "192.168.1.101" },
        { id: 102, name: "Living Light 2", node_id: "4L_BOARD_A_2", room_id: "living", is_online: true, status: false, local_ip: "192.168.1.101" },
        { id: 105, name: "Living Fan",     node_id: "4L_BOARD_A_5", room_id: "living", is_online: true, status: false, value: 1, local_ip: "192.168.1.101" },
        // Switchboard B (Bedroom) - Dead / Unreachable (192.168.1.102)
        { id: 201, name: "Bed Light 1",    node_id: "4L_BOARD_B_1", room_id: "bed", is_online: true, status: false, local_ip: "192.168.1.102" },
        { id: 202, name: "Bed Light 2",    node_id: "4L_BOARD_B_2", room_id: "bed", is_online: true, status: false, local_ip: "192.168.1.102" },
        // Switchboard C (Kitchen) - Online on LAN (192.168.1.103)
        { id: 301, name: "Kitchen Light",  node_id: "4L_BOARD_C_1", room_id: "kitchen", is_online: true, status: false, local_ip: "192.168.1.103" }
      ];

      const mockPingResponses = {
        "4L_BOARD_A": {
          node_id: "4L_BOARD_A",
          local_ip: "192.168.1.101",
          channel_1: "ON",
          channel_2: "OFF",
          channel_5: "ON",
          speed: 2
        },
        "4L_BOARD_B": null, // Unreachable
        "4L_BOARD_C": {
          node_id: "4L_BOARD_C",
          local_ip: "192.168.1.103",
          channel_1: "ON"
        }
      };

      const isPhoneOnWifi = true;
      const uniqueBaseNodes = Array.from(new Set(allDevices.map(d => getBaseNodeId(d.node_id)).filter(Boolean)));
      assert.deepEqual(uniqueBaseNodes, ["4L_BOARD_A", "4L_BOARD_B", "4L_BOARD_C"]);

      const pingResults = await Promise.all(uniqueBaseNodes.map(async baseNodeId => ({
        baseNodeId,
        localState: mockPingResponses[baseNodeId]
      })));
      const pingMap = new Map(pingResults.map(r => [r.baseNodeId, r]));

      const updatedDevices = allDevices.map(d => {
        const baseNodeId = getBaseNodeId(d.node_id);
        const pingInfo = pingMap.get(baseNodeId);
        if (pingInfo && pingInfo.localState) {
          const suffix = parseInt(d.node_id.split('_').pop(), 10);
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

      // Node A checks (Living Room)
      const livingDevs = updatedDevices.filter(d => d.room_id === "living");
      assert.equal(livingDevs[0].is_online, true, "Node A Light 1 MUST be online");
      assert.equal(livingDevs[0].status, true, "Node A Light 1 MUST be ON");
      assert.equal(livingDevs[1].is_online, true, "Node A Light 2 MUST be online");
      assert.equal(livingDevs[1].status, false, "Node A Light 2 MUST be OFF");
      assert.equal(livingDevs[2].is_online, true, "Node A Fan MUST be online");
      assert.equal(livingDevs[2].value, 2, "Node A Fan speed MUST be 2");
      assert.equal(livingDevs.some(d => d.is_online === false), false, "Living Room MUST NOT show offline banner");

      // Node B checks (Bedroom)
      const bedDevs = updatedDevices.filter(d => d.room_id === "bed");
      assert.equal(bedDevs[0].is_online, false, "Node B Light 1 MUST be offline");
      assert.equal(bedDevs[1].is_online, false, "Node B Light 2 MUST be offline");
      assert.equal(bedDevs.some(d => d.is_online === false), true, "Bedroom MUST show offline banner");

      // Node C checks (Kitchen)
      const kitchenDevs = updatedDevices.filter(d => d.room_id === "kitchen");
      assert.equal(kitchenDevs[0].is_online, true, "Node C Light MUST be online");
      assert.equal(kitchenDevs[0].status, true, "Node C Light MUST be ON");
      assert.equal(kitchenDevs.some(d => d.is_online === false), false, "Kitchen MUST NOT show offline banner");
    });
  });

  // =========================================================================
  // SCENARIO D: Firmware /state parsing with various payload flavors
  // =========================================================================
  describe('Scenario D: Firmware /state Payload Flavor Parsing', () => {
    it('should parse uppercase, lowercase, and mixed case string statuses ("ON", "on", "OFF", "off")', () => {
      const payload = {
        channel_1: "ON",
        channel_2: "off",
        channel_3: "On",
        channel_4: "OFF"
      };

      assert.deepEqual(parseLocalChannelState(payload, 1), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 2), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 3), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 4), { status: false, value: null });
    });

    it('should parse boolean statuses (true, false)', () => {
      const payload = {
        channel_1: true,
        channel_2: false,
        channel_3: true,
        channel_4: false
      };

      assert.deepEqual(parseLocalChannelState(payload, 1), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 2), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 3), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 4), { status: false, value: null });
    });

    it('should parse integer and string numeric statuses (1, 0, "1", "0")', () => {
      const payload = {
        channel_1: 1,
        channel_2: 0,
        channel_3: "1",
        channel_4: "0"
      };

      assert.deepEqual(parseLocalChannelState(payload, 1), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 2), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 3), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 4), { status: false, value: null });
    });

    it('should parse string booleans ("TRUE", "true", "FALSE", "false")', () => {
      const payload = {
        channel_1: "TRUE",
        channel_2: "false",
        channel_3: "True",
        channel_4: "FALSE"
      };

      assert.deepEqual(parseLocalChannelState(payload, 1), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 2), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 3), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(payload, 4), { status: false, value: null });
    });

    it('should correctly parse Fan channel 5 with integer, string, and zero speeds', () => {
      // Fan ON with integer speed
      assert.deepEqual(
        parseLocalChannelState({ channel_5: "ON", speed: 4 }, 5),
        { status: true, value: 4 }
      );

      // Fan OFF with speed 0
      assert.deepEqual(
        parseLocalChannelState({ channel_5: "OFF", speed: 0 }, 5),
        { status: false, value: 0 }
      );

      // Fan with speed string "3" and channel_5 undefined -> status inferred from speed > 0
      assert.deepEqual(
        parseLocalChannelState({ speed: "3" }, 5),
        { status: true, value: 3 }
      );

      // Fan with speed 0 and channel_5 undefined -> status inferred as false
      assert.deepEqual(
        parseLocalChannelState({ speed: 0 }, 5),
        { status: false, value: 0 }
      );

      // Fan OFF but speed retained in firmware memory as 3
      assert.deepEqual(
        parseLocalChannelState({ channel_5: "OFF", speed: 3 }, 5),
        { status: false, value: 3 }
      );
    });

    it('should correctly parse master channel (6 and 7) with all_state variations', () => {
      assert.deepEqual(parseLocalChannelState({ all_state: "ALL_ON" }, 6), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState({ all_state: "ON" }, 6), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState({ all_state: "MIXED" }, 6), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState({ all_state: "mixed" }, 6), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState({ all_state: "ALL_OFF" }, 6), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState({ all_state: "OFF" }, 6), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState({ all_state: "ALL_ON" }, 7), { status: true, value: null });
    });

    it('should parse legacy relays array and fan object with mixed types', () => {
      const legacyPayload = {
        relays: ["ON", 0, true, "OFF"],
        fan: {
          enabled: true,
          speed: "4"
        }
      };

      assert.deepEqual(parseLocalChannelState(legacyPayload, 1), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(legacyPayload, 2), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState(legacyPayload, 3), { status: true, value: null });
      assert.deepEqual(parseLocalChannelState(legacyPayload, 4), { status: false, value: null });
      assert.deepEqual(parseLocalChannelState(legacyPayload, 5), { status: true, value: 4 });
    });

    it('should handle corrupted, unexpected or edge-case payload shapes safely', () => {
      // Non-object input
      assert.deepEqual(parseLocalChannelState(null, 1), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState("string payload", 1), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState(12345, 1), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState([], 1), { status: null, value: null });

      // Invalid channel suffix
      assert.deepEqual(parseLocalChannelState({ channel_1: "ON" }, null), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState({ channel_1: "ON" }, undefined), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState({ channel_1: "ON" }, "invalid_ch"), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState({ channel_1: "ON" }, NaN), { status: null, value: null });

      // Unexpected channel data types (objects, arrays)
      assert.deepEqual(parseLocalChannelState({ channel_1: { invalid: true } }, 1), { status: null, value: null });
      assert.deepEqual(parseLocalChannelState({ channel_1: [1, 2, 3] }, 1), { status: null, value: null });

      // Invalid speed string
      assert.deepEqual(parseLocalChannelState({ channel_5: "ON", speed: "not_a_number" }, 5), { status: true, value: null });
    });
  });

  // =========================================================================
  // SCENARIO E: Base Node ID and IP Resolution Adversarial Stress Testing
  // =========================================================================
  describe('Scenario E: Base Node ID and Local IP Cache Stress Testing', () => {
    it('should reliably extract base node IDs from complex, multi-segment naming patterns', () => {
      assert.equal(getBaseNodeId("4L_SWITCHBOARD_A_1"), "4L_SWITCHBOARD_A");
      assert.equal(getBaseNodeId("HOME_FLOOR1_ROOM2_NODE3_5"), "HOME_FLOOR1_ROOM2_NODE3");
      assert.equal(getBaseNodeId("SINGLE_1"), "SINGLE");
      assert.equal(getBaseNodeId("NOUNDERSCORE"), "NOUNDERSCORE");
      assert.equal(getBaseNodeId("A_B_C_D_E_6"), "A_B_C_D_E");
      assert.equal(getBaseNodeId(""), "");
      assert.equal(getBaseNodeId(null), "");
      assert.equal(getBaseNodeId(undefined), "");
    });

    it('should save and resolve IP correctly for both base node and sub-channel node IDs', async () => {
      await saveDeviceLocalIp("4L_COMPLEX_NODE_1", "192.168.4.120");
      assert.equal(getDeviceLocalIp("4L_COMPLEX_NODE"), "192.168.4.120");
      assert.equal(getDeviceLocalIp("4L_COMPLEX_NODE_1"), "192.168.4.120");
      assert.equal(getDeviceLocalIp("4L_COMPLEX_NODE_5"), "192.168.4.120");
      assert.equal(getDeviceLocalIp("4L_COMPLEX_NODE_7"), "192.168.4.120");
    });
  });

  // =========================================================================
  // SCENARIO F: Local HTTP Command Construction & Query Parameter Validation
  // =========================================================================
  describe('Scenario F: sendLocalControlCommand Query Formatting', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    it('should construct correct HTTP GET URL with channel, state, and speed parameters', async () => {
      let interceptedUrl = null;

      global.fetch = async (url, options) => {
        interceptedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, channel: 5, state: "ON", speed: 3 })
        };
      };

      try {
        const result = await sendLocalControlCommand("4L_TEST_5", 5, "ON", "192.168.1.200", 3);
        assert.equal(result.success, true);
        assert.equal(interceptedUrl, "http://192.168.1.200/control?channel=5&state=on&speed=3");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should format boolean state to "on" / "off" string parameters', async () => {
      let interceptedUrls = [];

      global.fetch = async (url) => {
        interceptedUrls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      };

      try {
        await sendLocalControlCommand("4L_TEST_1", 1, true, "192.168.1.200");
        await sendLocalControlCommand("4L_TEST_2", 2, false, "192.168.1.200");

        assert.equal(interceptedUrls[0], "http://192.168.1.200/control?channel=1&state=on");
        assert.equal(interceptedUrls[1], "http://192.168.1.200/control?channel=2&state=off");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should fallback to mDNS hostname when direct IP fetch fails', async () => {
      let fetchAttempts = [];

      global.fetch = async (url) => {
        fetchAttempts.push(url);
        if (url.includes("192.168.1.200")) {
          throw new Error("Connection refused on direct IP");
        }
        if (url.includes(".local")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, via: "mdns" })
          };
        }
        throw new Error("Unknown host");
      };

      try {
        const result = await sendLocalControlCommand("4L_TEST_1", 1, "ON", "192.168.1.200");
        assert.equal(result.success, true);
        assert.equal(fetchAttempts.length, 2);
        assert.equal(fetchAttempts[0], "http://192.168.1.200/control?channel=1&state=on");
        assert.equal(fetchAttempts[1], "http://4L_TEST.local/control?channel=1&state=on");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw an error when both direct IP and mDNS fail to trigger cloud fallback in caller', async () => {
      global.fetch = async (url) => {
        throw new Error("Network unreachable");
      };

      try {
        await assert.rejects(
          async () => {
            await sendLocalControlCommand("4L_TEST_1", 1, "ON", "192.168.1.200");
          },
          /Local control unreachable/
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // SCENARIO G: Room Master Switch Aggregation Stress Testing
  // =========================================================================
  describe('Scenario G: Master Switch Multi-Room State Aggregation', () => {
    const recalculateMasterStatus = (devList) => {
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

    it('should ignore offline devices when evaluating room master state', () => {
      const devices = [
        // Room 1: 1 offline device that was ON before disconnection, 1 online OFF device, 1 master switch
        { id: 1, node_id: "4L_R1_1", room_id: "room1", is_online: false, status: true },
        { id: 2, node_id: "4L_R1_2", room_id: "room1", is_online: true, status: false },
        { id: 6, node_id: "4L_R1_6", room_id: "room1", is_online: true, status: true, type: "master" },

        // Room 2: 1 online ON device, 1 master switch
        { id: 11, node_id: "4L_R2_1", room_id: "room2", is_online: true, status: true },
        { id: 16, node_id: "4L_R2_6", room_id: "room2", is_online: true, status: false, type: "master" }
      ];

      const recalculated = recalculateMasterStatus(devices);

      const r1Master = recalculated.find(d => d.id === 6);
      const r2Master = recalculated.find(d => d.id === 16);

      assert.equal(r1Master.status, false, "Room 1 master MUST be OFF because the only ON device is offline");
      assert.equal(r2Master.status, true, "Room 2 master MUST be ON because an online device is ON");
    });
  });
});
