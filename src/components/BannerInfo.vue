<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { currentLang, t } from '../data.js';
const props = defineProps({banner:{type:Object,required:true}});
const emit = defineEmits(['close']);
const dialog = ref(null);
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
  <dialog ref="dialog" class="banner-info" aria-labelledby="banner-info-title" @cancel.prevent="emit('close')" @click="$event.target === dialog && emit('close')">
    <div class="banner-info-content">
      <button type="button" class="info-close" :aria-label="t('close')" autofocus @click="emit('close')">×</button>
      <h2 id="banner-info-title">{{ text('title') }}</h2>
      <p>{{ text('description') }}</p>
      <button class="btn btn-primary" type="button" @click="emit('close')">{{ t('close') }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.banner-info { border:0; border-radius:20px; padding:0; width:calc(100% - 32px); max-width:520px; max-height:85vh; max-height:85dvh; background:var(--bg-paper); color:var(--text-ink); margin:auto; }
.banner-info::backdrop { background:rgba(0,0,0,.55); }
.banner-info-content { padding:32px 24px 24px; position:relative; }
.banner-info h2 { margin:8px 30px 16px 0; font-size:24px; }
.banner-info p { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.6; margin:0 0 24px; }
.info-close { position:absolute; top:8px; right:8px; width:40px; height:40px; font-size:28px; border:0; border-radius:50%; cursor:pointer; background:var(--bg-soft); color:inherit; }
</style>
