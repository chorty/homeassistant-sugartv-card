import { LitElement, html, css } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { cardStyles } from './sugartv-card-styles.js';
import './sugartv-card-editor.js';
import { getLocalizer } from './localize.js';

const VERSION = process.env.VERSION;

class SugarTvCard extends LitElement {
    static UNITS = {
        MGDL: 'mg/dL',
        MMOLL: 'mmol/L',
    };

    static get properties() {
        return {
            hass: { type: Object },
            config: { type: Object },
        };
    }

    static getStubConfig() {
        return {
            type: 'custom:sugartv-card',
            glucose_value: 'sensor.dexcom_glucose_value',
            glucose_trend: 'sensor.dexcom_glucose_trend',
            show_prediction: true,
        };
    }

    static async getConfigElement() {
        return document.createElement('sugartv-card-editor');
    }

    constructor() {
        super();
        this._data = this._getInitialDataState();
    }

    _getInitialDataState() {
        return {
            value: null,
            last_changed: null,
            trend: null,
            unit: SugarTvCard.UNITS.MGDL,
            previous_value: null,
            previous_last_changed: null,
            previous_trend: null,
        };
    }

    _getTrendDescriptions(unit) {
        const isMgdl = unit === SugarTvCard.UNITS.MGDL;
        const localize = getLocalizer(this.config, this.hass);
        const u = isMgdl ? localize('units.mgdl') : localize('units.mmoll');
        const locale =
            (this.config && this.config.locale) ||
            (this.hass && this.hass.language) ||
            'en';

        const nf = (val) =>
            val.toLocaleString(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
            });

        const formatMmol = (val1, val2) =>
            val2 ? `${nf(val1)}-${nf(val2)}` : nf(val1);

        return {
            rising_quickly: {
                icon: 'mdi:chevron-double-up',
                prediction: localize(
                    'predictions.rise_over',
                    isMgdl ? '45' : formatMmol(2.5),
                    u,
                ),
            },
            rising: {
                icon: 'mdi:arrow-up',
                prediction: localize(
                    'predictions.rise_in',
                    isMgdl ? '30-45' : formatMmol(1.7, 2.5),
                    u,
                ),
            },
            rising_slightly: {
                icon: 'mdi:arrow-top-right',
                prediction: localize(
                    'predictions.rise_in',
                    isMgdl ? '15-30' : formatMmol(0.8, 1.7),
                    u,
                ),
            },
            steady: {
                icon: 'mdi:arrow-right',
            },
            falling_slightly: {
                icon: 'mdi:arrow-bottom-right',
                prediction: localize(
                    'predictions.fall_in',
                    isMgdl ? '15-30' : formatMmol(0.8, 1.7),
                    u,
                ),
            },
            falling: {
                icon: 'mdi:arrow-down',
                prediction: localize(
                    'predictions.fall_in',
                    isMgdl ? '30-45' : formatMmol(1.7, 2.5),
                    u,
                ),
            },
            falling_quickly: {
                icon: 'mdi:chevron-double-down',
                prediction: localize(
                    'predictions.fall_over',
                    isMgdl ? '45' : formatMmol(2.5),
                    u,
                ),
            },
            unknown: {
                icon: 'mdi:help-circle-outline',
            },
        };
    }

    setConfig(config) {
        console.info(
            '%c SUGARTV-CARD %c ' + VERSION,
            'color: white; background: red; font-weight: 700;',
            'color: red; background: white; font-weight: 700;',
        );

        if (!config.glucose_value) {
            throw new Error(
                'You need to define glucose_value in your configuration.',
            );
        }

        if (!config.glucose_trend) {
            throw new Error(
                'You need to define glucose_trend in your configuration.',
            );
        }

        this.config = config;
        this._data = this._data || this._getInitialDataState();

        if (!this.config.disable_storage) {
            try {
                const key = `sugartv-card-${this.config.glucose_value}`;
                const storedState = sessionStorage.getItem(key);
                if (storedState) {
                    const state = JSON.parse(storedState);
                    this._data.previous_value = state.value;
                    this._data.previous_last_changed = state.last_changed;
                }
            } catch (e) {
                console.error('Error loading state from sessionStorage', e);
            }
        }
    }

    _updateData() {
        if (!this.hass || !this.config) {
            return;
        }

        const { glucose_value, glucose_trend } = this.config;

        if (!this._validateEntities(glucose_value, glucose_trend)) {
            // Data will be reset in _validateEntities, no need to return error html from here
            return;
        }

        const currentState = this._getCurrentState(
            glucose_value,
            glucose_trend,
        );

        if (!this.config.disable_storage) {
            try {
                if (this._isValidValue(currentState.value)) {
                    const key = `sugartv-card-${this.config.glucose_value}`;
                    sessionStorage.setItem(
                        key,
                        JSON.stringify({
                            value: currentState.value,
                            last_changed: currentState.last_changed,
                        }),
                    );
                }
            } catch (e) {
                console.error('Error saving state to sessionStorage', e);
            }
        }

        const previousState =
            this._data.value !== null
                ? {
                      previous_value: this._data.value,
                      previous_last_changed: this._data.last_changed,
                      previous_trend: this._data.trend,
                  }
                : null;

        this._updateCurrentData(currentState);

        if (
            previousState &&
            currentState.last_changed !== previousState.previous_last_changed
        ) {
            Object.assign(this._data, previousState);
        }
    }

    _validateEntities(glucose_value, glucose_trend) {
        if (
            !this.hass.states[glucose_value] ||
            !this.hass.states[glucose_trend]
        ) {
            // Don't log error here, it will spam the console during startup
            this._data = {
                ...this._getInitialDataState(),
                value: 0,
                last_changed: 0,
                trend: 'unknown',
                unit: SugarTvCard.UNITS.MGDL,
            };
            return false;
        }
        return true;
    }

    _getCurrentState(glucose_value, glucose_trend) {
        const glucoseState = this.hass.states[glucose_value];
        const trendState = this.hass.states[glucose_trend];

        return {
            value: glucoseState.state,
            unit: glucoseState.attributes.unit_of_measurement,
            last_changed: glucoseState.last_changed,
            trend: trendState.state,
        };
    }

    _updateCurrentData(currentState) {
        if (this._data.unit !== currentState.unit) {
            this._getTrendDescriptions(
                currentState.unit || SugarTvCard.UNITS.MGDL,
            );
            this._data.unit = currentState.unit;
        }
        Object.assign(this._data, currentState);
    }

    _formatTime(timestamp) {
        const localize = getLocalizer(this.config, this.hass);
        if (
            !timestamp ||
            timestamp === 'unknown' ||
            timestamp === 'unavailable'
        ) {
            return localize('common.default_time');
        }

        const options = {
            hour: '2-digit',
            minute: '2-digit',
        };

        const locale =
            (this.config && this.config.locale) ||
            (this.hass && this.hass.language);

        return new Date(timestamp).toLocaleTimeString(locale || [], options);
    }

    _calculateDelta() {
        const { value, previous_value, last_changed, previous_last_changed } =
            this._data;

        if (
            !this._isValidValue(value) ||
            !this._isValidValue(previous_value) ||
            last_changed === previous_last_changed
        ) {
            return null;
        }

        const timeDiff = Math.abs(
            new Date(last_changed) - new Date(previous_last_changed),
        );
        if (timeDiff >= 450000) {
            // 7.5 minutes
            return null;
        }

        const currentValue = parseFloat(String(value).replace(',', '.'));
        const previousValue = parseFloat(
            String(previous_value).replace(',', '.'),
        );

        if (isNaN(currentValue) || isNaN(previousValue)) {
            return null;
        }

        const delta = currentValue - previousValue;
        const sign = delta >= 0 ? '＋' : '－';
        const absDelta = Math.abs(delta);

        const locale = this.config.locale || [];
        const isMmol = this._data.unit === SugarTvCard.UNITS.MMOLL;

        if (isMmol) {
            return `${sign}${absDelta.toLocaleString(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
            })}`;
        }

        return `${sign}${Math.round(absDelta).toLocaleString(locale)}`;
    }

    _isValidValue(value) {
        return value && value !== 'unknown' && value !== 'unavailable';
    }

    _formatValue(value) {
        const localize = getLocalizer(this.config, this.hass);
        if (!this._isValidValue(value)) {
            return localize('common.not_available');
        }

        const sanitizedValue = String(value).replace(',', '.');
        const numValue = parseFloat(sanitizedValue);

        if (isNaN(numValue)) {
            return localize('common.not_available');
        }

        const locale = this.config.locale || [];
        const isMmol = this._data.unit === SugarTvCard.UNITS.MMOLL;

        return numValue.toLocaleString(locale, {
            minimumFractionDigits: isMmol ? 1 : 0,
            maximumFractionDigits: isMmol ? 1 : 0,
        });
    }

    _getBackgroundColor(value) {
        if (!this.config || !this._isValidValue(value)) {
            return null;
        }

        const sanitized = parseFloat(String(value).replace(',', '.'));

        if (!Number.isFinite(sanitized)) {
            return null;
        }

        const mgdlValue =
            this._data.unit === SugarTvCard.UNITS.MMOLL
                ? sanitized * 18
                : sanitized;

        const { color_low, color_mid, color_high } = this.config;

        if (!color_low && !color_mid && !color_high) {
            return null;
        }

        if (mgdlValue < 1) {
            return color_low || null;
        }

        if (mgdlValue <= 69) {
            return color_low || null;
        }

        if (mgdlValue <= 149) {
            return color_mid || null;
        }

        if (mgdlValue <= 600) {
            return color_high || null;
        }

        return color_high || null;
    }

    _getBackgroundStyles(value) {
        const background = this._getBackgroundColor(value);

        if (!background) {
            return null;
        }

        return {
            background,
            color: this._getContrastColor(background),
        };
    }

    _getContrastColor(color) {
        const rgb = this._parseColor(color);

        if (!rgb) {
            return '#ffffff';
        }

        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

        return luminance > 0.6 ? '#000000' : '#ffffff';
    }

    _parseColor(color) {
        if (typeof color !== 'string') {
            return null;
        }

        const value = color.trim();

        const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex
                    .split('')
                    .map((ch) => ch + ch)
                    .join('');
            }
            const intVal = parseInt(hex, 16);
            return {
                r: (intVal >> 16) & 255,
                g: (intVal >> 8) & 255,
                b: intVal & 255,
            };
        }

        const rgbMatch = value.match(
            /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i,
        );

        if (rgbMatch) {
            return {
                r: Math.min(255, parseInt(rgbMatch[1], 10)),
                g: Math.min(255, parseInt(rgbMatch[2], 10)),
                b: Math.min(255, parseInt(rgbMatch[3], 10)),
            };
        }

        return null;
    }

    render() {
        this._updateData();

        const { value, last_changed, trend, unit } = this._data;
        const showPrediction = this.config.show_prediction !== false;
        const trendSymbols = this._getTrendDescriptions(unit);
        const trendInfo =
            (trend && trendSymbols[trend.toLowerCase()]) ||
            trendSymbols.unknown;
        const trendIcon = trendInfo.icon;
        const prediction = trendInfo.prediction || '';
        const rangeStyles = this._getBackgroundStyles(value);
        const wrapperStyle = rangeStyles
            ? `background:${rangeStyles.background};--sugartv-text-color:${rangeStyles.color};`
            : undefined;

        return html`
            <div class="wrapper" style=${ifDefined(wrapperStyle)}>
                <div class="container">
                    <div class="main-row">
                        <div class="time">
                            ${this._formatTime(last_changed)}
                        </div>
                        <div class="value">${this._formatValue(value)}</div>
                        <div class="trend">
                            <ha-icon icon="${trendIcon}"></ha-icon>
                        </div>
                        <div class="delta">
                            ${this._calculateDelta() ||
                            html`<ha-icon icon="mdi:progress-clock"></ha-icon>`}
                        </div>
                    </div>
                    ${showPrediction && prediction
                        ? html` <div class="prediction">${prediction}</div> `
                        : ''}
                </div>
            </div>
        `;
    }

    getCardSize() {
        return 1;
    }

    static get styles() {
        return cardStyles;
    }
}

const localize = getLocalizer();
customElements.define('sugartv-card', SugarTvCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'sugartv-card',
    name: localize('card.name'),
    description: localize('card.description'),
});
