<script setup>
import { ref, computed, watch } from 'vue';
import { products, PHONE, icons, t, currentLang } from '../data.js';

const props = defineProps({
  productId: {
    type: [String, null],
    required: true
  }
});

const emit = defineEmits(['close']);

const product = ref(null);
const selectedBank = ref('Kaspi');
const term = ref(12);
const qty = ref(1);
const selectedSize = ref('');

const setQty = (val) => {
  if (val === '' || isNaN(val)) {
    qty.value = '';
  } else {
    qty.value = Math.max(1, parseInt(val, 10));
  }
};

const handleQtyBlur = () => {
  if (qty.value === '') {
    qty.value = 1;
  }
};

watch(() => props.productId, (newId) => {
  if (newId) {
    product.value = products.find(p => p.id === newId);
    qty.value = 1;
    term.value = 12;
    
    // Set first available bank dynamically
    const avail = [];
    if (product.value) {
      if (product.value.kaspiLink) avail.push('Kaspi');
      if (product.value.halykLink) avail.push('Halyk');
      if (product.value.forteLink) avail.push('Forte');
    }
    if (avail.length > 0) {
      selectedBank.value = avail[0];
    } else {
      selectedBank.value = 'Kaspi';
    }
    
    if (product.value && product.value.sizes && product.value.sizes.length > 0) {
      selectedSize.value = product.value.sizes[0].size;
    } else {
      selectedSize.value = '';
    }
  } else {
    product.value = null;
  }
}, { immediate: true });

const bankOptions = [
  { 
    name: 'Kaspi', 
    label: 'Каспи Банк (Kaspi Red)', 
    avatar: '/kaspi.png',
    fallbackBg: '#FF2D55',
    terms: [3, 6, 12]
  },
  { 
    name: 'Halyk', 
    label: 'Халык Банк (Halyk Club)', 
    avatar: '/halyk.png',
    fallbackBg: '#008C45',
    terms: [3, 6, 12, 24]
  },
  { 
    name: 'Forte', 
    label: 'ФортеБанк (Forte Market)', 
    avatar: '/forte.jpg',
    fallbackBg: '#7A1C5A',
    terms: [3, 6, 12]
  }
];

const activeSize = computed(() => {
  if (!product.value) return null;
  if (selectedSize.value && product.value.sizes && product.value.sizes.length > 0) {
    return product.value.sizes.find(s => s.size === selectedSize.value) || null;
  }
  return null;
});

const availableBanks = computed(() => {
  if (!product.value) return [];
  const list = [];
  
  // Check if bank link is available either on selected size, any size, or main product
  const hasKaspi = (activeSize.value && activeSize.value.kaspiLink) || 
                   product.value.kaspiLink || 
                   (product.value.sizes && product.value.sizes.some(s => s.kaspiLink));
                   
  const hasHalyk = (activeSize.value && activeSize.value.halykLink) || 
                   product.value.halykLink || 
                   (product.value.sizes && product.value.sizes.some(s => s.halykLink));
                   
  const hasForte = (activeSize.value && activeSize.value.forteLink) || 
                   product.value.forteLink || 
                   (product.value.sizes && product.value.sizes.some(s => s.forteLink));

  if (hasKaspi) {
    const k = bankOptions.find(b => b.name === 'Kaspi');
    if (k) list.push(k);
  }
  if (hasHalyk) {
    const h = bankOptions.find(b => b.name === 'Halyk');
    if (h) list.push(h);
  }
  if (hasForte) {
    const f = bankOptions.find(b => b.name === 'Forte');
    if (f) list.push(f);
  }
  if (list.length === 0) {
    return bankOptions;
  }
  return list;
});

const activeBank = computed(() => {
  return availableBanks.value.find(b => b.name === selectedBank.value) || availableBanks.value[0];
});

const activeBankLink = computed(() => {
  if (!product.value || !activeBank.value) return '';
  
  // Try to resolve from active size first
  if (activeSize.value) {
    if (activeBank.value.name === 'Kaspi' && activeSize.value.kaspiLink) return activeSize.value.kaspiLink;
    if (activeBank.value.name === 'Halyk' && activeSize.value.halykLink) return activeSize.value.halykLink;
    if (activeBank.value.name === 'Forte' && activeSize.value.forteLink) return activeSize.value.forteLink;
  }
  
  // Fall back to main product links
  if (activeBank.value.name === 'Kaspi') return product.value.kaspiLink || '';
  if (activeBank.value.name === 'Halyk') return product.value.halykLink || '';
  if (activeBank.value.name === 'Forte') return product.value.forteLink || '';
  return '';
});

const getBankDisplayName = (name) => {
  if (currentLang.value === 'kk') {
    return `${name} Банкі`;
  }
  return `${name} Банк`;
};

const getBankDisplayLabel = (bank) => {
  if (currentLang.value === 'kk') {
    if (bank.name === 'Kaspi') return 'Каспи Банкі (Kaspi Red)';
    if (bank.name === 'Halyk') return 'Халық Банкі (Halyk Club)';
    if (bank.name === 'Forte') return 'ФортеБанк (Forte Market)';
  }
  return bank.label;
};

watch(selectedBank, () => {
  if (activeBank.value && !activeBank.value.terms.includes(term.value)) {
    term.value = activeBank.value.terms[0];
  }
});

const unitPrice = computed(() => {
  if (!product.value) return 0;
  if (selectedSize.value && product.value.sizes && product.value.sizes.length > 0) {
    const found = product.value.sizes.find(s => s.size === selectedSize.value);
    if (found) return found.price;
  }
  return product.value.price;
});

const totalProductPrice = computed(() => {
  return unitPrice.value * qty.value;
});

const displayImage = computed(() => {
  if (!product.value) return '';
  if (selectedSize.value && product.value.sizes && product.value.sizes.length > 0) {
    const found = product.value.sizes.find(s => s.size === selectedSize.value);
    if (found && found.image) return found.image;
  }
  return product.value.image;
});

const monthlyPayment = computed(() => {
  if (totalProductPrice.value === 0 || term.value === 0) return 0;
  return Math.round(totalProductPrice.value / term.value);
});

const triggerWhatsAppInstallment = () => {
  if (!product.value) return;
  const sizeText = selectedSize.value ? ` (${selectedSize.value})` : '';
  const bankNameFormatted = getBankDisplayName(activeBank.value.name);
  let msg = '';
  if (currentLang.value === 'kk') {
    msg = `Сәлеметсіз бе! *${bankNameFormatted}* арқылы *${term.value} айға* келесі тауарға бөліп төлеуді рәсімдегім келеді:\n*${product.value.title}${sizeText}* - ${qty.value}${product.value.unit ? ' ' + product.value.unit : ''}, сомасы *${totalProductPrice.value.toLocaleString('kk-KZ')} ₸*.\n(Ай сайынғы төлем: ~ ${monthlyPayment.value.toLocaleString('kk-KZ')} ₸/ай).`;
  } else {
    msg = `Здравствуйте! Хочу оформить рассрочку в *${bankNameFormatted}* на *${term.value} мес.* на товар:\n*${product.value.title}${sizeText}* - ${qty.value}${product.value.unit ? ' ' + product.value.unit : ''} на сумму *${totalProductPrice.value.toLocaleString('ru-RU')} ₸*.\n(Ежемесячный платеж: ~ ${monthlyPayment.value.toLocaleString('ru-RU')} ₸/мес).`;
  }
  const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  emit('close');
};
</script>

<template>
  <div 
    v-if="productId !== null" 
    class="modal-overlay open"
    @click.self="emit('close')"
  >
    <div class="modal-box">
      <!-- Header -->
      <div class="modal-header">
        <h3>{{ t('installmentTitle') }}</h3>
        <button @click="emit('close')" class="btn-square" style="border: none; background: transparent;" v-html="icons.x"></button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <div class="installment-product-preview">
          <img 
            :src="displayImage" 
            :alt="product?.title" 
            class="installment-product-img"
            onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'"
          />
          <div class="installment-product-info">
            <h4>{{ product?.title }}</h4>
            <span>{{ unitPrice.toLocaleString('ru-RU') }} ₸<span v-if="product?.unit"> / {{ product?.unit }}</span></span>
          </div>
        </div>

        <!-- Size selector for products with sizes -->
        <div v-if="product?.sizes && product.sizes.length > 0" class="product-sizes-selector" style="margin-bottom: 14px;">
          <span class="sizes-label">{{ t('sizeLabel') }}</span>
          <div class="sizes-pills">
            <button 
              v-for="s in product.sizes" 
              :key="s.size"
              @click="selectedSize = s.size"
              :class="['size-pill', { active: selectedSize === s.size }]"
              type="button"
            >
              {{ s.size }}
            </button>
          </div>
        </div>

        <!-- Quantity adjust inside calculator -->
        <div class="calculator-stepper-wrap">
          <div class="calculator-qty-row">
            <span class="form-label">{{ t('quantity') }}</span>
            <div class="stepper" style="width: 110px;">
              <button @click="qty = Math.max(1, qty - 1)">-</button>
              <span>{{ qty }}</span>
              <button @click="qty++">+</button>
            </div>
          </div>
          <div class="calculator-sum-row">
            <span>{{ t('totalSum') }}</span>
            <span>{{ totalProductPrice.toLocaleString('ru-RU') }} ₸</span>
          </div>
        </div>

        <!-- Choose Bank Tab list -->
        <div style="margin-bottom: 18px;">
          <span class="form-label" style="display: block; margin-bottom: 8px;">{{ t('selectBank') }}</span>
          
          <div class="bank-calculator-list">
            <div 
              v-for="bank in availableBanks" 
              :key="bank.name"
              @click="selectedBank = bank.name"
              :class="['bank-option-card', { active: selectedBank === bank.name }]"
              :style="selectedBank === bank.name ? { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-light)' } : {}"
            >
              <div class="bank-avatar">
                <img :src="bank.avatar" :alt="bank.name" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
              </div>
              <div class="bank-info">
                <h4>{{ getBankDisplayName(bank.name) }}</h4>
                <p>{{ getBankDisplayLabel(bank) }}</p>
              </div>
              <span class="bank-term-badge">{{ currentLang === 'kk' ? `${Math.max(...bank.terms)} айға дейін` : `До ${Math.max(...bank.terms)} мес.` }}</span>
            </div>
          </div>
        </div>


        <!-- Buy on active bank direct link if link is configured -->
        <div v-if="activeBankLink" style="margin-top: 14px;">
          <a 
            :href="activeBankLink" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn-kaspi-direct"
            :style="{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              height: '46px',
              backgroundColor: activeBank.fallbackBg,
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              fontSize: '15px',
              boxShadow: `0 4px 12px ${activeBank.fallbackBg}33`
            }"
          >
            <img 
              :src="activeBank.avatar" 
              :alt="activeBank.name" 
              style="width: 20px; height: 20px; object-fit: contain; border-radius: 4px;" 
              :style="activeBank.name === 'Kaspi' ? { filter: 'brightness(0) invert(1)' } : {}"
            />
            {{ t('buyOn') }} {{ activeBank.name }}
          </a>
        </div>

        <!-- Action submit -->
        <div class="installment-actions">
          <button @click="emit('close')" class="btn btn-secondary" style="width: 100%;">{{ t('close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  transition: opacity 0.25s ease, visibility 0.25s ease;
}
.modal-box {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.bank-option-card {
  transition: all var(--transition-fast);
}

.installment-product-preview {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}

.installment-product-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  background-color: var(--bg-soft);
  border-radius: var(--radius-sm);
  padding: 4px;
  flex-shrink: 0;
}

.installment-product-info {
  min-width: 0;
}

.installment-product-info h4 {
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.installment-product-info span {
  font-size: 13px;
  color: var(--text-muted);
}

.calculator-qty-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calculator-sum-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-lead);
}

.term-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.term-btn {
  flex: 1;
  min-width: 60px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-line);
  background-color: var(--bg-paper);
  font-weight: 700;
  font-size: 13px;
  transition: all var(--transition-fast);
}

.term-btn:hover {
  background-color: var(--bg-soft);
}

.term-btn.active {
  background-color: var(--primary);
  color: #16181C;
  border-color: var(--primary);
}

.installment-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.installment-actions .btn-secondary {
  flex: 1;
}

.installment-submit-btn {
  flex: 1.5;
}

.installment-wa-icon {
  width: 18px;
  height: 18px;
  display: inline-block;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 4px;
}

@media (max-width: 480px) {
  .installment-product-img {
    width: 48px;
    height: 48px;
  }
  
  .installment-product-info h4 {
    font-size: 13px;
  }
  
  .installment-product-info span {
    font-size: 12px;
  }
  
  .term-btn {
    height: 36px;
    font-size: 12px;
    min-width: 50px;
  }
  
  .installment-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .installment-submit-btn {
    flex: none;
  }
  
  .installment-actions .btn-secondary {
    flex: none;
  }
}
</style>
