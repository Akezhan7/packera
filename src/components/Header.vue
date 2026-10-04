<script setup>
import { computed } from 'vue';
import { icons, PHONE, FORMATTED_PHONE, currentLang, setLang, t } from '../data.js';

const props = defineProps({
  cartTotal: {
    type: Number,
    required: true
  },
  cartItemsCount: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['open-cart']);

const formattedTotal = computed(() => {
  return `${Math.round(props.cartTotal).toLocaleString('ru-RU')} ₸`;
});
</script>

<template>
  <header class="topbar">
    <div class="container nav-container">
      <!-- Brand Logo -->
      <a href="#top" class="brand" aria-label="Packerra.kz">
        <img src="/logo2.png" alt="Packerra.kz" onerror="this.src='https://packerra.kz/logo2.png'" />
      </a>

      <!-- Actions (Phone, WhatsApp, Language Switcher, Cart) -->
      <div class="nav-actions">
        <!-- Call phone link -->
        <a :href="`tel:+${PHONE}`" class="phone-link" :aria-label="t('ariaCall')">
          <span class="phone-icon" v-html="icons.phone"></span>
          <span class="phone-text">
            <strong>{{ FORMATTED_PHONE }}</strong>
            <span>{{ t('dailyWork') }}</span>
          </span>
        </a>

        <!-- Fast WhatsApp link -->
        <a 
          :href="`https://wa.me/${PHONE}?text=${encodeURIComponent(currentLang === 'kk' ? 'Сәлеметсіз бе! Қаптама материалдары бойынша кеңес алғым келеді.' : 'Здравствуйте! Хочу получить консультацию по упаковочным материалам.')}`"
          target="_blank"
          rel="noreferrer"
          class="whatsapp-link"
          :aria-label="t('ariaWriteWhatsApp')"
        >
          <img src="/whatsapp.png" alt="WhatsApp" style="width: 22px; height: 22px; display: block; object-fit: contain;" />
        </a>

        <!-- Sleek Language Switcher -->
        <div class="lang-switcher">
          <button 
            @click="setLang('ru')" 
            :class="['lang-btn', { active: currentLang === 'ru' }]"
          >
            RU
          </button>
          <button 
            @click="setLang('kk')" 
            :class="['lang-btn', { active: currentLang === 'kk' }]"
          >
            KK
          </button>
        </div>



      </div>
    </div>
  </header>

  <!-- Fixed floating cart button -->
  <button @click="emit('open-cart')" class="floating-cart-btn" :aria-label="t('ariaCart')">
    <span class="floating-cart-icon" v-html="icons.cart"></span>
    <span class="floating-cart-text">{{ t('cart') }}</span>
    <span class="floating-cart-total">{{ formattedTotal }}</span>
    <span v-if="cartItemsCount > 0" class="floating-cart-badge">{{ cartItemsCount }}</span>
  </button>
</template>

<style scoped>
.floating-cart-btn {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 999;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  padding: 0 12px 0 18px;
  border-radius: 999px;
  background-color: var(--success);
  color: #FFFFFF;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 16px;
  white-space: nowrap;
  box-shadow: 0 8px 28px rgba(16, 185, 129, 0.35);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: none;
}

.floating-cart-btn:hover {
  background-color: var(--success-hover);
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(16, 185, 129, 0.45);
}

.floating-cart-btn:active {
  transform: translateY(-1px);
}

.floating-cart-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
}

.floating-cart-text {
  font-weight: 850;
  letter-spacing: -0.01em;
}

.floating-cart-total {
  display: inline-flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.22);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
}

.floating-cart-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 22px;
  height: 22px;
  border-radius: 99px;
  background-color: var(--primary);
  color: #16181C;
  font-size: 11px;
  font-weight: 900;
  display: grid;
  place-items: center;
  padding: 0 5px;
  line-height: 1;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
}

@media (max-width: 480px) {
  .floating-cart-btn {
    bottom: 20px;
    right: 16px;
    height: 48px;
    padding: 0 10px 0 14px;
    font-size: 14px;
    gap: 8px;
  }

  .floating-cart-icon {
    width: 20px;
    height: 20px;
  }

  .floating-cart-total {
    padding: 4px 10px;
    font-size: 13px;
  }
}

.lang-switcher {
  display: inline-flex;
  background-color: var(--bg-soft);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 2px;
  height: 38px;
  align-items: center;
}

.lang-btn {
  height: 100%;
  padding: 0 10px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  color: var(--text-muted);
  border-radius: calc(var(--radius-sm) - 2px);
  transition: all var(--transition-fast);
  background: transparent;
  border: none;
  cursor: pointer;
}

.lang-btn:hover {
  color: var(--text-lead);
}

.lang-btn.active {
  background-color: var(--primary);
  color: #16181C;
}
</style>
