if (!customElements.get('product-description-toggle')) {
  customElements.define(
    'product-description-toggle',
    class ProductDescriptionToggle extends HTMLElement {
      connectedCallback() {
        this.content = this.querySelector('.product-description-toggle__content');
        this.button = this.querySelector('.product-description-toggle__btn');
        if (!this.content || !this.button) return;

        this.onResize = debounce(() => this.measure(), 150);
        this.button.addEventListener('click', this.onClick.bind(this));
        window.addEventListener('resize', this.onResize);

        // Measure once layout has settled, then again after the async Typekit
        // font loads (it changes text height and can flip the overflow result).
        requestAnimationFrame(() => this.measure());
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => this.measure());
        }
      }

      disconnectedCallback() {
        window.removeEventListener('resize', this.onResize);
      }

      // Only clamp + show the toggle when the content actually overflows the cap.
      // Apply the clamp first so clientHeight reflects the capped height, then
      // read the overflow synchronously and drop the clamp again if it fits.
      // Both class changes happen before paint, so short descriptions don't flash.
      measure() {
        if (this.classList.contains('is-expanded')) return;
        this.classList.add('is-clamped');
        const overflows = this.content.scrollHeight > this.content.clientHeight + 1;
        this.classList.toggle('is-clamped', overflows);
        this.button.hidden = !overflows;
      }

      onClick() {
        const expanded = this.classList.toggle('is-expanded');
        this.button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }
    }
  );
}
