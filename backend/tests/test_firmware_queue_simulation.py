"""
Empirical FreeRTOS Command Queueing & Concurrency Simulation Test Suite
Designed for Challenger 1 (Milestone 1: ESP32 Firmware Fixes)

Simulates and stress-tests:
1. Dual-Core FreeRTOS Command Queue (depth 16) architecture.
2. Concurrent command ingestion from HTTP (Core 0), MQTT (Core 1), and Physical Switches during in-flight bulk operations.
3. Strict FIFO queue ordering and zero-drop guarantee (elimination of "Bulk action already in progress! Ignoring command").
4. Queue capacity limit (16 items) and overflow boundary fallback.
5. Task Watchdog Timer (TWDT) servicing during staggered relay delays (250ms x 4 = 1.0s).
6. Local webserver response latency on Core 0 during heavy Core 1 queue execution.
"""

import time
import queue
import threading
import unittest
from dataclasses import dataclass
from enum import Enum, auto
from typing import List, Optional, Tuple


class CmdType(Enum):
    CMD_CHANNEL_SET = auto()
    CMD_FAN_SPEED_SET = auto()
    CMD_BULK_ALL_ON = auto()
    CMD_BULK_ALL_OFF = auto()


@dataclass
class SwitchCommand:
    type: CmdType
    channel: int       # 1 - 7
    state: bool        # true = ON, false = OFF
    speed: int         # 0 - 4 (-1 if unchanged)
    source: str        # Command origin label
    seq_id: int = 0    # Tracking ID for FIFO order verification
    timestamp_enqueued: float = 0.0
    timestamp_executed: float = 0.0


class TaskWatchdogTimer:
    """
    Simulates the ESP-IDF Task Watchdog Timer (TWDT).
    Monitors unserviced execution windows and triggers panic if interval > timeout_ms.
    """
    def __init__(self, timeout_ms: int = 5000):
        self.timeout_ms = timeout_ms
        self.last_reset_time = time.time()
        self.panic_triggered = False
        self.max_unserviced_interval_ms = 0.0
        self.reset_count = 0
        self._lock = threading.Lock()

    def reset(self):
        with self._lock:
            now = time.time()
            interval_ms = (now - self.last_reset_time) * 1000.0
            if interval_ms > self.max_unserviced_interval_ms:
                self.max_unserviced_interval_ms = interval_ms
            if interval_ms > self.timeout_ms:
                self.panic_triggered = True
            self.last_reset_time = now
            self.reset_count += 1

    def check(self):
        with self._lock:
            now = time.time()
            interval_ms = (now - self.last_reset_time) * 1000.0
            if interval_ms > self.timeout_ms:
                self.panic_triggered = True
            return self.panic_triggered


class ESP32FirmwareQueueSimulator:
    """
    Exact simulation model of ESP32 firmware FreeRTOS Command Queue and state management:
    - command_queue: FreeRTOS Queue (depth 16)
    - command_worker_task: Pinned to Core 1 (Priority 4)
    - state_mux: portMUX_TYPE spinlock
    - Relay and Fan state management
    - TWDT watchdog integration
    """
    def __init__(self, queue_capacity: int = 16, send_timeout_ms: float = 50.0, twdt_timeout_ms: int = 5000):
        self.queue_capacity = queue_capacity
        self.send_timeout_sec = send_timeout_ms / 1000.0
        self.twdt = TaskWatchdogTimer(timeout_ms=twdt_timeout_ms)
        
        self.command_queue = queue.Queue(maxsize=queue_capacity)
        self.state_mux = threading.Lock()
        
        # Hardware States
        self.switch_state_ch1 = False
        self.switch_state_ch2 = False
        self.switch_state_ch3 = False
        self.switch_state_ch4 = False
        self.fan_power = False
        self.curr_speed = 0
        self.fan_speed_memory = 3
        
        # Execution & Diagnostic Logs
        self.executed_commands: List[SwitchCommand] = []
        self.fallback_direct_executions: List[SwitchCommand] = []
        self.dropped_commands: List[SwitchCommand] = []
        self.relay_switch_events: List[Tuple[float, str, int, bool]] = []
        
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        self._seq_counter = 0
        self._seq_lock = threading.Lock()

    def start(self):
        self._running = True
        self.twdt.reset()
        self._worker_thread = threading.Thread(target=self._command_worker_task, name="command_worker_task", daemon=True)
        self._worker_thread.start()

    def stop(self):
        self._running = False
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)

    def _command_worker_task(self):
        """Dedicated command queue worker task on Core 1."""
        while self._running:
            self.twdt.reset()
            try:
                # xQueueReceive with 100ms timeout
                cmd: SwitchCommand = self.command_queue.get(timeout=0.1)
                cmd.timestamp_executed = time.time()
                self._execute_command_direct(cmd)
                self.executed_commands.append(cmd)
                self.command_queue.task_done()
            except queue.Empty:
                pass

    def _execute_command_direct(self, cmd: SwitchCommand):
        """Exact mirror of execute_command_direct() in main.cpp."""
        if cmd.type == CmdType.CMD_CHANNEL_SET:
            ch = cmd.channel
            turnOn = cmd.state
            if 1 <= ch <= 4:
                with self.state_mux:
                    if ch == 1: self.switch_state_ch1 = turnOn
                    elif ch == 2: self.switch_state_ch2 = turnOn
                    elif ch == 3: self.switch_state_ch3 = turnOn
                    elif ch == 4: self.switch_state_ch4 = turnOn
                self.relay_switch_events.append((time.time(), cmd.source, ch, turnOn))
            elif ch == 5:
                with self.state_mux:
                    self.fan_power = turnOn
                    if turnOn:
                        self.curr_speed = self.fan_speed_memory if self.fan_speed_memory > 0 else 3
                    else:
                        self.curr_speed = 0

        elif cmd.type == CmdType.CMD_FAN_SPEED_SET:
            with self.state_mux:
                spd = cmd.speed
                self.curr_speed = spd
                self.fan_power = (spd > 0)
                if spd > 0:
                    self.fan_speed_memory = spd

        elif cmd.type == CmdType.CMD_BULK_ALL_ON:
            # Relay 1 ON -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch1 = True
            self.relay_switch_events.append((time.time(), cmd.source, 1, True))
            time.sleep(0.250)
            self.twdt.reset()

            # Relay 2 ON -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch2 = True
            self.relay_switch_events.append((time.time(), cmd.source, 2, True))
            time.sleep(0.250)
            self.twdt.reset()

            # Relay 3 ON -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch3 = True
            self.relay_switch_events.append((time.time(), cmd.source, 3, True))
            time.sleep(0.250)
            self.twdt.reset()

            # Relay 4 ON -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch4 = True
            self.relay_switch_events.append((time.time(), cmd.source, 4, True))
            time.sleep(0.250)
            self.twdt.reset()

            # Fan ON
            with self.state_mux:
                if not self.fan_power:
                    self.fan_power = True
                    self.curr_speed = self.fan_speed_memory if self.fan_speed_memory > 0 else 3

        elif cmd.type == CmdType.CMD_BULK_ALL_OFF:
            # Relay 1 OFF -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch1 = False
            self.relay_switch_events.append((time.time(), cmd.source, 1, False))
            time.sleep(0.250)
            self.twdt.reset()

            # Relay 2 OFF -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch2 = False
            self.relay_switch_events.append((time.time(), cmd.source, 2, False))
            time.sleep(0.250)
            self.twdt.reset()

            # Relay 3 OFF -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch3 = False
            self.relay_switch_events.append((time.time(), cmd.source, 3, False))
            time.sleep(0.250)
            self.twdt.reset()

            # Relay 4 OFF -> 250ms delay -> TWDT reset
            with self.state_mux: self.switch_state_ch4 = False
            self.relay_switch_events.append((time.time(), cmd.source, 4, False))
            time.sleep(0.250)
            self.twdt.reset()

            # Fan OFF
            with self.state_mux:
                self.fan_power = False
                self.curr_speed = 0

    def process_channel_command(self, channel: int, turnOn: bool, speedVal: int = -1, source: str = "⚙️ [SYSTEM]") -> bool:
        """Exact mirror of process_channel_command() in main.cpp."""
        with self._seq_lock:
            self._seq_counter += 1
            seq = self._seq_counter

        cmd_type = CmdType.CMD_CHANNEL_SET
        cmd_speed = -1
        cmd_state = turnOn

        if 1 <= channel <= 4:
            cmd_type = CmdType.CMD_CHANNEL_SET
        elif channel == 5:
            if speedVal != -1:
                cmd_type = CmdType.CMD_FAN_SPEED_SET
                cmd_state = (speedVal > 0)
                cmd_speed = speedVal
            else:
                cmd_type = CmdType.CMD_CHANNEL_SET
        elif channel in (6, 7):
            cmd_type = CmdType.CMD_BULK_ALL_ON if turnOn else CmdType.CMD_BULK_ALL_OFF
        else:
            return False

        cmd = SwitchCommand(
            type=cmd_type,
            channel=channel,
            state=cmd_state,
            speed=cmd_speed,
            source=source,
            seq_id=seq,
            timestamp_enqueued=time.time()
        )

        try:
            # xQueueSend with 50ms timeout
            self.command_queue.put(cmd, timeout=self.send_timeout_sec)
            return True
        except queue.Full:
            # Fallback direct execution on queue overflow
            self.fallback_direct_executions.append(cmd)
            self._execute_command_direct(cmd)
            self.executed_commands.append(cmd)
            return True

    def get_state(self) -> dict:
        """Simulates Core 0 HTTP /state response."""
        with self.state_mux:
            return {
                "channel_1": "ON" if self.switch_state_ch1 else "OFF",
                "channel_2": "ON" if self.switch_state_ch2 else "OFF",
                "channel_3": "ON" if self.switch_state_ch3 else "OFF",
                "channel_4": "ON" if self.switch_state_ch4 else "OFF",
                "channel_5": "ON" if self.fan_power else "OFF",
                "speed": self.curr_speed,
                "all_state": "ALL_ON" if (self.switch_state_ch1 and self.switch_state_ch2 and self.switch_state_ch3 and self.switch_state_ch4 and self.fan_power)
                             else ("ALL_OFF" if (not self.switch_state_ch1 and not self.switch_state_ch2 and not self.switch_state_ch3 and not self.switch_state_ch4 and not self.fan_power)
                                   else "MIXED")
            }


class TestFreeRTOSQueueAndBulkHandling(unittest.TestCase):
    """
    Empirical test harness validating Challenger 1 objectives.
    """

    def setUp(self):
        self.sim = ESP32FirmwareQueueSimulator(queue_capacity=16, send_timeout_ms=50.0, twdt_timeout_ms=5000)
        self.sim.start()

    def tearDown(self):
        self.sim.stop()

    def test_01_bulk_action_stagger_and_watchdog(self):
        """
        Test 1: Verify CMD_BULK_ALL_ON execution:
        - Stagger duration ~ 1.0s (250ms * 4 relays)
        - Watchdog reset after every 250ms step
        - Zero watchdog panic
        """
        start_time = time.time()
        self.sim.process_channel_command(6, True, -1, "📱 [APP/CLOUD]")
        
        # Wait for bulk action to complete
        time.sleep(1.2)
        elapsed = time.time() - start_time
        
        self.assertGreaterEqual(elapsed, 1.0, "Bulk action must stagger over at least 1.0s")
        state = self.sim.get_state()
        self.assertEqual(state["channel_1"], "ON")
        self.assertEqual(state["channel_2"], "ON")
        self.assertEqual(state["channel_3"], "ON")
        self.assertEqual(state["channel_4"], "ON")
        self.assertEqual(state["channel_5"], "ON")
        self.assertEqual(state["all_state"], "ALL_ON")
        
        # Watchdog checks
        self.assertFalse(self.sim.twdt.panic_triggered, "TWDT should NOT panic during bulk stagger")
        self.assertLess(self.sim.twdt.max_unserviced_interval_ms, 350.0, "Max unserviced interval must be <= 350ms (resets every 250ms)")
        self.assertGreaterEqual(self.sim.twdt.reset_count, 4, "TWDT should be reset at least 4 times during bulk execution")

    def test_02_concurrent_burst_5_commands_during_bulk_action(self):
        """
        Test 2: Inject rapid burst of 5 channel toggle commands while CMD_BULK_ALL_ON is in flight.
        - Verify zero dropped commands
        - Verify strict FIFO execution
        - Verify final state matches trailing commands
        """
        # 1. Trigger Bulk ALL ON (takes 1.0s)
        self.sim.process_channel_command(6, True, -1, "⚙️ [SYSTEM]")
        time.sleep(0.1)  # Ensure bulk action is actively in flight
        
        # 2. Concurrently inject 5 commands from HTTP, MQTT, and Physical Switches
        injected = [
            (1, False, -1, "🌐 [APP/LOCAL]"),      # Turn Relay 1 OFF
            (2, False, -1, "📱 [APP/CLOUD]"),      # Turn Relay 2 OFF
            (3, False, -1, "🔘 [PHYSICAL SWITCH]"),# Turn Relay 3 OFF
            (4, False, -1, "📻 [RF REMOTE]"),      # Turn Relay 4 OFF
            (5, True, 2, "🌐 [APP/LOCAL]")         # Set Fan Speed to 2
        ]
        
        for ch, st, spd, src in injected:
            ok = self.sim.process_channel_command(ch, st, spd, src)
            self.assertTrue(ok, f"Command for channel {ch} failed to enqueue")

        # 3. Wait for all 6 operations (1 bulk + 5 toggles) to complete
        time.sleep(1.5)
        
        # Total executed commands: 1 bulk + 5 individual = 6
        self.assertEqual(len(self.sim.executed_commands), 6, "All 6 commands must be executed without drops")
        self.assertEqual(len(self.sim.dropped_commands), 0, "Zero commands should be dropped")
        
        # Verify FIFO order of executed commands
        executed_seq_ids = [cmd.seq_id for cmd in self.sim.executed_commands]
        self.assertEqual(executed_seq_ids, sorted(executed_seq_ids), "Commands must be executed in strict FIFO order")
        
        # Verify final state reflects trailing commands
        state = self.sim.get_state()
        self.assertEqual(state["channel_1"], "OFF", "Relay 1 must be OFF (overridden by queued command)")
        self.assertEqual(state["channel_2"], "OFF", "Relay 2 must be OFF (overridden by queued command)")
        self.assertEqual(state["channel_3"], "OFF", "Relay 3 must be OFF (overridden by queued command)")
        self.assertEqual(state["channel_4"], "OFF", "Relay 4 must be OFF (overridden by queued command)")
        self.assertEqual(state["channel_5"], "ON", "Fan must be ON")
        self.assertEqual(state["speed"], 2, "Fan speed must be 2")
        self.assertEqual(state["all_state"], "MIXED")

    def test_03_concurrent_burst_10_commands_during_bulk_action(self):
        """
        Test 3: Inject 10 concurrent commands across multiple threads during CMD_BULK_ALL_OFF.
        """
        # Start Bulk ALL OFF
        self.sim.process_channel_command(6, False, -1, "⚙️ [SYSTEM]")
        time.sleep(0.05)
        
        # Spawn 3 concurrent producer threads (HTTP, MQTT, Physical)
        def http_producer():
            self.sim.process_channel_command(1, True, -1, "🌐 [APP/LOCAL]")
            self.sim.process_channel_command(2, True, -1, "🌐 [APP/LOCAL]")
            self.sim.process_channel_command(5, True, 4, "🌐 [APP/LOCAL]")

        def mqtt_producer():
            self.sim.process_channel_command(3, True, -1, "📱 [APP/CLOUD]")
            self.sim.process_channel_command(4, True, -1, "📱 [APP/CLOUD]")
            self.sim.process_channel_command(1, False, -1, "📱 [APP/CLOUD]")

        def physical_producer():
            self.sim.process_channel_command(2, False, -1, "🔘 [PHYSICAL SWITCH]")
            self.sim.process_channel_command(3, False, -1, "🔘 [PHYSICAL SWITCH]")
            self.sim.process_channel_command(4, False, -1, "🔘 [PHYSICAL SWITCH]")
            self.sim.process_channel_command(5, False, -1, "🔘 [PHYSICAL SWITCH]")

        t1 = threading.Thread(target=http_producer)
        t2 = threading.Thread(target=mqtt_producer)
        t3 = threading.Thread(target=physical_producer)
        
        t1.start(); t2.start(); t3.start()
        t1.join(); t2.join(); t3.join()

        # Wait for all commands to finish executing
        time.sleep(1.6)
        
        # 1 bulk + 10 commands = 11 total
        self.assertEqual(len(self.sim.executed_commands), 11, "All 11 commands must be executed without drops")
        self.assertEqual(len(self.sim.dropped_commands), 0)
        self.assertEqual(len(self.sim.fallback_direct_executions), 0, "10 items must fit well within queue capacity 16")

    def test_04_queue_capacity_limit_16_commands_burst(self):
        """
        Test 4: Inject exactly 16 commands in a burst while bulk action is running.
        - Verify all 16 items fit in queue (capacity 16) without triggering overflow fallback.
        - Verify FIFO ordering is strictly preserved.
        """
        self.sim.process_channel_command(6, True, -1, "⚙️ [SYSTEM]")
        time.sleep(0.05)
        
        # Enqueue 16 rapid commands
        for i in range(16):
            ch = (i % 5) + 1
            st = (i % 2 == 0)
            self.sim.process_channel_command(ch, st, -1 if ch != 5 else (i % 4 + 1), f"BURST_CMD_{i+1}")

        time.sleep(1.8)
        
        # 1 bulk + 16 queued = 17 total
        self.assertEqual(len(self.sim.executed_commands), 17, "Exactly 17 commands executed")
        self.assertEqual(len(self.sim.fallback_direct_executions), 0, "No overflow fallback when queue size <= 16")
        
        # Check strict monotonic FIFO ordering of execution
        seqs = [c.seq_id for c in self.sim.executed_commands]
        self.assertEqual(seqs, sorted(seqs), "FIFO order strictly maintained for all 16 buffered commands")

    def test_05_queue_overflow_and_boundary_fallback(self):
        """
        Test 5: Inject > 16 commands (e.g. 20 commands) while worker is occupied.
        - First 16 commands buffer in FIFO queue.
        - Subsequent commands (17..20) exceed capacity -> trigger 50ms wait -> fallback direct execution.
        - Verify zero commands lost or discarded.
        """
        self.sim.process_channel_command(6, True, -1, "⚙️ [SYSTEM]")
        time.sleep(0.02)  # Worker is in relay 1 delay
        
        # Fill queue to max capacity (16)
        for i in range(16):
            self.sim.process_channel_command((i % 4) + 1, True, -1, f"FILL_Q_{i+1}")

        # Inject 4 additional commands (overflow boundary)
        overflow_count_before = len(self.sim.fallback_direct_executions)
        for i in range(4):
            self.sim.process_channel_command((i % 4) + 1, False, -1, f"OVERFLOW_CMD_{i+1}")
            
        time.sleep(2.0)
        
        # Verify that fallback direct executions handled the excess items safely
        total_executed = len(self.sim.executed_commands)
        self.assertEqual(total_executed, 21, "Total 21 commands (1 bulk + 16 queue + 4 overflow) must be executed")
        self.assertGreaterEqual(len(self.sim.fallback_direct_executions), 1, "Fallback direct execution triggered for overflow")
        self.assertEqual(len(self.sim.dropped_commands), 0, "No commands dropped even under overflow")

    def test_06_watchdog_strictest_threshold_verification(self):
        """
        Test 6: Verify TWDT with a strict 400ms timeout threshold.
        Since bulk action delays 250ms per relay, TWDT resets every 250ms and must never exceed 400ms.
        """
        strict_sim = ESP32FirmwareQueueSimulator(queue_capacity=16, twdt_timeout_ms=400)
        strict_sim.start()
        
        try:
            strict_sim.process_channel_command(6, True, -1, "STRICT_WDT_TEST")
            time.sleep(1.2)
            self.assertFalse(strict_sim.twdt.panic_triggered, "TWDT should NOT panic even with strict 400ms threshold")
            self.assertLess(strict_sim.twdt.max_unserviced_interval_ms, 350.0)
        finally:
            strict_sim.stop()

    def test_07_core0_webserver_latency_during_heavy_core1_queue_load(self):
        """
        Test 7: Core 0 /state latency test during heavy Core 1 bulk + queue processing.
        Simulates Core 0 HTTP server servicing requests while Core 1 processes commands.
        """
        # Start heavy bulk action on Core 1
        self.sim.process_channel_command(6, True, -1, "CORE1_BULK")
        for i in range(10):
            self.sim.process_channel_command((i % 4) + 1, (i % 2 == 0), -1, "CORE1_STORM")

        # Simulate rapid Core 0 /state requests
        latencies = []
        for _ in range(50):
            t0 = time.time()
            st = self.sim.get_state()
            latencies.append((time.time() - t0) * 1000.0)
            time.sleep(0.01)

        avg_latency_ms = sum(latencies) / len(latencies)
        max_latency_ms = max(latencies)
        
        self.assertLess(avg_latency_ms, 5.0, f"Average /state latency ({avg_latency_ms:.2f}ms) must be < 5ms")
        self.assertLess(max_latency_ms, 20.0, f"Max /state latency ({max_latency_ms:.2f}ms) must be < 20ms")

    def test_08_channel_boundary_and_invalid_inputs(self):
        """
        Test 8: Channel boundary validation:
        - Invalid channels (< 1, > 7) rejected without queue entry
        - Channel 6 and 7 trigger bulk actions
        - Fan channel 5 speed values (-1, 0, 1..4)
        """
        # Invalid channels
        self.assertFalse(self.sim.process_channel_command(0, True, -1, "TEST_INVALID"))
        self.assertFalse(self.sim.process_channel_command(8, True, -1, "TEST_INVALID"))
        self.assertFalse(self.sim.process_channel_command(-1, True, -1, "TEST_INVALID"))
        self.assertFalse(self.sim.process_channel_command(100, True, -1, "TEST_INVALID"))
        
        # Valid channel 7 (alternate master switch)
        self.assertTrue(self.sim.process_channel_command(7, True, -1, "TEST_CH7"))
        time.sleep(1.2)
        state = self.sim.get_state()
        self.assertEqual(state["all_state"], "ALL_ON")

    def test_09_watchdog_negative_control_omitted_resets(self):
        """
        Test 9: Negative Control: Verify that omitting intermediate TWDT resets
        during a 1.0s blocking delay with a 500ms TWDT threshold triggers TWDT panic.
        Proves that watchdog verification in the harness is active and valid.
        """
        wdt = TaskWatchdogTimer(timeout_ms=500)
        wdt.reset()
        
        # Simulate blocking 1.0s WITHOUT intermediate resets
        time.sleep(0.6)
        wdt.check()
        self.assertTrue(wdt.panic_triggered, "TWDT MUST panic when unserviced for 600ms with 500ms threshold")

    def test_10_high_contention_randomized_storm(self):
        """
        Test 10: High-contention adversarial storm:
        - 10 concurrent threads generating 100 total commands (mix of bulk, single relay, fan speeds)
        - Assert zero deadlocks, zero dropped commands, zero unhandled exceptions
        - Final state is well-defined and queryable
        """
        import random
        
        threads = []
        commands_per_thread = 10
        thread_count = 10
        total_commands = commands_per_thread * thread_count
        
        def storm_worker(thread_id):
            for j in range(commands_per_thread):
                ch = random.choice([1, 2, 3, 4, 5, 6])
                st = random.choice([True, False])
                spd = random.randint(0, 4) if ch == 5 else -1
                src = f"STORM_T{thread_id}_C{j}"
                self.sim.process_channel_command(ch, st, spd, src)
                time.sleep(random.uniform(0.005, 0.02))

        for i in range(thread_count):
            t = threading.Thread(target=storm_worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Wait for all commands to finish execution (bulk commands can take ~1.0s each)
        timeout = time.time() + 20.0
        while time.time() < timeout and len(self.sim.executed_commands) < total_commands:
            time.sleep(0.05)

        # Assert all commands were executed
        total_executed = len(self.sim.executed_commands)
        self.assertEqual(total_executed, total_commands, f"All {total_commands} storm commands must be processed without drops")
        self.assertEqual(len(self.sim.dropped_commands), 0)
        
        # Assert state is valid
        state = self.sim.get_state()
        self.assertIn(state["channel_1"], ("ON", "OFF"))
        self.assertIn(state["channel_2"], ("ON", "OFF"))
        self.assertIn(state["channel_3"], ("ON", "OFF"))
        self.assertIn(state["channel_4"], ("ON", "OFF"))
        self.assertIn(state["channel_5"], ("ON", "OFF"))
        self.assertIn(state["all_state"], ("ALL_ON", "ALL_OFF", "MIXED"))


if __name__ == "__main__":
    unittest.main(verbosity=2)

