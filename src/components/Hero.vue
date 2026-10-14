<script setup>
import { computed } from 'vue';
import { useStorefrontData } from '../storefrontData.js';
const { siteSettings, t } = useStorefrontData();
import { thumbnailUrl, thumbnailSrcset } from '../imageUrls.js';
const hero = computed(() => siteSettings.hero);
</script>

<template>
  <section v-if="hero" id="hero-section" class="main-banner container">
    <div class="main-banner-layout">
      <picture class="main-banner-picture">
        <source v-if="hero.mobileImage" media="(max-width:767px)" :srcset="thumbnailSrcset(hero.mobileImage) || hero.mobileImage.replace(/\s/g,encodeURIComponent)" sizes="100vw" />
        <img :src="thumbnailUrl(hero.image, 960)" :srcset="thumbnailSrcset(hero.image)" sizes="(max-width:767px) 100vw, 1200px" :alt="t('storeHeading')" fetchpriority="high" decoding="async" />
      </picture>
    </div>
  </section>
</template>

<style scoped>
.main-banner { padding-top:20px; padding-bottom:0; }
.main-banner-layout { min-width:0; height:350px; overflow:hidden; border-radius:16px; }
.main-banner-picture { display:block; width:100%; height:100%; }
.main-banner-picture img { display:block; width:100%; height:100%; object-fit:cover; object-position:65% 50%; }
@media(max-width:767px) {
  .main-banner { padding-top:12px; }
  .main-banner-layout { height:250px; border-radius:12px; }
  .main-banner-picture img { object-position:72% 50%; }
}
</style>
