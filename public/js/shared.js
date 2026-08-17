// Shared helpers used by every page (catalog, product detail, cart).

// ---------- Entry gate (age + research-use certification, shown before anything else) ----------
function initEntryGate() {
  const gate = document.getElementById('entryGate');
  if (!gate) return;
  const alreadyAgreed = localStorage.getItem('ruo_gate_agreed') === 'yes';
  gate.style.display = alreadyAgreed ? 'none' : 'flex';

  const agreeBtn = document.getElementById('entryAgreeBtn');
  const exitBtn = document.getElementById('entryExitBtn');
  if (!agreeBtn || !exitBtn) return;

  agreeBtn.onclick = () => {
    localStorage.setItem('ruo_gate_agreed', 'yes');
    gate.style.display = 'none';
  };
  exitBtn.onclick = () => {
    window.location.href = 'https://www.google.com';
  };
}
initEntryGate();

function initHeaderScrollState() {
  const nav = document.querySelector('.nav-wrap');
  if (!nav) return;
  const sync = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 28);
  };
  sync();
  window.addEventListener('scroll', sync, { passive: true });
}
initHeaderScrollState();

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- Cart (persisted to localStorage so it survives navigation between pages) ----------
const CART_KEY = 'hp_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(sku, qty = 1) {
  const cart = getCart();
  cart[sku] = (cart[sku] || 0) + qty;
  saveCart(cart);
  setTimeout(() => showAddedToCartPopup(sku, qty), 0);
  return cart;
}

function removeFromCart(sku) {
  const cart = getCart();
  delete cart[sku];
  saveCart(cart);
  return cart;
}

// Sets an exact quantity; deletes the line if qty drops to 0 or below.
function setCartQty(sku, qty) {
  const cart = getCart();
  if (qty <= 0) {
    delete cart[sku];
  } else {
    cart[sku] = qty;
  }
  saveCart(cart);
  return cart;
}

function cartItemCount(cart) {
  return Object.values(cart).reduce((sum, q) => sum + q, 0);
}

// Updates the "Cart (N)" badge in the nav. Safe to call on pages without one.
function updateCartBadge() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const count = cartItemCount(getCart());
  el.textContent = count;
  el.setAttribute('aria-label', `${count} item${count === 1 ? '' : 's'}`);
}

function getCatalogProductBySku(sku) {
  const catalog = Array.isArray(window.siteCatalog) ? window.siteCatalog : [];
  return catalog.find(product => product.sku === sku) || null;
}

function showAddedToCartPopup(sku, qty = 1) {
  if (document.getElementById('entryGate')?.style.display === 'flex') return;
  const product = getCatalogProductBySku(sku);
  if (!product || !document.body) return;

  let overlay = document.getElementById('addToCartPopup');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'addToCartPopup';
    overlay.className = 'cart-popup-overlay';
    document.body.appendChild(overlay);
  }

  const cart = getCart();
  const subtotal = Object.keys(cart).reduce((sum, itemSku) => {
    const item = getCatalogProductBySku(itemSku);
    return item ? sum + item.price * cart[itemSku] : sum;
  }, 0);
  const count = cartItemCount(cart);
  const suggestions = (Array.isArray(window.siteCatalog) ? window.siteCatalog : [])
    .filter(item => item.sku !== sku && item.popular)
    .slice(0, 2);

  overlay.innerHTML = `
    <div class="cart-popup-card" role="dialog" aria-modal="true" aria-labelledby="cartPopupTitle">
      <button type="button" class="cart-popup-close" aria-label="Close">&times;</button>
      <div class="cart-popup-success"><span aria-hidden="true">OK</span><strong id="cartPopupTitle">Product successfully added to your cart.</strong></div>
      <div class="cart-popup-product">
        <div class="cart-popup-media photo sku-mockup">${productMockupImageHTML(product)}</div>
        <div class="cart-popup-copy">
          <strong>${escapeHTML(product.name)}</strong>
          <span>${escapeHTML(cleanVialSpec(product.spec))} &bull; Qty ${qty}</span>
          <em>Guaranteed 99% purity</em>
        </div>
        <div class="cart-popup-price">$${(product.price * qty).toFixed(2)}</div>
      </div>
      <div class="cart-popup-totals">
        <span>${count} item${count === 1 ? '' : 's'} in cart</span>
        <strong>Subtotal $${subtotal.toFixed(2)}</strong>
      </div>
      <div class="cart-popup-actions">
        <button type="button" class="cart-popup-checkout">Checkout</button>
        <button type="button" class="cart-popup-continue">Continue Shopping</button>
      </div>
      ${suggestions.length ? `
        <div class="cart-popup-suggestions">
          <div class="cart-popup-suggestions-title">Suggested research products</div>
          <div class="cart-popup-suggestion-grid">
            ${suggestions.map(item => `
              <a href="/product/${encodeURIComponent(item.slug)}" class="cart-popup-suggestion">
                <span class="cart-popup-suggestion-media photo sku-mockup">${productMockupImageHTML(item)}</span>
                <span><strong>${escapeHTML(item.name)}</strong><em>${escapeHTML(cleanVialSpec(item.spec))} &bull; $${item.price.toFixed(2)}</em></span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const close = () => {
    overlay.classList.remove('active');
    setTimeout(() => { overlay.hidden = true; }, 180);
  };

  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('active'));
  overlay.querySelector('.cart-popup-close').onclick = close;
  overlay.querySelector('.cart-popup-continue').onclick = close;
  overlay.querySelector('.cart-popup-checkout').onclick = () => {
    if (window.location.pathname.endsWith('/cart.html')) {
      close();
      document.getElementById('checkoutBtn')?.click();
      return;
    }
    window.location.href = '/cart.html?checkout=1';
  };
  overlay.onclick = event => {
    if (event.target === overlay) close();
  };
}



function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function cleanVialSpec(spec) {
  return String(spec || '').replace(/\s*x1\s*vial/i, '').replace(/\s+/g, ' ').trim();
}


const VIAL_LABEL_ALIASES = {
  'Retatrutide': 'RETA',
  'Ipamorelin': 'IPA',
  'Thymosin Alpha-1': 'TA-1',
  'Tesamorelin': 'TESA',
  'Tesamorelin + Ipamorelin': 'TESA + IPA',
  'PDA (Pentadeca-Arginate)': 'PDA',
  '5-Amino-1MQ': '5-A1MQ',
  'Kisspeptin-10': 'KISS-10',
  'CJC-1295 without DAC': 'CJC NO DAC',
  'CJC-1295 without DAC + Ipamorelin': 'CJC W/O DAC + IPA',
  'Cagrilintide + Semaglutide': 'CAGRI + SEMA',
  'Semax 10mg + Selank 10mg': 'SEMAX + SELANK',
  'Semax 5mg + Selank 5mg': 'SEMAX + SELANK',
  'BPC-157 + GHK-Cu + TB-500 + KPV Blend (Klow)': 'KLOW BLEND',
  'BPC-157 + GHK-Cu + TB-500 Blend (Glow)': 'GLOW BLEND',
  'BPC-157 + TB-500 Blend': 'BPC + TB-500',
  'Bacteriostatic Water': 'BAC WATER',
};

function productImageStyle(product) {
  if (!product || !product.image) return '';
  return ` style="--mockup-image:url('${escapeHTML(product.image)}')"`;
}

function productMockupImageHTML(product) {
  if (!product) return '';
  const name = escapeHTML(vialDisplayName(product.name || 'Research Peptide'));
  const label = `${product.name || 'Product'} Prismatic Peptides research vial`.trim();
  return `<img class="sku-mockup-img prismatic-vial-image" src="/images/product-mockups/prismatic-vial-template.png" alt="${escapeHTML(label)}" loading="lazy" decoding="async"><span class="prismatic-vial-label"><span class="vial-prism-mark" aria-hidden="true"></span><i>PRISMATIC PEPTIDES</i><strong>${name}</strong></span>`;
}
function vialDisplayName(name) {
  const cleanName = String(name || '').trim();
  return VIAL_LABEL_ALIASES[cleanName] || cleanName;
}
function vialLabelSizeClass(name) {
  const raw = String(vialDisplayName(name) || '').replace(/[^a-z0-9]/gi, '');
  if (raw.length >= 18) return 'vial-label-xlong';
  if (raw.length >= 11) return 'vial-label-long';
  if (raw.length >= 9) return 'vial-label-medium';
  return 'vial-label-short';
}

function vialLabelHTML(name, spec, className = '') {
  const productName = escapeHTML(vialDisplayName(name));
  const strength = escapeHTML(cleanVialSpec(spec));
  const sizeClass = vialLabelSizeClass(name);
  return `
    <div class="vial-label-overlay ${className} ${sizeClass}">
      <strong title="${productName}">${productName}</strong>
      <em>${strength}</em>
    </div>
  `;
}

const SEARCH_ALIASES = {
  'Retatrutide': ['reta', 'rt'],
  'Tirzepatide': ['tirz', 'tr'],
  'Semaglutide': ['sema', 'sem'],
  'Cagrilintide': ['cagri', 'cag'],
  'Cagrilintide + Semaglutide': ['cagri sema', 'cag sem', 'cagsem'],
  'CJC-1295 without DAC + Ipamorelin': ['cjc ipa', 'cjc ipamorelin', 'cjc w/o dac ipa', 'cjc no dac ipa'],
  'CJC-1295 without DAC': ['cjc no dac', 'cjc w/o dac'],
  'CJC-1295 with DAC': ['cjc dac'],
  'Bacteriostatic Water': ['bac water', 'bac', 'water'],
  'BPC-157': ['bpc'],
  'TB-500': ['tb500', 'tb'],
  'BPC-157 + TB-500 Blend': ['bpc tb', 'bpc tb500'],
  'BPC-157 + GHK-Cu + TB-500 Blend (Glow)': ['glow', 'glow blend'],
  'BPC-157 + GHK-Cu + TB-500 + KPV Blend (Klow)': ['klow', 'klow blend'],
  'GHK-Cu': ['ghk', 'ghk cu'],
  'MOTS-c': ['mots', 'motsc'],
  'NAD+': ['nad', 'nad plus'],
  'Melanotan II': ['mt2', 'mt-ii'],
  'Melanotan I': ['mt1', 'mt-i'],
};

function searchableValues(product) {
  return [
    product.name,
    product.spec,
    product.sku,
    product.category,
    product.group,
    product.description,
    ...(SEARCH_ALIASES[product.name] || []),
  ].filter(Boolean).map(value => String(value).toLowerCase());
}

// ---------- Shared product search (used by every public page) ----------
let productSearchCatalogPromise = null;

function productSearchResultHTML(p) {
  return `
    <a class="product-search-result" href="/product/${encodeURIComponent(p.slug)}">
      <div class="product-search-result-media photo sku-mockup">${productMockupImageHTML(p)}</div>
      <div class="product-search-result-copy">
        <span class="product-search-result-group">${escapeHTML(p.group || p.category)}</span>
        <strong>${escapeHTML(p.name)}</strong>
        <span>${escapeHTML(cleanVialSpec(p.spec))} | $${p.price.toFixed(2)}</span>
        <span class="product-search-result-proof">Guaranteed 99% purity</span>
      </div>
      <span class="product-search-result-arrow" aria-hidden="true">&rsaquo;</span>
    </a>
  `;
}

function ensureProductSearchOverlay() {
  let overlay = document.getElementById('productSearchOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'productSearchOverlay';
  overlay.className = 'product-search-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="product-search-dialog" role="dialog" aria-modal="true" aria-labelledby="productSearchTitle">
      <div class="product-search-header">
        <div>
          <div class="product-search-eyebrow">Catalog search</div>
          <h2 id="productSearchTitle">Find a research material</h2>
        </div>
        <button id="closeProductSearch" class="product-search-close" type="button" aria-label="Close search">&times;</button>
      </div>
      <label for="productSearchInput" class="sr-only">Search products</label>
      <div class="product-search-input-wrap">
        <span class="nav-search-icon" aria-hidden="true"></span>
        <input id="productSearchInput" type="search" placeholder="Search peptide name, category, or vial strength" autocomplete="off">
      </div>
      <div class="product-search-quick-chips" id="productSearchQuickChips" aria-label="Quick search categories"></div>
      <div id="productSearchStatus" class="product-search-status" aria-live="polite"></div>
      <div id="productSearchResults" class="product-search-results"></div>
    </section>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function getProductSearchCatalog() {
  if (Array.isArray(window.siteCatalog) && window.siteCatalog.length) {
    return Promise.resolve(window.siteCatalog);
  }
  if (!productSearchCatalogPromise) {
    productSearchCatalogPromise = api('/api/catalog').then(data => {
      window.siteCatalog = data.products;
      window.siteFees = { packagingFee: data.packagingFee, shippingFee: data.shippingFee, internationalShippingFee: data.internationalShippingFee || 35, shippingOptions: data.shippingOptions || [], orderFeeRate: data.orderFeeRate || 0, altPaymentDiscountRate: data.altPaymentDiscountRate || 0 };
      return data.products;
    });
  }
  return productSearchCatalogPromise;
}

function initProductSearch() {
  const openButton = document.getElementById('openProductSearch');
  if (!openButton || openButton.dataset.searchWired === 'yes') return;
  openButton.dataset.searchWired = 'yes';

  const overlay = ensureProductSearchOverlay();
  const closeButton = document.getElementById('closeProductSearch');
  const input = document.getElementById('productSearchInput');
  const results = document.getElementById('productSearchResults');
  const status = document.getElementById('productSearchStatus');
  const quickChips = document.getElementById('productSearchQuickChips');

  const renderQuickChips = async () => {
    const catalog = await getProductSearchCatalog();
    const groups = [...new Set(catalog.map(p => p.group || p.category).filter(Boolean))].slice(0, 6);
    if (quickChips) {
      quickChips.innerHTML = groups.map(group => `<button type="button" data-query="${escapeHTML(group)}">${escapeHTML(group)}</button>`).join('');
      quickChips.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => { input.value = btn.dataset.query; renderResults(); input.focus(); };
      });
    }
  };

  const renderResults = async () => {
    const catalog = await getProductSearchCatalog();
    const query = input.value.trim().toLowerCase();
    const matches = query
      ? catalog.filter(p => searchableValues(p).some(value => value.includes(query)))
      : catalog.filter(p => p.popular).slice(0, 8);

    status.textContent = query
      ? `${matches.length} result${matches.length === 1 ? '' : 's'}`
      : 'Popular research products';
    results.innerHTML = matches.length
      ? matches.slice(0, 24).map(productSearchResultHTML).join('')
      : '<div class="product-search-empty"><strong>No products found</strong><span>Try another compound, category, or specification.</span></div>';
  };

  const openSearch = () => {
    overlay.hidden = false;
    document.body.classList.add('search-open');
    input.value = '';
    status.textContent = 'Loading products';
    results.innerHTML = '';
    renderQuickChips();
    renderResults();
    requestAnimationFrame(() => input.focus());
  };

  const closeSearch = () => {
    overlay.hidden = true;
    document.body.classList.remove('search-open');
    openButton.focus();
  };

  openButton.addEventListener('click', openSearch);
  closeButton.addEventListener('click', closeSearch);
  input.addEventListener('input', renderResults);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeSearch();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) closeSearch();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initProductSearch();
  updateCartBadge();
});
function cartSubtotal() {
  const cart = getCart();
  return Object.keys(cart).filter(s => cart[s] > 0).reduce((sum, sku) => {
    const p = window.siteCatalog.find(x => x.sku === sku);
    return p ? sum + p.price * cart[sku] : sum;
  }, 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function selectedShippingMethod() {
  const checked = document.querySelector('input[name="shippingMethod"]:checked');
  return checked && checked.value === 'international' ? 'international' : 'domestic';
}

function selectedShippingFee() {
  const fees = window.siteFees || {};
  return selectedShippingMethod() === 'international'
    ? Number(fees.internationalShippingFee || 35)
    : Number(fees.shippingFee || 0);
}

function selectedShippingLabel() {
  return selectedShippingMethod() === 'international' ? 'International shipping' : 'U.S. shipping';
}

function selectedCountryCode() {
  return (document.getElementById('buyerCountry')?.value || 'US').trim().toUpperCase();
}

function selectedCountryName() {
  const select = document.getElementById('buyerCountry');
  return select && select.selectedOptions && select.selectedOptions[0]
    ? select.selectedOptions[0].textContent.trim()
    : selectedCountryCode();
}

function updateShippingCountryNote() {
  const note = document.getElementById('shippingCountryNote');
  if (!note) return;
  const country = selectedCountryName() || 'United States';
  const method = selectedShippingMethod();
  note.textContent = method === 'international'
    ? `International shipping selected for ${country}. Please confirm this is the correct destination country before payment.`
    : `U.S. shipping selected. Use International shipping for any destination outside the U.S.`;
}

// ---------- Checkout modal (lives on the cart page only) ----------

let appliedDiscount = null; // { code, percentOff } | null

function renderCheckoutSummary() {
  const cart = getCart();
  const summaryEl = document.getElementById('modalOrderSummary');
  if (!summaryEl) return;

  const skus = Object.keys(cart).filter(s => cart[s] > 0);
  const subtotal = round2(cartSubtotal());
  const shippingFee = selectedShippingFee();
  const discountAmount = appliedDiscount ? round2(subtotal * appliedDiscount.percentOff / 100) : 0;
  const feeBase = Math.max(0, subtotal - discountAmount + shippingFee);
  const total = round2(feeBase);

  const lines = skus.map(sku => {
    const p = window.siteCatalog.find(x => x.sku === sku);
    if (!p) return '';
    return `<div class="cart-row"><span>${escapeHTML(p.name)} x${cart[sku]}</span><span>$${(p.price * cart[sku]).toFixed(2)}</span></div>`;
  }).join('');

  const breakdown = [
    `<div class="cart-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>`,
    appliedDiscount ? `<div class="cart-row"><span>Discount (${appliedDiscount.code})</span><span>-$${discountAmount.toFixed(2)}</span></div>` : '',
    `<div class="cart-row"><span>${selectedShippingLabel()}</span><span>$${shippingFee.toFixed(2)}</span></div>`,
    `<div class="order-summary-total cart-row"><span>Total</span><span>$${total.toFixed(2)}</span></div>`,
  ].join('');

  summaryEl.innerHTML = lines + '<div class="order-summary-divider"></div>' + breakdown;
}

function checkoutPayloadFromForm() {
  const cart = getCart();
  const activeSkus = new Set((window.siteCatalog || []).map(p => p.sku));
  const items = Object.keys(cart)
    .filter(sku => cart[sku] > 0 && (!activeSkus.size || activeSkus.has(sku)))
    .map(sku => ({ sku, quantity: cart[sku] }));
  return {
    items,
    buyer: {
      name: document.getElementById('buyerName').value.trim(),
      email: document.getElementById('buyerEmail').value.trim(),
      address1: document.getElementById('buyerAddress1').value.trim(),
      address2: document.getElementById('buyerAddress2').value.trim(),
      city: document.getElementById('buyerCity').value.trim(),
      state: document.getElementById('buyerState').value.trim(),
      zip: document.getElementById('buyerZip').value.trim(),
      country: selectedCountryCode(),
    },
    certified: document.getElementById('checkoutCertify').checked,
    shippingMethod: selectedShippingMethod(),
    paymentPolicyAccepted: document.getElementById('paymentPolicyConfirm')?.checked === true,
    discountCode: appliedDiscount ? appliedDiscount.code : null,
    paymentMethod: 'crypto',
  };
}

function validateCheckoutPayload(payload, msgEl) {
  if (payload.items.length === 0) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Cart is empty.';
    return false;
  }
  if (!payload.buyer.name || !payload.buyer.email || !payload.buyer.address1 || !payload.buyer.city || !payload.buyer.state || !payload.buyer.zip || !payload.buyer.country) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Name, email, destination country, and full shipping address are required before payment.';
    return false;
  }
  if (!/^[A-Z]{2}$/.test(payload.buyer.country)) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Select a valid destination country from the list.';
    return false;
  }
  if (payload.shippingMethod === 'domestic' && payload.buyer.country !== 'US') {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Choose International shipping for destinations outside the U.S.';
    return false;
  }
  if (payload.shippingMethod === 'international' && payload.buyer.country === 'US') {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'International shipping is for destinations outside the U.S. Change the country or select U.S. shipping.';
    return false;
  }
  if (!payload.certified) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'You must certify research/business use before payment.';
    return false;
  }
  if (!payload.paymentPolicyAccepted) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Confirm the exact-payment and 72-hour mismatch policy before payment.';
    return false;
  }
  msgEl.textContent = '';
  return true;
}

function clearCartAfterCheckout() {
  saveCart({});
  appliedDiscount = null;
  updateCartBadge();
  document.dispatchEvent(new CustomEvent('cart:updated'));
  document.getElementById('checkoutForm').reset();
}

function openCheckoutModal() {
  appliedDiscount = null;
  lastCryptoOrder = null;
  cryptoChoiceOpen = false;
  const promoInput = document.getElementById('promoInput');
  const promoMsg = document.getElementById('promoMsg');
  const checkoutMsg = document.getElementById('checkoutMsg');
  const cryptoMsg = document.getElementById('cryptoMsg');
  const cryptoDetails = document.getElementById('cryptoPaymentDetails');
  if (promoInput) promoInput.value = '';
  if (promoMsg) promoMsg.textContent = '';
  if (checkoutMsg) checkoutMsg.textContent = '';
  if (cryptoMsg) cryptoMsg.textContent = '';
  const manualDetails = document.getElementById('manualPaymentDetails');
  const cryptoChoice = document.getElementById('cryptoChoiceDetails');
  if (manualDetails) manualDetails.style.display = 'none';
  if (cryptoChoice) cryptoChoice.style.display = 'none';
  if (cryptoDetails) cryptoDetails.style.display = 'none';
  const cryptoButton = document.getElementById('cryptoCheckoutBtn');
  if (cryptoButton) cryptoButton.querySelector('strong').innerHTML = 'Crypto <em>5% off</em>';
  updateShippingCountryNote();
  renderCheckoutSummary();
  renderCryptoPricePreview();
  document.body.classList.add('checkout-modal-open');
  document.getElementById('checkoutModal').style.display = 'flex';

}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').style.display = 'none';
  document.body.classList.remove('checkout-modal-open');
}

async function applyPromoCode() {
  const input = document.getElementById('promoInput');
  const msgEl = document.getElementById('promoMsg');
  const code = input.value.trim();
  if (!code) {
    appliedDiscount = null;
    msgEl.textContent = '';
    renderCheckoutSummary();
    return;
  }
  try {
    const result = await api(`/api/discount-code?code=${encodeURIComponent(code)}`);
    if (result.valid) {
      appliedDiscount = { code: result.code, percentOff: result.percentOff };
      msgEl.style.color = 'var(--success)';
      msgEl.textContent = `${result.percentOff}% off applied.`;
    } else {
      appliedDiscount = null;
      msgEl.style.color = 'var(--danger)';
      msgEl.textContent = 'Invalid code.';
    }
  } catch {
    appliedDiscount = null;
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Could not check that code, try again.';
  }
  renderCheckoutSummary();
}

let lastCryptoOrder = null; // { id, email } | null
let cryptoChoiceOpen = false;

function renderCryptoPricePreview() {
  const previewEl = document.getElementById('cryptoPricePreview');
  if (!previewEl) return;
  if (appliedDiscount) {
    previewEl.textContent = 'Crypto discount cannot be combined with a promo code.';
    return;
  }
  const subtotal = round2(cartSubtotal());
  const rate = (window.siteFees && window.siteFees.altPaymentDiscountRate) || 0;
  const shippingFee = selectedShippingFee();
  const discount = round2(subtotal * rate);
  const feeBase = Math.max(0, subtotal - discount + shippingFee);
  const total = round2(feeBase);
  previewEl.textContent = rate ? `Crypto price: $${total.toFixed(2)} (saves $${discount.toFixed(2)})` : '';
}

function showManualPaymentShell(title, summary) {
  const details = document.getElementById('manualPaymentDetails');
  const titleEl = document.getElementById('manualPaymentTitle');
  const summaryEl = document.getElementById('manualPaymentSummary');
  if (details) details.style.display = 'block';
  if (titleEl) titleEl.textContent = title;
  if (summaryEl) summaryEl.innerHTML = summary;
}

async function submitCryptoCheckout() {
  const msgEl = document.getElementById('checkoutMsg');
  const btn = document.getElementById('cryptoCheckoutBtn');
  const choice = document.getElementById('cryptoChoiceDetails');

  if (appliedDiscount) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Crypto discount cannot be combined with promo codes. Remove the promo code to use crypto checkout.';
    return;
  }

  if (!cryptoChoiceOpen) {
    cryptoChoiceOpen = true;
    if (choice) choice.style.display = 'block';
    showManualPaymentShell('Crypto payment', 'Choose BTC or USDC, then submit the order to get the exact payment total and address. Crypto discount cannot be combined with promo codes.');
    btn.querySelector('strong').innerHTML = 'Submit Crypto Order <em>5% off</em>';
    return;
  }

  const asset = document.getElementById('cryptoAssetSelect').value;
  const payload = checkoutPayloadFromForm();
  payload.paymentMethod = 'crypto';
  payload.cryptoAsset = asset;

  if (!validateCheckoutPayload(payload, msgEl)) return;

  const buyerEmail = payload.buyer.email;
  btn.disabled = true;
  try {
    const result = await api('/api/checkout', { method: 'POST', body: payload });
    msgEl.style.color = 'var(--success)';
    msgEl.textContent = 'Order submitted. Please send the exact total shown below for manual verification.';
    lastCryptoOrder = { id: result.orderId, email: buyerEmail };

    showManualPaymentShell('Crypto payment instructions', `<strong>Order #${result.orderId}</strong><br>Exact total due: <strong>$${result.total.toFixed(2)}</strong><br><span class="hint">Unique matching cents: $${Number(result.paymentMatchAdjustment || 0).toFixed(2)}</span><br><span class="hint">If the amount sent is incorrect, we will email you for confirmation. If no response is received within 72 hours, fulfillment will not proceed and the payment will not be refunded except where required by law.</span>`);

    if (result.crypto) {
      document.getElementById('cryptoAddressText').textContent = result.crypto.address;
      document.getElementById('cryptoNetworkNote').textContent = `${result.crypto.network}. Reference: ${result.crypto.reference}`;
      document.getElementById('cryptoPaymentDetails').style.display = 'block';
    }
    clearCartAfterCheckout();
  } catch (err) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function confirmCryptoPayment() {
  const msgEl = document.getElementById('cryptoConfirmMsg');
  const btn = document.getElementById('cryptoConfirmBtn');
  const txid = document.getElementById('cryptoTxidInput').value.trim();

  if (!lastCryptoOrder) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Submit your order first.';
    return;
  }
  if (!txid) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = 'Paste your transaction ID first.';
    return;
  }

  btn.disabled = true;
  try {
    const result = await api(`/api/orders/${lastCryptoOrder.id}/confirm-crypto`, {
      method: 'POST',
      body: { email: lastCryptoOrder.email, txid },
    });
    msgEl.style.color = 'var(--success)';
    msgEl.textContent = result.message;
  } catch (err) {
    msgEl.style.color = 'var(--danger)';
    msgEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

function wireCheckout() {
  document.getElementById('checkoutBtn').addEventListener('click', () => {
    const cartMsg = document.getElementById('cartMsg');
    const skus = Object.keys(getCart()).filter(s => getCart()[s] > 0);
    if (skus.length === 0) {
      cartMsg.style.color = 'var(--danger)';
      cartMsg.textContent = 'Cart is empty.';
      return;
    }
    cartMsg.textContent = '';
    openCheckoutModal();
  });

  document.getElementById('checkoutCloseBtn').addEventListener('click', closeCheckoutModal);
  document.getElementById('checkoutModal').addEventListener('click', (e) => {
    if (e.target.id === 'checkoutModal') closeCheckoutModal();
  });


  document.querySelectorAll('input[name="shippingMethod"]').forEach(input => {
    input.addEventListener('change', () => {
      updateShippingCountryNote();
      renderCheckoutSummary();
      renderCryptoPricePreview();
    });
  });

  const buyerCountryInput = document.getElementById('buyerCountry');
  if (buyerCountryInput) buyerCountryInput.addEventListener('change', updateShippingCountryNote);

  const promoApplyBtn = document.getElementById('promoApplyBtn');
  if (promoApplyBtn) {
    promoApplyBtn.addEventListener('click', applyPromoCode);
    document.getElementById('promoInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
    });
  }

  const cryptoBtn = document.getElementById('cryptoCheckoutBtn');
  if (cryptoBtn) cryptoBtn.addEventListener('click', submitCryptoCheckout);

  const cryptoConfirmBtn = document.getElementById('cryptoConfirmBtn');
  if (cryptoConfirmBtn) cryptoConfirmBtn.addEventListener('click', confirmCryptoPayment);

  const cryptoAssetSelect = document.getElementById('cryptoAssetSelect');
  if (cryptoAssetSelect) cryptoAssetSelect.addEventListener('change', renderCryptoPricePreview);

  document.getElementById('checkoutForm').addEventListener('submit', (e) => {
    e.preventDefault();
  });
}







