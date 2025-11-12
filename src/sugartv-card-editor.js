import { LitElement, html } from 'lit';
import { fireEvent } from 'custom-card-helpers';

import { editorStyles } from './sugartv-card-styles.js';
import { getLocalizer } from './localize.js';

class SugarTvCardEditor extends LitElement {
    static get properties() {
        return {
            hass: { attribute: false },
            config: { type: Object },
        };
    }

    setConfig(config) {
        this.config = config;
    }

    get _glucose_value() {
        return this.config.glucose_value || '';
    }

    get _glucose_trend() {
        return this.config.glucose_trend || '';
    }

    get _show_prediction() {
        return this.config.show_prediction !== false;
    }

    get _color_low() {
        return this.config.color_low || '#ff8a80';
    }

    get _color_mid() {
        return this.config.color_mid || '#aed581';
    }

    get _color_high() {
        return this.config.color_high || '#ffb74d';
    }

    render() {
        if (!this.hass || !this.config) {
            return html``;
        }

        const entities = Object.keys(this.hass.states).filter((eid) =>
            eid.startsWith('sensor.'),
        );
        const localize = getLocalizer(this.config, this.hass);

        return html`
            <div class="card-config">
                <ha-select
                    naturalMenuWidth
                    fixedMenuPosition
                    label="${localize('editor.glucose_value')}"
                    .configValue=${'glucose_value'}
                    .value=${this._glucose_value}
                    @selected=${this._valueChanged}
                    @closed=${(ev) => ev.stopPropagation()}
                >
                    ${entities.map(
                        (entity) =>
                            html`<ha-list-item .value=${entity}
                                >${entity}</ha-list-item
                            >`,
                    )}
                </ha-select>

                <ha-select
                    naturalMenuWidth
                    fixedMenuPosition
                    label="${localize('editor.glucose_trend')}"
                    .configValue=${'glucose_trend'}
                    .value=${this._glucose_trend}
                    @selected=${this._valueChanged}
                    @closed=${(ev) => ev.stopPropagation()}
                >
                    ${entities.map(
                        (entity) =>
                            html`<ha-list-item .value=${entity}
                                >${entity}</ha-list-item
                            >`,
                    )}
                </ha-select>

                <ha-formfield .label=${localize('editor.show_prediction')}>
                    <ha-switch
                        .checked=${this._show_prediction}
                        .configValue=${'show_prediction'}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <div class="values">
                    <div class="section-heading">
                        ${localize('editor.background_colors_heading')}
                    </div>
                    <div class="color-row">
                        <label for="color-low">
                            ${localize('editor.color_low')}
                        </label>
                        <input
                            id="color-low"
                            type="color"
                            .value=${this._color_low}
                            .configValue=${'color_low'}
                            @change=${this._valueChanged}
                        />
                    </div>
                    <div class="color-row">
                        <label for="color-mid">
                            ${localize('editor.color_mid')}
                        </label>
                        <input
                            id="color-mid"
                            type="color"
                            .value=${this._color_mid}
                            .configValue=${'color_mid'}
                            @change=${this._valueChanged}
                        />
                    </div>
                    <div class="color-row">
                        <label for="color-high">
                            ${localize('editor.color_high')}
                        </label>
                        <input
                            id="color-high"
                            type="color"
                            .value=${this._color_high}
                            .configValue=${'color_high'}
                            @change=${this._valueChanged}
                        />
                    </div>
                </div>
            </div>
        `;
    }

    _valueChanged(ev) {
        if (!this.config || !this.hass) {
            return;
        }

        const { target } = ev;

        const { configValue } = target;

        if (!configValue) {
            return;
        }

        const newConfig = {
            ...this.config,
            [configValue]:
                configValue === 'show_prediction'
                    ? target.checked
                    : target.value,
        };

        fireEvent(this, 'config-changed', { config: newConfig });
    }

    static get styles() {
        return editorStyles;
    }
}

customElements.define('sugartv-card-editor', SugarTvCardEditor);
