<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { currentLang, t } from '../data.js';
const props = defineProps({banner:{type:Object,required:true}});
const emit = defineEmits(['close']);
const dialog = ref(null);
const imageFailed = ref(false);
const text = field => props.banner[currentLang.value==='kk' ? `${field}Kk` : field] || '';
let previousOverflow;
onMounted(() => {
  previousOverflow=document.documentElement.style.overflow;
  document.documentElement.style.overflow='hidden';
  dialog.value.showModal();
});
onUnmounted(() => { document.documentElement.style.overflow=previousOverflow; });
</script>

<template>
  <dialog ref="dialog" class="banner-info" :class="{'has-image':banner.infoImage}" aria-labelledby="banner-info-title" @cancel.prevent="emit('close')" @click="$event.target === dialog && emit('close')">
    <header class="info-header">
      <h2 id="banner-info-title">{{ text('title') || t('promotion') }}</h2>
      <button type="button" class="info-close" :aria-label="t('close')" autofocus @click="emit('close')">×</button>
    </header>
    <div class="banner-info-content">
      <img v-if="banner.infoImage && !imageFailed" :src="banner.infoImage" :alt="text('title') || t('promotion')" class="info-image" decoding="async" @error="imageFailed=true" />
      <p v-if="imageFailed" role="alert">{{ t('promotionImageError') }}</p>
      <p v-if="text('description')">{{ text('description') }}</p>
      <button class="btn btn-primary" type="button" @click="emit('close')">{{ t('close') }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.banner-info { border:0; border-radius:20px; padding:0; width:calc(100% - 32px); max-width:520px; max-height:85vh; max-height:85dvh; background:var(--bg-paper); color:var(--text-ink); margin:auto; }
.banner-info::backdrop { background:rgba(0,0,0,.55); }
.banner-info.has-image { max-width:800px; }
.info-header { position:sticky; top:0; z-index:1; display:flex; align-items:center; gap:16px; justify-content:space-between; padding:12px 16px 12px 24px; background:var(--bg-paper); }
.banner-info-content { padding:0 24px 24px; }
.banner-info h2 { margin:0; font-size:20px; overflow-wrap:anywhere; }
.info-image { display:block; width:100%; height:auto; margin-bottom:20px; }
.banner-info p { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.6; margin:0 0 24px; }
.info-close { flex-shrink:0; width:40px; height:40px; font-size:28px; border:0; border-radius:50%; cursor:pointer; background:var(--bg-soft); color:inherit; }
@media(max-width:767px) { .info-header { padding-left:16px; } .banner-info-content { padding:0 16px 16px; } }
</style>
