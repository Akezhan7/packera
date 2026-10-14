<script setup>
import { computed } from 'vue';
import { useStorefrontData } from '../storefrontData.js';
const { siteSettings, currentLang } = useStorefrontData();
import { thumbnailUrl, thumbnailSrcset } from '../imageUrls.js';
const emit = defineEmits(['action']);
const hero = computed(() => siteSettings.hero);
const text = field => hero.value?.[currentLang.value === 'kk' ? `${field}Kk` : field] || '';
const hasButton = computed(() => hero.value?.actionType !== 'none' && !!text('buttonText'));
</script>

<template>
  <section v-if="hero" id="hero-section" class="main-banner container">
    <div class="main-banner-layout">
      <picture class="main-banner-picture">
        <source v-if="hero.mobileImage" media="(max-width:767px)" :srcset="thumbnailSrcset(hero.mobileImage) || hero.mobileImage.replace(/\s/g,encodeURIComponent)" sizes="100vw" />
        <img :src="thumbnailUrl(hero.image, 960)" :srcset="thumbnailSrcset(hero.image)" sizes="(max-width:767px) 100vw, 1200px" alt="" fetchpriority="high" decoding="async" />
      </picture>
      <div class="main-banner-copy" :class="{'with-button':hasButton}">
        <h1>{{ text('title') }}</h1>
        <button v-if="hasButton" class="btn btn-primary" type="button" @click="emit('action',hero)">{{ text('buttonText') }}</button>
        <p v-if="text('description')">{{ text('description') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.main-banner { --hero-surface:#f7f5ef; padding-top:20px; padding-bottom:0; background:var(--bg-paper); }
:global(body.dark-theme) .main-banner { --hero-surface:var(--bg-soft); }
.main-banner-layout { overflow:hidden; border-radius:16px; background:var(--hero-surface); }
.main-banner-picture { display:block; width:100%; aspect-ratio:4.8/1; }
.main-banner-picture img { display:block; width:100%; height:100%; object-fit:cover; object-position:65% 50%; }
.main-banner-copy { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:10px 16px; padding:18px 24px; }
.main-banner-copy h1 { grid-column:1/-1; font-family:var(--font-body); font-size:20px; font-weight:650; line-height:1.3; margin:0; }
.main-banner-copy p { grid-column:1/-1; font-size:14px; line-height:1.5; color:var(--text-lead); margin:0; overflow-wrap:anywhere; }
.main-banner-copy.with-button p { grid-column:2; }
.main-banner-copy .btn { min-height:36px; border:0; border-radius:8px; box-shadow:none; padding:8px 12px; font-size:13px; }
@media(max-width:767px) {
  .main-banner { padding-top:12px; }
  .main-banner-layout { border-radius:12px; }
  .main-banner-copy { padding:12px; gap:8px 12px; }
  .main-banner-copy h1 { font-size:16px; }
  .main-banner-copy p { font-size:12px; }
  .main-banner-copy .btn { padding:8px 10px; font-size:12px; }
  .main-banner-picture { aspect-ratio:2.8/1; }
  .main-banner-picture img { object-position:72% 50%; }
}
</style>
