<script setup>
import { ref, computed, watch } from 'vue';
import { products, PHONE, icons, currentLang, t, siteSettings } from '../data.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  cart: {
    type: Map,
    required: true
  }
});

const emit = defineEmits(['close', 'update-qty', 'set-qty', 'remove-from-cart', 'open-installment']);

const localQuantities = ref({});

watch(() => props.cart, () => {
  localQuantities.value = {};
}, { deep: true });

const getCartItemQty = (item) => {
  if (localQuantities.value[item.key] !== undefined) {
    return localQuantities.value[item.key];
  }
  return item.qty;
};

const updateCartItemQty = (item, val) => {
  if (val === '' || isNaN(val)) {
    localQuantities.value[item.key] = '';
  } else {
    const parsed = Math.max(1, parseInt(val, 10));
    localQuantities.value[item.key] = parsed;
    emit('set-qty', item.key, parsed);
  }
};

const handleCartItemBlur = (item) => {
  if (localQuantities.value[item.key] === '') {
    localQuantities.value[item.key] = 1;
    emit('set-qty', item.key, 1);
  }
};

const getProduct = (id) => {
  const [prodId] = id.split('::');
  return products.find(p => p.id === prodId);
};

const cartItems = computed(() => {
  return [...props.cart.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => {
      const [prodId, size] = key.split('::');
      const p = getProduct(prodId);
      
      // Calculate custom price & image for selected size if available
      let price = p ? p.price : 0;
      let itemImage = p ? p.image : '';
      if (p && p.sizes && p.sizes.length > 0 && size) {
        const found = p.sizes.find(s => s.size === size);
        if (found) {
          price = found.price;
          if (found.image) itemImage = found.image;
          else if (found.images && found.images[0]) itemImage = found.images[0];
        }
      }
      
      return {
        key, // composite key: id::size
        product: p,
        qty,
        size,
        price,
        image: itemImage
      };
    });
});

const cartTotal = computed(() => {
  return cartItems.value.reduce((sum, item) => {
    return sum + (item.price * item.qty);
  }, 0);
});

const freeShippingThreshold = 100000;

const leftForFreeShipping = computed(() => {
  return Math.max(0, freeShippingThreshold - cartTotal.value);
});

const handleClose = () => {
  emit('close');
};

const triggerWhatsAppOrder = () => {
  if (cartItems.value.length === 0) return;

  const lines = [
    t('waOrderHello'),
    "",
    ...cartItems.value.map((item, idx) => {
      const p = item.product;
      const sizeText = item.size ? ` (${item.size})` : '';
      const priceSum = item.price * item.qty;
      return `${idx + 1}. ${p.title}${sizeText} - ${item.qty}${p.unit ? ' ' + p.unit : ''} - ${priceSum.toLocaleString('ru-RU')} ₸`;
    }),
    "",
    `${t('waOrderTotal')}: ${cartTotal.value.toLocaleString('ru-RU')} ₸`
  ];

  const formattedMsg = encodeURIComponent(lines.join("\n"));
  const waUrl = `https://api.whatsapp.com/send/?phone=${PHONE}&text=${formattedMsg}&type=phone_number&app_absent=0`;
  
  window.open(waUrl, '_blank', 'noopener,noreferrer');
};
</script>

<template>
  <div 
    :class="['cart-drawer-overlay', { open: isOpen }]"
    @click.self="handleClose"
  >
    <aside 
      class="cart-drawer"
      role="dialog"
      aria-modal="true"
      :aria-label="t('cartTitle')"
    >
      <!-- Header -->
      <div class="cart-drawer-header">
        <div class="cart-drawer-title-wrap">
          <h2>{{ t('cartTitle') }}</h2>
          <span 
            class="badge badge-primary"
            style="font-size: 11px; padding: 2px 8px;"
          >
            {{ cartItems.length }} {{ currentLang === 'ru' ? (cartItems.length === 1 ? 'позиция' : 'позиций') : 'тауар' }}
          </span>
        </div>
        <button 
          @click="handleClose" 
          class="btn-square" 
          aria-label="Закрыть корзину"
          v-html="icons.x"
        ></button>
      </div>

      <!-- Drawer Body -->
      <div class="cart-drawer-body">
        <!-- Empty Cart Notice -->
        <div v-if="cartItems.length === 0" class="cart-empty-message">
          <span v-html="icons.cart" style="color: var(--text-muted); width: 48px; height: 48px; display: inline-block;"></span>
          <p>{{ t('cartEmpty') }}</p>
          <button @click="handleClose" class="btn btn-primary" style="height: 38px; font-size: 13px;">
            {{ t('backToShop') }}
          </button>
        </div>

        <!-- List of items -->
        <div v-else class="cart-items-list">
          <article 
            v-for="item in cartItems" 
            :key="item.key"
            class="cart-item-card"
          >
            <div class="cart-item-img">
              <img :src="item.image || item.product.image" :alt="item.product.title" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=80'" />
            </div>
            
            <div class="cart-item-info">
              <h4 class="cart-item-title">{{ item.product.title }}</h4>
              
              <!-- Size Tag -->
              <div v-if="item.size" class="cart-item-size-tag">
                {{ t('sizeLabel') }} {{ item.size }}
              </div>

              <span class="cart-item-meta">{{ item.price.toLocaleString('ru-RU') }} ₸<span v-if="item.product.unit"> / {{ item.product.unit }}</span></span>
              
              <!-- Controls and line total -->
              <div class="cart-item-controls">
                <div class="stepper" style="width: 96px; height: 30px;">
                  <button @click="updateCartItemQty(item, getCartItemQty(item) - 1)" aria-label="Уменьшить">-</button>
                  <input 
                    type="number" 
                    :value="getCartItemQty(item)" 
                    @input="updateCartItemQty(item, $event.target.value)" 
                    @blur="handleCartItemBlur(item)"
                    min="1"
                    style="font-size: 12px;"
                  />
                  <button @click="updateCartItemQty(item, getCartItemQty(item) + 1)" aria-label="Увеличить">+</button>
                </div>
                
                <strong class="cart-item-price">
                  {{ (item.price * item.qty).toLocaleString('ru-RU') }} ₸
                </strong>
              </div>
              <!-- Side-by-side action buttons: Рассрочка & Удалить -->
              <div class="cart-item-actions-row">
                <button 
                  v-if="siteSettings.installmentEnabled"
                  @click="emit('open-installment', item.product.id)" 
                  class="cart-item-btn-installment"
                >
                  {{ t('installment') }}
                </button>
                <button 
                  @click="emit('remove-from-cart', item.key)" 
                  class="cart-item-btn-delete"
                >
                  {{ t('delete') }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- Drawer Footer -->
      <div v-if="cartItems.length > 0" class="cart-drawer-footer">
        <div class="cart-total-row">
          <span>{{ t('total') }}</span>
          <strong>{{ cartTotal.toLocaleString('ru-RU') }} ₸</strong>
        </div>

        <!-- Progress to free shipping -->
        <div 
          v-if="leftForFreeShipping > 0" 
          class="delivery-note"
          style="background-color: var(--bg-soft); color: var(--text-lead); border-color: var(--border-line);"
        >
          {{ t('freeShippingLeft') }} {{ leftForFreeShipping.toLocaleString('ru-RU') }} ₸
        </div>
        <div 
          v-else 
          class="delivery-note" 
          style="background-color: var(--success-light); color: var(--success); border-color: rgba(16, 185, 129, 0.15);"
        >
          {{ t('freeShippingSuccess') }}
        </div>

        <!-- Action Button -->
        <div class="checkout-btn-group">
          <button 
            @click="triggerWhatsAppOrder" 
            class="btn btn-success checkout-main-btn"
          >
            <img src="/whatsapp.png" alt="WhatsApp" class="checkout-wa-icon" /> {{ t('checkoutBtn') }}
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.cart-drawer-overlay {
  transition: opacity 0.25s ease, visibility 0.25s ease;
}
.cart-drawer {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.checkout-main-btn {
  width: 100%;
  height: 48px;
  font-weight: 800;
  font-size: 15px;
}

.checkout-wa-icon {
  width: 20px;
  height: 20px;
  display: inline-block;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 6px;
}

.checkout-btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}


.cart-item-actions-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  width: 100%;
}

.cart-item-btn-installment {
  flex: 1;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  color: var(--text-ink);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cart-item-btn-installment:hover {
  background-color: var(--bg-soft);
  border-color: var(--text-muted);
}

.cart-item-btn-delete {
  flex: 1;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #FFF5F5;
  border: 1px solid rgba(255, 45, 85, 0.25);
  color: #FF2D55;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cart-item-btn-delete:hover {
  background-color: #FFE5E5;
  border-color: rgba(255, 45, 85, 0.4);
}

@media (max-width: 480px) {
  .checkout-main-btn {
    height: 44px;
    font-size: 14px;
  }
  .checkout-wa-icon {
    width: 18px;
    height: 18px;
  }
  .cart-item-btn-installment,
  .cart-item-btn-delete {
    font-size: 11px;
    height: 30px;
    border-radius: 6px;
  }
}
</style>
