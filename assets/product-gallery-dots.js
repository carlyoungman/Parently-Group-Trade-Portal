// Gallery dot pagination for the product media gallery (desktop/tablet only —
// the mobile slider keeps Dawn's swipe + counter). Dots stay in sync with the
// active media no matter what changed it: a dot, a thumbnail, or a colour
// preview swatch.

if (!customElements.get('product-gallery-dots')) {
  customElements.define(
    'product-gallery-dots',
    class ProductGalleryDots extends HTMLElement {
      connectedCallback() {
        this.gallery = this.closest('media-gallery');
        this.viewer = this.gallery?.querySelector('[id^="GalleryViewer"]');
        this.onClick = this.onClick.bind(this);
        this.addEventListener('click', this.onClick);

        if (this.viewer) {
          this.observer = new MutationObserver(() => this.syncActiveDot());
          this.viewer.querySelectorAll('[data-media-id]').forEach((item) => {
            this.observer.observe(item, { attributes: true, attributeFilter: ['class'] });
          });
        }
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
        this.observer?.disconnect();
      }

      onClick(event) {
        const dot = event.target.closest('.gallery-dots__dot');
        if (!dot) return;
        this.gallery?.setActiveMedia?.(dot.dataset.target, false);
      }

      syncActiveDot() {
        const activeMedia = this.viewer?.querySelector('.is-active[data-media-id]');
        if (!activeMedia) return;
        this.querySelectorAll('.gallery-dots__dot').forEach((dot) => {
          if (dot.dataset.target === activeMedia.dataset.mediaId) {
            dot.setAttribute('aria-current', 'true');
          } else {
            dot.removeAttribute('aria-current');
          }
        });
      }
    }
  );
}
