<script setup>
import { ref, computed, nextTick, watch } from 'vue';
import { getProductImages } from '../../shared/productImages.js';
import { thumbnailUrl, thumbnailSrcset } from '../imageUrls.js';
import { compareTaskProducts } from '../taskSorting.js';
import { useStorefrontData } from '../storefrontData.js';
const { tasks, products, icons, t, translateTask, databaseReady, currentLang } = useStorefrontData();
import { publicPath, isPlainNavigation, hasKazakhPage } from '../../shared/publicRoutes.js';
const taskPath = task => publicPath('task', task.id, '', currentLang.value === 'kk' && hasKazakhPage({kind:'task'}, task, {}) ? 'kk' : 'ru');

const props = defineProps({
  taskId: { type:String, default:'' },
  hideSelector: { type:Boolean, default:false },
  cart: {
    type: Map,
    required: true
  }
});

const emit = defineEmits(['add-to-cart', 'open-gallery', 'open-installment']);

const activeTaskId = ref('move');
const activeLevel = ref(1);

const translatedTasks = computed(() => {
  return tasks.map(tk => translateTask(tk));
});

const activeTask = computed(() => {
  if (tasks.length === 0) {
    return { id: '', title: '', desc: '', icon: '', image: '' };
  }
  const tk = tasks.find(t => t.id === activeTaskId.value) || tasks[0];
  return translateTask(tk) || { id: '', title: '', desc: '', icon: '', image: '' };
});


const priorityLevels = computed(() => [
  { level: 1, label: t('need') },
  { level: 2, label: t('often') },
  { level: 3, label: t('other') }
]);

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
  const el = document.getElementById(`task-visual-box-${productId}`);
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

const filteredProducts = computed(() => {
  return products.filter(
    (product) => product.tasks && product.tasks[activeTaskId.value] === activeLevel.value && product.isVisible !== false
  ).sort((a,b) => compareTaskProducts(a,b,activeTaskId.value));
});

const handleTaskSelect = (id) => {
  activeTaskId.value = id;
  activeLevel.value = 1;
};
defineExpose({selectTask:handleTaskSelect});
watch(() => tasks.find(task => task.id === props.taskId), task => {
  if (task && activeTaskId.value !== task.id) handleTaskSelect(task.id);
}, { immediate:true });

// Size selector state
const selectedSizes = ref({});
const imageSelectedSizes = ref({});
const expandedSizes = ref({});

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
};

const getVisibleSizes = (product) => {
  if (!product.sizes || product.sizes.length === 0) return [];
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
  // Reset card quantity to 1 after buy
  setQuantity(product.id, 1);
};
</script>

<template>
  <section v-if="!hideSelector" class="task-selector" id="tasks-wizard-section">
    <div class="container">
      <h1 class="task-section-title store-heading">{{ t('storeHeading') }}</h1>
      <p class="task-section-prompt">{{ t('selectTask') }}</p>
      
      <!-- Task Selection Grid -->
      <div class="task-choice-grid">
        <component :is="databaseReady ? 'a' : 'button'"
          v-for="task in translatedTasks" 
          :key="task.id"
          :href="databaseReady ? taskPath(task) : undefined"
          @click="isPlainNavigation($event) && handleTaskSelect(task.id)"
          :class="['task-choice', { active: activeTaskId === task.id }]"
          :aria-current="databaseReady && activeTaskId === task.id ? 'true' : undefined"
          :aria-pressed="!databaseReady ? activeTaskId === task.id : undefined"
          :aria-label="task.title"
        >
          <span class="task-choice-media">
            <picture v-if="task.desktopImage || task.mobileImage">
              <img :src="thumbnailUrl(task.desktopImage || task.mobileImage, 640)" :srcset="thumbnailSrcset(task.desktopImage || task.mobileImage)" sizes="(max-width: 1024px) 30vw, 190px" alt="" loading="lazy" decoding="async" />
            </picture>
            <img v-else :src="thumbnailUrl(task.image,320)" :srcset="thumbnailSrcset(task.image)" sizes="48px" alt="" class="task-choice-icon" loading="lazy" decoding="async" />
          </span>
          <strong class="task-choice-name">{{ task.title }}</strong>
          <span v-if="task.mobileImage" class="task-mobile-art">
            <img :src="thumbnailUrl(task.mobileImage, 640)" :srcset="thumbnailSrcset(task.mobileImage)" sizes="46vw" alt="" loading="lazy" decoding="async" />
          </span>
          <span v-else class="task-mobile-fallback">
            <img :src="thumbnailUrl(task.image,320)" :srcset="thumbnailSrcset(task.image)" sizes="48px" alt="" loading="lazy" decoding="async" />
            <strong>{{ task.title }}</strong>
          </span>
        </component>
      </div>
    </div>
  </section>

  <!-- Suggested Items Section -->
  <section class="recommendations-section" id="recommendations-section">
    <div class="container">
      <div class="task-panel" style="margin-top: 0;">
        <div class="panel-head">
          <div class="panel-head-info">
            <h3>{{ t('recommendations') }}: {{ activeTask.title }}</h3>
            <p>{{ t('recommendationsSub') }}</p>
          </div>
          
          <!-- Priority Tabs -->
          <div class="tabs-wrapper">
            <button 
              v-for="tab in priorityLevels" 
              :key="tab.level"
              @click="activeLevel = tab.level"
              :class="['tab-btn', { active: activeLevel === tab.level }]"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Products Grid -->
        <div class="products-grid">
          <article 
            v-for="product in filteredProducts" 
            :key="product.id"
            class="product-card"
          >
            <!-- Product Image Lightbox Trigger -->
            <div 
              :id="`task-visual-box-${product.id}`"
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
                  :src="Math.abs(idx - (activeImageIndices[product.id] || 0)) <= 1 ? thumbnailUrl(img, 640) : undefined"
                  :srcset="Math.abs(idx - (activeImageIndices[product.id] || 0)) <= 1 ? thumbnailSrcset(img) : undefined"
                  sizes="(max-width: 480px) 46vw, (max-width: 768px) 44vw, (max-width: 1024px) 30vw, 280px"
                  decoding="async"
                  :alt="product.title" 
                  loading="lazy"
                />
              </div>
            </div>

            <!-- Content -->
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

              <h4 class="product-title"><component :is="databaseReady ? 'a' : 'span'" :href="databaseReady ? publicPath('product', product.id, imageSelectedSizes[product.id]) : undefined">{{ product.title }}</component></h4>
              <p class="product-desc">{{ product.desc }}</p>

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
                    v-if="product.sizes.length > 0" 
                    @click.stop="toggleSizesExpanded(product.id)" 
                    class="size-pill more-btn"
                    type="button"
                  >
                    {{ expandedSizes[product.id] ? t('hide') : t('more') }}
                  </button>
                </div>
              </div>

              <!-- Price & Installments -->
              <div class="product-price-row">
                <span class="product-price">{{ getProductDisplayPrice(product).toLocaleString('ru-RU') }} ₸</span>
                <span class="product-unit" v-if="product.unit">{{ t('perUnit') }} {{ product.unit }}</span>
              </div>

              <!-- Cart actions stepper / buy -->
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
    </div>
  </section>
</template>

<style scoped>
/* Keep these category tiles independent of the legacy card styles. */
#tasks-wizard-section.task-selector { padding:32px 0 28px; background:var(--bg-paper) !important; }
.task-section-title { margin:0 0 20px; font-family:var(--font-body); font-size:26px; font-weight:600; letter-spacing:-.035em; line-height:1.2; }
.task-section-title.store-heading { margin-bottom:8px; font-size:22px; line-height:1.35; }
.task-section-prompt { margin:0 0 18px; font-size:14px; color:var(--text-lead); }
.task-choice-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:16px; }
.task-choice { display:flex; flex-direction:column; gap:12px; min-width:0; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; text-align:left; color:var(--text-ink); cursor:pointer; font:inherit; }
.task-choice-media { position:relative; display:grid; place-items:center; width:100%; aspect-ratio:4/3; overflow:hidden; border-radius:12px; background:var(--bg-soft); }
.task-choice-media picture { display:block; width:100%; height:100%; }
.task-choice-media picture img { display:block; width:100%; height:100%; object-fit:cover; transition:transform .2s ease; }
.task-choice-icon { display:block; width:64px; height:64px; object-fit:contain; transition:transform .2s ease; }
.task-choice-name { font-family:var(--font-body); font-size:14px; font-weight:550; line-height:1.4; text-wrap:pretty; }
.task-mobile-art, .task-mobile-fallback { display:none; }
.task-choice.active .task-choice-media::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:var(--primary); }
.task-choice.active .task-choice-name { font-weight:700; }
.task-choice:focus-visible { outline:2px solid var(--text-ink); outline-offset:5px; border-radius:12px; }
.task-choice:active .task-choice-media { transform:scale(.985); }
@media(hover:hover) { .task-choice:hover .task-choice-media img { transform:scale(1.035); } }
@media(max-width:1024px) { .task-choice-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:767px) {
  #tasks-wizard-section.task-selector { padding:24px 0; }
  .task-section-title { font-size:22px; margin-bottom:16px; }
  .task-section-title.store-heading { font-size:18px; }
  .task-choice-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .task-choice { position:relative; gap:0; width:100%; max-width:100%; aspect-ratio:3.2/1; min-height:64px; overflow:hidden; border-radius:12px; background:var(--bg-soft); }
  .task-choice-media, .task-choice-name { display:none; }
  .task-mobile-art { display:block; position:absolute; inset:0; }
  .task-mobile-art img { display:block; width:100%; height:100%; object-fit:contain; }
  .task-mobile-fallback { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:100%; padding:8px; box-sizing:border-box; }
  .task-mobile-fallback img { width:28px; height:28px; flex-shrink:0; object-fit:contain; }
  .task-mobile-fallback strong { min-width:0; overflow-wrap:anywhere; font-size:12px; font-weight:600; line-height:1.25; text-align:center; }
  .task-choice.active { outline:2px solid var(--primary); outline-offset:2px; }
  .task-choice:focus-visible { outline:2px solid var(--text-ink); outline-offset:2px; }
  .task-choice:active { transform:scale(.985); }
}
@media(prefers-reduced-motion:reduce) { .task-choice-media img { transition:none; } }
.product-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s, box-shadow 0.2s;
}
</style>
