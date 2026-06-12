/**
 * @typedef {{
 *   onApply?: (cssColor: string) => void,
 *   onRemove?: () => void,
 *   onChange?: (cssColor: string) => void,
 *   onFormatChange?: (formatted: string, format: string) => void,
 *   showRemove?: boolean,
 * }} ColorPickerOptions
 */
/**
 * Reusable color picker UI component.
 * Renders SV area, hue bar, alpha bar, format toggle, hex input, eyedropper, apply/remove buttons.
 */
export class ColorPicker {
    /** @param {ColorPickerOptions} [options] */
    constructor(options?: ColorPickerOptions);
    /** @returns {HTMLElement} */
    get element(): HTMLElement;
    /**
     * Open the picker with a given color.
     * @param {string} hex
     * @param {number} [alpha]
     */
    open(hex: string, alpha?: number): void;
    close(): void;
    destroy(): void;
    #private;
}
export type ColorPickerOptions = {
    onApply?: (cssColor: string) => void;
    onRemove?: () => void;
    onChange?: (cssColor: string) => void;
    onFormatChange?: (formatted: string, format: string) => void;
    showRemove?: boolean;
};
