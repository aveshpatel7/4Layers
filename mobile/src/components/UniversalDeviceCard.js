import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TYPE_ICONS = {
  relay: 'light-switch', light: 'lightbulb-outline', dimmer: 'brightness-6',
  rgb_light: 'palette-outline', rgbw_light: 'palette-outline', rgb_cct_light: 'palette-outline',
  fan: 'fan', smart_plug: 'power-socket', water_tank: 'water-percent',
  water_valve: 'valve', pump: 'water-pump', motor: 'engine-outline',
  temperature_sensor: 'thermometer', humidity_sensor: 'water-percent',
  temp_humidity_sensor: 'thermometer-water', motion_sensor: 'motion-sensor',
  presence_sensor: 'account-radar', contact_sensor: 'door',
  leak_sensor: 'water-alert-outline', smoke_detector: 'smoke-detector-variant',
  gas_detector: 'gas-cylinder', energy_meter: 'flash-outline', thermostat: 'thermostat',
  air_conditioner: 'air-conditioner', curtain: 'curtains', blind: 'blinds',
  shade: 'roller-shade', garage_door: 'garage', door_lock: 'lock-outline',
  scene_controller: 'power', generic_sensor: 'gauge', generic: 'tune-variant',
};

const PALETTE = ['#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#007AFF','#5856D6','#AF52DE','#FFFFFF'];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const readValue = (state, capability) => {
  if (!state || !capability) return null;
  if (capability.state_key) return state[capability.state_key];
  if (Array.isArray(capability.state_path)) {
    let value = state;
    for (const part of capability.state_path) {
      if (!value || typeof value !== 'object') return null;
      value = value[part];
    }
    return value;
  }
  return state[capability.id];
};

const ControlButton = ({ active, label, disabled, onPress }) => (
  <TouchableOpacity disabled={disabled} onPress={onPress}
    style={[styles.controlButton, active && styles.controlButtonActive, disabled && styles.disabled]}>
    <Text style={[styles.controlButtonText, active && styles.controlButtonTextActive]}>{label}</Text>
  </TouchableOpacity>
);

function CapabilityControl({ device, component, capability, state, busy, onCommand }) {
  const value = readValue(state, capability);
  const writable = capability.writable === true;
  const dataType = capability.data_type || typeof value;
  const ui = capability.ui || {};
  const control = ui.control || ui.presentation || '';
  const key = `${device.id}:${component.id}:${capability.id}`;
  const disabled = !device?.presence?.online || busy[key];
  const send = (next) => onCommand(device, component, capability, next);
  const label = capability.label || capability.name || capability.id.replaceAll('_', ' ');

  if (dataType === 'action') {
    return <View style={styles.capRow}><ControlButton disabled={disabled} label={ui.label || label.toUpperCase()} onPress={() => send(true)} /></View>;
  }

  if (dataType === 'boolean') {
    if (writable) {
      const active = value === true;
      return (
        <View style={styles.capRowBetween}>
          <View style={styles.capTextWrap}><Text style={styles.capLabel}>{label}</Text><Text style={styles.capValue}>{active ? 'ON' : 'OFF'}</Text></View>
          <ControlButton active={active} disabled={disabled} label={active ? 'ON' : 'OFF'} onPress={() => send(!active)} />
        </View>
      );
    }
    return <View style={styles.metricRow}><Text style={styles.capLabel}>{label}</Text><Text style={styles.metricValue}>{value === true ? 'DETECTED' : value === false ? 'CLEAR' : '—'}</Text></View>;
  }

  if (dataType === 'enum') {
    const values = Array.isArray(capability.values) ? capability.values : [];
    if (writable && values.length) {
      return (
        <View style={styles.capBlock}>
          <Text style={styles.capLabel}>{label}</Text>
          <View style={styles.wrap}>
            {values.map((item) => <ControlButton key={String(item)} active={String(value) === String(item)} disabled={disabled}
              label={String(item).toUpperCase()} onPress={() => send(item)} />)}
          </View>
        </View>
      );
    }
    return <View style={styles.metricRow}><Text style={styles.capLabel}>{label}</Text><Text style={styles.metricValue}>{value == null ? '—' : String(value)}</Text></View>;
  }

  if (dataType === 'color') {
    if (!writable) {
      return <View style={styles.metricRow}><Text style={styles.capLabel}>{label}</Text><Text style={styles.metricValue}>{value || '—'}</Text></View>;
    }
    return (
      <View style={styles.capBlock}>
        <Text style={styles.capLabel}>{label}</Text>
        <View style={styles.wrap}>
          {PALETTE.map((color) => (
            <TouchableOpacity key={color} disabled={disabled} onPress={() => send(color)}
              style={[styles.colorDot, { backgroundColor: color }, String(value).toUpperCase() === color && styles.colorDotActive, disabled && styles.disabled]} />
          ))}
        </View>
      </View>
    );
  }

  if (dataType === 'number') {
    const numeric = Number(value);
    const display = Number.isFinite(numeric) ? numeric : 0;
    const min = Number.isFinite(Number(capability.min)) ? Number(capability.min) : 0;
    const max = Number.isFinite(Number(capability.max)) ? Number(capability.max) : 100;
    const step = Number.isFinite(Number(capability.step)) && Number(capability.step) > 0 ? Number(capability.step) : 1;
    const unit = capability.unit || '';

    if (control === 'tank') {
      const pct = clamp(display, 0, 100);
      return (
        <View style={styles.tankBlock}>
          <View style={styles.tankHead}><Text style={styles.capLabel}>{label}</Text><Text style={styles.tankValue}>{`${Math.round(display)}${unit}`}</Text></View>
          <View style={styles.tankTrack}><View style={[styles.tankFill, { width: `${pct}%` }]} /></View>
        </View>
      );
    }

    if (writable && control === 'steps' && max - min <= 12) {
      const values = [];
      for (let i = min; i <= max; i += step) values.push(i);
      return (
        <View style={styles.capBlock}>
          <Text style={styles.capLabel}>{label}</Text>
          <View style={styles.wrap}>
            {values.map((item) => <ControlButton key={String(item)} active={display === item} disabled={disabled}
              label={`${item}${unit}`} onPress={() => send(item)} />)}
          </View>
        </View>
      );
    }

    if (writable) {
      return (
        <View style={styles.capRowBetween}>
          <View style={styles.capTextWrap}><Text style={styles.capLabel}>{label}</Text><Text style={styles.capValue}>{`${display}${unit}`}</Text></View>
          <View style={styles.stepper}>
            <ControlButton disabled={disabled || display <= min} label="−" onPress={() => send(clamp(display - step, min, max))} />
            <ControlButton disabled={disabled || display >= max} label="+" onPress={() => send(clamp(display + step, min, max))} />
          </View>
        </View>
      );
    }

    return <View style={styles.metricRow}><Text style={styles.capLabel}>{label}</Text><Text style={styles.metricValue}>{value == null ? '—' : `${value}${unit ? ` ${unit}` : ''}`}</Text></View>;
  }

  const rendered = value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return <View style={styles.metricRow}><Text style={styles.capLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={2}>{rendered}</Text></View>;
}

export default function UniversalDeviceCard({ device, busy, onCommand }) {
  const profile = device?.profile || {};
  const components = Array.isArray(profile.components) ? profile.components : [];
  const detected = Array.isArray(device?.detected) ? device.detected : [];
  const state = device?.state || {};
  const online = !!device?.presence?.online;

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHead}>
        <View style={styles.deviceTitleWrap}>
          <Text style={styles.deviceName}>{device?.name || profile?.name || 'GO SMART Device'}</Text>
          <Text style={styles.nodeId}>{device?.node_id || 'UNKNOWN NODE'}</Text>
        </View>
        <View style={[styles.statusDot, online && styles.statusDotOnline]} />
        <Text style={styles.statusText}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
      </View>

      <View style={styles.detectedBox}>
        <MaterialCommunityIcons name="check-decagram-outline" size={17} color="#FFFFFF" />
        <View style={styles.detectedTextWrap}>
          <Text style={styles.detectedTitle}>AUTO-DETECTED</Text>
          <Text style={styles.detectedText}>{detected.length ? detected.join(' · ') : `${components.length} component${components.length === 1 ? '' : 's'}`}</Text>
        </View>
      </View>

      {!online && (
        <View style={styles.offlineBox}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#9A9A9A" />
          <Text style={styles.offlineText}>Device is offline. Controls are disabled until it reconnects.</Text>
        </View>
      )}

      {components.map((component) => {
        const capabilities = Array.isArray(component.capabilities) ? component.capabilities : [];
        if (!capabilities.length) return null;
        const icon = TYPE_ICONS[component.type] || TYPE_ICONS.generic;
        return (
          <View key={component.id} style={styles.componentCard}>
            <View style={styles.componentHead}>
              <View style={styles.componentIcon}><MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" /></View>
              <View style={styles.componentTitleWrap}>
                <Text style={styles.componentName}>{component.name || component.id}</Text>
                <Text style={styles.componentType}>{String(component.type || 'device').replaceAll('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            {capabilities.map((capability) => <CapabilityControl key={`${component.id}:${capability.id}`}
              device={device} component={component} capability={capability} state={state} busy={busy} onCommand={onCommand} />)}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  deviceCard: { backgroundColor: '#070707', borderWidth: 1, borderColor: '#232323', borderRadius: 22, padding: 15, marginBottom: 16 },
  deviceHead: { flexDirection: 'row', alignItems: 'center' }, deviceTitleWrap: { flex: 1 },
  deviceName: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  nodeId: { color: '#777777', marginTop: 4, fontSize: 11, fontFamily: 'monospace' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4A4A4A', marginRight: 6 },
  statusDotOnline: { backgroundColor: '#FFFFFF' }, statusText: { color: '#BDBDBD', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  detectedBox: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14, padding: 11, borderRadius: 14, backgroundColor: '#101010', borderWidth: 1, borderColor: '#262626' },
  detectedTextWrap: { flex: 1 }, detectedTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  detectedText: { color: '#A8A8A8', fontSize: 12, marginTop: 3 },
  offlineBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#252525' },
  offlineText: { color: '#8E8E8E', fontSize: 11, flex: 1 },
  componentCard: { marginTop: 12, borderRadius: 17, borderWidth: 1, borderColor: '#202020', padding: 13, backgroundColor: '#0B0B0B' },
  componentHead: { flexDirection: 'row', alignItems: 'center' },
  componentIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#2E2E2E', alignItems: 'center', justifyContent: 'center' },
  componentTitleWrap: { marginLeft: 10, flex: 1 }, componentName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  componentType: { color: '#666666', marginTop: 2, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 12 },
  capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  capRowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  capTextWrap: { flex: 1 }, capBlock: { marginBottom: 12 },
  capLabel: { color: '#858585', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  capValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 4 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 11 },
  metricValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', maxWidth: '58%', textAlign: 'right' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  controlButton: { minWidth: 58, minHeight: 38, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#363636', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  controlButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  controlButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, controlButtonTextActive: { color: '#000000' },
  disabled: { opacity: 0.32 }, stepper: { flexDirection: 'row', gap: 7 },
  tankBlock: { marginBottom: 13 }, tankHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tankValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  tankTrack: { height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#333333', overflow: 'hidden', marginTop: 9 },
  tankFill: { height: '100%', backgroundColor: '#FFFFFF' },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#222222' },
  colorDotActive: { borderColor: '#FFFFFF', borderWidth: 3 },
});
