<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { getProductImages } from '../../shared/productImages.js';
import { thumbnailUrl, thumbnailSrcset } from '../imageUrls.js';
import { useStorefrontData } from '../storefrontData.js';
const { categories, products, icons, t, translateCategory, databaseReady } = useStorefrontData();
import { publicPath, isPlainNavigation } from '../../shared/publicRoutes.js';

const props = defineProps({ categoryId: { type:String, default:'' }, productId: { type:String, default:'' }, selectedSize: { type:String, default:'' } });

const emit = defineEmits(['add-to-cart', 'open-gallery', 'open-installment', 'variant-change']);

const activeCategory = ref("📦 Картонные изделия");
defineExpose({selectCategory:name => { activeCategory.value=name; }});

watch(() => categories, (newCats) => {
  if (newCats.length > 0 && !newCats.some(c => c.name === activeCategory.value)) {
    activeCategory.value = newCats[0].name;
  }
}, { deep: true, immediate: true });

const filteredProducts = computed(() => {
  return products
    .filter(p => (props.productId ? p.id === props.productId : p.category === activeCategory.value) && p.isVisible !== false)
    .sort((a, b) => {
      const orderA = Number(a.categorySortOrder ?? a.sortOrder) || 0;
      const orderB = Number(b.categorySortOrder ?? b.sortOrder) || 0;
      return orderA - orderB || String(a.id).localeCompare(String(b.id));
    });
});

// Quantity adjustments in the individual cards (local UI state before adding to cart)
const cardQuantities = ref({});

const getQuantity = (id) => {
  if (cardQuantities.value[id] === undefined) {
    cardQuantities.value[id] = 1;
  }
  return cardQuantities.value[id];
};

const setQuantity = (id, val) => {
  if (val === '' || isNaN(val)) {
    cardQuantities.value[id] = '';
  } else {
    cardQuantities.value[id] = Math.max(1, parseInt(val, 10));
  }
};
// Image switcher helpers
const activeImageIndices = ref({});



const setActiveImage = (productId, idx) => {
  activeImageIndices.value[productId] = idx;
  if (typeof document === 'undefined') return;
  const el = document.getElementById(`catalog-visual-box-${productId}`);
  if (el) {
    el.scrollTo({
      left: idx * el.clientWidth,
      behavior: 'smooth'
    });
  }
};

const handleScroll = (productId, event) => {
  const el = event.target;
  if (el.clientWidth) {
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    activeImageIndices.value[productId] = idx;
  }
};

const cleanCatName = (name) => {
  return name.replace(/^[^a-zA-Zа-яА-ЯёЁ]*\s*/, '');
};

const getCategoryIcon = (name) => {
  const clean = cleanCatName(name).toLowerCase();
  if (clean.includes('картон')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  }
  if (clean.includes('плен') || clean.includes('плён')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 6a6 6 0 0 1 6 6"></path></svg>`;
  }
  if (clean.includes('скотч') || clean.includes('лент')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><path d="M12 2a10 10 0 0 1 8 4l-4 4"></path></svg>`;
  }
  if (clean.includes('сумк') || clean.includes('баул') || clean.includes('пакет')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
  }
  if (clean.includes('перчат')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"></path><path d="M10 10.5V5.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8.5"></path><path d="M6 14v-2.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6.5a6 6 0 0 0 6 6h7a5 5 0 0 0 5-5v-4"></path></svg>`;
  }
  if (clean.includes('личн') || clean.includes('защит')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11.9" r="2" /><path d="M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 9 3.7 9.6 2 11.6" /><path d="m8.9 10.1 1.4.8" /><path d="M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4-1.2 5.2-.6 6.9 1.5" /><path d="m15.1 10.1-1.4.8" /><path d="M16.7 20.8c-2.6-.4-4.6-2.6-4.7-5.3-.2 2.6-2.1 4.8-4.7 5.2" /><path d="M12 13.9v1.6" /><path d="M13.5 5.4c-1-.2-2-.2-3 0" /><path d="M17 16.4c.7-.7 1.2-1.6 1.5-2.5" /><path d="M5.5 13.9c.3.9.8 1.8 1.5 2.5" /></svg>`;
  }
  if (clean.includes('инструмент')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="9.8" y1="8.2" x2="21" y2="19.4"></line><line x1="9.8" y1="15.8" x2="21" y2="4.6"></line></svg>`;
  }
  if (clean.includes('фиксац') || clean.includes('аксессуар')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
  }
  if (clean.includes('ветош') || clean.includes('бытов')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8M5 12h14M19 12l-2-4H7l-2 4M7 8V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5"></path></svg>`;
  }
  if (clean.includes('салфет')) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 22H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z"></path><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path><path d="M4 11h16M12 15v4"></path></svg>`;
  }
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`;
};

// Size selector state
const selectedSizes = ref({});
const imageSelectedSizes = ref({});
const expandedSizes = ref({});

watch(() => categories.find(category => category.id === props.categoryId)?.name, name => {
  if (name) activeCategory.value = name;
}, { immediate:true });
watch(() => [products.find(product => product.id === props.productId), props.selectedSize], ([product, size]) => {
  if (!product) return;
  const explicit = product.sizes?.some(variant => variant.size === size) ? size : '';
  selectedSizes.value[product.id] = explicit || product.sizes?.[0]?.size || '';
  imageSelectedSizes.value[product.id] = explicit;
  nextTick(() => setActiveImage(product.id, 0));
}, { immediate:true });

const getSelectedSize = (productId) => {
  if (selectedSizes.value[productId] === undefined) {
    const product = products.find(p => p.id === productId);
    if (product && product.sizes && product.sizes.length > 0) {
      selectedSizes.value[productId] = product.sizes[0].size;
    } else {
      selectedSizes.value[productId] = '';
    }
  }
  return selectedSizes.value[productId];
};

const setSelectedSize = (productId, size) => {
  selectedSizes.value[productId] = size;
  imageSelectedSizes.value[productId] = size;
  nextTick(() => setActiveImage(productId,0));
  if (props.productId === productId) emit('variant-change', size);
};

const getVisibleSizes = (product) => {
  if (!product.sizes || product.sizes.length === 0) return [];
  if (props.productId) return product.sizes;
  const isExpanded = expandedSizes.value[product.id] || false;
  if (isExpanded) {
    return product.sizes;
  }
  return [];
};

const toggleSizesExpanded = (productId) => {
  expandedSizes.value[productId] = !expandedSizes.value[productId];
};

const getProductDisplayPrice = (product) => {
  const sel = getSelectedSize(product.id);
  if (sel && product.sizes && product.sizes.length > 0) {
    const found = product.sizes.find(s => s.size === sel);
    if (found) return found.price;
  }
  return product.price;
};

const getProductDisplayImages = product => getProductImages(product,imageSelectedSizes.value[product.id]);

const handleAddToCart = (product) => {
  const qty = getQuantity(product.id);
  const size = getSelectedSize(product.id);
  const cartKey = size ? `${product.id}::${size}` : `${product.id}::`;
  emit('add-to-cart', cartKey, qty);
  setQuantity(product.id, 1);
};
</script>

<template>
  <!-- Category Selector Section -->
  <section v-if="!productId" class="catalog-tabs-section" id="catalog-tabs-section">
    <div class="container">
      <h2 class="section-title">{{ t('catalogTitle') }}</h2>
      
      <!-- Category tabs scrollbar bar -->
      <nav class="category-tabs-nav" style="margin-bottom: 0;">
          <component :is="databaseReady ? 'a' : 'button'"
            v-for="cat in categories" 
            :key="cat.name"
            :href="databaseReady ? publicPath('category', cat.id) : undefined"
            :aria-current="activeCategory === cat.name ? 'true' : undefined"
            @click="isPlainNavigation($event) && (activeCategory = cat.name)"
            :class="['category-tab-btn', { active: activeCategory === cat.name }]"
          >
            <span class="cat-btn-content">
              <span class="cat-btn-icon">
                <img v-if="cat.icon" :src="cat.icon" style="width: 24px; height: 24px; object-fit: contain;" />
                <span v-else v-html="getCategoryIcon(cat.name)"></span>
              </span>
              <span class="cat-btn-text">{{ cleanCatName(translateCategory(cat.name)) }}</span>
            </span>
          </component>
      </nav>
    </div>
  </section>

  <!-- Products Grid Section -->
  <section class="catalog-products-section" :class="{'product-page':productId}" id="catalog-products-section">
    <div class="container">
      <!-- Products Grid -->
      <div class="products-grid" style="padding-left: 0; padding-right: 0; padding-top: 0; padding-bottom: 0;">
        <article 
          v-for="product in filteredProducts" 
          :key="product.id"
          class="product-card"
        >
          <!-- Visual trigger gallery -->
          <div 
            :id="`catalog-visual-box-${product.id}`"
            class="product-visual-box scroll-slider" 
            style="--visual-color: #f6f5f0"
            @scroll="handleScroll(product.id, $event)"
            @click="emit('open-gallery', product.id, imageSelectedSizes[product.id])"
          >
            <div 
              v-for="(img, idx) in getProductDisplayImages(product)"
              :key="idx"
              class="product-slide"
            >
              <img 
                :src="Math.abs(idx - (activeImageIndices[product.id] || 0)) <= 1 ? thumbnailUrl(img, productId ? 960 : 640) : undefined"
                :srcset="Math.abs(idx - (activeImageIndices[product.id] || 0)) <= 1 ? thumbnailSrcset(img) : undefined"
                :sizes="productId ? '(max-width: 767px) 90vw, 45vw' : '(max-width: 480px) 46vw, (max-width: 768px) 44vw, (max-width: 1024px) 30vw, 280px'"
                decoding="async"
                :alt="product.title" 
                :loading="productId && idx === 0 ? 'eager' : 'lazy'"
              />
            </div>
          </div>

          <!-- Info -->
          <div class="product-info">
            <!-- Pagination dots indicators -->
            <div 
              v-if="getProductDisplayImages(product).length > 1" 
              class="product-card-dots"
            >
              <button
                v-for="(img, idx) in getProductDisplayImages(product)"
                :key="idx"
                @click.stop="setActiveImage(product.id, idx)"
                :class="['card-dot', { active: (activeImageIndices[product.id] || 0) === idx }]"
                :aria-label="`Посмотреть изображение ${idx + 1}`"
              ></button>
            </div>

            <h4 v-if="!productId" class="product-title"><component :is="databaseReady ? 'a' : 'span'" :href="databaseReady ? publicPath('product', product.id, imageSelectedSizes[product.id]) : undefined">{{ product.title }}</component></h4>
            <p class="product-desc">{{ product.desc }}</p>
            <dl v-if="productId && Object.keys(product.specs || {}).length" class="product-page-specs">
              <div v-for="(value, key) in product.specs" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div>
            </dl>

            <!-- Sizes Selector Pills -->
            <div v-if="product.sizes && product.sizes.length > 0" class="product-sizes-selector">
              <span class="sizes-label">{{ t('sizeLabel') }}</span>
              <div class="sizes-pills">
                <button 
                  v-for="s in getVisibleSizes(product)" 
                  :key="s.size"
                  @click.stop="setSelectedSize(product.id, s.size)"
                  :class="['size-pill', { active: getSelectedSize(product.id) === s.size }]"
                  type="button"
                >
                  {{ s.size }}
                </button>
                <button 
                  v-if="!productId && product.sizes.length > 0"
                  @click.stop="toggleSizesExpanded(product.id)" 
                  class="size-pill more-btn"
                  type="button"
                >
                  {{ expandedSizes[product.id] ? t('hide') : t('more') }}
                </button>
              </div>
            </div>

            <!-- Price & Unit -->
            <div class="product-price-row">
              <span class="product-price">{{ getProductDisplayPrice(product).toLocaleString('ru-RU') }} ₸</span>
              <span class="product-unit" v-if="product.unit">{{ t('perUnit') }} {{ product.unit }}</span>
            </div>

          <!-- Action controls -->
          <div class="product-actions-row">
            <div class="stepper" @click.stop>
              <button @click="setQuantity(product.id, getQuantity(product.id) - 1)" aria-label="Уменьшить">-</button>
              <input 
                type="number" 
                :value="getQuantity(product.id)" 
                @input="setQuantity(product.id, $event.target.value)" 
                @blur="!getQuantity(product.id) && setQuantity(product.id, 1)"
                min="1"
              />
              <button @click="setQuantity(product.id, getQuantity(product.id) + 1)" aria-label="Увеличить">+</button>
            </div>
            <button 
              @click.stop="handleAddToCart(product)" 
              class="btn btn-primary btn-card-buy"
            >
              <span v-html="icons.cart"></span> {{ t('buy') }}
            </button>
          </div>
        </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.category-tabs-nav {
  margin-bottom: 24px;
}
.product-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s, box-shadow 0.2s;
}
.product-page .products-grid { display:block; }
.product-page .product-card { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:32px; padding:24px; }
.product-page .product-info { padding:0; min-width:0; overflow-wrap:anywhere; }
.product-page .product-desc { display:block; -webkit-line-clamp:unset; height:auto; max-height:none; overflow:visible; white-space:pre-line; }
.product-page .product-visual-box { min-width:0; align-self:start; }
.product-page-specs { margin:20px 0; }
.product-page-specs div { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; padding:8px 0; border-bottom:1px solid var(--border-line); overflow-wrap:anywhere; }
.product-page-specs dt { color:var(--text-lead); }
.product-page-specs dd { margin:0; }
@media(max-width:767px) { .product-page .product-card { grid-template-columns:minmax(0,1fr); gap:20px; padding:16px; } }
</style>
