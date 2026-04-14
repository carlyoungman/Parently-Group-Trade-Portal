/**
 * Vertical Image Links — scroll-driven sticky carousel
 *
 * The outer custom element is made tall enough (100vh + carousel overflow) so
 * that normal page scrolling drives a 0→1 progress value.  The inner layout is
 * position:sticky so it stays locked in the viewport.  JS reads that progress
 * on every scroll event and translates the card track upward, giving the
 * illusion of the cards scrolling while the text column remains stationary.
 *
 * On mobile (≤749px) the sticky behaviour is disabled entirely via CSS and this
 * script becomes a no-op.
 */

class VerticalImageLinks extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.vertical-image-links__carousel-track');
    this.cards = Array.from(this.querySelectorAll('.vertical-image-links__card'));

    if (!this.track || this.cards.length === 0) return;

    // Wait for layout to be ready before measuring
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._init());
    } else {
      // Use requestAnimationFrame to ensure paint has occurred
      requestAnimationFrame(() => this._init());
    }
  }

  disconnectedCallback() {
    if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }

  _init() {
    this._onScroll = this._handleScroll.bind(this);
    this._onResize = this._debounce(this._setup.bind(this), 150);

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize);

    this._setup();
  }

  _setup() {
    // Disable on mobile — CSS already resets position:sticky
    if (window.innerWidth <= 749) {
      this.style.minHeight = '';
      if (this.track) this.track.style.transform = '';
      this._overflowH = 0;
      return;
    }

    // Calculate how far the card track needs to travel to show all cards
    const gap = parseFloat(getComputedStyle(this.track).gap) || 16;
    const padding = parseFloat(getComputedStyle(this.track).paddingTop) || 16;
    const cardH = this.cards[0] ? this.cards[0].offsetHeight : 0;

    if (cardH === 0) {
      // Cards not yet painted — retry after next frame
      requestAnimationFrame(() => this._setup());
      return;
    }

    const totalTrackH =
      padding * 2 + cardH * this.cards.length + gap * (this.cards.length - 1);
    const overflowH = Math.max(0, totalTrackH - window.innerHeight);

    this._overflowH = overflowH;

    // Grow the outer element so there is enough scroll room
    this.style.minHeight = `${window.innerHeight + overflowH}px`;

    // Kick off initial position in case page loaded mid-section
    this._handleScroll();
  }

  _handleScroll() {
    if (!this._overflowH || window.innerWidth <= 749) return;

    const rect = this.getBoundingClientRect();
    const sectionH = this.offsetHeight;
    const vp = window.innerHeight;

    // scrolled: how many px we've moved past the section's top edge (0 = entry)
    const scrolled = -rect.top;
    const scrollable = sectionH - vp; // total px of scroll range through section

    if (scrollable <= 0) return;

    const progress = Math.max(0, Math.min(1, scrolled / scrollable));
    const translateY = -(progress * this._overflowH);

    this.track.style.transform = `translateY(${translateY}px)`;
  }

  /** Lightweight debounce to avoid thrashing on resize */
  _debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
}

customElements.define('vertical-image-links-component', VerticalImageLinks);
