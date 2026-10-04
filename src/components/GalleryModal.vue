<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { products, icons } from '../data.js';

const props = defineProps({
  productId: {
    type: [String, null],
    required: true
  },
  selectedSize: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close']);

const product = ref(null);
const currentIndex = ref(0);
const currentSelectedSize = ref('');

watch(() => [props.productId, props.selectedSize], () => {
  if (props.productId) {
    product.value = products.find(p => p.id === props.productId) || null;
    currentSelectedSize.value = props.selectedSize || (product.value?.sizes?.[0]?.size || '');
    currentIndex.value = 0;
    document.body.classList.add('modal-open');
  } else {
    product.value = null;
    currentSelectedSize.value = '';
    document.body.classList.remove('modal-open');
  }
}, { immediate: true });

const displayPrice = computed(() => {
  if (!product.value) return null;
  if (currentSelectedSize.value && product.value.sizes && product.value.sizes.length > 0) {
    const found = product.value.sizes.find(s => s.size === currentSelectedSize.value);
    if (found) return found.price;
  }
  return product.value.price;
});

const selectSizeInModal = (sizeName) => {
  currentSelectedSize.value = sizeName;
  currentIndex.value = 0;
};

const images = computed(() => {
  if (!product.value) return [];
  const list = [];

  // 1. Primary size photos (if size selected)
  if (currentSelectedSize.value && product.value.sizes && product.value.sizes.length > 0) {
    const found = product.value.sizes.find(s => s.size === currentSelectedSize.value);
    if (found) {
      if (found.images && found.images.length > 0) {
        list.push(...found.images);
      } else if (found.image) {
        list.push(found.image);
      }
    }
  }

  // 2. All other sizes' photos
  if (product.value.sizes && product.value.sizes.length > 0) {
    product.value.sizes.forEach(s => {
      if (s.images && s.images.length > 0) {
        list.push(...s.images);
      } else if (s.image) {
        list.push(s.image);
      }
    });
  }

  // 3. Main product images
  if (product.value.images && product.value.images.length > 0) {
    list.push(...product.value.images);
  } else if (product.value.image) {
    list.push(product.value.image);
  }

  // 4. Remove empty & duplicate URLs preserving priority
  const uniqueImages = [];
  list.forEach(img => {
    if (img && typeof img === 'string' && img.trim() !== '' && !uniqueImages.includes(img)) {
      uniqueImages.push(img);
    }
  });

  return uniqueImages;
});

const handlePrev = () => {
  if (images.value.length <= 1) return;
  currentIndex.value = (currentIndex.value - 1 + images.value.length) % images.value.length;
};

const handleNext = () => {
  if (images.value.length <= 1) return;
  currentIndex.value = (currentIndex.value + 1) % images.value.length;
};

const selectThumb = (idx) => {
  currentIndex.value = idx;
};

const handleKeyDown = (e) => {
  if (!props.productId) return;
  if (e.key === 'Escape') emit('close');
  if (e.key === 'ArrowLeft') handlePrev();
  if (e.key === 'ArrowRight') handleNext();
};

// Touch swipe support
let touchStartX = 0;
let touchEndX = 0;

const handleTouchStart = (e) => {
  touchStartX = e.changedTouches[0].screenX;
};

const handleTouchEnd = (e) => {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) handleNext();
    else handlePrev();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div 
    v-if="productId !== null" 
    class="gallery-modal-overlay open"
    @click.self="emit('close')"
  >
    <!-- Close -->
    <button 
      @click="emit('close')" 
      class="gallery-modal-close" 
      aria-label="Закрыть галерею"
      v-html="icons.x"
    ></button>

    <!-- Slide wrapper -->
    <div 
      class="gallery-slide-wrap"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Prev Arrow -->
      <button 
        v-if="images.length > 1" 
        @click="handlePrev" 
        class="gallery-arrow gallery-arrow-prev" 
        aria-label="Предыдущее изображение"
      >
        ‹
      </button>

      <!-- Main large image -->
      <img 
        :src="images[currentIndex]" 
        :alt="product?.title" 
        onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=640'"
      />

      <!-- Next Arrow -->
      <button 
        v-if="images.length > 1" 
        @click="handleNext" 
        class="gallery-arrow gallery-arrow-next" 
        aria-label="Следующее изображение"
      >
        ›
      </button>
    </div>

    <!-- Title, size selector, price, and specs preview overlay -->
    <div class="gallery-info-overlay">
      <h3>{{ product?.title }}</h3>

      <div v-if="displayPrice" class="gallery-price-tag">
        {{ displayPrice }} ₸
      </div>

      <!-- Sizes Selector Pills in Modal -->
      <div v-if="product?.sizes && product.sizes.length > 0" class="gallery-sizes-pills">
        <button 
          v-for="s in product.sizes" 
          :key="s.size"
          @click="selectSizeInModal(s.size)"
          :class="['size-pill', { active: currentSelectedSize === s.size }]"
          type="button"
        >
          {{ s.size }}
        </button>
      </div>
      
      <p v-if="product?.desc" class="gallery-desc">
        {{ product.desc }}
      </p>
      
      <!-- Specs list -->
      <div 
        v-if="product?.specs" 
        class="gallery-specs-strip"
      >
        <span v-for="([key, val]) in Object.entries(product.specs)" :key="key">
          <strong>{{ key }}:</strong> {{ val }}
        </span>
      </div>
    </div>

    <!-- Thumbnail Strip -->
    <div v-if="images.length > 1" class="gallery-thumbnails-strip">
      <button 
        v-for="(img, idx) in images" 
        :key="idx"
        @click="selectThumb(idx)"
        :class="['gallery-thumb-item', { active: idx === currentIndex }]"
      >
        <img :src="img" :alt="`Миниатюра ${idx + 1}`" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.gallery-arrow {
  font-size: 28px;
  font-family: inherit;
  line-height: 1;
}
.gallery-modal-overlay {
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

.gallery-info-overlay {
  text-align: center;
  color: #FFF;
  margin-top: 16px;
  max-width: 600px;
  padding: 0 16px;
}

.gallery-info-overlay h3 {
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 800;
  margin-bottom: 4px;
}

.gallery-price-tag {
  font-size: 20px;
  font-weight: 800;
  color: #E5A900;
  margin: 4px 0 8px 0;
}

.gallery-sizes-pills {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin: 6px 0 10px 0;
}

.gallery-sizes-pills .size-pill {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.15);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: all 0.2s ease;
}

.gallery-sizes-pills .size-pill:hover,
.gallery-sizes-pills .size-pill.active {
  background: #E5A900;
  color: #000000;
  border-color: #E5A900;
}

.gallery-desc {
  font-size: 13px;
  color: #D1D5DB;
  margin: 8px 0 12px 0;
  line-height: 1.4;
  text-align: center;
  max-height: 80px;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 0 8px;
}

.gallery-specs-strip {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: #9CA3AF;
}

@media (max-width: 480px) {
  .gallery-info-overlay h3 {
    font-size: 14px;
  }
  
  .gallery-desc {
    font-size: 12px;
    max-height: 60px;
    margin: 6px 0;
  }
  
  .gallery-specs-strip {
    font-size: 10px;
    gap: 8px;
  }
}
</style>
