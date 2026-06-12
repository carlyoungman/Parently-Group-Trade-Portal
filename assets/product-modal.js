if (!customElements.get('product-modal')) {
  customElements.define(
    'product-modal',
    class ProductModal extends ModalDialog {
      constructor() {
        super();

        this.content = this.querySelector('.product-media-modal__content');
        // Direct children carrying a media id are the slides (img / deferred-media
        // / model wrapper). Thumb buttons also use data-media-id, so scope to content.
        this.slides = Array.from(this.content ? this.content.querySelectorAll(':scope > [data-media-id]') : []);
        this.thumbs = Array.from(this.querySelectorAll('.product-media-modal__thumb-btn'));
        this.counterCurrent = this.querySelector('.product-media-modal__counter-current');
        this.thumbStrip = this.querySelector('.product-media-modal__thumbs');
        this.activeIndex = 0;
        this.onKeydown = this.onKeydown.bind(this);

        this.querySelector('.product-media-modal__nav--prev')?.addEventListener('click', () => this.step(-1));
        this.querySelector('.product-media-modal__nav--next')?.addEventListener('click', () => this.step(1));
        this.thumbs.forEach((thumb, index) => thumb.addEventListener('click', () => this.setActiveIndex(index)));

        // ModalDialog's media-modal pointerup handler closes on any click that
        // isn't inside a video/model. Keep clicks on the controls and the image
        // itself from bubbling there, so only the dimmed backdrop closes.
        this.querySelectorAll(
          '.product-media-modal__nav, .product-media-modal__counter, .product-media-modal__thumbs, .product-media-modal__content img'
        ).forEach((element) => {
          element.addEventListener('pointerup', (event) => event.stopPropagation());
        });
      }

      hide() {
        super.hide();
        document.removeEventListener('keydown', this.onKeydown);

        // Keep the inline gallery's dots/thumbnails in sync with the last image viewed.
        const gallery = document.querySelector(`#MediaGallery-${this.dataset.section}`);
        const activeId = this.slides[this.activeIndex]?.dataset.mediaId;
        if (gallery && activeId) gallery.setActiveMedia?.(`${this.dataset.section}-${activeId}`, false);
      }

      show(opener) {
        super.show(opener);
        const openerId = opener.getAttribute('data-media-id');
        const index = this.slides.findIndex((slide) => slide.dataset.mediaId === openerId);
        this.setActiveIndex(index < 0 ? 0 : index);
        document.addEventListener('keydown', this.onKeydown);
      }

      onKeydown(event) {
        if (event.code === 'ArrowRight') {
          event.preventDefault();
          this.step(1);
        } else if (event.code === 'ArrowLeft') {
          event.preventDefault();
          this.step(-1);
        }
      }

      step(direction) {
        if (this.slides.length < 2) return;
        this.setActiveIndex((this.activeIndex + direction + this.slides.length) % this.slides.length);
      }

      setActiveIndex(index) {
        const activeMedia = this.slides[index];
        if (!activeMedia) return;
        this.activeIndex = index;

        this.slides.forEach((slide) => slide.classList.toggle('active', slide === activeMedia));
        this.thumbs.forEach((thumb, i) => {
          if (i === index) {
            thumb.setAttribute('aria-current', 'true');
          } else {
            thumb.removeAttribute('aria-current');
          }
        });
        if (this.counterCurrent) this.counterCurrent.textContent = index + 1;

        const thumb = this.thumbs[index];
        if (this.thumbStrip && thumb) {
          this.thumbStrip.scrollTo({
            left: thumb.offsetLeft - this.thumbStrip.clientWidth / 2 + thumb.clientWidth / 2,
            behavior: 'smooth',
          });
        }

        // Lazy-load deferred YouTube embeds when their slide becomes active.
        const template = activeMedia.querySelector('template');
        const templateContent = template ? template.content : null;
        if (activeMedia.nodeName === 'DEFERRED-MEDIA' && templateContent && templateContent.querySelector('.js-youtube')) {
          activeMedia.loadContent();
        }
      }
    }
  );
}
