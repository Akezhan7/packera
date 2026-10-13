<script setup>
import { computed } from 'vue';
import { useStorefrontData } from '../storefrontData.js';
const { siteSettings, currentLang } = useStorefrontData();
import { thumbnailUrl, thumbnailSrcset } from '../imageUrls.js';
const emit = defineEmits(['action']);
const hero = computed(() => siteSettings.hero);
const text = field => hero.value?.[currentLang.value === 'kk' ? `${field}Kk` : field] || '';
</script>

<template>
  <section v-if="hero" id="hero-section" class="main-banner container">
    <div class="main-banner-layout">
      <div class="main-banner-copy">
        <h1>{{ text('title') }}</h1>
        <p v-if="text('description')">{{ text('description') }}</p>
        <button v-if="hero.actionType !== 'none' && text('buttonText')" class="btn btn-primary" type="button" @click="emit('action',hero)">{{ text('buttonText') }}</button>
      </div>
      <picture class="main-banner-picture">
        <source v-if="hero.mobileImage" media="(max-width:767px)" :srcset="thumbnailSrcset(hero.mobileImage) || hero.mobileImage.replace(/\s/g,encodeURIComponent)" sizes="100vw" />
        <img :src="thumbnailUrl(hero.image, 960)" :srcset="thumbnailSrcset(hero.image)" sizes="(max-width:767px) 100vw, 820px" alt="" fetchpriority="high" decoding="async" />
      </picture>
    </div>
  </section>
</template>

<style scoped>
.main-banner { --hero-surface:#f7f5ef; --hero-rgb:247 245 239; padding-top:20px; padding-bottom:0; background:var(--bg-paper); }
:global(body.dark-theme) .main-banner { --hero-surface:var(--bg-soft); --hero-rgb:27 30 38; }
.main-banner-layout { position:relative; isolation:isolate; overflow:hidden; min-height:350px; display:flex; align-items:center; border-radius:16px; background:var(--hero-surface); }
.main-banner-picture { position:absolute; inset:0 0 0 auto; width:68%; z-index:-2; }
.main-banner-picture img { display:block; width:100%; height:100%; object-fit:cover; object-position:65% 50%; }
.main-banner-layout::after { content:''; position:absolute; inset:0; z-index:-1; background:linear-gradient(90deg,var(--hero-surface) 0%,var(--hero-surface) 30%,rgb(var(--hero-rgb) / .94) 40%,rgb(var(--hero-rgb) / .3) 56%,transparent 72%); pointer-events:none; }
.main-banner-copy { width:52%; padding:42px; }
.main-banner-copy h1 { font-family:var(--font-body); font-size:clamp(30px,3.1vw,44px); font-weight:650; letter-spacing:-.04em; line-height:1.12; text-wrap:balance; margin:0 0 16px; }
.main-banner-copy p { max-width:34ch; font-size:15px; line-height:1.5; color:var(--text-lead); margin:0 0 24px; }
.main-banner-copy .btn { min-height:44px; border:0; border-radius:10px; box-shadow:none; padding:12px 20px; font-size:14px; }
@media(max-width:1024px) { .main-banner-copy { width:58%; padding:32px; } }
@media(max-width:767px) {
  .main-banner { padding-top:12px; }
  .main-banner-layout { min-height:250px; border-radius:12px; }
  .main-banner-copy { width:82%; padding:24px 20px; }
  .main-banner-copy h1 { font-size:clamp(26px,7vw,34px); margin-bottom:12px; }
  .main-banner-copy p { font-size:13px; max-width:27ch; margin-bottom:18px; }
  .main-banner-copy .btn { min-height:40px; padding:10px 16px; font-size:13px; }
  .main-banner-picture { width:100%; }
  .main-banner-picture img { object-position:72% 50%; }
  .main-banner-layout::after { background:linear-gradient(90deg,var(--hero-surface) 0%,rgb(var(--hero-rgb) / .97) 35%,rgb(var(--hero-rgb) / .8) 55%,rgb(var(--hero-rgb) / .1) 100%); }
}
@media(max-width:360px) { .main-banner-copy { width:90%; padding:20px 16px; } .main-banner-copy h1 { font-size:25px; } }
</style>
