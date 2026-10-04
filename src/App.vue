<script setup>
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import Header from './components/Header.vue';
import BannerSlider from './components/BannerSlider.vue';
import TaskWizard from './components/TaskWizard.vue';
import Catalog from './components/Catalog.vue';
import Footer from './components/Footer.vue';
import Toast from './components/Toast.vue';
import { products, t, siteSettings } from './data.js';

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
const isAdminView = ref(false);

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
  isAdminView.value = window.location.pathname === '/admin';
};

const handleCloseAdmin = () => {
  isAdminView.value = false;
  window.history.pushState({}, '', '/');
};

let originalPushState = null;

onMounted(() => {
  checkPath();
  window.addEventListener('popstate', checkPath);
  
  // Custom navigation interceptor for path-based routing in standard Vue
  originalPushState = window.history.pushState;
  window.history.pushState = function(...args) {
    originalPushState.apply(this, args);
    checkPath();
  };
});

onUnmounted(() => {
  window.removeEventListener('popstate', checkPath);
  if (originalPushState) {
    window.history.pushState = originalPushState;
  }
});
</script>

<template>
  <div class="app-wrapper">
    <template v-if="isAdminView">
      <AdminPanel @close="handleCloseAdmin" />
    </template>

    <template v-else>
      <!-- Navbar / Header -->
      <Header 
        :cartTotal="cartTotal"
        :cartItemsCount="cartItemsCount"
        @open-cart="isCartOpen = true"
      />

      <BannerSlider />

      <!-- Section 1: Choose by Task Wizard -->
      <TaskWizard 
        :cart="cart"
        @add-to-cart="handleAddToCart"
        @open-gallery="handleOpenGallery"
        @open-installment="handleOpenInstallment"
      />

      <!-- Section 4: Categorized Catalog Explorer -->
      <Catalog 
        @add-to-cart="handleAddToCart"
        @open-gallery="handleOpenGallery"
        @open-installment="handleOpenInstallment"
      />

      <!-- Static Information Footer -->
      <Footer />

      <!-- Right Drawer Cart -->
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
</style>
