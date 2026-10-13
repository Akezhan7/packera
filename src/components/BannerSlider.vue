<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useStorefrontData } from '../storefrontData.js';
const { banners, currentLang, t, renderedAt } = useStorefrontData();
import { getActiveBanners } from '../../shared/marketing.js';
import { thumbnailUrl, thumbnailSrcset } from '../imageUrls.js';

const emit = defineEmits(['action']);
const now = ref(renderedAt ?? Date.now());
const activeBanners = computed(() => getActiveBanners(banners, now.value));
const slides = computed(() => {
  const items = activeBanners.value;
  // Two wide slides need an extra tail to fill the viewport across the loop boundary.
  const copies = items.length > 1 ? (items.length === 2 ? [-1, 0, 1, 2] : [-1, 0, 1]) : [0];
  return copies.flatMap(copy => items.map(banner => ({ banner, copy, key: `${copy}:${banner.id}` })));
});
const track = ref(null);
const hovering = ref(false);
const focused = ref(false);
const dragging = ref(false);
let reducedMotion;
let intervalId, settleId, resizeObserver;
let loopStart = 0, loopWidth = 0, step = 0, resumeAt = 0;
let pointerId = null, startX = 0, startScroll = 0, moved = false;
const label = banner => banner[currentLang.value === 'kk' ? 'titleKk' : 'title'] || t('promotion');

function measure() {
  const element = track.value;
  if (!element || activeBanners.value.length < 2) { loopStart = loopWidth = step = 0; return; }
  const count = activeBanners.value.length;
  const first = element.children[0].offsetLeft;
  loopStart = element.children[count].offsetLeft - first;
  loopWidth = element.children[count * 2].offsetLeft - element.children[count].offsetLeft;
  step = element.children[1].offsetLeft - first;
  normalize();
}
function normalize() {
  if (!track.value || !loopWidth || dragging.value) return;
  const position = track.value.scrollLeft;
  if (position < loopStart - 1 || position >= loopStart + loopWidth - 1) {
    track.value.scrollLeft = loopStart + ((position - loopStart) % loopWidth + loopWidth) % loopWidth;
  }
}
function onScroll() {
  clearTimeout(settleId);
  settleId = setTimeout(normalize, 180);
}
function move(direction) {
  if (!track.value || !step) return;
  const index = Math.round((track.value.scrollLeft - loopStart) / step);
  track.value.scrollTo({ left: loopStart + (index + direction) * step, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}
function pointerDown(event) {
  resumeAt = Date.now() + 7000;
  moved = false;
  if (event.pointerType !== 'mouse' || event.button !== 0 || !loopWidth) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  startScroll = track.value.scrollLeft;
}
function pointerMove(event) {
  if (event.pointerId !== pointerId) return;
  const delta = event.clientX - startX;
  if (!moved && Math.abs(delta) < 6) return;
  moved = true;
  dragging.value = true;
  track.value.setPointerCapture(event.pointerId);
  track.value.scrollLeft = startScroll - delta;
  event.preventDefault();
}
function pointerUp(event) {
  resumeAt = Date.now() + 7000;
  if (event.pointerId !== pointerId) return;
  if (track.value.hasPointerCapture(event.pointerId)) track.value.releasePointerCapture(event.pointerId);
  pointerId = null;
  dragging.value = false;
  if (moved && step) {
    const index = Math.round((track.value.scrollLeft - loopStart) / step);
    track.value.scrollTo({ left: loopStart + index * step, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
}
function click(event) {
  if (moved) { event.preventDefault(); event.stopPropagation(); }
}
function keyboard(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  resumeAt = Date.now() + 7000;
  move(event.key === 'ArrowRight' ? 1 : -1);
}
watch(() => activeBanners.value.map(b => b.id).join(','), async () => {
  await nextTick();
  if (track.value) { resizeObserver?.observe(track.value); measure(); track.value.scrollLeft = loopStart; }
});
onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  resizeObserver = new ResizeObserver(measure);
  if (track.value) { resizeObserver.observe(track.value); measure(); track.value.scrollLeft = loopStart; }
  intervalId = setInterval(() => {
    now.value = Date.now();
    if (!hovering.value && !focused.value && !dragging.value && !document.hidden && !reducedMotion.matches && now.value >= resumeAt) move(1);
  }, 5000);
  // First measure matches the hydrated DOM. Schedule changes are measured by
  // the watcher after Vue has rendered the new set of active slides.
  now.value = Date.now();
});
onUnmounted(() => { clearInterval(intervalId); clearTimeout(settleId); resizeObserver?.disconnect(); });
</script>

<template>
  <section v-if="activeBanners.length" class="promotions container" :aria-label="t('promotions')" @mouseenter="hovering=true" @mouseleave="hovering=false" @focusin="focused=$event.target.matches(':focus-visible')" @focusout="focused=$event.currentTarget.contains($event.relatedTarget) && $event.relatedTarget.matches(':focus-visible')">
    <div ref="track" class="banner-track" :class="{dragging, single:activeBanners.length===1}" tabindex="0" @keydown="keyboard" @scroll.passive="onScroll" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @pointerleave="pointerUp" @click.capture="click" @dragstart.prevent>
      <component :is="slide.banner.actionType && slide.banner.actionType!=='none' ? 'button' : 'div'" v-for="slide in slides" :key="slide.key" class="banner-slide" :class="{'is-clickable':slide.banner.actionType && slide.banner.actionType!=='none'}" :aria-label="label(slide.banner)" :aria-hidden="slide.copy!==0 ? 'true' : undefined" :tabindex="slide.copy!==0 ? -1 : undefined" @click="slide.banner.actionType && slide.banner.actionType!=='none' && emit('action',slide.banner)">
        <picture><source v-if="slide.banner.mobileImage" media="(max-width:767px)" :srcset="thumbnailSrcset(slide.banner.mobileImage) || slide.banner.mobileImage.replace(/\s/g,encodeURIComponent)" sizes="44vw" /><img :src="thumbnailUrl(slide.banner.image, 640)" :srcset="thumbnailSrcset(slide.banner.image)" :sizes="activeBanners.length === 1 ? '(max-width:1200px) 100vw, 1200px' : '(max-width:767px) 44vw, 550px'" :alt="label(slide.banner)" loading="lazy" decoding="async" draggable="false" /></picture>
      </component>
    </div>
  </section>
</template>

<style scoped>
.promotions { padding-top:20px; padding-bottom:0; background:var(--bg-paper); }
.banner-track { display:flex; gap:16px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; position:relative; cursor:grab; touch-action:pan-x pan-y; -webkit-overflow-scrolling:touch; }
.banner-track::-webkit-scrollbar { display:none; }
.banner-track:focus-visible { outline:2px solid var(--text-ink); outline-offset:4px; }
.banner-track.dragging { scroll-snap-type:none; cursor:grabbing; user-select:none; }
.banner-slide { flex:0 0 46%; min-width:0; display:block; scroll-snap-align:start; overflow:hidden; border:0; padding:0; border-radius:12px; background:transparent; box-shadow:none; font:inherit; }
.banner-slide picture { display:block; width:100%; aspect-ratio:2.2/1; }
.banner-slide img { display:block; width:100%; height:100%; object-fit:cover; user-select:none; }
.is-clickable { cursor:pointer; }
.is-clickable:focus-visible { outline:2px solid var(--text-ink); outline-offset:-3px; }
.single .banner-slide { flex-basis:100%; }
.single .banner-slide picture { aspect-ratio:4/1; }
@media(max-width:767px) {
  .promotions { padding-top:14px; }
  .banner-track { gap:10px; }
  .banner-slide { flex-basis:44%; border-radius:10px; }
  .single .banner-slide picture { aspect-ratio:2.2/1; }
}
</style>
