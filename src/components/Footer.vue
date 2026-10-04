<script setup>
import { PHONE, FORMATTED_PHONE, icons, t } from '../data.js';
</script>

<template>
  <footer>
    <div class="container">
      <div class="footer-grid">
        <!-- Brand & Info -->
        <div class="footer-column" style="max-width: 320px;">
          <div class="brand footer-brand">
            <img src="/logo2.png" alt="Packerra.kz" onerror="this.src='https://packerra.kz/logo2.png'" />
          </div>
          <p>
            {{ t('footerDesc') }}
          </p>
        </div>



        <!-- Contact Detail -->
        <div class="footer-column">
          <h4>{{ t('contacts') }}</h4>
          <ul class="footer-links footer-contacts">
            <li>
              <span v-html="icons.phone" class="footer-contact-icon"></span>
              <strong>{{ FORMATTED_PHONE }}</strong>
            </li>
            <li>
              <img src="/whatsapp.png" alt="WhatsApp" class="footer-wa-icon" />
              <a :href="`https://wa.me/${PHONE}`" target="_blank" rel="noreferrer" style="font-weight: 700;">{{ t('writeWhatsApp') }}</a>
            </li>
            <li>
              <span v-html="icons.clock" class="footer-contact-icon footer-contact-icon-muted"></span>
              <span>{{ t('footerDaily') }}</span>
            </li>
            <li>
              <span v-html="icons.warehouse" class="footer-contact-icon footer-contact-icon-muted"></span>
              <span>{{ t('footerAddress') }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Footer Bottom -->
      <div class="footer-bottom">
        <span>{{ t('footerRights') }}</span>

      </div>
    </div>
  </footer>
</template>

<style scoped>
footer {
  transition: background-color var(--transition-medium);
}

.footer-brand {
  margin-bottom: 8px;
}

.footer-brand img {
  height: 34px;
}

.footer-contacts li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-lead);
}

.footer-contact-icon {
  width: 16px;
  height: 16px;
  color: var(--primary);
  flex-shrink: 0;
}

.footer-contact-icon-muted {
  color: var(--text-muted);
}

.footer-wa-icon {
  width: 16px;
  height: 16px;
  display: inline-block;
  object-fit: contain;
  vertical-align: middle;
  flex-shrink: 0;
}


@media (max-width: 768px) {
  .footer-brand img {
    height: 30px;
  }
  
  .footer-contacts li {
    font-size: 13px;
  }
}
</style>
