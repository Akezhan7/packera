<script setup>
import { ref, computed } from 'vue';
import { tasks, products, icons, t, translateTask } from '../data.js';

const props = defineProps({
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
  const el = document.getElementById(`visual-box-${productId}`);
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
  ).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || String(a.id).localeCompare(String(b.id)));
});

const handleTaskSelect = (id) => {
  activeTaskId.value = id;
  activeLevel.value = 1;
};

// Size selector state
const selectedSizes = ref({});
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

const getProductDisplayImages = (product) => {
  let mainImages = product.images && product.images.length ? [...product.images] : (product.image ? [product.image] : []);
  const sel = getSelectedSize(product.id);
  if (sel && product.sizes && product.sizes.length > 0) {
    const found = product.sizes.find(s => s.size === sel);
    if (found) {
      let sizeImages = [];
      if (found.images && found.images.length > 0) sizeImages = found.images;
      else if (found.image) sizeImages = [found.image];
      
      if (sizeImages.length > 0) {
        return [...new Set([...sizeImages, ...mainImages])];
      }
    }
  }
  return mainImages.length > 0 ? mainImages : ['https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=250'];
};

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
  <section class="bg-soft-section" id="tasks-wizard-section">
    <div class="container">
      <h2 class="section-title">{{ t('selectTask') }}</h2>
      
      <!-- Task Selection Grid -->
      <div class="task-grid">
        <button 
          v-for="task in translatedTasks" 
          :key="task.id"
          @click="handleTaskSelect(task.id)"
          :class="['task-card', { active: activeTaskId === task.id }]"
          type="button"
        >
          <span>
            <span class="task-icon-svg">
              <img :src="task.image" :alt="task.title" :class="['task-image-icon', `task-icon-${task.id}`]" />
            </span>
            <strong>{{ task.title }}</strong>
          </span>
          <span class="task-desc-text">{{ task.desc }}</span>
        </button>
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
              :id="`visual-box-${product.id}`"
              class="product-visual-box scroll-slider" 
              style="--visual-color: #f6f5f0"
              @scroll="handleScroll(product.id, $event)"
              @click="emit('open-gallery', product.id, selectedSizes[product.id])"
            >
              <div 
                v-for="(img, idx) in getProductDisplayImages(product)"
                :key="idx"
                class="product-slide"
              >
                <img 
                  :src="img" 
                  :alt="product.title" 
                  loading="lazy"
                  onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=250'"
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

              <h4 class="product-title">{{ product.title }}</h4>
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
/* Scoped overrides to support seamless transition effects */
.task-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s, box-shadow 0.2s;
}
.product-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s, box-shadow 0.2s;
}
</style>
