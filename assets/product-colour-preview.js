// Colour preview swatches - swaps the product media gallery image to the
// selected colour's variant image. Presentation only: no variant, URL, or
// cart state changes.

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
  bottle: '#0F4D3A',
  'bottle green': '#0F4D3A',
  maroon: '#800000',
  mulbery: '#70193D',
  mulberry: '#70193D',
  royal: '#234AA8',
  sky: '#87BFE8',
  silver: '#C0C0C0',
  amber: '#F6B23A',
  amethyst: '#8E6BBE',
  'icelandic amethyst': '#9B87C8',
  toffee: '#8B5A2B',
  'toffee brown': '#8B5A2B',
  lavender: '#BBA7E8',
  lilac: '#C8A2C8',
  mint: '#98D8C8',
  turquoise: '#30C5C8',
  gold: '#D4AF37',
  ochre: '#CC8A00',
  coral: '#F06F61',
  'dark coral': '#C94D4D',
  'candyfloss coral': '#F07F7A',
  'cornflower blue': '#6495ED',
  'baby blue': '#A7D8F2',
  'baby pink': '#F4B6C8',
  'burnt orange': '#C65A1E',
  'buttermilk yellow': '#F6E59A',
  'fudge brown': '#7A4A2B',
  'geothermal grey': '#7D858C',
  'ice blue': '#B7DDF2',
  'pampas cream': '#E8DDC6',
  beige: '#D2B48C',
  cream: '#FFFDD0',
  khaki: '#C3B091',
  burgundy: '#800020',
  pink: '#FFC0CB',
  rose: '#B76E79',
  'rose pink': '#D8A0A6',
  purple: '#6B3FA0',
  yellow: '#F5C400',
  orange: '#E8883A',
  camel: '#C19A6B',
  slate: '#708090',
  stone: '#e0d9c8ff',
  teal: '#008080',
  sand: '#D4B483',
};

function normaliseColourName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^(?:[a-z]*\d+[a-z0-9]*|\d+[a-z0-9]*)[\s_-]+/i, '')
    .replace(/\b(mto|ltd|so|pu|sebs|leather|patent)\b/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getColourSwatchBackground(name) {
  const cleanName = normaliseColourName(name);
  const parts = cleanName
    .split(/\s*\/\s*|\s+\+\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const colours = parts
    .map((part) => {
      if (COLOUR_PREVIEW_SWATCH_MAP[part]) return COLOUR_PREVIEW_SWATCH_MAP[part];

      const words = part.split(/\s+/).reverse();
      const matchedWord = words.find((word) => COLOUR_PREVIEW_SWATCH_MAP[word]);
      return matchedWord ? COLOUR_PREVIEW_SWATCH_MAP[matchedWord] : null;
    })
    .filter(Boolean);

  if (colours.length === 1) return colours[0];
  if (colours.length === 2) return `linear-gradient(135deg, ${colours[0]} 0 50%, ${colours[1]} 50% 100%)`;
  if (colours.length === 3) return `linear-gradient(135deg, ${colours[0]} 0 33%, ${colours[1]} 33% 66%, ${colours[2]} 66% 100%)`;

  return '#888888';
}

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
          if (!swatch) return;

          const current = swatch.style.getPropertyValue('--swatch--background').trim();
          if (current && current !== '#888888' && current !== 'rgb(136, 136, 136)') return;

          swatch.style.setProperty('--swatch--background', getColourSwatchBackground(button.dataset.colourName));
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
