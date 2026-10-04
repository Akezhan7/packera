<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { banners } from '../data.js';

const activeBanners = computed(() => {
  return banners.filter(b => b.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
});

const currentIndex = ref(0);
let intervalId = null;

const nextSlide = () => {
  if (activeBanners.value.length <= 1) return;
  currentIndex.value = (currentIndex.value + 1) % activeBanners.value.length;
};

const prevSlide = () => {
  if (activeBanners.value.length <= 1) return;
  currentIndex.value = (currentIndex.value - 1 + activeBanners.value.length) % activeBanners.value.length;
};

const goToSlide = (index) => {
  currentIndex.value = index;
};

const startTimer = () => {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(nextSlide, 5000);
};

const stopTimer = () => {
  if (intervalId) clearInterval(intervalId);
};

onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  stopTimer();
});
</script>

<template>
  <div 
    v-if="activeBanners.length > 0" 
    class="banner-slider-wrapper"
    @mouseenter="stopTimer"
    @mouseleave="startTimer"
  >
    <div class="banner-slider">
      <div 
        class="banner-track"
        :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
      >
        <div 
          v-for="(banner, index) in activeBanners" 
          :key="banner.id" 
          class="banner-slide"
        >
          <img :src="banner.image" alt="Banner" />
        </div>
      </div>

      <button v-if="activeBanners.length > 1" class="slider-btn prev" @click="prevSlide">‹</button>
      <button v-if="activeBanners.length > 1" class="slider-btn next" @click="nextSlide">›</button>
      
      <div v-if="activeBanners.length > 1" class="slider-dots">
        <span 
          v-for="(_, index) in activeBanners" 
          :key="'dot-'+index"
          class="dot"
          :class="{ active: index === currentIndex }"
          @click="goToSlide(index)"
        ></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-slider-wrapper {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  background-color: #f5f5f5;
}

.banner-slider {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 4; /* Typical wide banner ratio, adjust as needed */
  max-height: 400px; /* Or arbitrary max height */
  overflow: hidden;
}

.banner-track {
  display: flex;
  transition: transform 0.5s ease-in-out;
  height: 100%;
}

.banner-slide {
  min-width: 100%;
  height: 100%;
  flex-shrink: 0;
}

.banner-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.slider-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.7);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: background 0.3s;
}

.slider-btn:hover {
  background: white;
}

.slider-btn.prev {
  left: 10px;
}

.slider-btn.next {
  right: 10px;
}

.slider-dots {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: background 0.3s;
}

.dot.active {
  background: white;
  box-shadow: 0 0 2px rgba(0,0,0,0.3);
}

@media (max-width: 768px) {
  .banner-slider {
    aspect-ratio: 16 / 9; /* More squarish for mobile */
  }
}
</style>
