import { inject, reactive, ref } from 'vue';
import * as browserData from './data.js';

export const storefrontKey = Symbol('storefront');

export function useStorefrontData() {
  return inject(storefrontKey, browserData);
}

// Every render owns its arrays, language and readiness state. Browser/admin keep
// the existing store; server requests never write into those module singletons.
export function createServerStorefront(catalog, renderedAt, lang = 'ru') {
  const state = JSON.parse(JSON.stringify(catalog));
  const language = ref(lang);
  const items = key => reactive(state[key].sort((a,b) => (Number(a.sortOrder)||0) - (Number(b.sortOrder)||0)));
  return {
    ...browserData,
    products:items('products'), categories:items('categories'), tasks:items('tasks'), banners:items('banners'),
    siteSettings:reactive(state.siteSettings), settingVersions:reactive(state.settingVersions),
    databaseReady:ref(true), catalogLoading:ref(false), isFallbackMode:ref(false), databaseError:ref(''),
    currentLang:language, renderedAt,
    t:key => browserData.t(key, language.value),
    translateCategory:name => browserData.translateCategory(name, language.value),
    translateTask:task => browserData.translateTask(task, language.value),
    setLang:value => { language.value = value; },
  };
}
