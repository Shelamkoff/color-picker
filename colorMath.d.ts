/**
 * Convert HSV to hex string.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value (0-1)
 * @returns {string}
 */
export function hsvToHex(h: number, s: number, v: number): string;
/**
 * Convert normalized RGB (0-1) to HSV.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, v: number }}
 */
export function rgbToHsv(r: number, g: number, b: number): {
    h: number;
    s: number;
    v: number;
};
/**
 * Convert hex string to HSV.
 * @param {string} hex
 * @returns {{ h: number, s: number, v: number }}
 */
export function hexToHsv(hex: string): {
    h: number;
    s: number;
    v: number;
};
/**
 * Convert HSV to RGB (0-255).
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {{ r: number, g: number, b: number }}
 */
export function hsvToRgb(h: number, s: number, v: number): {
    r: number;
    g: number;
    b: number;
};
/**
 * Convert HSV to HSL.
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {{ h: number, s: number, l: number }}
 */
export function hsvToHsl(h: number, s: number, v: number): {
    h: number;
    s: number;
    l: number;
};
/**
 * Format HSVA as a CSS color string in the given format.
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @param {number} a
 * @param {string} fmt - 'HEX', 'RGB', or 'HSL'
 * @returns {string}
 */
export function formatColor(h: number, s: number, v: number, a: number, fmt: string): string;
/**
 * Round alpha to 2 decimal places.
 * @param {number} a
 * @returns {number}
 */
export function roundAlpha(a: number): number;
/**
 * Parse rgb/rgba(...) CSS string to hex + alpha.
 * @param {string} css
 * @returns {{ hex: string, alpha: number }}
 */
export function parseRgbCss(css: string): {
    hex: string;
    alpha: number;
};
/**
 * Parse any color string (hex, rgb, rgba, hsl, hsla) to HSVA or null.
 * @param {string} str
 * @returns {{ h: number, s: number, v: number, a: number } | null}
 */
export function parseColorInput(str: string): {
    h: number;
    s: number;
    v: number;
    a: number;
} | null;
/**
 * Color math utilities — pure functions for color space conversions.
 * No DOM dependencies.
 */
/** Available color format names */
export const COLOR_FORMATS: string[];
