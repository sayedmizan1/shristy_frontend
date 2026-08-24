const appRoot = document.querySelector("#app");
const portalRoot = document.querySelector("#portal");
const fallbackHeroImage = "/assets/hero.jpg";
const fallbackProductImage = "/assets/hero.jpg";
const OWNER_ROUTE = "/owner";

const state = {
  storefront: {
    settings: { storeName: "Shrishti Organic", announcement: "", shippingFeePaise: 0, freeShippingThresholdPaise: 0 },
    banners: [],
    categories: [],
    products: [],
    paymentMode: "demo"
  },
  catalog: [],
  filters: { query: "", category: "", sort: "newest" },
  cart: readStoredCart(),
  couponCode: "",
  quote: null,
  quoteError: "",
  customer: null,
  customerCsrfToken: readCookie("customer_csrf_token"),
  accountProfileRequestId: 0,
  admin: null,
  csrfToken: readCookie("csrf_token"),
  adminTab: "dashboard",
  adminData: {},
  adminLoading: false
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

bootstrap();

window.addEventListener("hashchange", async () => {
  closePortal();
  if (isAdminRoute() && !state.admin) {
    await restoreAdminSession();
  }
  renderRoute();
  if (isAdminRoute() && state.admin) {
    loadAdminTab(state.adminTab);
  }
});

appRoot.addEventListener("click", handleAppClick);
portalRoot.addEventListener("click", handlePortalClick);

async function bootstrap() {
  try {
    await loadStoreData();
  } catch (error) {
    showToast(error.message, true);
  }

  await restoreCustomerSession();

  if (isAdminRoute()) {
    await restoreAdminSession();
  }

  renderRoute();
  if (isAdminRoute() && state.admin) {
    await loadAdminTab(state.adminTab);
  }
}

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (path.startsWith("/api/admin/") && !["GET", "HEAD", "OPTIONS"].includes(method) && state.csrfToken) {
    headers.set("X-CSRF-Token", state.csrfToken);
  }
  if ((path.startsWith("/api/checkout/") || path === "/api/account/logout") && !["GET", "HEAD", "OPTIONS"].includes(method) && state.customerCsrfToken) {
    headers.set("X-Customer-Csrf-Token", state.customerCsrfToken);
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "same-origin"
  });
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    if (response.status === 401 && path.startsWith("/api/admin/")) {
      state.admin = null;
      state.csrfToken = "";
    }
    if (response.status === 401 && (path.startsWith("/api/account/") || path.startsWith("/api/checkout/"))) {
      state.customer = null;
      state.customerCsrfToken = "";
    }
    throw new Error(payload.error || "The request could not be completed.");
  }
  return payload;
}

async function loadStoreData() {
  const [storefront, catalog] = await Promise.all([api("/api/storefront"), api("/api/products?limit=48")]);
  state.storefront = storefront;
  state.catalog = catalog.products;
}

async function restoreAdminSession() {
  if (readCookie("admin_present") !== "1") {
    state.admin = null;
    return;
  }
  try {
    const session = await api("/api/admin/session");
    state.admin = session.administrator;
    state.csrfToken = readCookie("csrf_token");
  } catch {
    state.admin = null;
  }
}

async function restoreCustomerSession() {
  if (readCookie("customer_present") !== "1") {
    state.customer = null;
    return;
  }
  try {
    const session = await api("/api/account/session");
    state.customer = session.customer;
    state.customerCsrfToken = readCookie("customer_csrf_token");
  } catch {
    state.customer = null;
    state.customerCsrfToken = "";
  }
}

function isAdminRoute() {
  return location.pathname.replace(/\/+$/, "") === OWNER_ROUTE;
}

function renderRoute() {
  if (isAdminRoute()) {
    document.title = "Owner | Shrishti Organic";
    renderAdmin();
    return;
  }
  document.title = `${state.storefront.settings.storeName || "Shrishti Organic"} | Botanical Care`;
  renderStorefront();
}

function renderStorefront() {
  const { settings, banners, categories, paymentMode } = state.storefront;
  const heroBanner = banners[0];
  const heroImage = safeImage(heroBanner?.imageUrl, fallbackHeroImage);
  const heroTitle = heroBanner?.title || "Rituals rooted in nature.";
  const heroSubtitle = heroBanner?.subtitle || "Thoughtful botanical care for the quiet, everyday moments that belong to you.";
  const heroCtaLabel = heroBanner?.ctaLabel || "Explore collection";
  const heroCtaUrl = safePath(heroBanner?.ctaUrl || "/#shop");
  const products = visibleProducts();

  appRoot.innerHTML = `
    <div class="site-shell">
      <div class="announcement">${escapeHtml(settings.announcement || "Nature's touch, your beauty. 100% Natural products.")}</div>
      <header class="site-header">
        <nav class="header-nav" aria-label="Main navigation">
          <a class="nav-link" href="#shop">Shop</a>
          <a class="nav-link" href="#collections">Collections</a>
          <a class="nav-link" href="#our-story">Our story</a>
        </nav>
        <a class="brand" href="#" aria-label="${escapeHtml(settings.storeName)} home">
          <div class="brand-s-logo">
            <div class="brand-s-inner">
              <span class="s-leaf left">🌿</span>
              <span class="s-letter">S</span>
              <span class="s-leaf right">🌿</span>
            </div>
          </div>
          <span class="brand-mark">SHRISHTI</span>
          <div class="brand-sub">
            <span class="brand-line"></span>
            <span class="brand-organic">ORGANIC</span>
            <span class="brand-line"></span>
          </div>
          <span class="brand-tag">Nature's touch, your beauty</span>
        </a>
        <div class="header-actions">
          <button class="icon-button" type="button" data-action="open-account" aria-label="${state.customer ? `Open account for ${escapeHtml(state.customer.name)}` : "Sign in or create an account"}" title="${state.customer ? `Account: ${escapeHtml(state.customer.name)}` : "Sign in or create an account"}">
            <i data-lucide="user-round"></i>
          </button>
          <button class="icon-button" type="button" data-action="open-cart" aria-label="Open shopping bag" title="Shopping bag">
            <i data-lucide="shopping-bag"></i><span class="counter">${cartQuantity()}</span>
          </button>
        </div>
      </header>

      <main id="main-content">
        <!-- 1. HERO SECTION -->
        <section class="so-hero">
          <div class="so-hero-overlay"></div>
          <div class="so-hero-content">
            <h1>Bring the Goodness of Nature to Your Everyday Care</h1>
            <p>Natural & herbal products made with carefully selected botanical ingredients, inspired by traditional Indian wellness.</p>
            <div style="display: flex; justify-content: center; gap: 15px;">
              <a href="#shop" class="so-btn so-btn-primary">🛍️ Shop Now</a>
              <a href="#collections" class="so-btn so-btn-secondary">🌿 Explore Our Collection</a>
            </div>
          </div>
          <div class="so-hero-trust">
            <span>🌿 Herbal Ingredients</span>
            <span>🤲 Handmade with Care</span>
            <span>💚 Nature Inspired</span>
            <span>✨ Small Batch</span>
          </div>
        </section>

        <!-- 2. SHOP BY CATEGORY -->
        <section class="so-section" id="collections">
          <div class="so-section-header">
            <h2>Discover Your Natural Care</h2>
            <p>Shop by Category</p>
          </div>
          <div class="so-category-grid">
            <div class="so-category-card">
              <h3>Herbal Soaps</h3>
              <p>Gentle everyday cleansing with botanical ingredients.</p>
            </div>
            <div class="so-category-card">
              <h3>Face & Skin Care</h3>
              <p>Natural powders, face washes, masks & scrubs.</p>
            </div>
            <div class="so-category-card">
              <h3>Hair Care</h3>
              <p>Herbal powders, oils & natural hair care essentials.</p>
            </div>
            <div class="so-category-card">
              <h3>Herbal Powders</h3>
              <p>Traditional herbs for your daily beauty rituals.</p>
            </div>
            <div class="so-category-card">
              <h3>Body Care</h3>
              <p>Natural care for a refreshing bathing experience.</p>
            </div>
            <div class="so-category-card">
              <h3>Natural Candles</h3>
              <p>Handcrafted candles for a warm & beautiful ambience.</p>
            </div>
          </div>
          <div class="so-btn-container">
            <a href="#shop" class="so-btn so-btn-primary">View All Products</a>
          </div>
        </section>

        <!-- 3. BEST SELLERS (dynamic catalog) -->
        <section class="so-section" id="shop">
          <div class="so-section-header">
            <h2>Loved by Our Customers ❤️</h2>
            <p>Best Sellers</p>
          </div>
          ${products.length ? `<div class="so-bestsellers-grid">${products.slice(0, 4).map(renderProductCard).join("")}</div>` : renderPublicEmptyState()}
        </section>

        <!-- 4. OUR NATURAL INGREDIENTS -->
        <section class="so-section">
          <div class="so-section-header">
            <h2>Nature's Finest Ingredients 🌿</h2>
            <p>Inspired by Nature. Rooted in Tradition.</p>
          </div>
          <div class="so-ingredient-grid">
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1611079830811-865ff4428d17?q=80&w=200&auto=format&fit=crop" alt="Manjishtha" />
              <span>Manjishtha</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=200&auto=format&fit=crop" alt="Mulethi" />
              <span>Mulethi</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1628189689917-88f6b2f6b86e?q=80&w=200&auto=format&fit=crop" alt="Neem" />
              <span>Neem</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1577931341113-43f1cb10f059?q=80&w=200&auto=format&fit=crop" alt="Amla" />
              <span>Amla</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1616147458694-811c7ce6c278?q=80&w=200&auto=format&fit=crop" alt="Shikakai" />
              <span>Shikakai</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1591557008127-142c6742a0b1?q=80&w=200&auto=format&fit=crop" alt="Hibiscus" />
              <span>Hibiscus</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1571587522513-f6617dd9faee?q=80&w=200&auto=format&fit=crop" alt="Moringa" />
              <span>Moringa</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1596541571217-023e3e2ec8b4?q=80&w=200&auto=format&fit=crop" alt="Orange Peel" />
              <span>Orange Peel</span>
            </div>
            <div class="so-ingredient">
              <img src="https://images.unsplash.com/photo-1621251368940-bf7f941f1737?q=80&w=200&auto=format&fit=crop" alt="Sandalwood" />
              <span>Sandalwood</span>
            </div>
          </div>
          <div style="max-width: 800px; margin: 0 auto; text-align: center; color: var(--ink);">
            <p>At Shrishti Organic, we believe that everyday personal care can be simple, thoughtful and closer to nature. We carefully select herbal and botanical ingredients for our products and prepare them with care.</p>
            <div class="so-btn-container">
              <a href="#shop" class="so-btn so-btn-secondary">Explore Ingredients</a>
            </div>
          </div>
        </section>

        <!-- 5. WHY SHRISHTI ORGANIC? -->
        <section class="so-section" style="background: var(--linen);">
          <div class="so-section-header">
            <h2>Why Choose Shrishti Organic?</h2>
          </div>
          <div class="so-features-grid">
            <div class="so-feature">
              <div class="so-feature-icon">🌿</div>
              <h3>Herbal Ingredients</h3>
              <p>Carefully selected botanical ingredients.</p>
            </div>
            <div class="so-feature">
              <div class="so-feature-icon">🤲</div>
              <h3>Handcrafted with Care</h3>
              <p>Made with attention to every batch.</p>
            </div>
            <div class="so-feature">
              <div class="so-feature-icon">🌱</div>
              <h3>Nature Inspired</h3>
              <p>Inspired by traditional Indian herbal beauty rituals.</p>
            </div>
            <div class="so-feature">
              <div class="so-feature-icon">🔍</div>
              <h3>Thoughtfully Made</h3>
              <p>Simple, transparent and carefully prepared products.</p>
            </div>
            <div class="so-feature">
              <div class="so-feature-icon">❤️</div>
              <h3>Made with Love</h3>
              <p>Created for everyday self-care and family wellness.</p>
            </div>
          </div>
        </section>

        <!-- 6. BRAND STORY -->
        <section class="so-section" id="our-story">
          <div class="so-story-split">
            <img class="so-story-img" src="https://images.unsplash.com/photo-1615397323136-1e3df6a17b2b?q=80&w=1000&auto=format&fit=crop" alt="Making process" />
            <div class="so-story-text">
              <p style="text-transform: uppercase; letter-spacing: 0.1em; color: var(--sun); font-size: 12px; margin-bottom: 10px;">From Nature to Your Home</p>
              <h2>"We believe beauty begins with nature."</h2>
              <p>Shrishti Organic is a homegrown natural care brand inspired by the traditional goodness of Indian herbs and botanical ingredients.</p>
              <p>From herbal soaps and face care to hair care and natural powders, every product is created with care to bring the simple goodness of nature into your daily routine.</p>
              <a href="#" class="so-btn so-btn-primary" style="margin-top: 15px;">Our Story</a>
            </div>
          </div>
        </section>

        <!-- 7. HERBAL RITUAL -->
        <section class="so-section">
          <div class="so-section-header">
            <h2>Create Your Everyday Herbal Ritual 🌿</h2>
          </div>
          <div class="so-ritual-steps">
            <div class="so-step">
              <div class="so-step-number">01</div>
              <h3>CHOOSE</h3>
              <p>Choose the herbal ingredients your skin & hair love.</p>
            </div>
            <div class="so-step-arrow">→</div>
            <div class="so-step">
              <div class="so-step-number">02</div>
              <h3>USE</h3>
              <p>Make them a simple part of your everyday self-care ritual.</p>
            </div>
            <div class="so-step-arrow">→</div>
            <div class="so-step">
              <div class="so-step-number">03</div>
              <h3>ENJOY</h3>
              <p>Enjoy a naturally inspired, refreshing self-care experience.</p>
            </div>
          </div>
        </section>

        <!-- 8. FEATURED COLLECTION -->
        <section class="so-featured-banner">
          <div class="so-featured-content">
            <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; margin-bottom: 10px; color: var(--sun);">Explore Our Herbal Collection</p>
            <h2>Traditional Herbal Goodness for Modern Everyday Care</h2>
            <div style="display: flex; justify-content: center; gap: 15px;">
              <a href="#shop" class="so-btn so-btn-light">Shop Skin Care</a>
              <a href="#shop" class="so-btn so-btn-light">Shop Hair Care</a>
            </div>
          </div>
        </section>

        <!-- 9. CUSTOMER REVIEWS -->
        <section class="so-section" style="background: var(--linen);">
          <div class="so-section-header">
            <h2>What Our Customers Say ❤️</h2>
            <p>Loved by Natural Beauty Lovers</p>
          </div>
          <div class="so-reviews-grid">
            <div class="so-review-card">
              <div class="so-stars">★★★★★</div>
              <p>“Beautiful packaging and lovely herbal fragrance. Really happy with the product.”</p>
            </div>
            <div class="so-review-card">
              <div class="so-stars">★★★★★</div>
              <p>“Feels natural and thoughtfully made.”</p>
            </div>
            <div class="so-review-card">
              <div class="so-stars">★★★★★</div>
              <p>“Good quality and beautifully packed.”</p>
            </div>
          </div>
        </section>

        <!-- 10. INSTAGRAM -->
        <section class="so-section">
          <div class="so-section-header">
            <h2>Follow Our Natural Journey 🌿</h2>
            <p>@ShrishtiOrganic</p>
          </div>
          <div class="so-instagram-grid">
            <img src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=400&auto=format&fit=crop" alt="Insta 1" />
            <img src="https://images.unsplash.com/photo-1615397323136-1e3df6a17b2b?q=80&w=400&auto=format&fit=crop" alt="Insta 2" />
            <img src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=400&auto=format&fit=crop" alt="Insta 3" />
            <img src="https://images.unsplash.com/photo-1611079830811-865ff4428d17?q=80&w=400&auto=format&fit=crop" alt="Insta 4" />
            <img src="https://images.unsplash.com/photo-1628189689917-88f6b2f6b86e?q=80&w=400&auto=format&fit=crop" alt="Insta 5" />
            <img src="https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=400&auto=format&fit=crop" alt="Insta 6" />
          </div>
          <div class="so-btn-container">
            <a href="#" class="so-btn so-btn-secondary">Follow Us On Instagram</a>
          </div>
        </section>

        <!-- 11. NEWSLETTER -->
        <section class="so-newsletter">
          <h2>Get 10% OFF on Your First Order</h2>
          <p>Join the Shrishti Organic family and discover our natural care collection.</p>
          <form onsubmit="event.preventDefault();">
            <input type="email" placeholder="Enter your email" required />
            <button type="submit" class="so-btn so-btn-primary" style="background: var(--sun); color: var(--forest); border: none;">Get My Offer</button>
          </form>
          <p style="font-size: 11px; margin-top: 15px; opacity: 0.8;">No spam. Only new launches, offers & natural beauty tips.</p>
        </section>
      </main>

      <!-- 12. FOOTER -->
      <footer class="so-footer">
        <div class="so-footer-grid">
          <div class="so-footer-col">
            <div class="brand" style="align-items: flex-start; text-align: left; margin-bottom: 20px; color: var(--sun);">
              <span class="brand-mark">SHRISHTI</span>
              <div class="brand-sub">
                <span class="brand-line" style="background: var(--sun);"></span>
                <span class="brand-organic" style="color: var(--white);">ORGANIC</span>
                <span class="brand-line" style="background: var(--sun);"></span>
              </div>
            </div>
            <p style="font-size: 13px; opacity: 0.8;">Pure Nature • Authentic Herbal Care • Handmade with Love</p>
          </div>
          <div class="so-footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#">Home</a></li>
              <li><a href="#shop">Shop</a></li>
              <li><a href="#our-story">About Us</a></li>
              <li><a href="#">Our Ingredients</a></li>
              <li><a href="#">FAQs</a></li>
            </ul>
          </div>
          <div class="so-footer-col">
            <h4>Shop</h4>
            <ul>
              <li><a href="#shop">Herbal Soaps</a></li>
              <li><a href="#shop">Face Care</a></li>
              <li><a href="#shop">Hair Care</a></li>
              <li><a href="#shop">Herbal Powders</a></li>
              <li><a href="#shop">Body Care</a></li>
              <li><a href="#shop">Candles</a></li>
            </ul>
          </div>
          <div class="so-footer-col">
            <h4>Customer Care</h4>
            <ul>
              <li><a href="#">Shipping Policy</a></li>
              <li><a href="#">Return & Refund Policy</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms & Conditions</a></li>
            </ul>
          </div>
        </div>
        <div class="so-footer-bottom">
          &copy; ${new Date().getFullYear()} Shrishti Organic. All rights reserved.
        </div>
      </footer>
    </div>
  `;

  bindPublicControls();
  refreshIcons();
}

function renderCategoryStrip(categories) {
  if (!categories.length) {
    return "";
  }
  return `<div class="category-strip">${categories
    .map(
      (category, index) => `
        <button class="category-tile" type="button" data-action="filter-category" data-category="${escapeHtml(category.slug)}">
          <span class="category-index">0${index + 1}</span>
          <strong>${escapeHtml(category.name)}</strong>
        </button>
      `
    )
    .join("")}</div>`;
}

function renderProductCard(product) {
  const image = product.images[0];
  const category = product.category?.name || "Shrishti Organic";
  const canPurchase = product.stock > 0;
  const discounted = product.compareAtPricePaise && product.compareAtPricePaise > product.pricePaise;
  return `
    <article class="product-card">
      <button class="product-image-button" type="button" data-action="open-product" data-product-id="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.name)}">
        ${image ? `<img src="${escapeHtml(safeImage(image, fallbackProductImage))}" alt="${escapeHtml(product.name)}" loading="lazy" />` : `<span class="product-placeholder"><i data-lucide="leaf"></i></span>`}
        ${product.featured ? '<span class="product-badge">Selected</span>' : ""}
      </button>
      <div class="product-content">
        <div><span class="product-category">${escapeHtml(category)}</span><h3 class="product-name">${escapeHtml(product.name)}</h3></div>
        <div class="price-row"><span class="price">${formatMoney(product.pricePaise)}</span>${discounted ? `<span class="compare-price">${formatMoney(product.compareAtPricePaise)}</span>` : ""}</div>
        <div class="product-action-row">
          <button class="primary-button" type="button" data-action="quick-add" data-product-id="${escapeHtml(product.id)}" ${canPurchase ? "" : "disabled"}>${canPurchase ? "Add to bag" : "Sold out"}</button>
          <button class="small-icon-button" type="button" data-action="open-product" data-product-id="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.name)}" title="View product"><i data-lucide="arrow-up-right"></i></button>
        </div>
      </div>
    </article>
  `;
}

function renderPublicEmptyState() {
  const filtering = state.filters.query || state.filters.category;
  return `
    <div class="empty-state">
      <div>
        <h2>${filtering ? "Nothing matched that search." : "The collection is being prepared."}</h2>
        <p>${filtering ? "Try another collection or clear your search." : "New botanical products will appear here when they are published by the store team."}</p>
        ${filtering ? '<button class="secondary-button" type="button" data-action="clear-filters">Clear filters</button>' : ""}
      </div>
    </div>
  `;
}

function visibleProducts() {
  const query = state.filters.query.trim().toLowerCase();
  const products = state.catalog.filter((product) => {
    const category = product.category?.slug || "";
    const searchable = `${product.name} ${product.description} ${product.ingredients}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!state.filters.category || category === state.filters.category);
  });
  const sorters = {
    newest: (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
    featured: (left, right) => Number(right.featured) - Number(left.featured) || new Date(right.createdAt) - new Date(left.createdAt),
    "price-asc": (left, right) => left.pricePaise - right.pricePaise,
    "price-desc": (left, right) => right.pricePaise - left.pricePaise
  };
  return products.sort(sorters[state.filters.sort] || sorters.newest);
}

function bindPublicControls() {
  const filterForm = document.querySelector("#catalog-filter-form");
  filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(filterForm);
    state.filters.query = String(form.get("search") || "").trim();
    state.filters.category = String(form.get("category") || "");
    state.filters.sort = String(form.get("sort") || "newest");
    renderStorefront();
    document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector("#catalog-category")?.addEventListener("change", () => filterForm?.requestSubmit());
  document.querySelector("#catalog-sort")?.addEventListener("change", () => filterForm?.requestSubmit());
}

function handleAppClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  if (action === "open-cart") {
    openCart();
  }
  if (action === "open-account") {
    openAccountModal();
  }
  if (action === "customer-logout") {
    logoutCustomer();
  }
  if (action === "filter-category") {
    state.filters.category = target.dataset.category || "";
    location.hash = "#shop";
    renderStorefront();
    document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (action === "clear-filters") {
    state.filters = { query: "", category: "", sort: "newest" };
    renderStorefront();
  }
  if (action === "open-product") {
    const product = findProduct(target.dataset.productId);
    if (product) {
      openProductDialog(product);
    }
  }
  if (action === "quick-add") {
    const product = findProduct(target.dataset.productId);
    if (product) {
      addToCart(product, product.sizes[0] || "");
    }
  }
  if (action === "admin-tab") {
    state.adminTab = target.dataset.tab || "dashboard";
    loadAdminTab(state.adminTab);
  }
  if (action === "admin-logout") {
    logoutAdministrator();
  }
  if (action === "new-product") {
    openProductEditor();
  }
  if (action === "edit-product") {
    const product = state.adminData.products?.products.find((item) => item.id === target.dataset.id);
    if (product) {
      openProductEditor(product);
    }
  }
  if (action === "delete-product") {
    deleteAdminItem("products", target.dataset.id, "product");
  }
  if (action === "new-category") {
    openCategoryEditor();
  }
  if (action === "edit-category") {
    const category = state.adminData.categories?.categories.find((item) => String(item.id) === target.dataset.id);
    if (category) {
      openCategoryEditor(category);
    }
  }
  if (action === "delete-category") {
    deleteAdminItem("categories", target.dataset.id, "category");
  }
  if (action === "new-banner") {
    openBannerEditor();
  }
  if (action === "edit-banner") {
    const banner = state.adminData.banners?.banners.find((item) => item.id === target.dataset.id);
    if (banner) {
      openBannerEditor(banner);
    }
  }
  if (action === "delete-banner") {
    deleteAdminItem("banners", target.dataset.id, "banner");
  }
  if (action === "new-coupon") {
    openCouponEditor();
  }
  if (action === "edit-coupon") {
    const coupon = state.adminData.coupons?.coupons.find((item) => item.id === target.dataset.id);
    if (coupon) {
      openCouponEditor(coupon);
    }
  }
  if (action === "delete-coupon") {
    deleteAdminItem("coupons", target.dataset.id, "coupon");
  }
  if (action === "change-password") {
    openPasswordEditor();
  }
}

async function openCart() {
  renderCartDrawer();
  await refreshQuote();
  renderCartDrawer();
}

function renderCartDrawer() {
  const details = cartDetails();
  const total = state.quote || localCartQuote(details);
  portalRoot.innerHTML = `
    <div class="drawer-backdrop" data-action="close-portal"></div>
    <aside class="cart-drawer" aria-label="Shopping bag" role="dialog" aria-modal="true">
      <div class="drawer-header"><h2>Your bag</h2><button class="icon-button" type="button" data-action="close-portal" aria-label="Close shopping bag" title="Close"><i data-lucide="x"></i></button></div>
      <div class="drawer-content">
        ${details.length ? details.map(renderCartItem).join("") : '<div class="empty-cart"><div><i data-lucide="shopping-bag"></i><p>Your bag is waiting for a botanical ritual.</p></div></div>'}
      </div>
      <div class="drawer-footer">
        ${details.length ? `
          <form class="coupon-row" id="coupon-form"><label class="field-shell"><i data-lucide="ticket"></i><input name="coupon" value="${escapeHtml(state.couponCode)}" placeholder="Coupon code" autocomplete="off" /></label><button class="primary-button" type="submit">Apply</button></form>
          ${state.quoteError ? `<p class="notice error">${escapeHtml(state.quoteError)}</p>` : ""}
          ${renderCartTotals(total)}
          <button class="primary-button checkout-button" type="button" data-action="open-checkout" ${state.quoteError ? "disabled" : ""}>Checkout <i data-lucide="lock-keyhole"></i></button>
        ` : '<a class="primary-button checkout-button" href="#shop" data-action="close-portal">Browse products</a>'}
      </div>
    </aside>
  `;
  refreshIcons(portalRoot);
  portalRoot.querySelector("#coupon-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.couponCode = String(new FormData(event.currentTarget).get("coupon") || "").trim().toUpperCase();
    await refreshQuote();
    renderCartDrawer();
  });
}

function renderCartItem(item) {
  const image = item.product.images[0];
  return `
    <div class="cart-item">
      ${image ? `<img class="cart-item-image" src="${escapeHtml(safeImage(image, fallbackProductImage))}" alt="${escapeHtml(item.product.name)}" />` : '<div class="cart-item-image product-placeholder"><i data-lucide="leaf"></i></div>'}
      <div><h3>${escapeHtml(item.product.name)}</h3><p>${escapeHtml(item.size || "Standard")} · ${formatMoney(item.product.pricePaise)}</p><div class="quantity-control"><button type="button" data-action="decrease-cart" data-key="${escapeHtml(item.key)}" aria-label="Decrease quantity">-</button><span>${item.quantity}</span><button type="button" data-action="increase-cart" data-key="${escapeHtml(item.key)}" aria-label="Increase quantity">+</button></div></div>
      <button class="row-icon-button danger" type="button" data-action="remove-cart" data-key="${escapeHtml(item.key)}" aria-label="Remove ${escapeHtml(item.product.name)}" title="Remove"><i data-lucide="trash-2"></i></button>
    </div>
  `;
}

function renderCartTotals(quote) {
  return `
    <div class="totals">
      <div class="total-line"><span>Subtotal</span><strong>${formatMoney(quote.subtotalPaise)}</strong></div>
      ${quote.discountPaise ? `<div class="total-line"><span>Discount</span><strong>-${formatMoney(quote.discountPaise)}</strong></div>` : ""}
      <div class="total-line"><span>Delivery</span><strong>${quote.shippingPaise ? formatMoney(quote.shippingPaise) : "Free"}</strong></div>
      <div class="total-line grand-total"><span>Total</span><strong>${formatMoney(quote.totalPaise)}</strong></div>
    </div>
  `;
}

function cartDetails() {
  return state.cart
    .map((item) => {
      const product = findProduct(item.productId);
      return product ? { ...item, product, key: cartKey(item.productId, item.size) } : null;
    })
    .filter(Boolean);
}

function localCartQuote(details) {
  const subtotalPaise = details.reduce((total, item) => total + item.product.pricePaise * item.quantity, 0);
  const settings = state.storefront.settings;
  const shippingPaise = subtotalPaise >= settings.freeShippingThresholdPaise ? 0 : settings.shippingFeePaise;
  return { subtotalPaise, discountPaise: 0, shippingPaise, totalPaise: subtotalPaise + shippingPaise };
}

async function refreshQuote() {
  const details = cartDetails();
  if (!details.length) {
    state.quote = null;
    state.quoteError = "";
    return;
  }
  try {
    const payload = await api("/api/checkout/quote", {
      method: "POST",
      body: JSON.stringify({ items: state.cart, couponCode: state.couponCode })
    });
    state.quote = payload.quote;
    state.quoteError = "";
  } catch (error) {
    state.quote = null;
    state.quoteError = error.message;
  }
}

function addToCart(product, size) {
  if (!product.stock) {
    showToast("This product is currently sold out.", true);
    return;
  }
  const key = cartKey(product.id, size);
  const existing = state.cart.find((item) => cartKey(item.productId, item.size) === key);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + 1, Math.min(product.stock, 8));
  } else {
    state.cart.push({ productId: product.id, size, quantity: 1 });
  }
  saveCart();
  state.quote = null;
  state.quoteError = "";
  showToast(`${product.name} added to your bag.`);
  renderStorefront();
}

function updateCartQuantity(key, change) {
  const item = state.cart.find((entry) => cartKey(entry.productId, entry.size) === key);
  const product = item && findProduct(item.productId);
  if (!item || !product) {
    return;
  }
  item.quantity = Math.max(0, Math.min(item.quantity + change, Math.min(product.stock, 8)));
  state.cart = state.cart.filter((entry) => entry.quantity > 0);
  saveCart();
  state.quote = null;
  state.quoteError = "";
  openCart();
}

function removeCartItem(key) {
  state.cart = state.cart.filter((item) => cartKey(item.productId, item.size) !== key);
  saveCart();
  state.quote = null;
  state.quoteError = "";
  openCart();
}

function openProductDialog(product) {
  let selectedSize = product.sizes[0] || "";
  portalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-portal">
      <section class="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <div class="product-dialog-media">${product.images[0] ? `<img src="${escapeHtml(safeImage(product.images[0], fallbackProductImage))}" alt="${escapeHtml(product.name)}" />` : '<div class="product-placeholder"><i data-lucide="leaf"></i></div>'}</div>
        <div class="product-dialog-details">
          <button class="icon-button dialog-close" type="button" data-action="close-portal" aria-label="Close product" title="Close"><i data-lucide="x"></i></button>
          <span class="product-category">${escapeHtml(product.category?.name || "Shrishti Organic")}</span>
          <h2 id="product-dialog-title">${escapeHtml(product.name)}</h2>
          <div class="price-row"><span class="price">${formatMoney(product.pricePaise)}</span>${product.compareAtPricePaise ? `<span class="compare-price">${formatMoney(product.compareAtPricePaise)}</span>` : ""}</div>
          <p>${escapeHtml(product.description || product.benefits || "A botanical addition to your everyday ritual.")}</p>
          ${renderProductDetails(product)}
          ${product.sizes.length ? `<div><span class="form-label">Choose size</span><div class="size-options" id="dialog-size-options">${product.sizes.map((size, index) => `<button class="size-option ${index === 0 ? "is-selected" : ""}" type="button" data-size="${escapeHtml(size)}">${escapeHtml(size)}</button>`).join("")}</div></div>` : ""}
          <button class="primary-button" id="dialog-add-button" type="button" ${product.stock ? "" : "disabled"}>${product.stock ? "Add to bag" : "Sold out"} <i data-lucide="shopping-bag"></i></button>
        </div>
      </section>
    </div>
  `;
  refreshIcons(portalRoot);
  portalRoot.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSize = button.dataset.size || "";
      portalRoot.querySelectorAll("[data-size]").forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  });
  portalRoot.querySelector("#dialog-add-button")?.addEventListener("click", () => {
    addToCart(product, selectedSize);
    closePortal();
  });
}

function renderProductDetails(product) {
  const rows = [
    ["Benefits", product.benefits],
    ["Ingredients", product.ingredients],
    ["How to use", product.howToUse]
  ].filter(([, value]) => value);
  return rows.length
    ? `<div class="detail-list">${rows.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}</div>`
    : "";
}

async function openAccountProfile(continueToCheckout = false) {
  const requestId = ++state.accountProfileRequestId;
  renderAccountProfile([], { loading: true }, continueToCheckout);
  try {
    const result = await api("/api/account/orders");
    if (requestId !== state.accountProfileRequestId) {
      return;
    }
    renderAccountProfile(result.orders, {}, continueToCheckout);
  } catch (error) {
    if (requestId !== state.accountProfileRequestId) {
      return;
    }
    if (!state.customer) {
      openAccountModal("login", continueToCheckout);
      showToast(error.message, true);
      return;
    }
    renderAccountProfile([], { error: error.message }, continueToCheckout);
  }
}

function renderAccountProfile(orders, { loading = false, error = "" } = {}, continueToCheckout = false) {
  portalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-portal">
      <section class="modal account-modal account-profile-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div class="modal-header"><h2 id="account-title">Your profile</h2><button class="icon-button" type="button" data-action="close-portal" aria-label="Close profile" title="Close"><i data-lucide="x"></i></button></div>
        <div class="modal-body account-profile">
          <section class="account-summary">
            <span class="account-avatar"><i data-lucide="user-round-check"></i></span>
            <div><span class="section-kicker">Signed in</span><h3>${escapeHtml(state.customer.name)}</h3><p>${escapeHtml(state.customer.email)}<br />${escapeHtml(state.customer.phone)}</p></div>
            <div class="account-summary-actions">${continueToCheckout ? '<button class="secondary-button" id="account-continue-checkout" type="button">Continue to checkout</button>' : ""}<button class="danger-button" id="account-logout" type="button">Sign out <i data-lucide="log-out"></i></button></div>
          </section>
          <section class="account-orders-section" aria-labelledby="order-history-title">
            <div class="account-orders-header"><div><span class="section-kicker">Order history</span><h3 id="order-history-title">Your orders</h3></div><button class="small-icon-button" id="refresh-account-orders" type="button" aria-label="Refresh order history" title="Refresh orders"><i data-lucide="refresh-cw"></i></button></div>
            ${loading ? '<div class="profile-loading"><i data-lucide="loader-circle"></i><span>Loading orders</span></div>' : error ? `<p class="notice error">${escapeHtml(error)}</p>` : renderCustomerOrders(orders)}
          </section>
        </div>
      </section>
    </div>
  `;
  portalRoot.querySelector("#account-continue-checkout")?.addEventListener("click", () => {
    closePortal();
    openCheckout();
  });
  portalRoot.querySelector("#account-logout")?.addEventListener("click", logoutCustomer);
  portalRoot.querySelector("#refresh-account-orders")?.addEventListener("click", () => openAccountProfile(continueToCheckout));
  refreshIcons(portalRoot);
}

function renderCustomerOrders(orders) {
  if (!orders.length) {
    return `<div class="account-orders-empty"><i data-lucide="package-open"></i><h4>No orders yet</h4><p>Your completed orders and delivery updates will appear here.</p></div>`;
  }
  return `<div class="customer-order-list">${orders.map(renderCustomerOrder).join("")}</div>`;
}

function renderCustomerOrder(order) {
  const deliveryLocation = [order.customer?.city, order.customer?.state, order.customer?.postalCode].filter(Boolean).join(", ");
  return `
    <article class="customer-order-card">
      <header class="customer-order-header"><div><span class="order-number">${escapeHtml(order.orderNumber)}</span><span class="order-date">Placed ${formatDate(order.createdAt)}</span></div><div class="order-tags">${paymentTag(order)}${statusTag(order.fulfillmentStatus)}</div></header>
      <div class="customer-order-items">${order.items.map((item) => `
        <div class="customer-order-item">
          ${item.imageUrl ? `<img src="${escapeHtml(safeImage(item.imageUrl, fallbackProductImage))}" alt="${escapeHtml(item.name)}" />` : '<span class="table-thumb product-placeholder"><i data-lucide="leaf"></i></span>'}
          <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.size || "Standard")} · Qty ${item.quantity}</span></div>
          <b>${formatMoney(item.lineTotalPaise)}</b>
        </div>
      `).join("")}</div>
      <div class="customer-order-meta"><span><i data-lucide="map-pin"></i>${escapeHtml(deliveryLocation || "Delivery address saved")}</span><strong>${formatMoney(order.totalPaise)}</strong></div>
      ${renderTrackingTimeline(order)}
    </article>
  `;
}

function renderTrackingTimeline(order) {
  if (order.fulfillmentStatus === "cancelled") {
    return `<div class="order-tracking is-cancelled"><div><span class="tracking-kicker">Order update</span><strong>This order has been cancelled.</strong></div></div>`;
  }
  const stages = [
    ["new", "Order placed", "We have received your order."],
    ["confirmed", "Confirmed", "Your order has been confirmed."],
    ["packed", "Packed", "Your order is carefully packed."],
    ["shipped", "Shipped", "Your order is on its way."],
    ["delivered", "Delivered", "Your order has been delivered."]
  ];
  const currentIndex = Math.max(0, stages.findIndex(([status]) => status === order.fulfillmentStatus));
  const currentStage = stages[currentIndex];
  return `
    <section class="order-tracking" aria-label="Order progress: ${escapeHtml(currentStage[1])}">
      <div class="tracking-summary"><div><span class="tracking-kicker">Order progress</span><strong>${escapeHtml(currentStage[1])}</strong></div><p>${escapeHtml(currentStage[2])}</p></div>
      <ol class="tracking-timeline">${stages.map(([status, label], index) => `<li class="${index <= currentIndex ? "is-complete" : ""} ${index === currentIndex ? "is-current" : ""}"><span></span><small>${escapeHtml(label)}</small></li>`).join("")}</ol>
    </section>
  `;
}

function openAccountModal(mode = "login", continueToCheckout = false) {
  if (state.customer) {
    openAccountProfile(continueToCheckout);
    return;
  }

  const isRegistration = mode === "register";
  portalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-portal">
      <section class="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div class="modal-header"><h2 id="account-title">${isRegistration ? "Create account" : "Sign in"}</h2><button class="icon-button" type="button" data-action="close-portal" aria-label="Close account" title="Close"><i data-lucide="x"></i></button></div>
        <div class="modal-body">
          <div class="auth-switch" role="tablist" aria-label="Account options"><button class="${!isRegistration ? "is-active" : ""}" type="button" data-auth-mode="login">Sign in</button><button class="${isRegistration ? "is-active" : ""}" type="button" data-auth-mode="register">Create account</button></div>
          <form id="customer-auth-form" class="compact-form">
            ${isRegistration ? `
              <div class="form-field"><label for="account-name">Full name</label><input id="account-name" name="name" autocomplete="name" maxlength="80" required /></div>
              <div class="form-field"><label for="account-phone">Phone</label><input id="account-phone" name="phone" inputmode="tel" autocomplete="tel" maxlength="20" required /></div>
            ` : ""}
            <div class="form-field"><label for="account-email">Email address</label><input id="account-email" name="email" type="email" autocomplete="email" maxlength="120" required /></div>
            <div class="form-field"><label for="account-password">Password</label><input id="account-password" name="password" type="password" autocomplete="${isRegistration ? "new-password" : "current-password"}" minlength="${isRegistration ? "12" : "1"}" maxlength="256" required /></div>
            ${isRegistration ? '<div class="form-field"><label for="account-password-confirmation">Confirm password</label><input id="account-password-confirmation" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" maxlength="256" required /></div>' : ""}
            <button class="primary-button" type="submit">${isRegistration ? "Create account" : "Sign in"} <i data-lucide="arrow-right"></i></button>
          </form>
        </div>
      </section>
    </div>
  `;
  portalRoot.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => openAccountModal(button.dataset.authMode, continueToCheckout));
  });
  portalRoot.querySelector("#customer-auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    if (isRegistration && password !== String(values.get("passwordConfirmation") || "")) {
      showFormError(form, "The passwords do not match.");
      return;
    }
    const payload = isRegistration
      ? { name: String(values.get("name") || ""), phone: String(values.get("phone") || ""), email: String(values.get("email") || ""), password }
      : { email: String(values.get("email") || ""), password };
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    try {
      const result = await api(isRegistration ? "/api/account/register" : "/api/account/login", { method: "POST", body: JSON.stringify(payload) });
      state.customer = result.customer;
      state.customerCsrfToken = result.csrfToken;
      closePortal();
      renderStorefront();
      showToast(isRegistration ? "Your account is ready." : "Welcome back.");
      if (continueToCheckout) {
        openCheckout();
      }
    } catch (error) {
      showFormError(form, error.message);
      submitButton.disabled = false;
    }
  });
  refreshIcons(portalRoot);
}

function openCheckout() {
  const details = cartDetails();
  const quote = state.quote || localCartQuote(details);
  const codAvailable = state.storefront.settings.codEnabled;
  const canPlaceOrder = true;
  const defaultPaymentMethod = "razorpay";
  if (!details.length || state.quoteError) {
    return;
  }
  if (!state.customer) {
    openAccountModal("login", true);
    return;
  }
  portalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-portal">
      <section class="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <div class="modal-header"><h2 id="checkout-title">Delivery details</h2><button class="icon-button" type="button" data-action="close-portal" aria-label="Close checkout" title="Close"><i data-lucide="x"></i></button></div>
        <div class="modal-body">
          <form id="checkout-form" class="checkout-layout" novalidate>
            <div class="form-grid">
              <div class="checkout-account-card full"><i data-lucide="user-round-check"></i><div><span>Ordering as</span><strong>${escapeHtml(state.customer.name)}</strong><small>${escapeHtml(state.customer.email)} · ${escapeHtml(state.customer.phone)}</small></div><button class="small-icon-button" id="checkout-account-button" type="button" aria-label="Open account" title="Account"><i data-lucide="user-round"></i></button></div>
              <div class="checkout-form-errors full" data-form-errors aria-live="polite"></div>
              <div class="form-field full"><label for="checkout-address-one">Address</label><input id="checkout-address-one" name="addressLine1" autocomplete="street-address" required minlength="5" maxlength="160" placeholder="House number, street, and area" /></div>
              <div class="form-field full"><label for="checkout-address-two">Apartment, landmark, or area</label><input id="checkout-address-two" name="addressLine2" autocomplete="address-line2" maxlength="160" placeholder="Optional" /></div>
              <div class="form-field"><label for="checkout-city">City</label><input id="checkout-city" name="city" autocomplete="address-level2" required minlength="2" maxlength="80" placeholder="Your city" /></div>
              <div class="form-field"><label for="checkout-state">State</label><input id="checkout-state" name="state" autocomplete="address-level1" required minlength="2" maxlength="80" placeholder="Your state" /></div>
              <div class="form-field"><label for="checkout-postal">Postal code</label><input id="checkout-postal" name="postalCode" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{6}" required minlength="6" maxlength="6" title="Enter a valid 6-digit postal code" placeholder="560001" /></div>
              <div class="payment-methods full"><span class="form-label">Payment method</span><div class="payment-method-options ${codAvailable ? "" : "is-single-option"}">
                <label class="payment-method-option"><input name="paymentMethod" type="radio" value="razorpay" ${defaultPaymentMethod === "razorpay" ? "checked" : ""} /><i data-lucide="credit-card"></i><span><strong>Pay online</strong><small>Secure payment via Razorpay</small></span></label>
                ${codAvailable ? `<label class="payment-method-option"><input name="paymentMethod" type="radio" value="cash_on_delivery" ${defaultPaymentMethod === "cash_on_delivery" ? "checked" : ""} /><i data-lucide="banknote"></i><span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span></label>` : '<div class="payment-method-option is-disabled"><i data-lucide="banknote"></i><span><strong>Cash on delivery</strong><small>Currently unavailable</small></span></div>'}
              </div></div>
              <div class="form-field full checkout-submit-field"><button class="primary-button" type="submit" ${canPlaceOrder ? "" : "disabled"}>Place order <i data-lucide="lock-keyhole"></i></button></div>
            </div>
            <aside class="checkout-summary"><h3>Order summary</h3>${details.map((item) => `<div class="checkout-summary-line"><span>${escapeHtml(item.product.name)} × ${item.quantity}</span><span>${formatMoney(item.product.pricePaise * item.quantity)}</span></div>`).join("")}<div class="detail-list">${renderCartTotals(quote)}</div></aside>
          </form>
        </div>
      </section>
    </div>
  `;
  refreshIcons(portalRoot);
  portalRoot.querySelector("#checkout-form")?.addEventListener("submit", submitCheckout);
  portalRoot.querySelector("#checkout-account-button")?.addEventListener("click", () => openAccountModal("login", true));
}

async function submitCheckout(event) {
  event.preventDefault();
  if (!state.customer) {
    openAccountModal("login", true);
    return;
  }
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const fields = new FormData(form);
  const values = Object.fromEntries(fields.entries());
  const paymentMethod = String(values.paymentMethod || "");
  delete values.paymentMethod;
  const shippingAddress = values;
  const addressValidation = validateCheckoutShippingAddress(shippingAddress);
  if (addressValidation) {
    showFormError(form, addressValidation.message);
    form.elements[addressValidation.field]?.focus();
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = "Preparing payment...";
  try {
    const payment = await api("/api/checkout/create-payment-order", {
      method: "POST",
      body: JSON.stringify({ items: state.cart, couponCode: state.couponCode, shippingAddress, paymentMethod })
    });
    if (payment.mode === "cash_on_delivery") {
      completeCheckout(payment.order);
      return;
    }
    if (payment.mode === "demo") {
      const confirmed = await api("/api/checkout/verify-payment", {
        method: "POST",
        body: JSON.stringify({ orderId: payment.orderId, paymentId: `demo_payment_${payment.orderId}` })
      });
      completeCheckout(confirmed.order);
      return;
    }
    await launchRazorpay(payment);
  } catch (error) {
    if (!state.customer) {
      closePortal();
      openAccountModal("login", true);
      showToast(error.message, true);
      return;
    }
    showFormError(form, error.message);
    submitButton.disabled = false;
    submitButton.innerHTML = 'Place order <i data-lucide="lock-keyhole"></i>';
    refreshIcons(form);
  }
}

function validateCheckoutShippingAddress(address) {
  if ((address.addressLine1 || "").trim().length < 5) {
    return { field: "addressLine1", message: "Enter a complete delivery address, including house number and street." };
  }
  if ((address.city || "").trim().length < 2) {
    return { field: "city", message: "Enter your city." };
  }
  if ((address.state || "").trim().length < 2) {
    return { field: "state", message: "Enter your state." };
  }
  if (!/^\d{6}$/.test((address.postalCode || "").trim())) {
    return { field: "postalCode", message: "Enter a valid 6-digit postal code." };
  }
  return null;
}

async function launchRazorpay(payment) {
  if (!window.Razorpay) {
    await loadRazorpayScript();
  }
  const checkout = new window.Razorpay({
    key: payment.keyId,
    amount: payment.amountPaise,
    currency: payment.currency,
    name: state.storefront.settings.storeName,
    description: "Shrishti Organic order",
    order_id: payment.orderId,
    theme: { color: "#183c31" },
    handler: async (response) => {
      try {
        const confirmed = await api("/api/checkout/verify-payment", {
          method: "POST",
          body: JSON.stringify({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature
          })
        });
        completeCheckout(confirmed.order);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });
  checkout.on("payment.failed", () => showToast("Payment was not completed. Your bag is still saved.", true));
  checkout.open();
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("The payment window could not be loaded."));
    document.head.append(script);
  });
}

function completeCheckout(order) {
  state.cart = [];
  state.couponCode = "";
  state.quote = null;
  saveCart();
  closePortal();
  renderStorefront();
  showToast(order.paymentMethod === "cash_on_delivery" ? `Order ${order.orderNumber} is placed. Payment is due on delivery.` : `Order ${order.orderNumber} is confirmed.`);
}

async function logoutCustomer() {
  try {
    await api("/api/account/logout", { method: "POST" });
  } catch (error) {
    showToast(error.message, true);
    return;
  }
  state.customer = null;
  state.customerCsrfToken = "";
  closePortal();
  renderStorefront();
  showToast("You have been signed out.");
}

function renderAdmin() {
  if (!state.admin) {
    renderAdminLogin();
    return;
  }
  const tab = state.adminTab;
  appRoot.innerHTML = `
    <div class="admin-shell">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <a class="brand admin-brand" href="/" aria-label="Return to storefront"><span class="brand-mark">${escapeHtml(state.storefront.settings.storeName)}</span><span class="brand-tag">Store control</span></a>
          <nav class="admin-nav" aria-label="Admin navigation">
            ${adminNavItem("dashboard", "layout-dashboard", "Overview", tab)}
            ${adminNavItem("products", "package", "Products", tab)}
            ${adminNavItem("orders", "receipt-text", "Orders", tab)}
            ${adminNavItem("customers", "users", "Customers", tab)}
            ${adminNavItem("coupons", "ticket", "Coupons", tab)}
            ${adminNavItem("banners", "panels-top-left", "Banners", tab)}
            ${adminNavItem("categories", "tags", "Categories", tab)}
            ${adminNavItem("settings", "settings-2", "Store settings", tab)}
          </nav>
          <div class="admin-sidebar-footer">
            <button class="admin-nav-button" type="button" data-action="change-password"><i data-lucide="key-round"></i>Password</button>
            <a class="admin-nav-button" href="/"><i data-lucide="store"></i>View storefront</a>
            <button class="admin-nav-button" type="button" data-action="admin-logout"><i data-lucide="log-out"></i>Sign out</button>
          </div>
        </aside>
        <main class="admin-main">
          <header class="admin-topbar">
            <div class="admin-title"><h1>${escapeHtml(adminHeading(tab))}</h1><p>${escapeHtml(adminDescription(tab))}</p></div>
            <div class="admin-user"><span class="status-dot"></span>${escapeHtml(state.admin.username)}</div>
          </header>
          ${state.adminLoading ? '<div class="loading-block">Loading workspace</div>' : renderAdminContent(tab)}
        </main>
      </div>
    </div>
  `;
  refreshIcons();
}

function renderAdminLogin() {
  appRoot.innerHTML = `
    <main class="admin-login">
      <section class="admin-login-aside"><p class="eyebrow">Shrishti Organic</p><h1>Run the store with a clear view.</h1><p>Manage products, imagery, prices, promotions, customers, and paid orders from one protected workspace.</p></section>
      <section class="admin-login-panel"><div><p class="section-kicker">Store administration</p><h2>Sign in</h2><p>Use the administrator credentials configured for this store.</p></div><form id="admin-login-form" class="compact-form"><div class="form-field"><label for="admin-username">Username</label><input id="admin-username" name="username" autocomplete="username" required /></div><div class="form-field"><label for="admin-password">Password</label><input id="admin-password" name="password" type="password" autocomplete="current-password" required /></div><button class="primary-button" type="submit">Open workspace <i data-lucide="arrow-right"></i></button><a class="secondary-button" href="#">Return to storefront</a></form></section>
    </main>
  `;
  appRoot.querySelector("#admin-login-form")?.addEventListener("submit", submitAdminLogin);
  refreshIcons();
}

async function submitAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  try {
    const credentials = Object.fromEntries(new FormData(form).entries());
    const result = await api("/api/admin/login", { method: "POST", body: JSON.stringify(credentials) });
    state.admin = result.administrator;
    state.csrfToken = result.csrfToken;
    state.adminData = {};
    renderAdmin();
    await loadAdminTab("dashboard");
  } catch (error) {
    showFormError(form, error.message);
    submitButton.disabled = false;
  }
}

function adminNavItem(tab, icon, label, activeTab) {
  return `<button class="admin-nav-button ${tab === activeTab ? "is-active" : ""}" type="button" data-action="admin-tab" data-tab="${tab}"><i data-lucide="${icon}"></i>${label}</button>`;
}

function adminHeading(tab) {
  return {
    dashboard: "Store overview",
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    coupons: "Coupons",
    banners: "Banners",
    categories: "Categories",
    settings: "Store settings"
  }[tab] || "Store overview";
}

function adminDescription(tab) {
  return {
    dashboard: "A live snapshot of your store activity.",
    products: "Publish, price, stock, and present your catalogue.",
    orders: "Keep fulfillment moving from paid order to delivery.",
    customers: "See the people who have shopped with you.",
    coupons: "Create and control promotional codes.",
    banners: "Control the main visual stories on the storefront.",
    categories: "Shape the collections customers browse.",
    settings: "Update the storefront name, announcement, and delivery rules."
  }[tab] || "";
}

async function loadAdminTab(tab) {
  if (!state.admin) {
    return;
  }
  state.adminTab = tab;
  state.adminLoading = true;
  renderAdmin();
  try {
    if (tab === "dashboard") {
      state.adminData.dashboard = await api("/api/admin/dashboard");
    }
    if (tab === "products") {
      const [products, categories] = await Promise.all([api("/api/admin/products"), api("/api/admin/categories")]);
      state.adminData.products = { products: products.products, categories: categories.categories };
    }
    if (tab === "orders") {
      state.adminData.orders = await api("/api/admin/orders");
    }
    if (tab === "customers") {
      state.adminData.customers = await api("/api/admin/customers");
    }
    if (tab === "coupons") {
      state.adminData.coupons = await api("/api/admin/coupons");
    }
    if (tab === "banners") {
      state.adminData.banners = await api("/api/admin/banners");
    }
    if (tab === "categories") {
      state.adminData.categories = await api("/api/admin/categories");
    }
    if (tab === "settings") {
      state.adminData.settings = await api("/api/admin/settings");
    }
  } catch (error) {
    showToast(error.message, true);
  } finally {
    state.adminLoading = false;
    renderAdmin();
  }
}

function renderAdminContent(tab) {
  if (tab === "dashboard") {
    return renderDashboard(state.adminData.dashboard);
  }
  if (tab === "products") {
    return renderProductsAdmin(state.adminData.products);
  }
  if (tab === "orders") {
    return renderOrdersAdmin(state.adminData.orders);
  }
  if (tab === "customers") {
    return renderCustomersAdmin(state.adminData.customers);
  }
  if (tab === "coupons") {
    return renderCouponsAdmin(state.adminData.coupons);
  }
  if (tab === "banners") {
    return renderBannersAdmin(state.adminData.banners);
  }
  if (tab === "categories") {
    return renderCategoriesAdmin(state.adminData.categories);
  }
  if (tab === "settings") {
    return renderSettingsAdmin(state.adminData.settings);
  }
  return "";
}

function renderDashboard(data) {
  if (!data) {
    return '<div class="loading-block">Loading overview</div>';
  }
  const metrics = data.metrics;
  return `
    <div class="metric-grid">
      ${renderMetric("Products", metrics.productCount, "package")}
      ${renderMetric("Orders", metrics.orderCount, "receipt-text")}
      ${renderMetric("Customers", metrics.customerCount, "users")}
      ${renderMetric("Revenue", formatMoney(metrics.revenuePaise), "indian-rupee")}
    </div>
    <section class="admin-panel">
      <div class="panel-header"><div><h2>Recent orders</h2><p>Your latest customer orders.</p></div><button class="secondary-button" type="button" data-action="admin-tab" data-tab="orders">View orders</button></div>
      ${data.recentOrders.length ? renderOrdersTable(data.recentOrders, false) : renderAdminEmpty("receipt-text", "No orders yet", "Customer orders will appear here after checkout.")}
    </section>
  `;
}

function renderMetric(label, value, icon) {
  return `<div class="metric"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-value">${escapeHtml(String(value))}</span><i data-lucide="${icon}"></i></div>`;
}

function renderProductsAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading products</div>';
  }
  return `
    <section class="admin-panel">
      <div class="panel-header"><div><h2>Catalogue</h2><p>${data.products.length} total product${data.products.length === 1 ? "" : "s"}</p></div><button class="primary-button" type="button" data-action="new-product"><i data-lucide="plus"></i>Add product</button></div>
      ${data.products.length ? `
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Collection</th><th>Price</th><th>Inventory</th><th>Status</th><th></th></tr></thead><tbody>
          ${data.products.map((product) => `
            <tr>
              <td><div class="table-product">${product.images[0] ? `<img src="${escapeHtml(safeImage(product.images[0], fallbackProductImage))}" alt="" />` : '<span class="table-thumb product-placeholder"><i data-lucide="leaf"></i></span>'}<div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.sku || product.slug)}</span></div></div></td>
              <td>${escapeHtml(product.category?.name || "Unassigned")}</td><td>${formatMoney(product.pricePaise)}</td><td>${product.stock}</td><td>${statusTag(product.status)}</td>
              <td><div class="row-actions"><button class="row-icon-button" type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}" aria-label="Edit ${escapeHtml(product.name)}" title="Edit"><i data-lucide="pencil"></i></button><button class="row-icon-button danger" type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}" aria-label="Delete ${escapeHtml(product.name)}" title="Delete"><i data-lucide="trash-2"></i></button></div></td>
            </tr>
          `).join("")}
        </tbody></table></div>
      ` : renderAdminEmpty("package-plus", "No products yet", "Add your first product with its imagery, price, stock, and collection.", "new-product", "Add product")}
    </section>
  `;
}

function renderOrdersAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading orders</div>';
  }
  return `<section class="admin-panel"><div class="panel-header"><div><h2>Order queue</h2><p>Update fulfillment status as orders move through your process.</p></div></div>${data.orders.length ? renderOrdersTable(data.orders, true) : renderAdminEmpty("receipt-text", "No orders yet", "Customer orders will show up here after checkout.")}</section>`;
}

function renderOrdersTable(orders, editable) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Fulfillment</th>${editable ? "<th></th>" : ""}</tr></thead><tbody>${orders.map((order) => `
    <tr>
      <td><span class="table-name">${escapeHtml(order.orderNumber)}</span><span class="table-subtext">${order.items.length} item${order.items.length === 1 ? "" : "s"}</span></td>
      <td><span class="table-name">${escapeHtml(order.customer.name || "Customer")}</span><span class="table-subtext">${escapeHtml(order.customer.phone || "")}</span></td>
      <td>${formatDate(order.createdAt)}</td><td>${formatMoney(order.totalPaise)}</td>
      <td>${paymentTag(order)}</td>
      <td>${editable ? `<select class="inline-status" data-order-status="${escapeHtml(order.id)}">${["new", "confirmed", "packed", "shipped", "delivered", "cancelled"].map((status) => `<option value="${status}" ${order.fulfillmentStatus === status ? "selected" : ""}>${capitalize(status)}</option>`).join("")}</select>` : statusTag(order.fulfillmentStatus)}</td>
      ${editable ? `<td><button class="row-icon-button" type="button" data-action="save-order" data-id="${escapeHtml(order.id)}" aria-label="Save ${escapeHtml(order.orderNumber)}" title="Save"><i data-lucide="save"></i></button></td>` : ""}
    </tr>`).join("")}</tbody></table></div>`;
}

function renderCustomersAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading customers</div>';
  }
  return `<section class="admin-panel"><div class="panel-header"><div><h2>Customer directory</h2><p>Customers and their order activity appear here.</p></div></div>${data.customers.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Last updated</th></tr></thead><tbody>${data.customers.map((customer) => `<tr><td><span class="table-name">${escapeHtml(customer.name)}</span><span class="table-subtext">${escapeHtml(customer.email || "No email added")}</span></td><td>${escapeHtml(customer.phone)}</td><td>${customer.orderCount}</td><td>${formatMoney(customer.totalSpentPaise)}</td><td>${formatDate(customer.updatedAt)}</td></tr>`).join("")}</tbody></table></div>` : renderAdminEmpty("users", "No customers yet", "Customer profiles appear after checkout.")}</section>`;
}

function renderCouponsAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading coupons</div>';
  }
  return `<section class="admin-panel"><div class="panel-header"><div><h2>Promotion codes</h2><p>Control discounts, validity windows, and use limits.</p></div><button class="primary-button" type="button" data-action="new-coupon"><i data-lucide="plus"></i>Add coupon</button></div>${data.coupons.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Code</th><th>Offer</th><th>Uses</th><th>Validity</th><th>Status</th><th></th></tr></thead><tbody>${data.coupons.map((coupon) => `<tr><td><span class="table-name">${escapeHtml(coupon.code)}</span></td><td>${coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatMoney(coupon.discountValue)}</td><td>${coupon.usageCount}${coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}</td><td>${coupon.endsAt ? formatDate(coupon.endsAt) : "No end date"}</td><td>${statusTag(coupon.isActive ? "active" : "inactive")}</td><td><div class="row-actions"><button class="row-icon-button" type="button" data-action="edit-coupon" data-id="${escapeHtml(coupon.id)}" aria-label="Edit ${escapeHtml(coupon.code)}" title="Edit"><i data-lucide="pencil"></i></button><button class="row-icon-button danger" type="button" data-action="delete-coupon" data-id="${escapeHtml(coupon.id)}" aria-label="Delete ${escapeHtml(coupon.code)}" title="Delete"><i data-lucide="trash-2"></i></button></div></td></tr>`).join("")}</tbody></table></div>` : renderAdminEmpty("ticket-plus", "No coupons yet", "Create a promotion code when you are ready to run an offer.", "new-coupon", "Add coupon")}</section>`;
}

function renderBannersAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading banners</div>';
  }
  return `<section class="admin-panel"><div class="panel-header"><div><h2>Storefront banners</h2><p>Active banners control the visual story customers see first.</p></div><button class="primary-button" type="button" data-action="new-banner"><i data-lucide="plus"></i>Add banner</button></div>${data.banners.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Banner</th><th>CTA</th><th>Position</th><th>Status</th><th></th></tr></thead><tbody>${data.banners.map((banner) => `<tr><td><div class="table-product"><img src="${escapeHtml(safeImage(banner.imageUrl, fallbackProductImage))}" alt="" /><div><strong>${escapeHtml(banner.title)}</strong><span>${escapeHtml(banner.subtitle)}</span></div></div></td><td>${escapeHtml(banner.ctaLabel || "No button")}</td><td>${banner.position}</td><td>${statusTag(banner.isActive ? "active" : "inactive")}</td><td><div class="row-actions"><button class="row-icon-button" type="button" data-action="edit-banner" data-id="${escapeHtml(banner.id)}" aria-label="Edit banner" title="Edit"><i data-lucide="pencil"></i></button><button class="row-icon-button danger" type="button" data-action="delete-banner" data-id="${escapeHtml(banner.id)}" aria-label="Delete banner" title="Delete"><i data-lucide="trash-2"></i></button></div></td></tr>`).join("")}</tbody></table></div>` : renderAdminEmpty("panels-top-left", "No banners yet", "Upload a banner to control the first story on the storefront.", "new-banner", "Add banner")}</section>`;
}

function renderCategoriesAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading categories</div>';
  }
  return `<section class="admin-panel"><div class="panel-header"><div><h2>Collections</h2><p>Categories can be published, revised, or removed at any time.</p></div><button class="primary-button" type="button" data-action="new-category"><i data-lucide="plus"></i>Add collection</button></div>${data.categories.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Collection</th><th>Slug</th><th>Status</th><th></th></tr></thead><tbody>${data.categories.map((category) => `<tr><td><span class="table-name">${escapeHtml(category.name)}</span><span class="table-subtext">${escapeHtml(category.description || "No description")}</span></td><td>${escapeHtml(category.slug)}</td><td>${statusTag(category.isActive ? "active" : "inactive")}</td><td><div class="row-actions"><button class="row-icon-button" type="button" data-action="edit-category" data-id="${category.id}" aria-label="Edit ${escapeHtml(category.name)}" title="Edit"><i data-lucide="pencil"></i></button><button class="row-icon-button danger" type="button" data-action="delete-category" data-id="${category.id}" aria-label="Delete ${escapeHtml(category.name)}" title="Delete"><i data-lucide="trash-2"></i></button></div></td></tr>`).join("")}</tbody></table></div>` : renderAdminEmpty("tags", "No collections yet", "Create a collection before publishing its products.", "new-category", "Add collection")}</section>`;
}

function renderSettingsAdmin(data) {
  if (!data) {
    return '<div class="loading-block">Loading settings</div>';
  }
  const settings = data.settings;
  return `<section class="admin-panel"><div class="panel-header"><div><h2>Storefront settings</h2><p>Changes here appear on the public storefront immediately.</p></div></div><div class="modal-body"><form id="settings-form" class="form-grid"><div class="form-field"><label for="settings-name">Store name</label><input id="settings-name" name="storeName" value="${escapeHtml(settings.storeName)}" maxlength="80" required /></div><div class="form-field"><label for="settings-shipping">Delivery fee (Rs.)</label><input id="settings-shipping" name="shippingFee" value="${escapeHtml(String(settings.shippingFeePaise / 100))}" type="number" min="0" step="0.01" required /></div><div class="form-field full"><label for="settings-announcement">Announcement</label><input id="settings-announcement" name="announcement" value="${escapeHtml(settings.announcement)}" maxlength="180" /></div><div class="form-field"><label for="settings-threshold">Free delivery above (Rs.)</label><input id="settings-threshold" name="freeShippingThreshold" value="${escapeHtml(String(settings.freeShippingThresholdPaise / 100))}" type="number" min="0" step="0.01" required /></div><label class="checkbox-field"><input name="codEnabled" type="checkbox" ${settings.codEnabled ? "checked" : ""} />Offer cash on delivery</label><div class="form-field"><label>&nbsp;</label><button class="primary-button" type="submit">Save settings <i data-lucide="save"></i></button></div></form></div></section>`;
}

function renderAdminEmpty(icon, title, copy, action = "", actionLabel = "") {
  return `<div class="admin-empty"><div><i data-lucide="${icon}"></i><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>${action ? `<button class="primary-button" type="button" data-action="${action}">${escapeHtml(actionLabel)}</button>` : ""}</div></div>`;
}

function statusTag(status) {
  return `<span class="tag ${escapeHtml(status)}">${escapeHtml(capitalize(status))}</span>`;
}

function paymentTag(order) {
  return order.paymentMethod === "cash_on_delivery"
    ? '<span class="tag cash_on_delivery">Cash on delivery</span>'
    : '<span class="tag paid">Paid online</span>';
}

function openProductEditor(product = null) {
  const categories = state.adminData.products?.categories || state.adminData.categories?.categories || [];
  let images = [...(product?.images || [])];
  const title = product ? "Edit product" : "Add product";
  portalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-portal"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><h2>${title}</h2><button class="icon-button" type="button" data-action="close-portal" aria-label="Close editor" title="Close"><i data-lucide="x"></i></button></div><div class="modal-body"><form id="product-form" class="form-grid" data-id="${escapeHtml(product?.id || "")}">
      <div class="form-field full"><label for="product-name">Product name</label><input id="product-name" name="name" value="${escapeHtml(product?.name || "")}" maxlength="140" required /></div>
      <div class="form-field"><label for="product-category">Collection</label><select id="product-category" name="categoryId"><option value="">Unassigned</option>${categories.map((category) => `<option value="${category.id}" ${product?.category?.id === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></div>
      <div class="form-field"><label for="product-status">Publishing status</label><select id="product-status" name="status"><option value="draft" ${product?.status === "draft" || !product ? "selected" : ""}>Draft</option><option value="active" ${product?.status === "active" ? "selected" : ""}>Active</option><option value="archived" ${product?.status === "archived" ? "selected" : ""}>Archived</option></select></div>
      <div class="form-field"><label for="product-price">Selling price (Rs.)</label><input id="product-price" name="price" value="${product ? escapeHtml(String(product.pricePaise / 100)) : ""}" type="number" min="1" step="0.01" required /></div>
      <div class="form-field"><label for="product-compare-price">Compare-at price (Rs.)</label><input id="product-compare-price" name="comparePrice" value="${product?.compareAtPricePaise ? escapeHtml(String(product.compareAtPricePaise / 100)) : ""}" type="number" min="1" step="0.01" /></div>
      <div class="form-field"><label for="product-stock">Available stock</label><input id="product-stock" name="stock" value="${product?.stock ?? 0}" type="number" min="0" step="1" required /></div>
      <div class="form-field"><label for="product-sku">SKU</label><input id="product-sku" name="sku" value="${escapeHtml(product?.sku || "")}" maxlength="64" /></div>
      <div class="form-field full"><label for="product-sizes">Sizes or variants</label><input id="product-sizes" name="sizes" value="${escapeHtml((product?.sizes || []).join(", "))}" placeholder="75 g, 100 g" maxlength="600" /></div>
      <div class="form-field full"><label for="product-description">Description</label><textarea id="product-description" name="description" maxlength="1600">${escapeHtml(product?.description || "")}</textarea></div>
      <div class="form-field full"><label for="product-benefits">Benefits</label><textarea id="product-benefits" name="benefits" maxlength="1200">${escapeHtml(product?.benefits || "")}</textarea></div>
      <div class="form-field full"><label for="product-ingredients">Ingredients</label><textarea id="product-ingredients" name="ingredients" maxlength="1600">${escapeHtml(product?.ingredients || "")}</textarea></div>
      <div class="form-field full"><label for="product-how-to-use">How to use</label><textarea id="product-how-to-use" name="howToUse" maxlength="1200">${escapeHtml(product?.howToUse || "")}</textarea></div>
      <div class="form-field full"><label for="product-images">Product images</label><input id="product-images" name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple /><div class="image-list" id="product-image-list"></div></div>
      <label class="checkbox-field full"><input name="featured" type="checkbox" ${product?.featured ? "checked" : ""} />Feature this product on the storefront</label>
      <div class="form-actions full"><button class="secondary-button" type="button" data-action="close-portal">Cancel</button><button class="primary-button" type="submit">Save product <i data-lucide="save"></i></button></div>
    </form></div></section></div>
  `;
  const form = portalRoot.querySelector("#product-form");
  const imageList = portalRoot.querySelector("#product-image-list");
  const renderImages = () => {
    imageList.innerHTML = images.map((image, index) => `<span class="image-chip"><img src="${escapeHtml(safeImage(image, fallbackProductImage))}" alt="" /><button type="button" data-remove-image="${index}" aria-label="Remove image"><i data-lucide="x"></i></button></span>`).join("");
    imageList.querySelectorAll("[data-remove-image]").forEach((button) => {
      button.addEventListener("click", () => {
        images.splice(Number(button.dataset.removeImage), 1);
        renderImages();
      });
    });
    refreshIcons(imageList);
  };
  renderImages();
  form.querySelector("#product-images").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const files = [...input.files].slice(0, Math.max(0, 6 - images.length));
    if (!files.length) {
      return;
    }
    try {
      for (const file of files) {
        images.push(await uploadImage(file));
      }
      input.value = "";
      renderImages();
    } catch (error) {
      showFormError(form, error.message);
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const comparePrice = String(values.get("comparePrice") || "").trim();
    const payload = {
      name: String(values.get("name") || ""),
      categoryId: values.get("categoryId") ? Number(values.get("categoryId")) : null,
      description: String(values.get("description") || ""),
      benefits: String(values.get("benefits") || ""),
      ingredients: String(values.get("ingredients") || ""),
      howToUse: String(values.get("howToUse") || ""),
      pricePaise: toPaise(values.get("price")),
      compareAtPricePaise: comparePrice ? toPaise(comparePrice) : null,
      stock: Number(values.get("stock")),
      sku: String(values.get("sku") || "").trim() || null,
      sizes: String(values.get("sizes") || "").split(",").map((size) => size.trim()).filter(Boolean),
      images,
      status: String(values.get("status") || "draft"),
      featured: form.elements.featured.checked
    };
    try {
      const id = form.dataset.id;
      await api(id ? `/api/admin/products/${id}` : "/api/admin/products", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      closePortal();
      showToast("Product saved.");
      await refreshAdminAndStore("products");
    } catch (error) {
      showFormError(form, error.message);
    }
  });
  refreshIcons(portalRoot);
}

function openCategoryEditor(category = null) {
  openBasicEditor({
    title: category ? "Edit collection" : "Add collection",
    formId: "category-form",
    content: `
      <div class="form-field full"><label for="category-name">Collection name</label><input id="category-name" name="name" value="${escapeHtml(category?.name || "")}" maxlength="80" required /></div>
      <div class="form-field full"><label for="category-description">Description</label><textarea id="category-description" name="description" maxlength="400">${escapeHtml(category?.description || "")}</textarea></div>
      <label class="checkbox-field full"><input name="isActive" type="checkbox" ${category?.isActive ?? true ? "checked" : ""} />Show this collection on the storefront</label>`,
    onSubmit: async (form) => {
      const values = new FormData(form);
      const payload = { name: String(values.get("name") || ""), description: String(values.get("description") || ""), isActive: form.elements.isActive.checked };
      await api(category ? `/api/admin/categories/${category.id}` : "/api/admin/categories", { method: category ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await refreshAdminAndStore("categories");
    }
  });
}

function openBannerEditor(banner = null) {
  let imageUrl = banner?.imageUrl || "";
  openBasicEditor({
    title: banner ? "Edit banner" : "Add banner",
    formId: "banner-form",
    content: `
      <div class="form-field full"><label for="banner-title">Headline</label><input id="banner-title" name="title" value="${escapeHtml(banner?.title || "")}" maxlength="110" required /></div>
      <div class="form-field full"><label for="banner-subtitle">Supporting text</label><textarea id="banner-subtitle" name="subtitle" maxlength="300">${escapeHtml(banner?.subtitle || "")}</textarea></div>
      <div class="form-field"><label for="banner-cta-label">Button label</label><input id="banner-cta-label" name="ctaLabel" value="${escapeHtml(banner?.ctaLabel || "")}" maxlength="40" /></div>
      <div class="form-field"><label for="banner-cta-url">Button link</label><input id="banner-cta-url" name="ctaUrl" value="${escapeHtml(banner?.ctaUrl || "/#shop")}" maxlength="250" required /></div>
      <div class="form-field"><label for="banner-position">Display position</label><input id="banner-position" name="position" value="${banner?.position ?? 0}" type="number" min="0" max="1000" required /></div>
      <label class="checkbox-field"><input name="isActive" type="checkbox" ${banner?.isActive ?? true ? "checked" : ""} />Show on storefront</label>
      <div class="form-field full"><label for="banner-image">Banner image</label><input id="banner-image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><div class="image-list" id="banner-image-preview"></div></div>`,
    onReady: (form) => {
      const preview = form.querySelector("#banner-image-preview");
      const renderImage = () => {
        preview.innerHTML = imageUrl ? `<span class="image-chip"><img src="${escapeHtml(safeImage(imageUrl, fallbackProductImage))}" alt="" /><button type="button" data-remove-banner-image aria-label="Remove image"><i data-lucide="x"></i></button></span>` : "";
        preview.querySelector("[data-remove-banner-image]")?.addEventListener("click", () => {
          imageUrl = "";
          renderImage();
        });
        refreshIcons(preview);
      };
      renderImage();
      form.querySelector("#banner-image").addEventListener("change", async (event) => {
        const input = event.currentTarget;
        const file = input.files[0];
        if (!file) {
          return;
        }
        try {
          imageUrl = await uploadImage(file);
          input.value = "";
          renderImage();
        } catch (error) {
          showFormError(form, error.message);
        }
      });
    },
    onSubmit: async (form) => {
      const values = new FormData(form);
      const payload = {
        title: String(values.get("title") || ""),
        subtitle: String(values.get("subtitle") || ""),
        ctaLabel: String(values.get("ctaLabel") || ""),
        ctaUrl: String(values.get("ctaUrl") || ""),
        imageUrl,
        isActive: form.elements.isActive.checked,
        position: Number(values.get("position"))
      };
      await api(banner ? `/api/admin/banners/${banner.id}` : "/api/admin/banners", { method: banner ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await refreshAdminAndStore("banners");
    }
  });
}

function openCouponEditor(coupon = null) {
  openBasicEditor({
    title: coupon ? "Edit coupon" : "Add coupon",
    formId: "coupon-form-admin",
    content: `
      <div class="form-field"><label for="coupon-code">Code</label><input id="coupon-code" name="code" value="${escapeHtml(coupon?.code || "")}" maxlength="24" required /></div>
      <div class="form-field"><label for="coupon-type">Discount type</label><select id="coupon-type" name="discountType"><option value="percentage" ${coupon?.discountType === "percentage" || !coupon ? "selected" : ""}>Percentage</option><option value="fixed" ${coupon?.discountType === "fixed" ? "selected" : ""}>Fixed amount</option></select></div>
      <div class="form-field"><label for="coupon-value">Discount value</label><input id="coupon-value" name="discountValue" value="${coupon ? escapeHtml(String(coupon.discountType === "fixed" ? coupon.discountValue / 100 : coupon.discountValue)) : ""}" type="number" min="1" step="0.01" required /></div>
      <div class="form-field"><label for="coupon-minimum">Minimum order (Rs.)</label><input id="coupon-minimum" name="minOrder" value="${coupon ? escapeHtml(String(coupon.minOrderPaise / 100)) : "0"}" type="number" min="0" step="0.01" required /></div>
      <div class="form-field"><label for="coupon-maximum">Maximum discount (Rs.)</label><input id="coupon-maximum" name="maxDiscount" value="${coupon?.maxDiscountPaise ? escapeHtml(String(coupon.maxDiscountPaise / 100)) : ""}" type="number" min="1" step="0.01" /></div>
      <div class="form-field"><label for="coupon-limit">Usage limit</label><input id="coupon-limit" name="usageLimit" value="${coupon?.usageLimit || ""}" type="number" min="1" step="1" /></div>
      <div class="form-field"><label for="coupon-start">Start time</label><input id="coupon-start" name="startsAt" value="${escapeHtml(toDateTimeLocal(coupon?.startsAt))}" type="datetime-local" /></div>
      <div class="form-field"><label for="coupon-end">End time</label><input id="coupon-end" name="endsAt" value="${escapeHtml(toDateTimeLocal(coupon?.endsAt))}" type="datetime-local" /></div>
      <label class="checkbox-field"><input name="isActive" type="checkbox" ${coupon?.isActive ?? true ? "checked" : ""} />Activate this coupon</label>`,
    onSubmit: async (form) => {
      const values = new FormData(form);
      const type = String(values.get("discountType"));
      const maxDiscount = String(values.get("maxDiscount") || "").trim();
      const usageLimit = String(values.get("usageLimit") || "").trim();
      const payload = {
        code: String(values.get("code") || "").trim().toUpperCase(),
        discountType: type,
        discountValue: type === "fixed" ? toPaise(values.get("discountValue")) : Math.round(Number(values.get("discountValue"))),
        minOrderPaise: toPaise(values.get("minOrder")),
        maxDiscountPaise: maxDiscount ? toPaise(maxDiscount) : null,
        startsAt: String(values.get("startsAt") || "") || null,
        endsAt: String(values.get("endsAt") || "") || null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        isActive: form.elements.isActive.checked
      };
      await api(coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons", { method: coupon ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await refreshAdminAndStore("coupons", false);
    }
  });
}

function openPasswordEditor() {
  openBasicEditor({
    title: "Change password",
    formId: "password-form",
    content: `<div class="form-field full"><label for="current-password">Current password</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required /></div><div class="form-field full"><label for="new-password">New password</label><input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="12" required /></div>`,
    onSubmit: async (form) => {
      const values = new FormData(form);
      const result = await api("/api/admin/password", { method: "PATCH", body: JSON.stringify(Object.fromEntries(values.entries())) });
      state.admin = result.administrator;
      state.csrfToken = result.csrfToken;
    }
  });
}

function openBasicEditor({ title, formId, content, onReady, onSubmit }) {
  portalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-portal"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><h2>${escapeHtml(title)}</h2><button class="icon-button" type="button" data-action="close-portal" aria-label="Close editor" title="Close"><i data-lucide="x"></i></button></div><div class="modal-body"><form id="${escapeHtml(formId)}" class="form-grid">${content}<div class="form-actions full"><button class="secondary-button" type="button" data-action="close-portal">Cancel</button><button class="primary-button" type="submit">Save <i data-lucide="save"></i></button></div></form></div></section></div>`;
  const form = portalRoot.querySelector(`#${CSS.escape(formId)}`);
  onReady?.(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await onSubmit(form);
      closePortal();
      showToast("Saved.");
    } catch (error) {
      showFormError(form, error.message);
    }
  });
  refreshIcons(portalRoot);
}

async function uploadImage(file) {
  const form = new FormData();
  form.append("image", file);
  const result = await api("/api/admin/media", { method: "POST", body: form });
  return result.url;
}

async function deleteAdminItem(resource, id, label) {
  if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) {
    return;
  }
  try {
    await api(`/api/admin/${resource}/${id}`, { method: "DELETE" });
    showToast(`${capitalize(label)} deleted.`);
    await refreshAdminAndStore(state.adminTab, resource === "products" || resource === "banners" || resource === "categories");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function refreshAdminAndStore(tab, refreshStore = true) {
  if (refreshStore) {
    await loadStoreData();
  }
  await loadAdminTab(tab);
}

async function logoutAdministrator() {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } catch {
    // The local session is still cleared when an already-expired token cannot be revoked.
  }
  state.admin = null;
  state.csrfToken = "";
  state.adminData = {};
  renderAdmin();
}

function handlePortalClick(event) {
  if (event.target.classList.contains("drawer-backdrop") || event.target.classList.contains("modal-backdrop")) {
    closePortal();
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target || target.classList.contains("drawer-backdrop") || target.classList.contains("modal-backdrop")) {
    return;
  }
  const action = target.dataset.action;
  if (action === "close-portal") {
    closePortal();
  }
  if (action === "increase-cart") {
    updateCartQuantity(target.dataset.key, 1);
  }
  if (action === "decrease-cart") {
    updateCartQuantity(target.dataset.key, -1);
  }
  if (action === "remove-cart") {
    removeCartItem(target.dataset.key);
  }
  if (action === "open-checkout") {
    openCheckout();
  }
}

appRoot.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action='save-order']");
  if (!target) {
    return;
  }
  const orderId = target.dataset.id;
  const select = appRoot.querySelector(`[data-order-status="${CSS.escape(orderId)}"]`);
  if (!select) {
    return;
  }
  target.disabled = true;
  try {
    await api(`/api/admin/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ fulfillmentStatus: select.value, note: "" }) });
    showToast("Order status saved.");
    await loadAdminTab("orders");
  } catch (error) {
    showToast(error.message, true);
    target.disabled = false;
  }
});

appRoot.addEventListener("submit", async (event) => {
  if (event.target.id !== "settings-form") {
    return;
  }
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const payload = {
    storeName: String(values.get("storeName") || ""),
    announcement: String(values.get("announcement") || ""),
    shippingFeePaise: toPaise(values.get("shippingFee")),
    freeShippingThresholdPaise: toPaise(values.get("freeShippingThreshold")),
    codEnabled: form.elements.codEnabled.checked
  };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    showToast("Store settings saved.");
    await refreshAdminAndStore("settings");
  } catch (error) {
    showFormError(form, error.message);
  }
});

function closePortal() {
  state.accountProfileRequestId += 1;
  portalRoot.innerHTML = "";
}

function findProduct(id) {
  return state.catalog.find((product) => product.id === id) || state.storefront.products.find((product) => product.id === id) || null;
}

function cartKey(productId, size) {
  return `${productId}|${size || ""}`;
}

function cartQuantity() {
  return state.cart.reduce((total, item) => total + item.quantity, 0);
}

function readStoredCart() {
  try {
    const raw = JSON.parse(localStorage.getItem("shrishti-organic-cart") || "[]");
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((item) => item && typeof item.productId === "string" && typeof item.size === "string" && Number.isInteger(item.quantity) && item.quantity > 0)
      .slice(0, 12);
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("shrishti-organic-cart", JSON.stringify(state.cart));
}

function safeImage(url, fallback) {
  return typeof url === "string" && /^\/media\/[a-f0-9-]+\.webp$/.test(url) ? url : fallback;
}

function safePath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/#shop";
}

function formatMoney(paise) {
  return moneyFormatter.format((Number(paise) || 0) / 100);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toPaise(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function capitalize(value) {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : "";
}

function readCookie(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length) || "";
}

function refreshIcons(root = document) {
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" }, root });
}

function showToast(message, isError = false) {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    document.body.append(region);
  }
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", isError ? "circle-alert" : "circle-check");
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(icon, text);
  region.append(toast);
  refreshIcons(toast);
  window.setTimeout(() => toast.remove(), 4600);
}

function showFormError(form, message) {
  const errorContainer = form.querySelector("[data-form-errors]") || form;
  errorContainer.querySelector(".notice.error")?.remove();
  const notice = document.createElement("p");
  notice.className = "notice error";
  notice.textContent = message;
  errorContainer.prepend(notice);
}