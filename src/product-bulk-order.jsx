import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';

const LOW_STOCK_THRESHOLD = 5;

// Inline trash SVG matching the theme's icon-remove.svg
const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width="16"
    height="16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M14 3h-3.53a3.07 3.07 0 0 0-.6-1.65C9.44.82 8.8.5 8 .5s-1.44.32-1.87.85A3.06 3.06 0 0 0 5.53 3H2a.5.5 0 0 0 0 1h1.25v10c0 .28.22.5.5.5h8.5a.5.5 0 0 0 .5-.5V4H14a.5.5 0 0 0 0-1M6.91 1.98c.23-.29.58-.48 1.09-.48s.85.19 1.09.48c.2.24.3.6.36 1.02h-2.9c.05-.42.17-.78.36-1.02m4.84 11.52h-7.5V4h7.5z"
    />
    <path
      fill="currentColor"
      d="M6.55 5.25a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5m2.9 0a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5"
    />
  </svg>
);

// Map common colour names to hex values for swatches
const COLOUR_SWATCH_MAP = {
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

function getSwatchColor(colourName) {
  return COLOUR_SWATCH_MAP[colourName?.toLowerCase().trim()] ?? '#888888';
}

function formatMoney(pence) {
  if (!pence && pence !== 0) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

function getStockStatus(variant) {
  if (!variant || !variant.available) return 'out';
  const qty = variant.inventory_quantity;
  if (qty === undefined || qty === null) return 'in'; // tracking off → assume in stock
  if (qty <= 0) return 'out';
  if (qty <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

function StockBadge({ variant }) {
  const status = getStockStatus(variant);
  const qty = variant?.inventory_quantity;
  const label =
    status === 'out'
      ? 'Out of stock'
      : qty !== undefined && qty !== null
      ? `${qty} in stock`
      : 'In stock';
  return <span className={`pbo-stock pbo-stock--${status}`}>{label}</span>;
}

function QuantityStepper({ value, onChange, disabled }) {
  return (
    <div className={`pbo-stepper${disabled ? ' pbo-stepper--disabled' : ''}`}>
      <button
        type="button"
        className="pbo-stepper__btn"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value === 0}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        className="pbo-stepper__input"
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
        disabled={disabled}
        aria-label="Quantity"
      />
      <button
        type="button"
        className="pbo-stepper__btn"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function ProductBulkOrder({ product }) {
  const options = product.options ?? [];

  // Detect which option position holds colour, size, and length by name
  const colourOptionIndex = options.findIndex((o) => /colou?r/i.test(o));
  const sizeOptionIndex   = options.findIndex((o) => /size/i.test(o));
  const lengthOptionIndex = options.findIndex((o) => /length/i.test(o));

  const getOptionValue = (variant, index) => {
    if (index === 0) return variant.option1;
    if (index === 1) return variant.option2;
    if (index === 2) return variant.option3;
    return '';
  };

  // Derive unique values for each semantic option
  const colours = useMemo(
    () =>
      colourOptionIndex >= 0
        ? [...new Set(product.variants.map((v) => getOptionValue(v, colourOptionIndex)))].filter(Boolean)
        : [],
    [product, colourOptionIndex]
  );
  const sizes = useMemo(
    () =>
      sizeOptionIndex >= 0
        ? [...new Set(product.variants.map((v) => getOptionValue(v, sizeOptionIndex)))].filter(Boolean)
        : [],
    [product, sizeOptionIndex]
  );
  const lengths = useMemo(
    () =>
      lengthOptionIndex >= 0
        ? [...new Set(product.variants.map((v) => getOptionValue(v, lengthOptionIndex)))].filter(Boolean)
        : [],
    [product, lengthOptionIndex]
  );

  const hasColours = colours.length > 1;
  const hasLengths = lengths.length > 0;
  const displayColumns = hasLengths ? lengths : [''];

  const [selectedColour, setSelectedColour] = useState(colours[0] ?? '');
  const [quantities, setQuantities] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState(null); // null | 'success' | 'error'

  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const stickyHeaderTableRef = useRef(null);
  const bodyTableRef = useRef(null);

  // Sync horizontal scroll between the sticky header and the body
  useEffect(() => {
    const headerEl = headerScrollRef.current;
    const bodyEl = bodyScrollRef.current;
    if (!headerEl || !bodyEl) return;
    let syncing = false;
    const onBodyScroll = () => {
      if (syncing) return;
      syncing = true;
      headerEl.scrollLeft = bodyEl.scrollLeft;
      syncing = false;
    };
    const onHeaderScroll = () => {
      if (syncing) return;
      syncing = true;
      bodyEl.scrollLeft = headerEl.scrollLeft;
      syncing = false;
    };
    bodyEl.addEventListener('scroll', onBodyScroll, { passive: true });
    headerEl.addEventListener('scroll', onHeaderScroll, { passive: true });
    return () => {
      bodyEl.removeEventListener('scroll', onBodyScroll);
      headerEl.removeEventListener('scroll', onHeaderScroll);
    };
  }, []);

  // Sync column widths from the body table to the sticky header table
  useLayoutEffect(() => {
    const sync = () => {
      const bodyTable = bodyTableRef.current;
      const headerTable = stickyHeaderTableRef.current;
      if (!bodyTable || !headerTable) return;
      const firstRow = bodyTable.querySelector('tbody tr');
      if (!firstRow) return;
      const bodyCells = firstRow.querySelectorAll('td');
      const headerCells = headerTable.querySelectorAll('th');
      bodyCells.forEach((td, i) => {
        if (headerCells[i]) {
          const w = td.getBoundingClientRect().width;
          headerCells[i].style.width = `${w}px`;
          headerCells[i].style.minWidth = `${w}px`;
        }
      });
      headerTable.style.width = `${bodyTable.getBoundingClientRect().width}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (bodyTableRef.current) ro.observe(bodyTableRef.current);
    return () => ro.disconnect();
  }, [sizes, displayColumns, selectedColour]);

  // Build variant lookup: "option1|option2|option3" → variant
  const variantMap = useMemo(() => {
    const map = {};
    product.variants.forEach((v) => {
      map[`${v.option1 ?? ''}|${v.option2 ?? ''}|${v.option3 ?? ''}`] = v;
    });
    return map;
  }, [product]);

  const getVariant = useCallback(
    (colour, size, length = '') => {
      const opts = ['', '', ''];
      if (colourOptionIndex >= 0) opts[colourOptionIndex] = colour;
      if (sizeOptionIndex   >= 0) opts[sizeOptionIndex]   = size;
      if (lengthOptionIndex >= 0) opts[lengthOptionIndex] = length;
      return variantMap[`${opts[0]}|${opts[1]}|${opts[2]}`];
    },
    [variantMap, colourOptionIndex, sizeOptionIndex, lengthOptionIndex]
  );

  const getQty = (variantId) => quantities[variantId] ?? 0;

  const setQty = useCallback((variantId, qty) => {
    setQuantities((prev) => ({ ...prev, [variantId]: qty }));
    setAddStatus(null);
  }, []);

  // Row subtotal (across all lengths for a given size)
  const rowTotal = (size) =>
    displayColumns.reduce((sum, len) => {
      const v = getVariant(selectedColour, size, len);
      return v ? sum + getQty(v.id) * v.price : sum;
    }, 0);

  // Column item count (across all sizes for a given length)
  const colItemCount = (len) =>
    sizes.reduce((sum, size) => {
      const v = getVariant(selectedColour, size, len);
      return v ? sum + getQty(v.id) : sum;
    }, 0);

  const grandTotal = useMemo(
    () =>
      Object.entries(quantities).reduce((sum, [id, qty]) => {
        const v = product.variants.find((v) => v.id === parseInt(id, 10));
        return v ? sum + qty * v.price : sum;
      }, 0),
    [quantities, product]
  );

  const totalItems = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + q, 0),
    [quantities]
  );

  const removeAll = () => {
    setQuantities({});
    setAddStatus(null);
  };

  const addToCart = async () => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ id: parseInt(id, 10), quantity: qty }));

    if (items.length === 0) return;

    setIsAdding(true);
    setAddStatus(null);

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.description ?? 'Failed to add to cart');
      }

      setAddStatus('success');

      // Notify theme cart drawer/bubble if available
      document.dispatchEvent(new CustomEvent('cart:refresh'));
      document.dispatchEvent(new CustomEvent('dispatch:cart-update'));
    } catch {
      setAddStatus('error');
    } finally {
      setIsAdding(false);
    }
  };

  const colourLabel = colourOptionIndex >= 0 ? options[colourOptionIndex] : 'Colour';
  const sizeLabel   = sizeOptionIndex   >= 0 ? options[sizeOptionIndex]   : 'Size';

  return (
    <div className="pbo">
      {/* Colour selector */}
      {hasColours && (
        <div className="pbo__colour-selector">
          <h2 className="pbo__colour-heading">Choose {colourLabel}</h2>
          <div className="pbo__colour-options" role="radiogroup" aria-label={`Choose ${colourLabel}`}>
            {colours.map((colour) => (
              <button
                key={colour}
                type="button"
                role="radio"
                aria-checked={selectedColour === colour}
                className={`pbo__colour-btn${selectedColour === colour ? ' pbo__colour-btn--active' : ''}`}
                onClick={() => {
                  setSelectedColour(colour);
                  setAddStatus(null);
                }}
              >
                <span
                  className="pbo__colour-swatch"
                  style={{ backgroundColor: getSwatchColor(colour) }}
                  aria-hidden="true"
                />
                <span className="pbo__colour-name">{colour}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky header – sits outside the overflow-x wrapper so position:sticky resolves to the page */}
      <div className="pbo__table-header-scroll" ref={headerScrollRef}>
        <table className="pbo__table" ref={stickyHeaderTableRef} aria-hidden="true">
          <thead>
            <tr>
              <th className="pbo__th pbo__th--size" scope="col">
                {sizeLabel.toUpperCase()}
              </th>
              {displayColumns.map((len) => (
                <th key={len || 'qty'} className="pbo__th" scope="col">
                  {len ? len.toUpperCase() : 'QTY'}
                </th>
              ))}
              <th className="pbo__th pbo__th--total" scope="col">
                TOTAL
              </th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Matrix table body */}
      <div className="pbo__table-wrapper" ref={bodyScrollRef}>
        <table className="pbo__table" ref={bodyTableRef}>
          {/* Visually hidden thead keeps screen-reader header/cell associations */}
          <thead className="pbo__thead--sr-only">
            <tr>
              <th scope="col">{sizeLabel.toUpperCase()}</th>
              {displayColumns.map((len) => (
                <th key={len || 'qty'} scope="col">{len ? len.toUpperCase() : 'QTY'}</th>
              ))}
              <th scope="col">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size} className="pbo__row">
                <td className="pbo__size-cell" headers="col-size">
                  {size}
                </td>
                {displayColumns.map((len) => {
                  const variant = getVariant(selectedColour, size, len);
                  const qty = variant ? getQty(variant.id) : 0;
                  const isOOS = !variant || !variant.available;

                  return (
                    <td key={len || 'qty'} className="pbo__cell">
                      <div className="pbo__cell-inner">
                        <div className="pbo__stepper-row">
                          <QuantityStepper
                            value={qty}
                            onChange={(val) => variant && setQty(variant.id, val)}
                            disabled={isOOS}
                          />
                          {qty > 0 && !isOOS && (
                            <button
                              type="button"
                              className="pbo__delete-btn"
                              onClick={() => variant && setQty(variant.id, 0)}
                              aria-label={`Remove ${size} ${len}`}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                        {variant ? (
                          <div className="pbo__price">{formatMoney(variant.price)} Each</div>
                        ) : (
                          <div className="pbo__price pbo__price--na">—</div>
                        )}
                        {variant ? (
                          <StockBadge variant={variant} />
                        ) : (
                          <span className="pbo-stock pbo-stock--out">Unavailable</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="pbo__row-total">
                  {rowTotal(size) > 0 ? formatMoney(rowTotal(size)) : <span className="pbo__row-total--empty">£0.00</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="pbo__footer">
        <div className="pbo__footer-left">
          {addStatus === 'success' ? (
            <a href="/cart" className="pbo__cart-btn">
              View cart
            </a>
          ) : (
            <button
              type="button"
              className="pbo__cart-btn"
              onClick={addToCart}
              disabled={isAdding || totalItems === 0}
            >
              {isAdding ? 'Adding…' : 'Add to Cart'}
            </button>
          )}

          {addStatus === 'error' && (
            <span className="pbo__status pbo__status--error">
              Something went wrong. Please try again.
            </span>
          )}

          {totalItems > 0 && (
            <button type="button" className="pbo__remove-all" onClick={removeAll}>
              <TrashIcon />
              <span>Remove all</span>
            </button>
          )}
        </div>

        <div className="pbo__footer-totals">
          {displayColumns.map((len) => (
            <div key={len || 'qty'} className="pbo__col-total">
              <span className="pbo__col-total-value">{colItemCount(len)}</span>
              <span className="pbo__col-total-label">Total Items</span>
            </div>
          ))}
          <div className="pbo__subtotal">
            <span className="pbo__subtotal-value">{formatMoney(grandTotal)}</span>
            <span className="pbo__subtotal-label">Product Subtotal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mount every instance on the page
document.querySelectorAll('[data-product-bulk-order]').forEach((el) => {
  try {
    const productData = JSON.parse(el.dataset.product ?? '{}');
    if (!Array.isArray(productData.variants) || productData.variants.length === 0) return;
    createRoot(el).render(<ProductBulkOrder product={productData} />);
  } catch (e) {
    console.error('[ProductBulkOrder] Failed to parse product data:', e);
  }
});
