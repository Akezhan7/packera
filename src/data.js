import { reactive, ref } from 'vue';
import { requestApi, saveContentOperations, resolvePendingContentSave } from './adminApi.js';

// Packerra.kz Upgraded Product & Task Data for Vue (ESM)

export const PHONE = "77779440077";
export const FORMATTED_PHONE = "+7 777 944 00 77";

export const commonsImage = (file, width = 640) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

export const icons = {
  "arrow-right": `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  phone: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.34 1.9.63 2.8a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.29 1.84.5 2.8.63A2 2 0 0 1 22 16.92Z"></path></svg>`,
  whatsapp: `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 2C6.479 2 2 6.479 2 12.03c0 1.959.563 3.788 1.536 5.334L2 22l4.81-1.488a9.923 9.923 0 005.221 1.517C17.581 22.03 22 17.55 22 12.03 22 6.479 17.581 2 12.031 2zm6.39 14.227c-.247.693-1.42 1.328-2.023 1.413-.512.073-1.18.106-1.895-.12a9.78 9.78 0 01-1.693-.622c-2.981-1.286-4.93-4.288-5.078-4.486-.149-.197-1.213-1.611-1.213-3.073 0-1.463.766-2.182 1.038-2.479.272-.298.594-.372.793-.372.198 0 .396.01.57.019.18.009.425-.08.666.5.247.594.842 2.059.916 2.207.075.148.124.321.025.52-.099.198-.149.321-.297.495-.149.173-.312.386-.446.52-.149.148-.302.307-.129.606.173.297.77 1.27 1.653 2.059 1.135 1.012 2.093 1.324 2.39 1.474.298.149.471.124.645-.074.173-.198.743-.866.94-1.163.199-.297.397-.248.694-.099.297.149 1.884.891 2.206 1.039.323.149.537.223.612.347.075.124.075.718-.172 1.413z"/></svg>`,
  truck: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
  box: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  clock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  "package-check": `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 18 18 22 14"></polyline><path d="M20 10c0-3.3-2.7-6-6-6S8 6.7 8 10s2.7 6 6 6h2"></path><rect x="2" y="14" width="6" height="8" rx="1"></rect><line x1="5" y1="14" x2="5" y2="10"></line></svg>`,
  warehouse: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"></path><path d="M4 11V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7"></path><line x1="12" y1="2" x2="12" y2="21"></line><path d="M7 15h10"></path></svg>`,
  headphones: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
  briefcase: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
  cart: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
  x: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  users: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  spray: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v4H8z"></path><path d="M10 7v4"></path><path d="M7 11h10l-1 10H8z"></path><path d="M14 7h4v2h-4z"></path></svg>`,
  wrench: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  scissors: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="9.8" y1="8.2" x2="21" y2="19.4"></line><line x1="9.8" y1="15.8" x2="21" y2="4.6"></line></svg>`,
  biohazard: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11.9" r="2" /><path d="M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 9 3.7 9.6 2 11.6" /><path d="m8.9 10.1 1.4.8" /><path d="M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4-1.2 5.2-.6 6.9 1.5" /><path d="m15.1 10.1-1.4.8" /><path d="M16.7 20.8c-2.6-.4-4.6-2.6-4.7-5.3-.2 2.6-2.1 4.8-4.7 5.2" /><path d="M12 13.9v1.6" /><path d="M13.5 5.4c-1-.2-2-.2-3 0" /><path d="M17 16.4c.7-.7 1.2-1.6 1.5-2.5" /><path d="M5.5 13.9c.3.9.8 1.8 1.5 2.5" /></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  tag: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  info: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  calculator: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="16"></line><line x1="15" y1="22" x2="15" y2="16"></line><line x1="9" y1="16" x2="15" y2="16"></line><path d="M8 6h8M8 10h8M8 14h8"></path></svg>`,
  star: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  search: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  heart: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  "paint-roller": `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="6" x="2" y="2" rx="2" /><path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect width="4" height="6" x="8" y="16" rx="1" /></svg>`,
  "scan-barcode": `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 7v10" /><path d="M12 7v10" /><path d="M17 7v10" /></svg>`,
  sofa: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" /><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" /><path d="M4 18v2" /><path d="M20 18v2" /><path d="M12 4v9" /></svg>`,
  "brush-cleaning": `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 22-1-4" /><path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1" /><path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z" /><path d="m8 22 1-4" /></svg>`,
  "shelving-unit": `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" /><path d="M16 20v-3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" /><path d="M20 22V2" /><path d="M4 12h16" /><path d="M4 20h16" /><path d="M4 2v20" /><path d="M4 4h16" /></svg>`
};

const defaultProducts = [
  {
    "id": "PKS000001",
    "title": "Гофрокартон двухслойный рулонный 10 м",
    "desc": "Двухслойный гофрокартон в рулоне шириной 105 см и длиной 10 м — универсальный материал для упаковки, переезда и защиты поверхностей. Плотная структура 250 г/м² и волна толщиной 4 мм обеспечивают надежное амортизирование и защиту предметов любой формы.",
    "price": 2790,
    "unit": "шт",
    "category": "📦 Картонные изделия",
    "visual": "box",
    "color": "#c89048",
    "image": "/products/image1.jpeg",
    "images": [
      "/products/image1.jpeg",
      "/products/image172.jpeg",
      "/products/image173.jpeg",
      "/products/image2.jpeg",
      "/products/image3.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "storage": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/gofrokarton-dvuhsloinyi-10-m-151221762/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000002",
    "title": "Картон листовой 5 листов",
    "desc": "Листовой трехслойный картон подходит для упаковки, хранения, переезда и защиты товаров при транспортировке. Прочный материал выдерживает нагрузки и помогает защитить содержимое от повреждений. Большой формат 200×105 см удобен для изготовления коробок, прокладок и упаковочных элементов.",
    "price": 4390,
    "unit": "шт",
    "category": "📦 Картонные изделия",
    "visual": "box",
    "color": "#c89048",
    "image": "/products/image142.jpeg",
    "images": [
      "/products/image142.jpeg",
      "/products/image145.png",
      "/products/image171.jpeg",
      "/products/image174.jpeg"
    ],
    "tasks": {},
    "sizes": [],
    "specs": {},
    "kaspiLink": "",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000003",
    "title": "Коробки 3слойные 5шт",
    "desc": "Набор картонных коробок подходит для хранения, переезда, упаковки и транспортировки различных вещей. Изготовлены из надежного гофрокартона, выдерживают нагрузку до 10 кг и обеспечивают сохранность содержимого. В комплекте 5 коробки.",
    "price": 5690,
    "unit": "шт",
    "category": "📦 Картонные изделия",
    "visual": "box",
    "color": "#c89048",
    "image": "/products/image143.jpeg",
    "images": [
      "/products/image143.jpeg",
      "/products/image144.jpeg",
      "/products/image146.jpeg",
      "/products/image147.jpeg",
      "/products/image149.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/korobka-3h-sloinaja-5sht-168654455/",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000004",
    "title": "Коробки 5 слойные 5шт",
    "desc": "Набор 5ти слойных картонных коробок подходит для хранения, переезда, упаковки и транспортировки различных вещей. Изготовлены из надежного гофрокартона, выдерживают нагрузку до 20 кг и обеспечивают сохранность содержимого. В комплекте 5 коробки.",
    "price": 8390,
    "unit": "шт",
    "category": "📦 Картонные изделия",
    "visual": "box",
    "color": "#c89048",
    "image": "/products/image148.jpeg",
    "images": [
      "/products/image148.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/korobka-09878900-gofrirovannyi-karton-40-sm-5-sht-169031658/",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000005",
    "title": "Перчатки нитриловые 100 шт",
    "desc": "Нитриловые одноразовые перчатки синего цвета размер S. Эластичный и прочный материал обеспечивает комфортную работу и надежную защиту рук. Подходят для косметологии, уборки, общепита и бытового использования. Не содержат латекс, устойчивы к разрывам и удобны при длительном ношении.",
    "price": 3790,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image10.jpeg",
    "images": [
      "/products/image10.jpeg",
      "/products/image11.jpeg",
      "/products/image12.jpeg",
      "/products/image13.jpeg",
      "/products/image14.jpeg",
      "/products/image4.jpeg",
      "/products/image5.jpeg",
      "/products/image6.jpeg",
      "/products/image7.jpeg",
      "/products/image8.jpeg",
      "/products/image9.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [
      {
        "id": "PKS000005",
        "size": "S (синие)",
        "price": 3790,
        "image": "/products/image4.jpeg",
        "images": [
          "/products/image4.jpeg",
          "/products/image5.jpeg",
          "/products/image6.jpeg",
          "/products/image7.jpeg",
          "/products/image8.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/perchatki-30324053-112-perchatki-nitrilovye-sinie-razmer-s-100-sht-sinii-100-sht-166651560/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000006",
        "size": "M (синие)",
        "price": 3790,
        "image": "/products/image11.jpeg",
        "images": [
          "/products/image11.jpeg",
          "/products/image9.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/perchatki-112-sinii-100-sht-166770323/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000007",
        "size": "L (черные)",
        "price": 3790,
        "image": "/products/image10.jpeg",
        "images": [
          "/products/image10.jpeg",
          "/products/image12.jpeg",
          "/products/image13.jpeg",
          "/products/image14.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/perchatki-112-chernyi-100-sht-166770419/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-30324053-112-perchatki-nitrilovye-sinie-razmer-s-100-sht-sinii-100-sht-166651560/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000008",
    "title": "Перчатки универсальные хлопчатобумажные 12 шт",
    "desc": "Рабочие хлопковые перчатки предназначены для защиты рук при строительных, хозяйственных и садовых работах. Обеспечивают комфорт, прочность и хорошую вентиляцию даже при длительном использовании.",
    "price": 2190,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "",
    "images": [],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-rabochie-serye-12-sht-147791796/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000009",
    "title": "Перчатки строительные хлопчатобумажные 10 шт",
    "desc": "Рабочие перчатки с дышащей хлопковой основой и эластичной манжетой обеспечивают комфорт и надёжную защиту рук во время работы. Ладонь и пальцы покрыты прочным нескользящим слоем для уверенного захвата инструментов и устойчивости к износу.",
    "price": 2890,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image15.jpeg",
    "images": [
      "/products/image15.jpeg",
      "/products/image16.jpeg",
      "/products/image17.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-rabochie-zelenye-10-sht-147756866/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000010",
    "title": "Перчатки строительные с нитриловым покрытием 10 шт",
    "desc": "Рабочие утепленные перчатки PlastKrep 600# с двойным латексным покрытием защищают руки от холода, влаги и механических повреждений. Подходят для строительных, ремонтных и складских работ в зимний период.",
    "price": 3890,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image18.jpeg",
    "images": [
      "/products/image18.jpeg",
      "/products/image20.jpeg"
    ],
    "tasks": {
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-stroitel-nye-s-nitrilovym-pokrytiem-10-sht--147792378/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000011",
    "title": "Перчатки универсальные хлопчатобумажные 10 шт",
    "desc": "Рабочие хлопчатобумажные перчатки — надёжная защита рук при строительных, ремонтных и хозяйственных работах. Благодаря дышащей хлопковой основе и эластичной манжете обеспечивают комфорт, хорошее прилегание и долговечность даже при длительном использовании.",
    "price": 2390,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image19.jpeg",
    "images": [
      "/products/image19.jpeg",
      "/products/image21.jpeg",
      "/products/image24.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-rabochie-polosatye-10sht-147788948/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000012",
    "title": "Перчатки розовый 1 шт",
    "desc": "Латексные перчатки предназначены для комфортной и безопасной работы по дому. Надёжно защищают руки от влаги, грязи и бытовой химии, обеспечивая удобство при уборке, мытье посуды и других задачах. Эластичный материал плотно прилегает к руке, не сковывает движения и позволяет выполнять работу аккуратно.",
    "price": 2990,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image22.jpeg",
    "images": [
      "/products/image22.jpeg",
      "/products/image23.jpeg",
      "/products/image25.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-30324053-67-perchatkilateksnyerozov-rozovyi-1-sht-166375198/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000013",
    "title": "Перчатки жёлтый 1 шт",
    "desc": "Латексные перчатки — практичное решение для уборки, бытовых и хозяйственных задач. Надёжно защищают руки от влаги, грязи и бытовой химии, обеспечивая комфорт даже при длительном использовании. Благодаря эластичному материалу перчатки плотно облегают руку и не сковывают движения. Рифлёная поверхность улучшает сцепление и делает работу более удобной и безопасной",
    "price": 990,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image26.jpeg",
    "images": [
      "/products/image26.jpeg",
      "/products/image27.jpeg",
      "/products/image28.jpeg",
      "/products/image29.jpeg"
    ],
    "tasks": {
      "repair": 1,
      "cleaning": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/perchatki-72-l-zhjoltyi-1-sht-166752780/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000014",
    "title": "Ветошь хлопчатобумажная",
    "desc": "Практичная хозяйственная ветошь из мягкой хлопковой ткани для эффективной уборки дома, офиса и производственных помещений. Отлично впитывает влагу, подходит для мытья полов, протирки поверхностей и многоразового использования.",
    "price": 3990,
    "unit": "шт",
    "category": "📦 Ящики и ёмкости",
    "visual": "box",
    "color": "#bc6c25",
    "image": "/products/image30.jpeg",
    "images": [
      "/products/image30.jpeg",
      "/products/image31.jpeg",
      "/products/image32.jpeg",
      "/products/image33.jpeg",
      "/products/image34.jpeg",
      "/products/image35.jpeg",
      "/products/image36.jpeg",
      "/products/image37.jpeg",
      "/products/image38.jpeg",
      "/products/image39.jpeg",
      "/products/image40.jpeg"
    ],
    "tasks": {
      "cleaning": 1
    },
    "sizes": [
      {
        "id": "PKS000014",
        "size": "70 см x 5 м",
        "price": 3990,
        "image": "/products/image30.jpeg",
        "images": [
          "/products/image30.jpeg",
          "/products/image31.jpeg",
          "/products/image32.jpeg",
          "/products/image34.jpeg",
          "/products/image35.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vetosh-vetosh-70-5-1-sht-hlopok-167977163/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000015",
        "size": "140 см x 5 м",
        "price": 4990,
        "image": "/products/image33.jpeg",
        "images": [
          "/products/image33.jpeg",
          "/products/image36.jpeg",
          "/products/image37.jpeg",
          "/products/image38.jpeg",
          "/products/image39.jpeg",
          "/products/image40.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vetosh-vetosh-1405-m-1-sht-hlopok-167977432/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/vetosh-vetosh-70-5-1-sht-hlopok-167977163/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000016",
    "title": "Пленка укрывная",
    "desc": "Укрывная плёнка предназначена для защиты мебели, пола, техники и других поверхностей во время ремонта, покраски и строительных работ. Надёжно защищает от пыли, влаги, краски и загрязнений, помогая сохранить чистоту и порядок в помещении. Плёнка лёгкая, прочная и удобная в использовании, легко раскладывается и подходит для укрытия больших поверхностей.",
    "price": 3750,
    "unit": "шт",
    "category": "📦 Ящики и ёмкости",
    "visual": "box",
    "color": "#bc6c25",
    "image": "/products/image41.jpeg",
    "images": [
      "/products/image41.jpeg",
      "/products/image42.jpeg",
      "/products/image43.jpeg"
    ],
    "tasks": {
      "move": 1,
      "marketplaces": 1,
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/plenka-ukryvnaja-3h5-m-166848612/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000017",
    "title": "Воздушно-пузырьковая пленка",
    "desc": "Пузырчатая пленка  60/50 — практичный упаковочный материал для надежной защиты хрупких предметов во время хранения, перевозки и переезда. Воздушные пузырьки создают амортизирующий слой, который помогает защитить изделия от ударов, царапин и повреждений. Подходит для домашнего и профессионального использования.",
    "price": 3590,
    "unit": "шт",
    "category": "🫧 Плёнки и укрывные материалы",
    "visual": "roll",
    "color": "#8ecae6",
    "image": "/products/image150.jpeg",
    "images": [
      "/products/image150.jpeg",
      "/products/image151.jpeg",
      "/products/image152.jpeg",
      "/products/image153.jpeg",
      "/products/image154.jpeg",
      "/products/image155.jpeg",
      "/products/image156.jpeg",
      "/products/image157.jpeg",
      "/products/image158.jpeg",
      "/products/image159.jpeg",
      "/products/image160.jpeg",
      "/products/image161.jpeg",
      "/products/image162.jpeg",
      "/products/image163.jpeg",
      "/products/image164.jpeg",
      "/products/image165.jpeg",
      "/products/image166.jpeg",
      "/products/image44.jpeg",
      "/products/image45.jpeg",
      "/products/image46.jpeg",
      "/products/image47.jpeg",
      "/products/image48.jpeg",
      "/products/image49.jpeg",
      "/products/image50.jpeg",
      "/products/image51.jpeg"
    ],
    "tasks": {
      "move": 1,
      "marketplaces": 1,
      "storage": 1
    },
    "sizes": [
      {
        "id": "PKS000017",
        "size": "60 см x 50 м",
        "price": 3590,
        "image": "/products/image44.jpeg",
        "images": [
          "/products/image44.jpeg",
          "/products/image45.jpeg",
          "/products/image48.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-60-50-polietilen-60-sm-1-sht-167368768/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000018",
        "size": "120 см x 50 м",
        "price": 5990,
        "image": "/products/image46.jpeg",
        "images": [
          "/products/image46.jpeg",
          "/products/image47.jpeg",
          "/products/image49.jpeg",
          "/products/image50.jpeg",
          "/products/image51.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-120-50m-polietilen-5000-sm-1-sht-167328111/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000049",
        "size": "120 см x 100 м",
        "price": 16990,
        "image": "/products/image150.jpeg",
        "images": [
          "/products/image150.jpeg",
          "/products/image151.jpeg",
          "/products/image152.jpeg",
          "/products/image153.jpeg",
          "/products/image155.jpeg",
          "/products/image156.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-120-100-polietilen-10000-sm-1-sht-167328113/",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000050",
        "size": "120 см x 30 м",
        "price": 5490,
        "image": "/products/image152.jpeg",
        "images": [
          "/products/image152.jpeg",
          "/products/image154.jpeg",
          "/products/image156.jpeg",
          "/products/image157.jpeg",
          "/products/image158.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-120-30-polietilen-3000-sm-1-sht-167328109/",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000051",
        "size": "60 см x 30 м",
        "price": 2290,
        "image": "/products/image152.jpeg",
        "images": [
          "/products/image152.jpeg",
          "/products/image159.jpeg",
          "/products/image162.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-60-30-polietilen-60-sm-1-sht-167368767/",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000052",
        "size": "100 см x 60 м",
        "price": 7990,
        "image": "/products/image160.jpeg",
        "images": [
          "/products/image160.jpeg",
          "/products/image161.jpeg",
          "/products/image163.jpeg",
          "/products/image164.jpeg",
          "/products/image165.jpeg",
          "/products/image166.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-100-60-polietilen-100-sm-1-sht-167368769/",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/vozdushno-puzyr-kovaja-plenka-68-60-50-polietilen-60-sm-1-sht-167368768/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000019",
    "title": "Скотч упаковочный",
    "desc": "Прочный упаковочный скотч 50х100с усиленным клеевым слоем для надежной фиксации коробок, посылок и различных товаров. Эластичный материал плотно прилегает к поверхности и обеспечивает удобное использование в быту, на складе и при переезде.",
    "price": 1490,
    "unit": "шт",
    "category": "📎 Скотч и клейкие ленты",
    "visual": "roll",
    "color": "#ffb703",
    "image": "/products/image52.jpeg",
    "images": [
      "/products/image52.jpeg",
      "/products/image53.jpeg",
      "/products/image54.jpeg",
      "/products/image55.jpeg",
      "/products/image56.jpeg",
      "/products/image57.jpeg",
      "/products/image58.jpeg",
      "/products/image59.jpeg",
      "/products/image60.jpeg"
    ],
    "tasks": {
      "move": 1,
      "marketplaces": 1,
      "storage": 1
    },
    "sizes": [
      {
        "id": "PKS000019",
        "size": "50 мм x 100 м",
        "price": 1490,
        "image": "",
        "images": [],
        "kaspiLink": "https://kaspi.kz/shop/p/skotch-50-mm-h-100-m-1-sht-165620075/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000020",
        "size": "60 мм x 100 м",
        "price": 1790,
        "image": "/products/image52.jpeg",
        "images": [
          "/products/image52.jpeg",
          "/products/image53.jpeg",
          "/products/image54.jpeg",
          "/products/image55.jpeg",
          "/products/image56.jpeg",
          "/products/image57.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/skotch-60-mm-h-100-m-1-sht-165645843/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000021",
        "size": "80 мм x 100 м",
        "price": 2390,
        "image": "/products/image58.jpeg",
        "images": [
          "/products/image58.jpeg",
          "/products/image59.jpeg",
          "/products/image60.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/skotch-80-mm-h-100-m-1-sht-165618727/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/skotch-50-mm-h-100-m-1-sht-165620075/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000022",
    "title": "Канцелярский нож серый",
    "desc": "Канцелярский нож для точной и удобной резки. Подходит для дома, офиса и ремонта. Оснащён автофиксатором и надёжной конструкцией, удобно лежит в руке.",
    "price": 2390,
    "unit": "шт",
    "category": "✂️ Инструменты и расходники",
    "visual": "tool",
    "color": "#264653",
    "image": "/products/image62.jpeg",
    "images": [
      "/products/image62.jpeg",
      "/products/image64.jpeg"
    ],
    "tasks": {
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/kantseljarskii-nozh-2508-seryi-153996276/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000023",
    "title": "Монтажный нож 1 шт",
    "desc": "Универсальный строительный нож для точной и удобной резки различных материалов. Оснащен прочным лезвием из стали 9ХФ и эргономичной рукояткой для комфортной работы. Подходит для дома, ремонта и мастерской.",
    "price": 3790,
    "unit": "шт",
    "category": "✂️ Инструменты и расходники",
    "visual": "tool",
    "color": "#264653",
    "image": "/products/image61.jpeg",
    "images": [
      "/products/image61.jpeg",
      "/products/image63.jpeg",
      "/products/image66.jpeg",
      "/products/image68.jpeg"
    ],
    "tasks": {
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/montazhnyi-nozh-409-1-sht-162588390/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000024",
    "title": "Портной ножницы р 11",
    "desc": "Портновские ножницы LINWEI — надёжный инструмент для кроя и шитья. Изготовлены по немецкой технологии из нержавеющей стали, обеспечивают чистый и точный срез любых тканей. Удобные прорезиненные ручки предотвращают скольжение и снижают усталость рук.",
    "price": 4590,
    "unit": "шт",
    "category": "✂️ Инструменты и расходники",
    "visual": "tool",
    "color": "#264653",
    "image": "/products/image65.jpeg",
    "images": [
      "/products/image65.jpeg",
      "/products/image67.jpeg",
      "/products/image70.jpeg"
    ],
    "tasks": {
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/00112-nozhnitsy-portnovskie-chernye-24sm-chernyi-148774315/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000025",
    "title": "Нож для гипсокартона с 5 лезвиями синий 1 шт",
    "desc": "Надежный монтажный нож для точного и аккуратного реза гипсокартона, винила и других материалов.Для резки гипсокартона, изоляционных материалов, линолеума, винила, кожи и других поверхностей.Лезвия из прочной стали SK5 – износостойкость и долговечность.",
    "price": 2590,
    "unit": "шт",
    "category": "✂️ Инструменты и расходники",
    "visual": "tool",
    "color": "#264653",
    "image": "/products/image69.jpeg",
    "images": [
      "/products/image69.jpeg",
      "/products/image72.jpeg"
    ],
    "tasks": {},
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/nozh-dlja-gipsokartona-s-5-lezvijami-sinii-1-sht-146130505/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000026",
    "title": "Ножницы универсальные синие 20 см",
    "desc": "Хозяйственные ножницы 20 см — удобный и прочный инструмент для дома, офиса или мастерской. Изготовлены из нержавеющей стали, устойчивой к коррозии, и оснащены зубчатой проточкой, которая обеспечивает точный и надёжный захват материала. Эргономичные пластиковые ручки обеспечивают комфорт при длительном использовании.",
    "price": 3390,
    "unit": "шт",
    "category": "✂️ Инструменты и расходники",
    "visual": "tool",
    "color": "#264653",
    "image": "/products/image71.jpeg",
    "images": [
      "/products/image71.jpeg",
      "/products/image73.jpeg",
      "/products/image74.jpeg"
    ],
    "tasks": {},
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/nozhnitsy-universal-nye-sinie-20-sm-148193245/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000027",
    "title": "Полумаска ffp2 ffp2 10 v 10 шт",
    "desc": "Респиратор класса FFP2 с клапаном выдоха предназначен для эффективной защиты органов дыхания от пыли, аэрозолей, дыма и мелких твёрдых частиц. Оснащён клапаном выдоха для облегчённого дыхания и снижения влажности под маской. Подходит для строительных, ремонтных, производственных и бытовых работ.",
    "price": 4990,
    "unit": "шт",
    "category": "😷 Личная защита",
    "visual": "shield",
    "color": "#e76f51",
    "image": "/products/image75.jpeg",
    "images": [
      "/products/image75.jpeg",
      "/products/image76.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/polumaska-ffp2-ffp2-10-v-10-sht-153608440/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000028",
    "title": "Полумаска a1+p2 круглая",
    "desc": "Респиратор профессиональный A1+P2 — надёжное средство защиты органов дыхания от органических паров, газов, строительной пыли и аэрозолей. Подходит для использования в промышленности, строительстве и бытовых условиях. Оснащён двойным фильтром и клапаном выдоха, не запотевает и обеспечивает комфортное дыхание.",
    "price": 4990,
    "unit": "шт",
    "category": "😷 Личная защита",
    "visual": "shield",
    "color": "#e76f51",
    "image": "/products/image77.jpeg",
    "images": [
      "/products/image77.jpeg",
      "/products/image78.jpeg",
      "/products/image79.jpeg",
      "/products/image80.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/polumaska-a1-p2-kruglaja-148073635/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000029",
    "title": "Респиратор a1+p2",
    "desc": "Полумаска-респиратор с фильтрами A1P2 для защиты от пыли, аэрозолей и органических паров. Легкий корпус и сменные фильтры обеспечивают удобство и долговечность.",
    "price": 4990,
    "unit": "шт",
    "category": "😷 Личная защита",
    "visual": "shield",
    "color": "#e76f51",
    "image": "/products/image82.jpeg",
    "images": [
      "/products/image82.jpeg",
      "/products/image83.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/a1-p2-146291363/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000030",
    "title": "Бумажные полотенца",
    "desc": "Многоразовые безворсовые салфетки в рулоне подходят для уборки кухни, дома и рабочих поверхностей. Плотный материал хорошо впитывает влагу, не рвется и не оставляет ворсинок. Удобный формат рулона позволяет легко отрывать салфетки по мере необходимости.",
    "price": 3890,
    "unit": "шт",
    "category": "🧹 Бытовые расходники",
    "visual": "cloth",
    "color": "#e9c46a",
    "image": "/products/image81.jpeg",
    "images": [
      "/products/image81.jpeg",
      "/products/image84.jpeg",
      "/products/image85.jpeg",
      "/products/image86.jpeg",
      "/products/image88.jpeg"
    ],
    "tasks": {},
    "sizes": [
      {
        "id": "PKS000030",
        "size": "370 листов (60 шт)",
        "price": 3890,
        "image": "/products/image81.jpeg",
        "images": [
          "/products/image81.jpeg",
          "/products/image84.jpeg",
          "/products/image85.jpeg",
          "/products/image86.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/bumazhnye-polotentsa-370-60-sht-161368701/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000031",
        "size": "Желтые (50 шт)",
        "price": 2590,
        "image": "/products/image88.jpeg",
        "images": [
          "/products/image88.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/bumazhnye-polotentsa-zheltye-50-sht-162739467/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/bumazhnye-polotentsa-370-60-sht-161368701/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000032",
    "title": "Очки закрытые класс f красный",
    "desc": "Защитные очки строительные с непрямой вентиляцией. Изготовлены из ударопрочного поликарбоната, обеспечивают надёжную защиту глаз от пыли, стружки, абразива, брызг и высокоскоростных частиц. Подходят для строительства, ремонта, шлифовки, резки металла, работы с деревом и электроинструментом.",
    "price": 2590,
    "unit": "шт",
    "category": "😷 Личная защита",
    "visual": "shield",
    "color": "#e76f51",
    "image": "/products/image87.jpeg",
    "images": [
      "/products/image87.jpeg",
      "/products/image89.jpeg",
      "/products/image90.png"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/ochki-zakrytye-s-nagolovnym-krepleniem-zaschitnye-vintiliruemye-klass-f-krasnyi-144775998/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000033",
    "title": "Комбинезон защитный белый",
    "desc": "Защитный одноразовый комбинезон предназначен для защиты одежды и тела от пыли, грязи и мелких загрязнений при выполнении рабочих задач.Надёжно защищает от загрязнений,лёгкий и удобный в использовании.",
    "price": 2890,
    "unit": "шт",
    "category": "😷 Личная защита",
    "visual": "shield",
    "color": "#e76f51",
    "image": "/products/image91.jpeg",
    "images": [
      "/products/image91.jpeg",
      "/products/image92.jpeg",
      "/products/image93.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/30324053-662859646-belyi-54-157349385/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000034",
    "title": "Пакет майка",
    "desc": "Прочные полиэтиленовые пакеты майка для продуктов, покупок и хозяйственных нужд. Размер 80×60 см обеспечивает хорошую вместительность, а плотность 30 мкм позволяет выдерживать нагрузку до 20 кг. Подходят для ежедневного использования.",
    "price": 3590,
    "unit": "шт",
    "category": "🧳 Сумки, баулы и пакеты",
    "visual": "bag",
    "color": "#457b9d",
    "image": "/products/image175.jpeg",
    "images": [
      "/products/image175.jpeg",
      "/products/image176.jpeg",
      "/products/image177.jpeg",
      "/products/image94.jpeg",
      "/products/image95.jpeg",
      "/products/image96.jpeg",
      "/products/image97.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [
      {
        "id": "PKS000034",
        "size": "30 шт",
        "price": 3590,
        "image": "/products/image94.jpeg",
        "images": [
          "/products/image94.jpeg",
          "/products/image95.jpeg",
          "/products/image96.jpeg",
          "/products/image97.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/paket-maika-30324053-526-pakety-maika-sinie-8060-sm-30-sht-polietilen-80-sm-30-sht-167252571/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000055",
        "size": "40 шт",
        "price": 3350,
        "image": "/products/image175.jpeg",
        "images": [
          "/products/image175.jpeg",
          "/products/image176.jpeg",
          "/products/image177.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/paket-maika-526-polietilen-80-sm-40-sht-167313148/",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/paket-maika-30324053-526-pakety-maika-sinie-8060-sm-30-sht-polietilen-80-sm-30-sht-167252571/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000035",
    "title": "Пакет для мусора",
    "desc": "Удобные мусорные пакеты объёмом 35 литров идеально подходят для ежедневного использования на кухне, дома или в офисе. Компактный и практичный размер позволяет легко размещать их в стандартных ведрах. Пакеты изготовлены из прочного полиэтилена, устойчивы к разрывам и протеканию, обеспечивая чистоту и удобство при утилизации отходов.",
    "price": 2450,
    "unit": "шт",
    "category": "🧳 Сумки, баулы и пакеты",
    "visual": "bag",
    "color": "#457b9d",
    "image": "/products/image100.jpeg",
    "images": [
      "/products/image100.jpeg",
      "/products/image101.jpeg",
      "/products/image167.jpeg",
      "/products/image168.jpeg",
      "/products/image169.jpeg",
      "/products/image170.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [
      {
        "id": "PKS000035",
        "size": "35 л",
        "price": 2450,
        "image": "/products/image100.jpeg",
        "images": [
          "/products/image100.jpeg",
          "/products/image101.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/30324053-74-paketmusornyi35l-35-l-166375318/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000054",
        "size": "60 л",
        "price": 3150,
        "image": "/products/image167.jpeg",
        "images": [
          "/products/image167.jpeg",
          "/products/image168.jpeg",
          "/products/image169.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/30324053-74-paketdljamusora60-60-l-166375268/?m=30324053&ms=true",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/30324053-74-paketmusornyi35l-35-l-166375318/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000036",
    "title": "Одноразовые шапочки",
    "desc": "Одноразовые шапочки предназначены для поддержания гигиены и аккуратности в медицинских учреждениях, салонах красоты, пищевом производстве, клининге и бытовом использовании. Лёгкий и дышащий материал обеспечивает комфорт даже при длительном ношении, а мягкая эластичная резинка надёжно фиксирует шапочку на голове, не создавая дискомфорта. Подходят для защиты волос и соблюдения санитарных норм.",
    "price": 4890,
    "unit": "шт",
    "category": "😷 Личная защита",
    "visual": "shield",
    "color": "#e76f51",
    "image": "/products/image103.jpeg",
    "images": [
      "/products/image103.jpeg",
      "/products/image98.jpeg",
      "/products/image99.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/shapochka-belyi-166830214/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000037",
    "title": "Бахилы от грязи и влаги 10 шт",
    "desc": "Одноразовые бахилы предназначены для поддержания чистоты в помещениях и защиты обуви от загрязнений. Эластичная резинка обеспечивает плотную фиксацию на ноге, а универсальный размер подходит для большинства видов обуви. Отлично подходят для дома, медицинских учреждений, салонов, офисов и производственных помещений.",
    "price": 3990,
    "unit": "шт",
    "category": "🧤 Перчатки и защита рук",
    "visual": "soft",
    "color": "#2a9d8f",
    "image": "/products/image102.jpeg",
    "images": [
      "/products/image102.jpeg",
      "/products/image104.jpeg",
      "/products/image106.jpeg",
      "/products/image107.jpeg",
      "/products/image108.jpeg"
    ],
    "tasks": {
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/bahily-ot-grjazi-i-vlagi-71-10-sht-166742271/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000038",
    "title": "Шпагатпропиллен 130 м",
    "desc": "Полипропиленовый шпагат — прочный и практичный материал для упаковки, хозяйственных работ, сада и бытового использования. Благодаря высокой устойчивости к разрывам и растяжению шпагат отлично подходит для фиксации, перевязки, подвязки растений и упаковки различных предметов. Лёгкий, удобный и долговечный, он станет незаменимым помощником дома, на даче и в мастерской.",
    "price": 1990,
    "unit": "шт",
    "category": "🔗 Фиксация и упаковочные аксессуары",
    "visual": "fix",
    "color": "#606c38",
    "image": "/products/image105.jpeg",
    "images": [
      "/products/image105.jpeg",
      "/products/image110.jpeg"
    ],
    "tasks": {},
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/shpagat-30324053-76-shpagatpropillen-130-m-polipropilen-166651350/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000039",
    "title": "Шпагат джут 90 м",
    "desc": "Прочный джутовый шпагат — универсальный помощник для дома, сада, упаковки и творчества. Натуральный материал отличается высокой износостойкостью и удобством в использовании. Подходит для декора, рукоделия, подвязки растений, упаковки подарков и хозяйственных задач. Шпагат легко завязывается, не скользит и сохраняет прочность даже при длительном использовании.",
    "price": 1990,
    "unit": "шт",
    "category": "🔗 Фиксация и упаковочные аксессуары",
    "visual": "fix",
    "color": "#606c38",
    "image": "/products/image109.jpeg",
    "images": [
      "/products/image109.jpeg",
      "/products/image111.jpeg",
      "/products/image112.jpeg",
      "/products/image114.jpeg",
      "/products/image115.jpeg"
    ],
    "tasks": {},
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/shpagat-30324053-65-shpagatdzhut-90-m-dzhut-166651139/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000040",
    "title": "Малярная лента 40 мм х 40 м",
    "desc": "Профессиональная малярная лента для внутренних работ и точного декора. Обеспечивает чистую линию окрашивания, легко удаляется без следов в течение 100 дней и совместима с красками на водной основе и растворителями.",
    "price": 1890,
    "unit": "шт",
    "category": "📎 Скотч и клейкие ленты",
    "visual": "roll",
    "color": "#ffb703",
    "image": "/products/image113.jpeg",
    "images": [
      "/products/image113.jpeg",
      "/products/image116.jpeg"
    ],
    "tasks": {
      "move": 1,
      "storage": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/maljarnaja-lenta-40-mm-h-40-m-oranzhevaja-1sht-151844094/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000041",
    "title": "Армированная клейкая лента 45 мм х 10 м",
    "desc": "Армированная клейкая лента на тканевой основе с каучуковым клеем. Обеспечивает прочное сцепление и устойчивость к влаге, холоду и высоким температурам.",
    "price": 3990,
    "unit": "шт",
    "category": "📎 Скотч и клейкие ленты",
    "visual": "roll",
    "color": "#ffb703",
    "image": "",
    "images": [],
    "tasks": {
      "move": 1,
      "warehouse": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/armirovannaja-kleikaja-lenta-45-mm-h-10-m-1-sht-147788157/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000042",
    "title": "Стрейч-пленка",
    "desc": "Прочная черная стрейч-пленка для надежной упаковки, фиксации и защиты товаров при хранении, перевозке и переезде. Плотно облегает поверхность, отлично тянется и защищает от пыли, влаги и повреждений.",
    "price": 6750,
    "unit": "шт",
    "category": "📎 Скотч и клейкие ленты",
    "visual": "roll",
    "color": "#ffb703",
    "image": "/products/image117.jpeg",
    "images": [
      "/products/image117.jpeg",
      "/products/image118.jpeg",
      "/products/image119.jpeg",
      "/products/image120.jpeg",
      "/products/image139.jpeg",
      "/products/image140.png",
      "/products/image141.jpeg"
    ],
    "tasks": {
      "move": 1,
      "repair": 1,
      "cleaning": 1
    },
    "sizes": [
      {
        "id": "PKS000042",
        "size": "Стандарт (полиэтилен)",
        "price": 6750,
        "image": "/products/image117.jpeg",
        "images": [
          "/products/image117.jpeg",
          "/products/image118.jpeg",
          "/products/image119.jpeg",
          "/products/image120.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/streich-plenka-chernyi-polietilen-23000-sm-1-sht-166034864/",
        "halykLink": "",
        "forteLink": ""
      },
      {
        "id": "PKS000048",
        "size": "190 м",
        "price": 4590,
        "image": "/products/image139.jpeg",
        "images": [
          "/products/image139.jpeg",
          "/products/image140.png",
          "/products/image141.jpeg"
        ],
        "kaspiLink": "https://kaspi.kz/shop/p/streich-plenka-190-m-165617345/",
        "halykLink": "",
        "forteLink": ""
      }
    ],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/streich-plenka-chernyi-polietilen-23000-sm-1-sht-166034864/",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000043",
    "title": "Сумка баул клетчатая 180 л",
    "desc": "Большая хозяйственная сумка-баул из прочного материала Oxford 600D объемом 180 литров. Подходит для хранения и перевозки вещей, одежды, одеял, товаров и других предметов. Усиленные ручки и прочная молния обеспечивают надежность и долговечность.",
    "price": 3390,
    "unit": "шт",
    "category": "🧳 Сумки, баулы и пакеты",
    "visual": "bag",
    "color": "#457b9d",
    "image": "/products/image121.jpeg",
    "images": [
      "/products/image121.jpeg",
      "/products/image122.jpeg",
      "/products/image123.png",
      "/products/image124.jpeg",
      "/products/image125.jpeg",
      "/products/image126.jpeg",
      "/products/image127.jpeg",
      "/products/image128.jpeg",
      "/products/image129.jpeg"
    ],
    "tasks": {},
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/841592-mul-tikolor-180-l-160903945/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000044",
    "title": "Ящик универсальный",
    "desc": "Пластиковый ящик для хранения и транспортировки продуктов и бытовых предметов. Подходит для дома, гаража, дачи и автомобиля. Удобен для штабелирования.Усиленное дно для надёжного хранения7",
    "price": 8790,
    "unit": "шт",
    "category": "🧹 Бытовые расходники",
    "visual": "cloth",
    "color": "#e9c46a",
    "image": "",
    "images": [],
    "tasks": {
      "move": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/jaschik-plastikovyi-jaschik-43x34x27-sm-plastik-152986949/",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000045",
    "title": "Корзина складная красно чёрная",
    "desc": "Удобная складная корзина для хранения и перевозки различных предметов — от продуктов питания до инструментов. Лёгкая, прочная и компактная конструкция обеспечивает комфортное использование в быту, гараже или автомобиле.",
    "price": 4990,
    "unit": "шт",
    "category": "🧹 Бытовые расходники",
    "visual": "cloth",
    "color": "#e9c46a",
    "image": "/products/image130.jpeg",
    "images": [
      "/products/image130.jpeg",
      "/products/image131.jpeg"
    ],
    "tasks": {
      "move": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/korzina-skladnaja-krasno-chjornaja-36l-46x33x24-sm-plastik-149216443/",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000046",
    "title": "Губка универсальные губки 6 шт",
    "desc": "Набор губок для мытья посуды из 6 штук с усиленным абразивным слоем. Эффективно удаляют загрязнения, не повреждая поверхности, подходят для кухни и ванной.",
    "price": 1990,
    "unit": "шт",
    "category": "🧹 Бытовые расходники",
    "visual": "cloth",
    "color": "#e9c46a",
    "image": "/products/image132.jpeg",
    "images": [
      "/products/image132.jpeg",
      "/products/image133.jpeg",
      "/products/image134.jpeg",
      "/products/image135.jpeg"
    ],
    "tasks": {
      "cleaning": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/gubka-universal-nye-gubki-6-sht-porolon-abraziv-161770063/",
    "halykLink": "",
    "forteLink": ""
  },
  {
    "id": "PKS000047",
    "title": "Губки для мытья посуды",
    "desc": "Набор губок для бережного и эффективного мытья посуды. Подходит для тефлоновых и керамических покрытий, хорошо удаляет загрязнения и не царапает поверхность.",
    "price": 1990,
    "unit": "шт",
    "category": "🧹 Бытовые расходники",
    "visual": "cloth",
    "color": "#e9c46a",
    "image": "/products/image136.jpeg",
    "images": [
      "/products/image136.jpeg",
      "/products/image137.jpeg",
      "/products/image138.jpeg"
    ],
    "tasks": {
      "cleaning": 1
    },
    "sizes": [],
    "specs": {},
    "kaspiLink": "https://kaspi.kz/shop/p/gubka-gubki-dlja-myt-ja-posudy-dlja-teflona-i-keramiki-4-sht-porolon-abraziv-160506234/?m=30324053&ms=true",
    "halykLink": "",
    "forteLink": ""
  }
];

export const defaultTasks = [
  {
    id: "move",
    title: "Переезд",
    desc: "Всё для безопасной упаковки вещей",
    icon: "truck",
    image: "/task_icon_0.png"
  },
  {
    id: "repair",
    title: "Подготовка к ремонту",
    desc: "Защитные материалы и расходники",
    icon: "paint-roller",
    image: "/task_icon_1.png"
  },
  {
    id: "marketplaces",
    title: "Упаковка товаров для маркетплейсов",
    desc: "Пакеты, плёнка, скотч и зипы",
    icon: "scan-barcode",
    image: "/task_icon_2.png"
  },
  {
    id: "storage",
    title: "Сохранность вещей/мебели",
    desc: "Для хранения вещей и сезонных товаров",
    icon: "sofa",
    image: "/task_icon_3.png"
  },
  {
    id: "cleaning",
    title: "Уборка после ремонта",
    desc: "Мешки, перчатки и химия",
    icon: "brush-cleaning",
    image: "/task_icon_4.png"
  },
  {
    id: "warehouse",
    title: "Для склада",
    desc: "Паллетная стрейч-плёнка, скотч и аксессуары",
    icon: "shelving-unit",
    image: "/task_icon_5.png"
  },
];

export const tasks = reactive([]);


const defaultCategories = [
  "📦 Картонные изделия",
  "🧤 Перчатки и защита рук",
  "📦 Ящики и ёмкости",
  "🫧 Плёнки и укрывные материалы",
  "📎 Скотч и клейкие ленты",
  "✂️ Инструменты и расходники",
  "😷 Личная защита",
  "🧹 Бытовые расходники",
  "🧳 Сумки, баулы и пакеты",
  "🔗 Фиксация и упаковочные аксессуары"
].map((name, sortOrder) => ({ name, icon: '', sortOrder }));




export const products = reactive([]);
export const categories = reactive([]);
export const banners = reactive([]);
export const siteSettings = reactive({ installmentEnabled: true });


export const isFallbackMode = ref(false);
export const databaseReady = ref(false);
export const databaseError = ref('');
export const catalogLoading = ref(false);
let catalogLoadSequence = 0;
export const settingVersions = reactive({});

export function acceptCatalog(data) {
  if (!['products','categories','tasks','banners'].every(key => Array.isArray(data[key])) || !data.siteSettings || !data.settingVersions) throw new Error('Неполный ответ каталога');
  for (const [items, key] of [[products,'products'],[categories,'categories'],[tasks,'tasks'],[banners,'banners']]) {
    items.splice(0, items.length, ...JSON.parse(JSON.stringify(data[key])));
    items.sort((a,b) => (Number(a.sortOrder)||0) - (Number(b.sortOrder)||0));
  }
  Object.assign(siteSettings, data.siteSettings);
  Object.assign(settingVersions, data.settingVersions);
  isFallbackMode.value = false;
  databaseReady.value = true;
  databaseError.value = '';
}

export const loadDatabase = async ({ allowFallback = false } = {}) => {
  const sequence = ++catalogLoadSequence;
  catalogLoading.value = true;
  try {
    const catalog = await requestApi('/api/data');
    if (sequence !== catalogLoadSequence) return false;
    acceptCatalog(catalog);
    return true;
  } catch (error) {
    if (sequence !== catalogLoadSequence) return false;
    databaseReady.value = false;
    databaseError.value = 'Не удалось загрузить каталог: ' + error.message;
    if (allowFallback) {
      products.splice(0, products.length, ...defaultProducts);
      categories.splice(0, categories.length, ...defaultCategories);
      tasks.splice(0, tasks.length, ...defaultTasks);
      isFallbackMode.value = true;
    } else throw error;
    return false;
  } finally { if (sequence === catalogLoadSequence) catalogLoading.value = false; }
};

// Public storefront may show its existing fallback; admin writes require a fresh server catalog.
loadDatabase({ allowFallback: true });

export function applyContentResult(result) {
  if (result.snapshot) { acceptCatalog(result.snapshot); return; }
  for (const change of result.changes) {
    if (change.entity === 'settings') {
      siteSettings[change.id] = change.data.value;
      settingVersions[change.id] = change.data.version;
      continue;
    }
    const items = { products, categories, tasks, banners }[change.entity];
    const index = items.findIndex(item => item.id === change.id);
    if (!change.data) { if (index !== -1) items.splice(index,1); }
    else if (index === -1) items.push(change.data);
    else if (items[index].version <= change.data.version) Object.assign(items[index], change.data);
    items.sort((a,b) => (Number(a.sortOrder)||0) - (Number(b.sortOrder)||0));
  }
}

export async function saveOperations(operations) {
  if (!databaseReady.value || catalogLoading.value || isFallbackMode.value) throw new Error('Загрузите актуальный каталог перед сохранением.');
  const result = await saveContentOperations(operations);
  applyContentResult(result);
  return result;
}

export async function checkPendingSave() {
  const result = await resolvePendingContentSave();
  if (result) acceptCatalog(result.snapshot);
  return result;
}

export const currentLang = ref(localStorage.getItem('packerra_lang') || 'ru');

export const setLang = (lang) => {
  currentLang.value = lang;
  localStorage.setItem('packerra_lang', lang);
};

export const translations = {
  ru: {
    dailyWork: "ежедневно 9:00 - 21:00",
    cart: "Корзина",
    heroTitleText: "Всё для переезда, ремонта и упаковки",
    heroTitleSpan: "в одном месте",
    heroLead: "Упаковочные материалы для переезда, ремонта, хранения и бизнеса.",
    taskTitle: "Какая у вас задача?",
    selectTask: "Выберите вашу задачу",
    recommendations: "Рекомендации",
    recommendationsSub: "Специально подобранная упаковка под ваши требования",
    taskSub: "Выберите тип задачи, и мы покажем список необходимых материалов с рекомендациями по упаковке.",
    kitTitle: "Рекомендуемый комплект",
    kitPromo: "Вместе дешевле!",
    kitBuy: "Купить комплект",
    need: "Необходимое",
    often: "Часто берут",
    other: "Остальное",
    buy: "Купить",
    perUnit: "за",
    sizeLabel: "Размер:",
    more: "Ещё",
    hide: "Скрыть",
    catalogTitle: "Каталог товаров",
    allCategories: "Все категории",
    cartTitle: "Корзина",
    cartEmpty: "Ваша корзина пуста",
    cartEmptyHint: "Добавьте товары из каталога, чтобы оформить заказ.",
    backToShop: "Вернуться в каталог",
    checkoutWhatsApp: "Оформить заказ в WhatsApp",
    installment: "Рассрочка",
    delete: "Удалить",
    total: "Итого",
    freeShippingLeft: "До бесплатной доставки осталось",
    freeShippingSuccess: "🎉 Поздравляем! Доставка по Алматы за наш счет!",
    checkoutBtn: "Оформить заказ",
    waOrderHello: "Здравствуйте! Хочу оформить заказ:",
    waOrderTotal: "Итого",
    installmentTitle: "Рассрочка на покупку",
    quantity: "Количество:",
    totalSum: "Общая сумма:",
    selectBank: "Выберите банк:",
    installmentTerm: "Срок рассрочки:",
    monthlyPayment: "Ежемесячный платеж:",
    noInterests: "Без процентов и переплат",
    buyOn: "Купить на",
    close: "Закрыть",
    contacts: "Контакты",
    addressLabel: "Адрес склада:",
    addressVal: "г. Алматы, ул. Кабдолова 1/8",
    phoneLabel: "Телефон:",
    hoursLabel: "Режим работы:",
    hoursVal: "Пн-Вс 9:00 - 21:00",
    footerText: "Packerra.kz — Качественные упаковочные материалы напрямую от производителя в Алматы.",
    allRightsReserved: "Все права защищены.",
    toastAdded: "добавлен в корзину!",
    toastKitAdded: "Весь набор успешно добавлен в корзину!",
    toastRemoved: "Товар удален из корзины",
    toastDefaultItem: "Товар",
    footerDesc: "Профессиональные упаковочные материалы для любых целей в Алматы. Качество, прочность и мгновенная доставка.",
    writeWhatsApp: "Написать в WhatsApp",
    footerDaily: "Ежедневно: 9:00 - 21:00",
    footerAddress: "Алматы, Алатауский район",
    footerRights: "© 2026 Packerra.kz. Все права защищены.",
    ariaCall: "Позвонить",
    ariaWriteWhatsApp: "Написать в WhatsApp",
    ariaCart: "Корзина"
  },
  kk: {
    dailyWork: "күнделікті 9:00 - 21:00",
    cart: "Себет",
    heroTitleText: "Көшуге, жөндеуге және қаптауға арналған барлық заттар",
    heroTitleSpan: "бір жерде",
    heroLead: "Көшу, жөндеу, сақтау және бизнеске арналған қаптама материалдары.",
    taskTitle: "Сіздің қандай міндетіңіз бар?",
    selectTask: "Тапсырмаңызды таңдаңыз",
    recommendations: "Ұсыныстар",
    recommendationsSub: "Сіздің талаптарыңызға арнайы таңдалған қаптама",
    taskSub: "Міндет түрін таңдаңыз, сонда біз қаптама бойынша ұсыныстары бар қажетті материалдар тізімін көрсетеміз.",
    kitTitle: "Ұсынылатын жинақ",
    kitPromo: "Бірге арзанырақ!",
    kitBuy: "Жинақты сатып алу",
    need: "Қажетті",
    often: "Жиі алынатын",
    other: "Басқалары",
    buy: "Сатып алу",
    perUnit: "үшін",
    sizeLabel: "Өлшемі:",
    more: "Тағы",
    hide: "Жасыру",
    catalogTitle: "Тауарлар каталогы",
    allCategories: "Барлық санаттар",
    cartTitle: "Себет",
    cartEmpty: "Себетіңіз бос",
    cartEmptyHint: "Тапсырыс беру үшін каталогтан тауарларды қосыңыз.",
    backToShop: "Каталогқа оралу",
    checkoutWhatsApp: "WhatsApp арқылы тапсырыс беру",
    installment: "Бөліп төлеу",
    delete: "Өшіру",
    total: "Жиынтығы",
    freeShippingLeft: "Тегін жеткізуге дейін қалды",
    freeShippingSuccess: "🎉 Құттықтаймыз! Алматы бойынша жеткізу тегін!",
    checkoutBtn: "Тапсырысты рәсімдеу",
    waOrderHello: "Сәлеметсіз бе! Тапсырыс бергім келеді:",
    waOrderTotal: "Жиынтығы",
    installmentTitle: "Сатып алуға бөліп төлеу",
    quantity: "Саны:",
    totalSum: "Жалпы сомасы:",
    selectBank: "Банкті таңдаңыз:",
    installmentTerm: "Бөліп төлеу мерзімі:",
    monthlyPayment: "Ай сайынғы төлем:",
    noInterests: "Пайызсыз және артық төлемсіз",
    buyOn: "Сатып алу:",
    close: "Жабу",
    contacts: "Байланыс",
    addressLabel: "Қойма мекенжайы:",
    addressVal: "Алматы қ., Қабдолов көшесі 1/8",
    phoneLabel: "Телефон:",
    hoursLabel: "Жұмыс режимі:",
    hoursVal: "Дс-Жс 9:00 - 21:00",
    footerText: "Packerra.kz — Алматыдағы өндірушіден тікелей сапалы қаптама материалдары.",
    allRightsReserved: "Барлық құқықтар қорғалған.",
    toastAdded: "себетке қосылды!",
    toastKitAdded: "Барлық жинақ себетке сәтті қосылды!",
    toastRemoved: "Тауар себетten өшірілді",
    toastDefaultItem: "Тауар",
    footerDesc: "Алматыдағы кез келген мақсатқа арналған кәсіби қаптама материалдары. Сапа, беріктік және жылдам жеткізу.",
    writeWhatsApp: "WhatsApp-қа жазу",
    footerDaily: "Күнделікті: 9:00 - 21:00",
    footerAddress: "Алматы, Алатау ауданы",
    footerRights: "© 2026 Packerra.kz. Барлық құқықтар қорғалған.",
    ariaCall: "Қоңырау шалу",
    ariaWriteWhatsApp: "WhatsApp-қа жазу",
    ariaCart: "Себет"
  }
};

export const t = (key) => {
  return translations[currentLang.value]?.[key] || key;
};

export const translateCategory = (catName) => {
  if (currentLang.value === 'kk') {
    if (catName.includes('Картонные')) return '📦 Картон бұйымдары';
    if (catName.includes('Плёнки')) return '🫧 Үлдірлер және жабын материалдары';
    if (catName.includes('Скотч')) return '📎 Скотч және жабысқақ ленталар';
    if (catName.includes('Сумки')) return '🧳 Сөмкелер, баулдар және пакеттер';
    if (catName.includes('Перчатки')) return '🧤 Қолғаптар және қолды қорғау';
    if (catName.includes('Личная')) return '😷 Жеке қорғаныс';
    if (catName.includes('Инструменты')) return '✂️ Құралдар мен шығын материалдары';
    if (catName.includes('Фиксация')) return '🔗 Бекіту және қаптама аксессуарлары';
    if (catName.includes('Бытовые')) return '🧹 Тұрмыстық шығын материалдары';
    if (catName.includes('Салфетки')) return '🧽 Майлықтар';
    if (catName.includes('Ящики')) return '📦 Жәшіктер мен сыйымдылықтар';
  }
  return catName;
};

export const translateTask = (task) => {
  if (!task) return task;
  if (currentLang.value === 'kk') {

    const titleKk = task.titleKk || task.title_kk;
    const descKk = task.descKk || task.desc_kk;
    if (titleKk) {
      return { ...task, title: titleKk, desc: descKk || task.desc };
    }
    if (task.id === 'move') return { ...task, title: 'Көшу', desc: 'Заттарды қауіпсіз қаптауға арналған барлық нәрсе' };
    if (task.id === 'repair') return { ...task, title: 'Жөндеуге дайындық', desc: 'Қорғаныс материалдары мен шығын материалдары' };
    if (task.id === 'marketplaces') return { ...task, title: 'Маркетплейстерге арналған тауарларды қаптау', desc: 'Пакеттер, үлдір, скотч және зиптер' };
    if (task.id === 'storage') return { ...task, title: 'Заттардың/жиһаздың сақталуы', desc: 'Заттарды және маусымдық тауарларды сақтауға арналған' };
    if (task.id === 'cleaning') return { ...task, title: 'Жөндеуден кейінгі тазалау', desc: 'Қаптар, қолғаптар және химия' };
    if (task.id === 'warehouse') return { ...task, title: 'Қойма үшін', desc: 'Паллеттік стрейч-үлдір, скотч және аксессуарлар' };
  }
  return task;
};

