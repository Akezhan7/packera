<script setup>
import { icons } from '../data.js';

defineProps({
  message: {
    type: String,
    required: true
  },
  show: {
    type: Boolean,
    required: true
  }
});
</script>

<template>
  <div class="toast-container">
    <Transition name="toast-slide">
      <div v-if="show" class="toast" role="status" aria-live="polite">
        <span v-html="icons.check" class="toast-icon"></span>
        <span class="toast-text">{{ message }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-icon {
  color: var(--success);
  width: 16px;
  height: 16px;
  display: inline-block;
  flex-shrink: 0;
}

.toast-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-slide-enter-active {
  animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.toast-slide-leave-active {
  animation: toastOut 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes toastOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(20px);
    opacity: 0;
  }
}
</style>
