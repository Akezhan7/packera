import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';
import { createServerStorefront, storefrontKey } from './storefrontData.js';
import { parsePublicRoute } from '../shared/publicRoutes.js';

export async function render(url, catalog, renderedAt) {
  const app = createSSRApp(App, { initialUrl:url });
  app.provide(storefrontKey, createServerStorefront(catalog, renderedAt, parsePublicRoute(url).lang || 'ru'));
  return renderToString(app);
}
