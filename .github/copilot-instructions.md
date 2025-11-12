<!-- .github/copilot-instructions.md - guidance for AI coding agents working on this repo -->

# SugarTV Card — Copilot instructions

Summary

- Purpose: small Home Assistant Lovelace custom card implemented as a set of ES modules using Lit. The bundle is produced with Rollup and a tiny demo server ships in /demo.
- Goal for agents: make focused, low-risk edits (UI tweaks, bug fixes, small new features) and update `dist/` via the build script so the demo and HACS packaging stay consistent.

Quick start (commands)

- npm install
- npm run build # produces `dist/sugartv-card.js` via rollup
- npm run watch # rollup watch
- npm run demo # builds then runs demo server on http://localhost:3000
- npm run format # run prettier

Architecture & key files (what to read first)

- `src/sugartv-card.js` — main LitElement custom element. Handles config validation, state updates, rendering and sessionStorage behavior. Look here for card behavior and configuration keys (glucose_value, glucose_trend, show_prediction, disable_storage, locale).
- `src/sugartv-card-editor.js` — the visual editor element returned from `static getConfigElement()`; it emits `config-changed` and uses `custom-card-helpers`'s `fireEvent`.
- `src/localize.js` — simple in-repo i18n helper. Use `getLocalizer(config, hass)` to resolve strings.
- `src/sugartv-card-styles.js` — shared CSS (card + editor styles).
- `rollup.config.js` — build pipeline. Note: it calls git to infer `process.env.VERSION` (git tags/branch). The bundle output is `dist/sugartv-card.js` and the banner includes version.
- `demo/` — small static demo and `demo/server.js` for manual testing. Demo loads `/dist/sugartv-card.js` and a hass mock (`demo/hass-mock.js`).

Project-specific conventions & patterns

- LitElement usage: properties use static getter `properties()`, and the card uses static helpers like `getStubConfig()` and `getConfigElement()` to integrate with Home Assistant's UI.
- Config validation: `setConfig(config)` throws if required config keys are missing (see `src/sugartv-card.js` — glucose_value and glucose_trend are required). Respect that behavior when changing config logic.
- Storage: by default the card persists previous value in `sessionStorage` under the key `sugartv-card-${glucose_value}`. The config flag `disable_storage: true` disables this. When editing state in demo, use `disable_storage: true` to avoid persisted state interfering with scenarios.
- Localization: strings are referenced with dotted keys (e.g., 'predictions.rise_over') and replaced via `getLocalizer`. New text must be added to `src/localize.js` for any additional languages.
- Editor `<ha-select>` pattern: the editor reads available `hass.states` and filters `sensor.*` entities — follow this pattern when adding new settings.

Build & release notes for agents

- The Rollup config executes `git describe --tags` to compute a version. For accurate version banners ensure the repo has tags or accept fallback branch-derived version string.
- When changing public API (config keys, behavior), update README and ensure `dist/sugartv-card.js` is rebuilt.
- No test harness is present in the repo. Keep changes small and verify behavior with `npm run demo`.

Debugging tips & gotchas

- If the card logs unexpected missing entity errors during startup, `src/sugartv-card.js` intentionally avoids console spam — validation returns a default placeholder state. Use the demo harness to reproduce entity states.
- Session storage may make local changes persist across demo reloads; toggle `disable_storage` in the demo config or clear site session storage.
- Rollup build needs node and git available in the environment (it runs git commands to generate VERSION). On CI, either provide tags or accept branch fallback.

Examples (from this repo)

- YAML card usage shown in `README.md`:
    ```yaml
    type: custom:sugartv-card
    glucose_value: sensor.dexcom_glucose_value
    glucose_trend: sensor.dexcom_glucose_trend
    show_prediction: true
    ```
- Editor integration: `SugarTvCard.static getConfigElement()` returns `document.createElement('sugartv-card-editor')` (see `src/sugartv-card.js`).

What agents should avoid

- Don't modify `dist/` by hand — always update source in `src/` and run `npm run build`.
- Avoid large refactors that change the public card API without updating README and the banner/versioning approach.

Where to look for follow-up changes

- README.md — user-facing documentation and configuration examples.
- rollup.config.js — update if you change build outputs or version injection.
- demo/ — useful place to add regression scenarios or reproduce UI issues.

If anything above is unclear or you'd like more examples (e.g., common small PRs, preferred commit message style, or a short checklist for releases), tell me which area to expand and I will iterate.
