# GO SMART Universal App V1

Status: source implementation complete on this feature branch; Android build/APK verification is pending.

## Purpose
This is one permanent GO SMART mobile UI. It does not hard-code “4 lights + fan” or “7 relay”. The backend returns each device's manifest/profile and the app renders only the components and capabilities actually exposed by that device.

Backend source-of-truth:
- repository: `aveshpatel7/GO_SMART_Backend`
- branch: `feature/universal-device-platform-v1`
- full architecture/handoff: `docs/UNIVERSAL_DEVICE_PLATFORM_V1.md`

## Changed files
- `mobile/src/components/UniversalDeviceCard.js`
- `mobile/src/screens/DashboardScreen.js`
- `mobile/src/api/client.js`

## Renderer rules
- boolean writable -> ON/OFF toggle
- boolean read-only -> status
- number writable -> steps or +/- control
- number read-only -> metric/gauge
- tank presentation -> tank level gauge
- enum writable -> mode buttons
- enum read-only -> status
- color -> color selector
- action -> action button
- unknown/string/object -> safe generic display

The device card shows `AUTO-DETECTED` and a component summary. Controls are disabled when the device is offline. Manifest components with `simulated:true` are visibly marked `SIMULATED`.

## API
- `GET /api/universal/devices`
- `GET /api/universal/catalog`
- `POST /api/universal/devices/{device_id}/command`

No GPIO/pin knowledge belongs in the app.

## Test expectation
Without changing/rebuilding this app, flashing the backend repo's prepared firmware branches should change the UI automatically:
- 1 relay -> 1 relay
- 2 relay -> 2 relays + Master
- 3 relay -> 3 relays + Master
- normal firmware -> 4 lights + fan + Master
- 7 relay -> 7 relays + Master
- tank simulator -> 1 tank gauge
- 10 relay simulator -> 10 logical relay controls; R8..R10 visibly SIMULATED

## Commits
- `53b1c3aa3c242efc0ec719483d06866960f93cf8` universal device card renderer
- `fec6958a6be7b9abc003d5b53df3932f4193106d` dashboard converted to dynamic profiles
- `25ac4cd001946d77d6d2aa9d4114fdd8b1da8b55` universal API client
- `a2bcf2fe56e029eb17ea0c547506ae95ca1df543` simulator labels and renderer compatibility

## Do not claim yet
- No new universal APK has been built/installed in this work session.
- No device-profile live MQTT test has been completed yet.
- Third-party Matter/SmartThings/vendor integrations are adapter targets, not completed connections.
- Do not merge to app `main` until backend deployment + app build + hardware tests pass.
