(function () {
  'use strict';

  var CONFIG = {
    draftKey: 'qo_draft_v4_parentlygroupmyshopifycom',
    collectionHandle: 'trade-quick-order',
    vatRate: 0.2,
    pageSize: 250,
    maxCollectionPages: 20,
    maxDropdownResults: 120,
    predictiveProductLimit: 10,
    cartDestination: '/cart',
    clearCartBeforeAdd: false
  };

  var GBP = String.fromCharCode(163);

  var state = {
    basket: [],
    variants: [],
    variantsById: {},
    variantsBySku: {},
    productsByHandle: {},
    selected: null,
    searchTimer: null,
    focusIndex: -1,
    productsLoaded: false,
    productsLoading: false,
    activeSearchToken: 0,
    csvLines: [],
    suggestedLines: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function has(id) {
    return Boolean($(id));
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function setHtml(id, value) {
    var el = $(id);
    if (el) el.innerHTML = value == null ? '' : String(value);
  }

  function show(id, display) {
    var el = $(id);
    if (el) el.style.display = display || 'block';
  }

  function hide(id) {
    var el = $(id);
    if (el) el.style.display = 'none';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normaliseSku(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normaliseText(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function singularToken(token) {
    if (token.length > 3 && token.slice(-3) === 'IES') return token.slice(0, -3) + 'Y';
    if (token.length > 3 && token.slice(-1) === 'S') return token.slice(0, -1);
    return token;
  }

  function queryTokens(query) {
    var text = normaliseText(query);
    if (!text) return [];
    return text.split(' ').map(singularToken).filter(Boolean);
  }

  function parseQty(value) {
    var qty = parseInt(value, 10);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  }

  function priceToCents(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value <= 0) return 0;
      return value > 999 && Number.isInteger(value) ? value : Math.round(value * 100);
    }
    var raw = String(value).replace(/[^0-9.]/g, '');
    if (!raw) return 0;
    var parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return raw.indexOf('.') === -1 && parsed > 999 ? Math.round(parsed) : Math.round(parsed * 100);
  }

  function money(cents, fallback) {
    var value = Number(cents);
    if (!Number.isFinite(value) || value <= 0) return fallback || 'Price pending';
    return GBP + (Math.round(value) / 100).toFixed(2);
  }

  function variantOptions(product, variant) {
    if (variant.title && variant.title !== 'Default Title') return variant.title;
    return [variant.option1, variant.option2, variant.option3]
      .filter(function (option) {
        return option && option !== 'Default Title';
      })
      .join(' / ');
  }

  function productImage(product, variant) {
    if (variant.featured_image && variant.featured_image.src) return variant.featured_image.src;
    if (variant.featured_image && typeof variant.featured_image === 'string') return variant.featured_image;
    if (variant.featured_media && variant.featured_media.preview_image) return variant.featured_media.preview_image.src;
    if (product.featured_image) return product.featured_image;
    if (product.images && product.images[0] && product.images[0].src) return product.images[0].src;
    if (product.images && typeof product.images[0] === 'string') return product.images[0];
    return '';
  }

  function productHandle(product) {
    if (product.handle) return product.handle;
    if (product.url) {
      var parts = String(product.url).split('/products/');
      if (parts[1]) return parts[1].split(/[?#]/)[0];
    }
    return '';
  }

  function mapVariant(product, variant) {
    var sku = String(variant.sku || '').trim();
    if (!sku) return null;

    var id = Number(variant.id);
    if (!Number.isFinite(id) || id <= 0) return null;

    var inventory =
      typeof variant.inventory_quantity === 'number'
        ? variant.inventory_quantity
        : typeof variant.inventoryQuantity === 'number'
        ? variant.inventoryQuantity
        : null;

    var available = variant.available !== false;

    return {
      id: id,
      sku: normaliseSku(sku),
      displaySku: sku,
      title: product.title || '',
      variant: variantOptions(product, variant) || 'Default',
      brand: product.vendor || '',
      price: priceToCents(variant.price),
      inventory: inventory,
      available: available,
      image: productImage(product, variant),
      handle: productHandle(product)
    };
  }

  function addVariantToIndex(variant) {
    if (!variant || !variant.id || !variant.sku) return;
    state.variantsById[variant.id] = variant;
    state.variantsBySku[variant.sku] = variant;

    var exists = state.variants.some(function (item) {
      return item.id === variant.id;
    });
    if (!exists) state.variants.push(variant);
  }

  function addProductToIndex(product) {
    if (!product) return;
    var handle = productHandle(product);
    if (handle) state.productsByHandle[handle] = true;

    (product.variants || []).forEach(function (variant) {
      addVariantToIndex(mapVariant(product, variant));
    });
  }

  function stockBadge(variant) {
    if (!variant || variant.available === false) return { cls: 'stock-out', label: 'Unavailable' };
    if (variant.inventory == null) return { cls: 'stock-in', label: 'Available' };
    if (variant.inventory <= 0) return { cls: 'stock-out', label: 'Out of stock' };
    if (variant.inventory <= 5) return { cls: 'stock-low', label: 'Low (' + variant.inventory + ')' };
    return { cls: 'stock-in', label: 'In stock' };
  }

  var toastTimer;
  function toast(message, type) {
    var el = $('qo-toast');
    if (!el) {
      if (type === 'err') console.error('[QO]', message);
      else console.log('[QO]', message);
      return;
    }
    el.textContent = message;
    el.className = 'qo-toast ' + (type || 'ok') + ' on';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = 'qo-toast';
    }, 3000);
  }

  async function fetchJson(url, options) {
    var response = await fetch(url, options || {});
    var body = await response.text();
    var data = {};
    if (body) {
      try {
        data = JSON.parse(body);
      } catch (error) {
        data = { raw: body };
      }
    }
    if (!response.ok) {
      throw new Error(data.description || data.message || response.statusText || 'Request failed');
    }
    return data;
  }

  async function loadCollectionProducts() {
    if (state.productsLoaded || state.productsLoading) return;
    state.productsLoading = true;

    try {
      for (var page = 1; page <= CONFIG.maxCollectionPages; page += 1) {
        var url =
          '/collections/' +
          CONFIG.collectionHandle +
          '/products.json?limit=' +
          CONFIG.pageSize +
          '&page=' +
          page;
        var data = await fetchJson(url);
        var products = data.products || [];
        products.forEach(addProductToIndex);
        if (products.length < CONFIG.pageSize) break;
      }
      state.productsLoaded = true;
      renderSuggested();
      console.log('[QO] collection variants loaded: ' + state.variants.length);
    } catch (error) {
      console.warn('[QO] collection load failed', error);
      toast('Quick order loaded with search fallback only.', 'err');
    } finally {
      state.productsLoading = false;
    }
  }

  async function fetchProductByHandle(handle) {
    if (!handle || state.productsByHandle[handle]) return;
    try {
      var product = await fetchJson('/products/' + encodeURIComponent(handle) + '.js');
      addProductToIndex(product);
    } catch (error) {
      console.warn('[QO] product load failed for ' + handle, error);
    }
  }

  async function predictiveSearchProducts(query) {
    if (!query || query.length < 2) return;
    try {
      var url =
        '/search/suggest.json?q=' +
        encodeURIComponent(query) +
        '&resources[type]=product&resources[limit]=' +
        CONFIG.predictiveProductLimit;
      var data = await fetchJson(url);
      var products =
        data.resources &&
        data.resources.results &&
        data.resources.results.products
          ? data.resources.results.products
          : [];

      await Promise.all(
        products
          .map(productHandle)
          .filter(Boolean)
          .map(function (handle) {
            return fetchProductByHandle(handle);
          })
      );
    } catch (error) {
      console.warn('[QO] predictive search failed', error);
    }
  }

  function variantHaystack(variant) {
    return normaliseText(
      [variant.sku, variant.displaySku, variant.title, variant.variant, variant.brand].join(' ')
    );
  }

  function variantMatches(variant, query) {
    var raw = normaliseSku(query);
    if (!raw) return false;
    if (variant.sku.indexOf(raw) !== -1) return true;

    var tokens = queryTokens(query);
    if (!tokens.length) return false;
    var haystack = variantHaystack(variant);
    return tokens.every(function (token) {
      return haystack.indexOf(token) !== -1;
    });
  }

  function searchVariants(query) {
    var raw = normaliseSku(query);
    return state.variants
      .filter(function (variant) {
        return variantMatches(variant, query);
      })
      .sort(function (a, b) {
        var aExact = a.sku === raw ? 0 : a.sku.indexOf(raw) === 0 ? 1 : 2;
        var bExact = b.sku === raw ? 0 : b.sku.indexOf(raw) === 0 ? 1 : 2;
        if (aExact !== bExact) return aExact - bExact;
        if (a.title !== b.title) return a.title.localeCompare(b.title);
        return a.sku.localeCompare(b.sku);
      });
  }

  async function runSearch(query) {
    var dropdown = $('qo-dropdown');
    if (!dropdown) return;

    var token = ++state.activeSearchToken;
    var clean = String(query || '').trim();
    if (!clean) {
      hide('qo-dropdown');
      return;
    }

    dropdown.style.maxHeight = '460px';
    dropdown.style.overflowY = 'auto';
    setHtml('qo-dropdown', '<div class="qo-d-loading">Searching...</div>');
    show('qo-dropdown', 'block');

    var local = searchVariants(clean);
    renderSearchResults(local, clean, true);

    await predictiveSearchProducts(clean);
    if (token !== state.activeSearchToken) return;

    renderSearchResults(searchVariants(clean), clean, false);
  }

  function renderSearchResults(results, query, loadingMore) {
    var dropdown = $('qo-dropdown');
    if (!dropdown) return;

    state.focusIndex = -1;

    if (!results.length) {
      dropdown.innerHTML = loadingMore
        ? '<div class="qo-d-loading">Searching wider catalogue...</div>'
        : '<div class="qo-d-empty">No products found</div>';
      dropdown.style.display = 'block';
      return;
    }

    var limited = results.slice(0, CONFIG.maxDropdownResults);
    var groups = limited.reduce(function (acc, variant) {
      var brand = variant.brand || 'Products';
      if (!acc[brand]) acc[brand] = [];
      acc[brand].push(variant);
      return acc;
    }, {});

    var markup = '';
    Object.keys(groups).forEach(function (brand) {
      markup += '<div class="qo-dg">';
      markup += '<span class="qo-dg-label">' + esc(brand) + '</span>';
      groups[brand].forEach(function (variant) {
        var stock = stockBadge(variant);
        markup +=
          '<button type="button" class="qo-di" data-sku="' +
          esc(variant.sku) +
          '">' +
          (variant.image
            ? '<img class="qo-di__img" src="' + esc(variant.image) + '" alt="" loading="lazy">'
            : '<span class="qo-di__img"></span>') +
          '<span class="qo-di__info">' +
          '<span class="qo-di__name">' +
          esc(variant.title) +
          '</span>' +
          '<span class="qo-di__sub">' +
          esc(variant.variant || 'Default') +
          ' - ' +
          esc(variant.displaySku || variant.sku) +
          '</span>' +
          '</span>' +
          '<span class="qo-di__stock ' +
          stock.cls +
          '">' +
          esc(stock.label) +
          '</span>' +
          '<span class="qo-di__price">' +
          money(variant.price) +
          '</span>' +
          '</button>';
      });
      markup += '</div>';
    });

    if (results.length > limited.length) {
      markup +=
        '<div class="qo-d-empty">Showing ' +
        limited.length +
        ' of ' +
        results.length +
        ' matches. Keep typing to narrow results.</div>';
    } else if (loadingMore) {
      markup += '<div class="qo-d-loading">Searching wider catalogue...</div>';
    }

    dropdown.innerHTML = markup;
    dropdown.style.display = 'block';
  }

  function exactVariant(query) {
    return state.variantsBySku[normaliseSku(query)] || null;
  }

  function clearSelection() {
    state.selected = null;
    hide('qo-product-card');
    hide('qo-qty-row');
    var add = $('qo-add-btn');
    if (add) add.disabled = true;
  }

  function selectVariant(sku) {
    var variant = exactVariant(sku);
    if (!variant) return false;

    state.selected = Object.assign({}, variant);
    hide('qo-dropdown');

    var input = $('qo-sku-input');
    if (input) input.value = variant.displaySku || variant.sku;
    show('qo-input-clear', 'block');

    var stock = stockBadge(variant);
    var image = $('qo-sel-img');
    if (image) {
      image.src = variant.image || '';
      image.alt = variant.title || '';
    }
    setText('qo-sel-brand', variant.brand);
    setText('qo-sel-title', variant.title);
    setText('qo-sel-variant', variant.variant || 'Default');
    setText('qo-sel-sku', 'SKU: ' + (variant.displaySku || variant.sku));
    setText('qo-sel-price', money(variant.price));
    setText('qo-sel-stock', stock.label);
    var stockEl = $('qo-sel-stock');
    if (stockEl) stockEl.className = 'qo-stock ' + stock.cls;

    show('qo-product-card', 'flex');
    show('qo-qty-row', 'flex');
    var qty = $('qo-qty-val');
    if (qty) qty.value = 1;

    var add = $('qo-add-btn');
    if (add) add.disabled = variant.available === false || !variant.id;

    return true;
  }

  function clearSearch() {
    var input = $('qo-sku-input');
    if (input) input.value = '';
    hide('qo-input-clear');
    hide('qo-dropdown');
    clearSelection();
    if (input) input.focus();
  }

  function lineFromVariant(variant, qty) {
    return {
      variantId: Number(variant.id),
      sku: variant.displaySku || variant.sku,
      title: variant.title || '',
      variant: variant.variant || 'Default',
      brand: variant.brand || '',
      price: Number(variant.price) || 0,
      image: variant.image || '',
      qty: parseQty(qty)
    };
  }

  function validLine(line) {
    return Boolean(line && Number.isFinite(Number(line.variantId)) && Number(line.variantId) > 0 && line.qty > 0);
  }

  function addVariantToBasket(variant, qty) {
    if (!variant || !variant.id) {
      toast('Please select a product first.', 'err');
      return false;
    }
    if (variant.available === false) {
      toast('This SKU is unavailable in Shopify.', 'err');
      return false;
    }

    var line = lineFromVariant(variant, qty);
    if (!validLine(line)) {
      toast('This SKU cannot be added because its variant ID is missing.', 'err');
      return false;
    }

    var existing = state.basket.find(function (item) {
      return item.variantId === line.variantId;
    });

    if (existing) {
      existing.qty += line.qty;
      existing.price = line.price || existing.price;
      existing.title = line.title || existing.title;
      existing.sku = line.sku || existing.sku;
      existing.variant = line.variant || existing.variant;
    } else {
      state.basket.push(line);
    }

    renderBasket();
    saveDraft();
    toast('Added ' + line.sku + ' x ' + line.qty);
    return true;
  }

  function addSelectedToBasket(event) {
    if (event && event.preventDefault) event.preventDefault();

    if (!state.selected) {
      var input = $('qo-sku-input');
      var exact = input ? exactVariant(input.value) : null;
      if (exact) selectVariant(exact.sku);
    }

    var qty = $('qo-qty-val');
    var added = addVariantToBasket(state.selected, qty ? qty.value : 1);
    if (added) clearSearch();
  }

  function subtotal() {
    return state.basket.reduce(function (sum, line) {
      return line.price > 0 ? sum + line.price * line.qty : sum;
    }, 0);
  }

  function hasPendingPrices() {
    return state.basket.some(function (line) {
      return !line.price || line.price <= 0;
    });
  }

  function renderLines() {
    var empty = state.basket.length === 0;
    if (has('qo-empty-state')) $('qo-empty-state').style.display = empty ? 'block' : 'none';
    if (has('qo-lines-panel')) $('qo-lines-panel').style.display = empty ? 'none' : 'block';
    if (empty) {
      setHtml('qo-lines-tbody', '');
      setText('qo-lines-count', '0');
      setText('qo-lines-subtotal', money(0, GBP + '0.00'));
      return;
    }

    var rows = '';
    state.basket.forEach(function (line, index) {
      var thumb = line.image
        ? '<img class="qo-t-thumb" src="' + esc(line.image) + '" alt="" loading="lazy">'
        : '<div class="qo-t-thumb"></div>';
      rows += '<tr>';
      rows +=
        '<td><div class="qo-t-product">' +
        thumb +
        '<div><div class="qo-t-name">' +
        esc(line.title) +
        '</div><div class="qo-t-var">' +
        esc(line.variant) +
        '</div></div></div></td>';
      rows += '<td class="qo-t-sku">' + esc(line.sku) + '</td>';
      rows += '<td class="qo-t-price">' + money(line.price) + '</td>';
      rows +=
        '<td><div class="qo-t-qty">' +
        '<button type="button" class="qo-t-qb" data-qo-action="decrease" data-index="' +
        index +
        '">-</button>' +
        '<input type="number" min="1" class="qo-t-qn" value="' +
        line.qty +
        '" data-qo-action="set-qty" data-index="' +
        index +
        '">' +
        '<button type="button" class="qo-t-qb" data-qo-action="increase" data-index="' +
        index +
        '">+</button>' +
        '</div></td>';
      rows += '<td class="qo-t-line">' + money(line.price * line.qty) + '</td>';
      rows +=
        '<td><button type="button" class="qo-t-rm" data-qo-action="remove" data-index="' +
        index +
        '" title="Remove">x</button></td>';
      rows += '</tr>';
    });

    setHtml('qo-lines-tbody', rows);
    setText('qo-lines-count', state.basket.length);
    setText('qo-lines-subtotal', hasPendingPrices() ? 'Calculated in cart' : money(subtotal()));
  }

  function renderBasketSidebar() {
    var count = state.basket.reduce(function (sum, line) {
      return sum + line.qty;
    }, 0);
    var empty = state.basket.length === 0;
    var sub = subtotal();
    var vat = Math.round(sub * CONFIG.vatRate);
    var total = sub + vat;
    var pending = hasPendingPrices();

    setText('qo-basket-count', count + ' item' + (count === 1 ? '' : 's'));
    setText('qo-b-sub', pending ? 'Calculated in cart' : money(sub, GBP + '0.00'));
    setText('qo-b-vat', pending ? 'Calculated in cart' : money(vat, GBP + '0.00'));
    setText('qo-b-total', pending ? 'Calculated in cart' : money(total, GBP + '0.00'));

    var checkout = $('qo-checkout-btn');
    if (checkout) {
      checkout.disabled = empty;
      checkout.textContent = 'Add to Cart';
    }

    if (empty) {
      setHtml('qo-basket-lines', '<div class="qo-basket__empty-msg">No items yet</div>');
      return;
    }

    var html = '';
    state.basket.forEach(function (line) {
      html +=
        '<div class="qo-basket__line">' +
        '<div class="qo-basket__line-info">' +
        '<div class="qo-basket__line-title">' +
        esc(line.title) +
        '</div>' +
        '<div class="qo-basket__line-sub">' +
        esc(line.sku) +
        ' - ' +
        esc(line.variant) +
        ' - x' +
        line.qty +
        '</div>' +
        '</div>' +
        '<div class="qo-basket__line-price">' +
        money(line.price * line.qty) +
        '</div>' +
        '</div>';
    });
    setHtml('qo-basket-lines', html);
  }

  function renderBasket() {
    state.basket = state.basket.filter(validLine);
    renderLines();
    renderBasketSidebar();
  }

  function changeQty(index, delta) {
    var line = state.basket[index];
    if (!line) return;
    line.qty = Math.max(1, line.qty + delta);
    renderBasket();
    saveDraft();
  }

  function setQty(index, qty) {
    var line = state.basket[index];
    if (!line) return;
    line.qty = parseQty(qty);
    renderBasket();
    saveDraft();
  }

  function removeLine(index) {
    state.basket.splice(index, 1);
    renderBasket();
    saveDraft();
  }

  function clearBasket() {
    state.basket = [];
    renderBasket();
    clearDraft();
    toast('Order cleared');
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(CONFIG.draftKey, JSON.stringify(state.basket));
    } catch (error) {
      console.warn('[QO] draft save failed', error);
    }
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(CONFIG.draftKey);
    } catch (error) {
      console.warn('[QO] draft clear failed', error);
    }
  }

  function loadDraft() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(CONFIG.draftKey) || '[]');
      state.basket = (Array.isArray(saved) ? saved : [])
        .map(function (line) {
          return {
            variantId: Number(line.variantId),
            sku: line.sku || '',
            title: line.title || '',
            variant: line.variant || 'Default',
            brand: line.brand || '',
            price: Number(line.price) || 0,
            image: line.image || '',
            qty: parseQty(line.qty)
          };
        })
        .filter(validLine);
      if (state.basket.length) {
        renderBasket();
        show('qo-draft-notice', 'flex');
      }
    } catch (error) {
      clearDraft();
    }
  }

  function cartItems() {
    return state.basket.filter(validLine).map(function (line) {
      return {
        id: line.variantId,
        quantity: line.qty
      };
    });
  }

  async function addToCart(event) {
    if (event && event.preventDefault) event.preventDefault();

    var button = $('qo-checkout-btn');
    var oldText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Adding...';
    }

    try {
      var items = cartItems();
      if (!items.length) throw new Error('No valid lines to add.');

      if (CONFIG.clearCartBeforeAdd) {
        await fetchJson('/cart/clear.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await fetchJson('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ items: items })
      });

      clearDraft();
      window.location.href = CONFIG.cartDestination;
    } catch (error) {
      console.error('[QO] cart add failed', error);
      toast(error.message || 'Could not add items to cart.', 'err');
      if (button) {
        button.disabled = false;
        button.textContent = oldText || 'Add to Cart';
      }
    }
  }

  function parseCsv(textValue) {
    var rows = [];
    var row = [];
    var cell = '';
    var quoted = false;

    for (var i = 0; i < textValue.length; i += 1) {
      var ch = textValue[i];
      var next = textValue[i + 1];
      if (ch === '"' && quoted && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        row.push(cell.trim());
        cell = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i += 1;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function findCsvColumns(header) {
    var normal = header.map(normaliseText);
    var skuIndex = normal.findIndex(function (value) {
      return value === 'SKU' || value === 'STYLE' || value === 'CODE' || value.indexOf('SKU') !== -1;
    });
    var qtyIndex = normal.findIndex(function (value) {
      return value === 'QTY' || value === 'QUANTITY' || value.indexOf('QTY') !== -1;
    });
    return {
      sku: skuIndex >= 0 ? skuIndex : 0,
      qty: qtyIndex >= 0 ? qtyIndex : 1
    };
  }

  function renderCsvRows(rows) {
    var namedHeader = rows[0] && rows[0].some(function (cell) {
      var value = normaliseText(cell);
      return value === 'SKU' || value === 'QTY' || value === 'QUANTITY';
    });
    var cols = findCsvColumns(namedHeader ? rows[0] : ['sku', 'qty']);
    var dataRows = namedHeader ? rows.slice(1) : rows;

    state.csvLines = dataRows
      .map(function (row) {
        var sku = normaliseSku(row[cols.sku]);
        if (!sku) return null;
        return {
          sku: sku,
          qty: parseQty(row[cols.qty]),
          variant: exactVariant(sku)
        };
      })
      .filter(Boolean);

    var html = state.csvLines
      .map(function (line) {
        var variant = line.variant;
        return (
          '<tr>' +
          '<td>' +
          esc(variant ? variant.title : 'Not found') +
          '</td>' +
          '<td>' +
          esc(line.sku) +
          '</td>' +
          '<td>' +
          (variant ? money(variant.price) : '-') +
          '</td>' +
          '<td>' +
          line.qty +
          '</td>' +
          '<td>' +
          (variant ? money(variant.price * line.qty) : '-') +
          '</td>' +
          '<td>' +
          (variant ? 'Matched' : 'No match') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    setText('qo-csv-title', 'Parsed ' + state.csvLines.length + ' lines');
    setHtml('qo-csv-tbody', html);
    show('qo-csv-results', 'block');

    var missing = state.csvLines.filter(function (line) {
      return !line.variant;
    });
    if (missing.length) {
      setHtml('qo-csv-errors', missing.length + ' SKU(s) could not be matched. Search them manually first, then retry.');
      show('qo-csv-errors', 'block');
    } else {
      hide('qo-csv-errors');
    }
  }

  function handleCsvFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast('Please convert XLS/XLSX to CSV before uploading.', 'err');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      renderCsvRows(parseCsv(String(reader.result || '')));
    };
    reader.onerror = function () {
      toast('Could not read the CSV file.', 'err');
    };
    reader.readAsText(file);
  }

  function addCsvLines() {
    state.csvLines.forEach(function (line) {
      if (line.variant) addVariantToBasket(line.variant, line.qty);
    });
  }

  function renderSuggested() {
    var tbody = $('qo-suggested-tbody');
    if (!tbody) return;
    state.suggestedLines = state.variants
      .filter(function (variant) {
        return variant.available !== false;
      })
      .slice(0, 12)
      .map(function (variant) {
        return { variant: variant, qty: 1 };
      });

    tbody.innerHTML = state.suggestedLines
      .map(function (line, index) {
        return (
          '<tr>' +
          '<td>' +
          esc(line.variant.title) +
          '</td>' +
          '<td>' +
          esc(line.variant.displaySku || line.variant.sku) +
          '</td>' +
          '<td>' +
          money(line.variant.price) +
          '</td>' +
          '<td><input type="number" min="1" value="1" data-qo-suggested-qty="' +
          index +
          '"></td>' +
          '<td><button type="button" class="qo-inline-btn" data-qo-suggested-add="' +
          index +
          '">Add</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function addSuggested(index) {
    var line = state.suggestedLines[index];
    if (!line) return;
    var qty = document.querySelector('[data-qo-suggested-qty="' + index + '"]');
    addVariantToBasket(line.variant, qty ? qty.value : 1);
  }

  function addAllSuggested() {
    state.suggestedLines.forEach(function (line, index) {
      var qty = document.querySelector('[data-qo-suggested-qty="' + index + '"]');
      addVariantToBasket(line.variant, qty ? qty.value : 1);
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.qo-tab').forEach(function (tab) {
      var active = tab.getAttribute('data-tab') === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.qo-panel').forEach(function (panel) {
      var active = panel.id === 'qo-panel-' + name;
      panel.classList.toggle('is-active', active);
      panel.style.display = active ? 'block' : 'none';
    });
  }

  function bindEvents() {
    var input = $('qo-sku-input');
    if (input) {
      input.addEventListener('input', function () {
        var value = input.value.trim();
        show('qo-input-clear', value ? 'block' : 'none');
        clearSelection();
        clearTimeout(state.searchTimer);
        if (!value) {
          hide('qo-dropdown');
          return;
        }
        state.searchTimer = setTimeout(function () {
          runSearch(value);
        }, 180);
      });

      input.addEventListener('keydown', function (event) {
        var items = Array.prototype.slice.call(document.querySelectorAll('#qo-dropdown .qo-di'));
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          state.focusIndex = Math.min(state.focusIndex + 1, items.length - 1);
          items.forEach(function (item, index) {
            item.classList.toggle('focused', index === state.focusIndex);
          });
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          state.focusIndex = Math.max(state.focusIndex - 1, 0);
          items.forEach(function (item, index) {
            item.classList.toggle('focused', index === state.focusIndex);
          });
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (state.selected) addSelectedToBasket();
          else if (state.focusIndex >= 0 && items[state.focusIndex]) {
            selectVariant(items[state.focusIndex].getAttribute('data-sku'));
          } else {
            var exact = exactVariant(input.value);
            if (exact) selectVariant(exact.sku);
            else if (items.length === 1) selectVariant(items[0].getAttribute('data-sku'));
          }
        } else if (event.key === 'Escape') {
          hide('qo-dropdown');
        }
      });
    }

    var dropdown = $('qo-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', function (event) {
        var option = event.target.closest('.qo-di');
        if (!option) return;
        event.preventDefault();
        event.stopPropagation();
        selectVariant(option.getAttribute('data-sku'));
      });
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest('#qo-panel-sku .qo-search-panel')) hide('qo-dropdown');
    });

    var clear = $('qo-input-clear');
    if (clear) clear.addEventListener('click', clearSearch);

    var dec = $('qo-qty-dec');
    if (dec) {
      dec.addEventListener('click', function (event) {
        event.preventDefault();
        var qty = $('qo-qty-val');
        if (qty) qty.value = Math.max(1, parseQty(qty.value) - 1);
      });
    }

    var inc = $('qo-qty-inc');
    if (inc) {
      inc.addEventListener('click', function (event) {
        event.preventDefault();
        var qty = $('qo-qty-val');
        if (qty) qty.value = parseQty(qty.value) + 1;
      });
    }

    var add = $('qo-add-btn');
    if (add) add.addEventListener('click', addSelectedToBasket);

    document.addEventListener('click', function (event) {
      var action = event.target.closest('[data-qo-action]');
      if (action) {
        event.preventDefault();
        var index = parseInt(action.getAttribute('data-index'), 10);
        var name = action.getAttribute('data-qo-action');
        if (name === 'decrease') changeQty(index, -1);
        if (name === 'increase') changeQty(index, 1);
        if (name === 'remove') removeLine(index);
      }

      var suggested = event.target.closest('[data-qo-suggested-add]');
      if (suggested) {
        event.preventDefault();
        addSuggested(parseInt(suggested.getAttribute('data-qo-suggested-add'), 10));
      }
    });

    document.addEventListener('change', function (event) {
      if (event.target.matches('[data-qo-action="set-qty"]')) {
        setQty(parseInt(event.target.getAttribute('data-index'), 10), event.target.value);
      }
    });

    var checkout = $('qo-checkout-btn');
    if (checkout) checkout.addEventListener('click', addToCart);

    ['qo-clear-basket', 'qo-clear-lines'].forEach(function (id) {
      var button = $(id);
      if (button) button.addEventListener('click', clearBasket);
    });

    var draft = $('qo-draft-btn');
    if (draft) {
      draft.addEventListener('click', function (event) {
        event.preventDefault();
        saveDraft();
        toast('Draft saved');
      });
    }

    var dismiss = $('qo-draft-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        hide('qo-draft-notice');
      });
    }

    var browse = $('qo-browse-btn');
    var file = $('qo-file-input');
    if (browse && file) {
      browse.addEventListener('click', function (event) {
        event.preventDefault();
        file.click();
      });
      file.addEventListener('change', function () {
        handleCsvFile(file.files && file.files[0]);
      });
    }

    var csvClear = $('qo-csv-clear');
    if (csvClear) {
      csvClear.addEventListener('click', function () {
        state.csvLines = [];
        setHtml('qo-csv-tbody', '');
        hide('qo-csv-results');
        hide('qo-csv-errors');
        if (file) file.value = '';
      });
    }

    var csvAdd = $('qo-csv-add-all');
    if (csvAdd) csvAdd.addEventListener('click', addCsvLines);

    var suggestedAdd = $('qo-suggested-add-all');
    if (suggestedAdd) suggestedAdd.addEventListener('click', addAllSuggested);

    document.querySelectorAll('.qo-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchTab(tab.getAttribute('data-tab'));
      });
    });

    var rebuy = $('qo-rebuy-lookup');
    if (rebuy) {
      rebuy.addEventListener('click', function () {
        toast('Re-buy needs a Shopify customer-order endpoint before it can work here.', 'err');
      });
    }
  }

  function init() {
    if (!has('qo-app')) return;
    bindEvents();
    renderBasket();
    loadDraft();
    loadCollectionProducts();
    window.ParentlyQuickOrderDebug = {
      state: state,
      search: runSearch,
      selectVariant: selectVariant,
      addSelectedToBasket: addSelectedToBasket,
      addToCart: addToCart,
      clearBasket: clearBasket
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
