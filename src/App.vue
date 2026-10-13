<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, defineAsyncComponent, watch } from 'vue';
import Header from './components/Header.vue';
import BannerSlider from './components/BannerSlider.vue';
import Hero from './components/Hero.vue';
import BannerInfo from './components/BannerInfo.vue';
import { isSafeLink } from '../shared/marketing.js';
import { publicPath, parsePublicRoute, publicRecord, isPlainNavigation, pageMetadata, homePath, hasKazakhPage, pageAlternates } from '../shared/publicRoutes.js';
import { pageStructuredData, serializeScriptData } from '../shared/structuredData.js';
import TaskWizard from './components/TaskWizard.vue';
import Catalog from './components/Catalog.vue';
import Footer from './components/Footer.vue';
import Toast from './components/Toast.vue';
import { useStorefrontData } from './storefrontData.js';

const { products, categories, tasks, t, siteSettings, currentLang, setLang, catalogLoading, databaseReady, isFallbackMode, loadDatabase, translateTask, translateCategory } = useStorefrontData();
const catalog = { products, categories, tasks, siteSettings };
const props = defineProps({ initialUrl:{type:String,default:''} });
const browser = typeof window !== 'undefined';
const interactiveReady = ref(false);

// Lazy loaded components for bundle optimization
const CartDrawer = defineAsyncComponent(() => import('./components/CartDrawer.vue'));
const GalleryModal = defineAsyncComponent(() => import('./components/GalleryModal.vue'));
const InstallmentModal = defineAsyncComponent(() => import('./components/InstallmentModal.vue'));
const AdminPanel = defineAsyncComponent(() => import('./components/AdminPanel.vue'));

// State Management
const cart = ref(new Map());
const isCartOpen = ref(false);
const galleryProductId = ref(null);
const gallerySelectedSize = ref('');
const installmentProductId = ref(null);
const toastMsg = ref('');
const isToastVisible = ref(false);
const route = ref(parsePublicRoute(props.initialUrl || (browser ? window.location.pathname + window.location.search : '/')));
let currentPageKey = browser ? window.history.state?.packeraPage || crypto.randomUUID() : '';
const scrollPositions = new Map();
const isAdminView = computed(() => route.value.kind === 'admin');
const routeRecord = computed(() => databaseReady.value ? publicRecord(route.value, catalog) : null);
const routeStatus = computed(() => {
  if (route.value.kind === 'missing') return 'missing';
  if (catalogLoading.value && !databaseReady.value) return 'loading';
  if (route.value.kind === 'home' && route.value.lang === 'kk' && databaseReady.value && !hasKazakhPage(route.value, null, catalog)) return 'missing';
  if (route.value.kind === 'home' && (databaseReady.value || isFallbackMode.value)) return 'ready';
  if (!databaseReady.value) return 'error';
  return routeRecord.value ? 'ready' : 'missing';
});
const pageTitle = computed(() => route.value.kind === 'category' ? translateCategory(routeRecord.value?.name || '') : route.value.kind === 'task' ? translateTask(routeRecord.value)?.title || '' : routeRecord.value?.title || '');
const productCategory = computed(() => route.value.kind === 'product' ? categories.find(category => category.name === routeRecord.value?.category) : null);
const infoBanner = ref(null);
const homeUrl = computed(() => homePath(route.value.lang === 'kk' && hasKazakhPage({kind:'home'}, null, catalog) ? 'kk' : 'ru'));
const pageSchema = computed(() => routeStatus.value === 'ready' ? pageStructuredData(route.value, routeRecord.value, catalog, currentLang.value) : []);
const languageUrls = computed(() => {
  if (routeStatus.value !== 'ready') return {};
  const path = language => route.value.kind === 'home' ? homePath(language) : publicPath(route.value.kind, routeRecord.value.id, route.value.size, language);
  return { ru:path('ru'), kk:hasKazakhPage(route.value, routeRecord.value, catalog) ? path('kk') : undefined };
});
watch(route, value => {
  if (['home','task'].includes(value.kind)) setLang(value.lang || 'ru');
}, {immediate:true});

async function handleBannerAction(banner) {
  const {actionType,actionTarget} = banner;
  if (actionType === 'none' || !actionType) return;
  if (actionType === 'info') { infoBanner.value=banner; return; }
  if (actionType === 'link') {
    if (!isSafeLink(actionTarget)) return;
    if(actionTarget.startsWith('#')) {
      const element=document.getElementById(actionTarget.slice(1));
      if(element) element.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
      else triggerToast(t('destinationUnavailable'));
    } else window.location.assign(actionTarget);
    return;
  }
  if (actionType === 'product') {
    if(products.some(p=>p.id===actionTarget && p.isVisible!==false)) navigate(publicPath('product', actionTarget));
    else triggerToast(t('destinationUnavailable'));
    return;
  }
  if(actionType==='category') {
    const category=categories.find(c=>c.id===actionTarget);
    if(category) { navigate(publicPath('category', category.id)); return; }
  } else if(actionType==='task' && tasks.some(task=>task.id===actionTarget)) {
    const task = tasks.find(item => item.id === actionTarget);
    navigate(publicPath('task', actionTarget, '', currentLang.value === 'kk' && hasKazakhPage({kind:'task'}, task, catalog) ? 'kk' : 'ru')); return;
  }
  triggerToast(t('destinationUnavailable'));
}

const getProductPrice = (id) => {
  const [prodId, size] = id.split('::');
  const p = products.find(prod => prod.id === prodId);
  if (p) {
    if (size && p.sizes && p.sizes.length > 0) {
      const found = p.sizes.find(s => s.size === size);
      if (found) return found.price;
    }
    return p.price;
  }
  return 0;
};

// Computed Cart Calculations
const cartTotal = computed(() => {
  return [...cart.value.entries()].reduce((sum, [id, qty]) => {
    return sum + (getProductPrice(id) * qty);
  }, 0);
});

const cartItemsCount = computed(() => {
  return [...cart.value.entries()].reduce((sum, [, qty]) => sum + qty, 0);
});



let toastTimeout = null;
const triggerToast = (message) => {
  toastMsg.value = message;
  isToastVisible.value = true;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    isToastVisible.value = false;
  }, 2200);
};

const handleAddToCart = (id, qty = 1) => {
  const current = cart.value.get(id) || 0;
  cart.value.set(id, current + qty);
  
  const [prodId, size] = id.split('::');
  const product = products.find(p => p.id === prodId);
  const sizeText = size ? ` (${size})` : '';
  const itemTitle = product ? product.title : t('toastDefaultItem');
  triggerToast(`${itemTitle}${sizeText} ${t('toastAdded')}`);
};

const handleAddKitToCart = (kitItems) => {
  kitItems.forEach(({ id, qty }) => {
    // Add default sizes if any
    const product = products.find(p => p.id === id);
    const size = product && product.sizes && product.sizes[0] ? product.sizes[0].size : '';
    const cartKey = size ? `${id}::${size}` : `${id}::`;
    const current = cart.value.get(cartKey) || 0;
    cart.value.set(cartKey, current + qty);
  });
  triggerToast(t('toastKitAdded'));
  isCartOpen.value = true;
};

const handleUpdateCartQty = (id, delta) => {
  const current = cart.value.get(id) || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) {
    cart.value.delete(id);
  } else {
    cart.value.set(id, next);
  }
};

const handleSetCartQty = (id, val) => {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 1) {
    cart.value.set(id, 1);
  } else {
    cart.value.set(id, parsed);
  }
};

const handleRemoveFromCart = (id) => {
  cart.value.delete(id);
  triggerToast(t('toastRemoved'));
};

const handleOpenGallery = (id, size = '') => {
  galleryProductId.value = id;
  gallerySelectedSize.value = size || '';
};

const handleCloseGallery = () => {
  galleryProductId.value = null;
  gallerySelectedSize.value = '';
};

const handleOpenInstallment = (id) => {
  installmentProductId.value = id;
};

const handleCloseInstallment = () => {
  installmentProductId.value = null;
};

const checkPath = () => {
  route.value = parsePublicRoute(window.location.pathname + window.location.search);
};

const handleCloseAdmin = () => {
  navigate('/');
};

function navigate(href, { replace = false, scroll = true } = {}) {
  if (href === window.location.pathname + window.location.search) return;
  if (!replace) {
    const position = [window.scrollX, window.scrollY];
    scrollPositions.set(currentPageKey, position);
    window.history.replaceState({ ...window.history.state, packeraPage:currentPageKey, packeraScroll:position }, '', window.location.href);
    currentPageKey = crypto.randomUUID();
  }
  window.history[replace ? 'replaceState' : 'pushState'](replace ? { ...window.history.state, packeraPage:currentPageKey } : { packeraPage:currentPageKey, packeraScroll:[0,0] }, '', href);
  checkPath();
  if (scroll) nextTick(() => window.scrollTo({ top:0, left:0, behavior:'instant' }));
}
function navigateLink(event) {
  if (!isPlainNavigation(event)) return;
  const link = event.target.closest('a[href]');
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin || url.hash || parsePublicRoute(url.pathname + url.search).kind === 'missing') return;
  event.preventDefault();
  navigate(url.pathname + url.search);
}
function selectProductVariant(size) {
  navigate(publicPath('product', route.value.id, size), { replace:true, scroll:false });
}
async function retryCatalog() {
  try { await loadDatabase(); } catch { triggerToast(t('catalogUnavailable')); }
}
async function historyChanged(event) {
  // With manual restoration the outgoing page is still at its own position here.
  scrollPositions.set(currentPageKey, [window.scrollX, window.scrollY]);
  currentPageKey = event.state?.packeraPage || crypto.randomUUID();
  if (!event.state?.packeraPage) window.history.replaceState({ ...event.state, packeraPage:currentPageKey }, '', window.location.href);
  checkPath();
  await nextTick();
  const position = scrollPositions.get(currentPageKey) || event.state?.packeraScroll;
  if (position) window.scrollTo({ left:position[0], top:position[1], behavior:'instant' });
  else if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  else window.scrollTo({ top:0, left:0, behavior:'instant' });
}
watch(() => (route.value.lang || 'ru') + ':' + route.value.kind + ':' + (route.value.id || ''), () => {
  handleCloseGallery();
  handleCloseInstallment();
  infoBanner.value = null;
  isCartOpen.value = false;
});
watch([route, routeRecord, routeStatus, pageSchema, currentLang], () => {
  if (!browser) return;
  if (route.value.kind === 'product' && routeRecord.value && route.value.size && !routeRecord.value.sizes?.some(size => size.size === route.value.size)) {
    navigate(publicPath('product', route.value.id), { replace:true, scroll:false });
    return;
  }
  const noindex = isAdminView.value || routeStatus.value === 'missing';
  let robots = document.querySelector('meta[name="robots"]');
  if (noindex || robots) {
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
    robots.content = noindex ? 'noindex, nofollow' : 'index, follow';
  }
  let schema = document.getElementById('packera-structured-data');
  const structuredData = pageSchema.value;
  if (structuredData.length) {
    if (!schema) { schema = document.createElement('script'); schema.id = 'packera-structured-data'; schema.type = 'application/ld+json'; document.head.append(schema); }
    schema.textContent = serializeScriptData(structuredData);
  } else schema?.remove();
  document.documentElement.lang = route.value.lang || 'ru';
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
  if (routeStatus.value === 'ready') for (const item of pageAlternates(route.value, routeRecord.value, catalog)) {
    const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = item.language; link.href = item.url; document.head.append(link);
  }
  if (route.value.kind !== 'home' && !routeRecord.value) return;
  const meta = pageMetadata(route.value, routeRecord.value, catalog);
  document.title = meta.title;
  for (const [selector, attribute, value] of [
    ['link[rel="canonical"]', 'href', meta.url], ['meta[name="description"]', 'content', meta.description],
    ['meta[property="og:title"]', 'content', meta.title], ['meta[property="og:description"]', 'content', meta.description],
    ['meta[property="og:url"]', 'content', meta.url], ['meta[property="og:image"]', 'content', meta.image],
  ]) document.querySelector(selector)?.setAttribute(attribute, value);
  let locale = document.querySelector('meta[property="og:locale"]');
  if (!locale) { locale = document.createElement('meta'); locale.setAttribute('property','og:locale'); document.head.append(locale); }
  locale.content = route.value.lang === 'kk' ? 'kk_KZ' : 'ru_KZ';
}, { immediate:true });

let previousScrollRestoration;

onMounted(() => {
  interactiveReady.value = true;
  checkPath();
  window.history.replaceState({ ...window.history.state, packeraPage:currentPageKey }, '', window.location.href);
  previousScrollRestoration = window.history.scrollRestoration;
  window.history.scrollRestoration = 'manual';
  window.addEventListener('popstate', historyChanged);
});

onUnmounted(() => {
  window.removeEventListener('popstate', historyChanged);
  window.history.scrollRestoration = previousScrollRestoration;
});
</script>

<template>
  <div class="app-wrapper" @click="navigateLink">
    <template v-if="isAdminView">
      <AdminPanel @close="handleCloseAdmin" />
    </template>

    <template v-else>
      <!-- Navbar / Header -->
      <Header 
        :language-urls="languageUrls"
        :home-url="homeUrl"
        :cartTotal="cartTotal"
        :cartItemsCount="cartItemsCount"
        @open-cart="isCartOpen = true"
      />

      <div v-if="routeStatus === 'loading'" class="storefront-loading container" aria-busy="true" :aria-label="t('catalogTitle')">
        <div class="storefront-loading-banner"></div>
      </div>
      <main v-else-if="routeStatus !== 'ready'" class="public-page-heading container">
        <h1>{{ routeStatus === 'missing' ? t('pageNotFound') : t('catalogUnavailable') }}</h1>
        <a :href="homeUrl">{{ t('homePage') }}</a>
        <button v-if="routeStatus === 'error'" class="btn btn-primary" @click="retryCatalog">{{ t('retryLoading') }}</button>
      </main>
      <template v-else>
      <Hero v-if="route.kind === 'home'" @action="handleBannerAction" />
      <BannerSlider v-if="route.kind === 'home'" @action="handleBannerAction" />
      <div v-if="route.kind !== 'home'" class="public-page-heading container">
        <nav :aria-label="t('pageNavigation')"><a :href="homeUrl">{{ t('homePage') }}</a><template v-if="productCategory"> / <a :href="publicPath('category', productCategory.id)">{{ translateCategory(productCategory.name) }}</a></template></nav>
        <h1>{{ pageTitle }}</h1>
        <p v-if="route.kind === 'task'">{{ translateTask(routeRecord).desc }}</p>
      </div>

      <!-- Section 1: Choose by Task Wizard -->
      <TaskWizard 
        v-if="route.kind === 'home' || route.kind === 'task'"
        :task-id="route.kind === 'task' ? route.id : ''"
        :hide-selector="route.kind === 'task'"
        :cart="cart"
        @add-to-cart="handleAddToCart"
        @open-gallery="handleOpenGallery"
        @open-installment="handleOpenInstallment"
      />

      <!-- Section 4: Categorized Catalog Explorer -->
      <Catalog 
        v-if="['home', 'category', 'product'].includes(route.kind)"
        :category-id="route.kind === 'category' ? route.id : ''"
        :product-id="route.kind === 'product' ? route.id : ''"
        :selected-size="route.kind === 'product' ? route.size : ''"
        @variant-change="selectProductVariant"
        @add-to-cart="handleAddToCart"
        @open-gallery="handleOpenGallery"
        @open-installment="handleOpenInstallment"
      />

      <!-- Static Information Footer -->
      <Footer />
      </template>
      <BannerInfo v-if="infoBanner" :banner="infoBanner" @close="infoBanner=null" />

      <!-- Right Drawer Cart -->
      <template v-if="interactiveReady">
      <CartDrawer 
        :isOpen="isCartOpen"
        :cart="cart"
        @close="isCartOpen = false"
        @update-qty="handleUpdateCartQty"
        @set-qty="handleSetCartQty"
        @remove-from-cart="handleRemoveFromCart"
        @open-installment="handleOpenInstallment"
      />

      <!-- Lightbox Fullscreen Photo Gallery -->
      <GalleryModal 
        :productId="galleryProductId"
        :selectedSize="gallerySelectedSize"
        @close="handleCloseGallery"
      />

      <!-- Kaspi/Halyk Installment Calculator Popup -->
      <InstallmentModal 
        v-if="siteSettings.installmentEnabled"
        :productId="installmentProductId"
        @close="handleCloseInstallment"
      />
      </template>

      <!-- Toast Notification Banner -->
      <Toast 
        :message="toastMsg"
        :show="isToastVisible"
      />
    </template>
  </div>
</template>

<style>
/* Global resets & styles mapped from style.css */
.storefront-loading { min-height:100svh; padding-top:20px; }
.storefront-loading-banner { height:350px; border-radius:16px; background:var(--bg-soft); }
.public-page-heading { padding-top:28px; padding-bottom:20px; }
.public-page-heading nav { font-size:14px; color:var(--text-lead); margin-bottom:16px; }
.public-page-heading h1 { font-family:var(--font-body); font-size:clamp(26px,4vw,38px); line-height:1.2; margin-bottom:12px; overflow-wrap:anywhere; }
.public-page-heading p { color:var(--text-lead); }
@media(max-width:767px) {
  .storefront-loading { padding-top:12px; }
  .storefront-loading-banner { height:250px; border-radius:12px; }
}
</style>
