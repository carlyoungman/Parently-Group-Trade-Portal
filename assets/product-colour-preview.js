// Colour preview swatches — swaps the product media gallery image to the
// selected colour's variant image. Presentation only: no variant, URL, or
// cart state changes (purchasing happens in the bulk order table).

// Keep in sync with COLOUR_SWATCH_MAP in src/product-bulk-order.jsx
const COLOUR_PREVIEW_SWATCH_MAP = {
  black: '#111111',
  charcoal: '#36454F',
  grey: '#9B9B9B',
  gray: '#9B9B9B',
  navy: '#1C2951',
  white: '#FFFFFF',
  red: '#CC0000',
  blue: '#1B4B8A',
  green: '#2A6B45',
  brown: '#6B3A2A',
  beige: '#D2B48C',
  cream: '#FFFDD0',
  khaki: '#C3B091',
  burgundy: '#800020',
  pink: '#FFC0CB',
  purple: '#6B3FA0',
  yellow: '#F5C400',
  orange: '#E8883A',
  camel: '#C19A6B',
  slate: '#708090',
  stone: '#928E85',
  teal: '#008080',
  sand: '#D4B483',
};

if (!customElements.get('product-colour-preview')) {
  customElements.define(
    'product-colour-preview',
    class ProductColourPreview extends HTMLElement {
      connectedCallback() {
        this.valueLabel = this.querySelector('[data-colour-preview-value]');
        this.swatchButtons = Array.from(this.querySelectorAll('.colour-preview__swatch'));
        this.onClick = this.onClick.bind(this);
        this.addEventListener('click', this.onClick);
        this.fillMissingSwatches();
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
      }

      get gallery() {
        return document.getElementById(`MediaGallery-${this.dataset.section}`);
      }

      fillMissingSwatches() {
        this.swatchButtons.forEach((button) => {
          const swatch = button.querySelector('.swatch');
          if (!swatch || swatch.style.getPropertyValue('--swatch--background')) return;
          const name = (button.dataset.colourName ?? '').toLowerCase().trim();
          const colour = COLOUR_PREVIEW_SWATCH_MAP[name] ?? '#888888';
          swatch.style.setProperty('--swatch--background', colour);
        });
      }

      onClick(event) {
        const button = event.target.closest('.colour-preview__swatch');
        if (!button) return;
        this.gallery?.setActiveMedia?.(button.dataset.mediaId, false);
        this.swatchButtons.forEach((swatchButton) => {
          swatchButton.setAttribute('aria-pressed', swatchButton === button ? 'true' : 'false');
        });
        if (this.valueLabel) this.valueLabel.textContent = button.dataset.colourName ?? '';
      }
    }
  );
}
