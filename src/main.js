import { createApp, createSSRApp } from 'vue'
import './fonts.css'
import './style.css'
import App from './App.vue'
import * as data from './data.js'
import { storefrontKey } from './storefrontData.js'
import { parsePublicRoute } from '../shared/publicRoutes.js'

const app = data.hydrationState ? createSSRApp(App, { initialUrl:data.hydrationState.url }) : createApp(App)
app.provide(storefrontKey, { ...data, renderedAt:data.hydrationState?.renderedAt ?? Date.now() })
app.mount('#app')
// Language URLs determine the initial language. Untranslated catalog pages keep
// the existing UI preference without creating a duplicate localized SEO page.
if (data.hydrationState && ['product','category'].includes(parsePublicRoute(data.hydrationState.url).kind)) data.currentLang.value = localStorage.getItem('packerra_lang') || 'ru'
