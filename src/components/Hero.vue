<script setup>
import { t } from '../data.js';
</script>

<template>
  <section class="hero" id="hero-section">
    <img 
      src="/Artboard 1.png" 
      alt="Коробки и упаковочные материалы Packerra"
      class="hero-image"
      onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20boxes%20(6956651267).jpg?width=640'"
    />

    <div class="container hero-content-container">
      <!-- Left: copy -->
      <div class="hero-copy">
        <h1 class="hero-title">
          {{ t('heroTitleText') }} <span>{{ t('heroTitleSpan') }}</span>
        </h1>
        <p class="hero-lead">
          {{ t('heroLead') }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* No component-specific styles needed */
</style>
