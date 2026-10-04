<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import AdminUsers from './AdminUsers.vue';
import AdminHistory from './AdminHistory.vue';
import draggable from 'vuedraggable';
import { products, categories, tasks, banners, saveOperations, loadDatabase, databaseReady, databaseError, catalogLoading, checkPendingSave, icons, siteSettings, settingVersions } from '../data.js';
import 'emoji-picker-element';
import { currentUser, authNotice, requestApi, restoreAdmin, loginAdmin, logoutAdmin, changeAdminPassword, makeUpdateOperation, contentBusy, pendingContentSave } from '../adminApi.js';


const emit = defineEmits(['close']);

// Session Auth State
const isLoggedIn = computed(() => Boolean(currentUser.value));
const authReady = ref(false);
const authBusy = ref(false);
const isPasswordChangeOpen = ref(false);
const currentPassword = ref('');
const newPassword = ref('');
const passwordError = ref('');
const isProductSaving = ref(false);
const isTaskSaving = ref(false);
const username = ref('');
const password = ref('');
const clone = value => JSON.parse(JSON.stringify(value));
const saveNotice = ref('');
const saveIssue = ref(null);
const productBaseline = ref(null);
const taskBaseline = ref(null);
const categoryBaseline = ref(null);
const productInitialState = ref('');
const taskInitialState = ref('');
const importDraft = ref(null);
const importFileInput = ref(null);
const uploadBusy = ref(0);
const catalogBlocked = computed(() => !databaseReady.value || catalogLoading.value || uploadBusy.value > 0 || contentBusy.value || Boolean(pendingContentSave.value));
const loginError = ref('');

// Navigation Tabs
const activeTab = ref('products'); // 'products', 'categories', 'tasks', 'sorting', 'settings'

// Search & Filter
const searchQuery = ref('');
const filterCategory = ref('');
const filterTask = ref('');
const isVisualSortMode = ref(false);
const sortMode = ref(null);

// Product Modal State
const isProductModalOpen = ref(false);
const editingProduct = ref(null);

// Product Form Fields
const prodId = ref('');
const prodTitle = ref('');
const prodDesc = ref('');
const prodPrice = ref(0);
const prodUnit = ref('шт');
const prodCategory = ref('');
const prodVisual = ref('box');
const prodColor = ref('#d7a15a');
const prodImagesList = ref([]); // Array of additional gallery images
const newGalleryImageUrl = ref('');
const prodImageUrl = computed({
  get() {
    return prodImagesList.value.length > 0 ? prodImagesList.value[0] : '';
  },
  set(val) {
    if (prodImagesList.value.length > 0) {
      prodImagesList.value[0] = val;
    } else if (val) {
      prodImagesList.value.push(val);
    }
  }
});
const prodKaspiLink = ref('');
const prodHalykLink = ref('');
const prodForteLink = ref('');
const prodSpecsList = ref([]); // Array of { key: '', value: '' }
const prodSizesList = ref([]); // Array of size variations
const prodTasksMap = ref({}); // Map of taskId -> level (0 for none, 1/2/3 for level)
const prodSortOrder = ref(0);
const prodIsVisible = ref(true);

// Category Form Fields
const newCategoryName = ref('');
const newCategoryIcon = ref('');
const editingCategoryIndex = ref(-1);
const editingCategoryName = ref('');
const editingCategoryIcon = ref('');

const triggerCatIconUpload = (isEdit = false) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => handleCatIconSelected(e, isEdit);
  input.click();
};

const handleCatIconSelected = (event, isEdit) => {
  const file = event.target.files[0];
  if (!file) return;

  (async () => {
    try {
      const url = await prepareImageUpload(file);
      if (isEdit) editingCategoryIcon.value = url;
      else newCategoryIcon.value = url;
    } catch (err) {
      console.error('Error uploading category icon:', err);
      alert('Ошибка загрузки иконки.');
    }
  })();
};

// Task Form Fields
const isTaskModalOpen = ref(false);
const editingTask = ref(null);
const taskId = ref('');
const taskTitle = ref('');
const taskDesc = ref('');
const taskTitleKk = ref('');
const taskDescKk = ref('');
const taskIcon = ref('box');
const taskImage = ref('');
const taskSortOrder = ref(0);




onMounted(async () => {
  window.addEventListener('beforeunload', guardUnload);
  try { await restoreAdmin(); await loadDatabase(); } catch (error) { loginError.value = error.message; }
  finally { authReady.value = true; }
});

const handleLogin = async () => {
  if (authBusy.value) return;
  authBusy.value = true;
  loginError.value = '';
  try {
    await loginAdmin(username.value, password.value);
    await loadDatabase();
    username.value = '';
    password.value = '';
  } catch (error) { loginError.value = error.message; }
  finally { authBusy.value = false; }
};

const handleLogout = async () => {
  if (authBusy.value || userManagementBusy.value) return;
  authBusy.value = true;
  try { await logoutAdmin(); }
  catch (error) { alert('Не удалось выйти: ' + error.message); }
  finally { authBusy.value = false; }
};

const handleChangePassword = async () => {
  if (authBusy.value) return;
  authBusy.value = true;
  passwordError.value = '';
  try {
    await changeAdminPassword(currentPassword.value, newPassword.value);
    currentPassword.value = '';
    newPassword.value = '';
    isPasswordChangeOpen.value = false;
  } catch (error) { passwordError.value = error.message; }
  finally { authBusy.value = false; }
};

// Summary metrics
const totalProducts = computed(() => products.length);
const totalCategories = computed(() => categories.length);
const averageProductPrice = computed(() => {
  if (products.length === 0) return 0;
  const sum = products.reduce((acc, p) => acc + p.price, 0);
  return Math.round(sum / products.length);
});

const productsByCategoryCount = computed(() => {
  const counts = {};
  categories.forEach(cat => {
    counts[cat] = products.filter(p => p.category === cat).length;
  });
  return counts;
});

// Banners State
const triggerBannerUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = handleBannerSelected;
  input.click();
};

const handleBannerSelected = async (event) => {
  const file = event.target.files[0];
  if (!file || catalogBlocked.value) return;
  try {
    const url = await prepareImageUpload(file);
    await runAction([{entity:'banners',action:'create',data:{id:crypto.randomUUID(),image:url,isActive:true,sortOrder:banners.length}}]);
  } catch (error) { reportSaveError(error); }
};
const removeBanner = index => {
  if (confirm('Удалить баннер?')) return runAction([deleteOperation('banners',banners[index])]);
};
const toggleBanner = banner => runAction([makeUpdateOperation('banners',banner,{isActive:!banner.isActive})]);
const moveBannerUp = index => moveOrdered('banners',banners,index,-1);
const moveBannerDown = index => moveOrdered('banners',banners,index,1);
const toggleInstallment = () => runAction([{entity:'settings',action:'update',id:'installmentEnabled',version:settingVersions.installmentEnabled,changes:{value:!siteSettings.installmentEnabled}}]);

// Filtered products list
const filteredProducts = computed(() => {
  return products.filter(p => {
    const pTitle = p.title || '';
    const pDesc = p.desc || '';
    const pId = p.id || '';
    
    const query = searchQuery.value.toLowerCase();
    const matchesSearch = pTitle.toLowerCase().includes(query) || 
                          pDesc.toLowerCase().includes(query) ||
                          pId.toLowerCase().includes(query);
    const matchesCategory = !filterCategory.value || p.category === filterCategory.value;
    const matchesTask = !filterTask.value || (p.tasks && p.tasks[filterTask.value] > 0);
    return matchesSearch && matchesCategory && matchesTask;
  }).sort((a, b) => {
    const order = sortMode.value === 'category'
      ? (Number(a.categorySortOrder ?? a.sortOrder) || 0) - (Number(b.categorySortOrder ?? b.sortOrder) || 0)
      : (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    return order || String(a.id).localeCompare(String(b.id));
  });
});

const filteredProductsDraggable = computed({
  get: () => filteredProducts.value,
  set: val => {
    const items = products.filter(p => p.category === filterCategory.value)
      .sort((a,b) => (Number(a.categorySortOrder ?? a.sortOrder)||0) - (Number(b.categorySortOrder ?? b.sortOrder)||0) || String(a.id).localeCompare(String(b.id)));
    const visibleIds = new Set(val.map(p => p.id));
    let index = 0;
    const ordered = items.map(p => visibleIds.has(p.id) ? val[index++] : p);
    runAction(ordered.map((p,i) => makeUpdateOperation('products',p,{categorySortOrder:i})));
  }
});

// Stage both setters of a cross-zone drag and commit once at drag end.
const taskZoneDraft = ref(null);
const taskZone = level => computed({
  get: () => taskZoneDraft.value?.[level] ?? filteredProducts.value.filter(p => p.tasks?.[filterTask.value] === level),
  set: value => {
    if (!taskZoneDraft.value) taskZoneDraft.value = Object.fromEntries([1,2,3].map(i => [i,filteredProducts.value.filter(p => p.tasks?.[filterTask.value] === i)]));
    taskZoneDraft.value[level] = value;
  }
});
const taskLevel1Products = taskZone(1);
const taskLevel2Products = taskZone(2);
const taskLevel3Products = taskZone(3);
const saveTaskZones = async () => {
  const zones = taskZoneDraft.value;
  if (!zones) return;
  const operations = [];
  for (const level of [1,2,3]) zones[level].forEach((p,index) => operations.push(makeUpdateOperation('products',p,{tasks:{...p.tasks,[filterTask.value]:level},sortOrder:index})));
  taskZoneDraft.value = null;
  await runAction(operations);
};
const orderedTasks = computed({get:()=>tasks,set:value=>saveOrdered('tasks',value)});
const orderedCategories = computed({get:()=>categories,set:value=>saveOrdered('categories',value)});

// Interactive Task & Category Sorting Helpers
const currentTask = computed(() => {
  return tasks.find(t => t.id === filterTask.value) || null;
});

const selectSortMode = (mode) => {
  sortMode.value = mode;
  if (mode === 'task') {
    filterCategory.value = '';
    if (!filterTask.value && tasks.length > 0) {
      filterTask.value = tasks[0].id;
    }
  } else if (mode === 'category') {
    filterTask.value = '';
    if (!filterCategory.value && categories.length > 0) {
      filterCategory.value = categories[0].name;
    }
  }
};

const getTaskProductsCount = (taskId) => {
  return products.filter(p => p.tasks && p.tasks[taskId] > 0).length;
};

const getCategoryProductsCount = (catName) => {
  return products.filter(p => p.category === catName).length;
};

const moveTaskLeft = index => moveOrdered('tasks',tasks,index,-1);
const moveTaskRight = index => moveOrdered('tasks',tasks,index,1);
const moveCategoryLeft = index => moveOrdered('categories',categories,index,-1);
const moveCategoryRight = index => moveOrdered('categories',categories,index,1);

const getCatDisplayIcon = (cat) => {
  if (cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('/') || cat.icon.startsWith('data:'))) {
    return `<img src="${cat.icon}" alt="" style="width: 32px; height: 32px; object-fit: contain;" />`;
  }
  if (cat.icon && icons[cat.icon]) {
    return icons[cat.icon];
  }
  const clean = (cat.name || '').toLowerCase();
  if (clean.includes('картон') || clean.includes('коробк')) return icons.box || '📦';
  if (clean.includes('плен') || clean.includes('плён')) return icons.tag || '🫧';
  if (clean.includes('скотч') || clean.includes('лент')) return icons.tag || '📎';
  if (clean.includes('сумк') || clean.includes('пакет')) return icons.cart || '🧳';
  if (clean.includes('перчат') || clean.includes('рукав')) return icons.shield || '🧤';
  if (clean.includes('инструмент')) return icons.wrench || '✂️';
  if (clean.includes('склад')) return icons.warehouse || '🏬';
  if (clean.includes('уборк') || clean.includes('чистк')) return icons['brush-cleaning'] || '🧹';
  return icons.box || '📦';
};

const moveProductInZone = (prod, direction, level) => {
  let list;
  if (level === 1) list = [...taskLevel1Products.value];
  else if (level === 2) list = [...taskLevel2Products.value];
  else if (level === 3) list = [...taskLevel3Products.value];
  if (!list) return;

  const idx = list.findIndex(p => p.id === prod.id);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= list.length) return;

  const item = list.splice(idx, 1)[0];
  list.splice(newIdx, 0, item);

  if (level === 1) taskLevel1Products.value = list;
  else if (level === 2) taskLevel2Products.value = list;
  else if (level === 3) taskLevel3Products.value = list;
  saveTaskZones();
};

const moveProductInCategory = (prod, direction) => {
  const list = [...filteredProductsDraggable.value];
  const idx = list.findIndex(p => p.id === prod.id);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= list.length) return;

  const item = list.splice(idx, 1)[0];
  list.splice(newIdx, 0, item);
  filteredProductsDraggable.value = list;
};

// Category operations
const handleAddCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) return;
  if (await runAction([{entity:'categories',action:'create',data:{id:crypto.randomUUID(),name,icon:newCategoryIcon.value,sortOrder:categories.length}}])) {
    newCategoryName.value=''; newCategoryIcon.value='';
  }
};
const startEditCategory = index => {
  if (categoryDirty.value && !confirm('Отменить несохранённые изменения категории?')) return;
  categoryBaseline.value=clone(categories[index]);
  editingCategoryIndex.value=index;
  editingCategoryName.value=categories[index].name;
  editingCategoryIcon.value=categories[index].icon || '';
};
const saveEditCategory = async () => {
  if (!editingCategoryName.value.trim()) return;
  if (await runAction([makeUpdateOperation('categories',categoryBaseline.value,{name:editingCategoryName.value.trim(),icon:editingCategoryIcon.value})],{entity:'categories',draft:{id:categoryBaseline.value.id,name:editingCategoryName.value.trim(),icon:editingCategoryIcon.value}})) editingCategoryIndex.value=-1;
};
const handleDeleteCategory = async cat => {
  const count=products.filter(p=>p.category===cat.name).length;
  if (!confirm(`Удалить категорию «${cat.name}»? У ${count} товаров очистится категория.`)) return;
  if (await runAction([deleteOperation('categories',cat)])) editingCategoryIndex.value=-1;
};

// Task Modal & Operation Helpers
const openTaskModal = (task = null) => {
  if (task) {
    editingTask.value = clone(task);
    taskId.value = task.id;
    taskTitle.value = task.title;
    taskDesc.value = task.desc;
    taskTitleKk.value = task.titleKk || task.title_kk || '';
    taskDescKk.value = task.descKk || task.desc_kk || '';
    taskIcon.value = task.icon || 'box';
    taskImage.value = task.image || '';
    taskSortOrder.value = task.sortOrder || 0;
  } else {
    editingTask.value = null;
    taskId.value = '';
    taskTitle.value = '';
    taskDesc.value = '';
    taskTitleKk.value = '';
    taskDescKk.value = '';
    taskIcon.value = 'box';
    taskImage.value = '';
    taskSortOrder.value = 0;
  }
  isTaskModalOpen.value = true;
  taskBaseline.value=buildTaskDraft();
  taskInitialState.value=JSON.stringify(taskFormState());
  saveIssue.value=null;
};

const buildTaskDraft = () => {
  return {
    id: taskId.value.trim().toLowerCase(),
    title: taskTitle.value.trim(),
    desc: taskDesc.value.trim(),
    titleKk: taskTitleKk.value.trim(),
    descKk: taskDescKk.value.trim(),
    icon: taskIcon.value,
    image: taskImage.value.trim(),
    sortOrder: Number(taskSortOrder.value) || 0
  };

};

const handleSaveTask = async () => {
  if (isTaskSaving.value || catalogBlocked.value) return;
  const idVal = taskId.value.trim().toLowerCase();
  const titleVal = taskTitle.value.trim();
  const descVal = taskDesc.value.trim();

  if (!idVal || !titleVal) {
    alert('Пожалуйста, заполните ID и название задачи!');
    return;
  }

  const taskObj = buildTaskDraft();

  isTaskSaving.value = true;
  try {
    const operation = editingTask.value ? makeUpdateOperation('tasks',editingTask.value,taskObj,taskBaseline.value) : {entity:'tasks',action:'create',data:taskObj};
    if (await runAction([operation],{entity:'tasks',draft:taskObj})) isTaskModalOpen.value = false;
  } finally { isTaskSaving.value = false; }
};
const handleDeleteTask = id => {
  const task=tasks.find(t=>t.id===id);
  if (task && confirm(`Удалить задачу «${task.title}»?`)) return runAction([deleteOperation('tasks',task)]);
};

const onTaskImageFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите файл изображения');
    return;
  }
  try {
    const finalUrl = await prepareImageUpload(file);
    taskImage.value = finalUrl;
  } catch (err) {
    alert('Ошибка при загрузке изображения');
  }
  event.target.value = '';
};

// Product CRUD Modal Helper
const openProductModal = (product = null) => {
  if (product) {
    // Edit Mode
    editingProduct.value = clone(product);
    prodId.value = product.id;
    prodTitle.value = product.title;
    prodDesc.value = product.desc;
    prodPrice.value = product.price;
    prodUnit.value = product.unit !== undefined ? product.unit : 'шт';
    prodCategory.value = product.category || '';
    prodSortOrder.value = product.sortOrder !== undefined ? product.sortOrder : 0;
    prodIsVisible.value = product.isVisible !== false;
    prodVisual.value = product.visual || 'box';
    prodColor.value = product.color || '#d7a15a';
    prodImageUrl.value = product.image || '';
    prodKaspiLink.value = product.kaspiLink || '';
    prodHalykLink.value = product.halykLink || '';
    prodForteLink.value = product.forteLink || '';
    
    // Parse specs object to Array
    prodSpecsList.value = product.specs ? 
      Object.entries(product.specs).map(([key, val]) => ({ key, value: val })) : [];

    // Parse sizes list
    prodSizesList.value = product.sizes ? 
      product.sizes.map(s => ({ 
        _id: s._id || (Date.now() + '-' + Math.random().toString(36).substr(2, 9)),
        size: s.size, 
        price: s.price, 
        image: s.image || '', 
        imagesList: s.images ? s.images.filter(img => img !== s.image) : [],
        kaspiLink: s.kaspiLink || '',
        halykLink: s.halykLink || '',
        forteLink: s.forteLink || '',
        newUrl: '',
        showGallery: false
      })) : [];

    // Parse ALL product images list (unified gallery)
    if (product.images && product.images.length > 0) {
      // Ensure main image is first in the list
      const mainImg = product.image || '';
      const otherImgs = product.images.filter(img => img !== mainImg);
      prodImagesList.value = mainImg ? [mainImg, ...otherImgs] : [...product.images];
    } else if (product.image) {
      prodImagesList.value = [product.image];
    } else {
      prodImagesList.value = [];
    }

    // Parse tasks
    const tMap = {};
    tasks.forEach(t => {
      tMap[t.id] = (product.tasks && product.tasks[t.id]) ? product.tasks[t.id] : 0;
    });
    prodTasksMap.value = tMap;
  } else {
    // Add Mode
    editingProduct.value = null;
    prodId.value = '';
    prodTitle.value = '';
    prodDesc.value = '';
    prodPrice.value = 100;
    prodUnit.value = 'шт';
    prodCategory.value = categories[0]?.name || '';
    prodVisual.value = 'box';
    prodColor.value = '#d7a15a';
    prodImagesList.value = ['https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=350'];
    newGalleryImageUrl.value = '';
    prodKaspiLink.value = '';
    prodHalykLink.value = '';
    prodForteLink.value = '';
    prodSpecsList.value = [
      { key: 'Материал', value: 'Гофрокартон' },
      { key: 'Размер', value: '40 x 30 x 30 см' }
    ];
    prodSizesList.value = [];
    prodSortOrder.value = 0;
    prodIsVisible.value = true;
    
    const tMap = {};
    tasks.forEach(t => {
      tMap[t.id] = 0;
    });
    prodTasksMap.value = tMap;
  }
  isProductModalOpen.value = true;
  productBaseline.value=buildProductDraft();
  productInitialState.value=JSON.stringify(productFormState());
  saveIssue.value=null;
};

// Form Spec list modifications
const addSpecRow = () => {
  prodSpecsList.value.push({ key: '', value: '' });
};

const removeSpecRow = (idx) => {
  prodSpecsList.value.splice(idx, 1);
};

const moveSpecRowUp = (idx) => {
  if (idx > 0) {
    const item = prodSpecsList.value.splice(idx, 1)[0];
    prodSpecsList.value.splice(idx - 1, 0, item);
  }
};

const moveSpecRowDown = (idx) => {
  if (idx < prodSpecsList.value.length - 1) {
    const item = prodSpecsList.value.splice(idx, 1)[0];
    prodSpecsList.value.splice(idx + 1, 0, item);
  }
};

// Form Size list modifications
const addSizeRow = () => {
  prodSizesList.value.push({ 
    _id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    size: '', 
    price: prodPrice.value || 100, 
    image: '', 
    imagesList: [],
    kaspiLink: '',
    halykLink: '',
    forteLink: '',
    newUrl: '',
    showGallery: false
  });
};

const removeSizeRow = (idx) => {
  prodSizesList.value.splice(idx, 1);
};

const moveSizeRowUp = (idx) => {
  if (idx > 0) {
    const item = prodSizesList.value.splice(idx, 1)[0];
    prodSizesList.value.splice(idx - 1, 0, item);
  }
};

const moveSizeRowDown = (idx) => {
  if (idx < prodSizesList.value.length - 1) {
    const item = prodSizesList.value.splice(idx, 1)[0];
    prodSizesList.value.splice(idx + 1, 0, item);
  }
};

// Image Upload Helper
const resizeAndConvertImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type === 'image/svg+xml') {
        resolve(e.target.result);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const outFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outFormat, 0.8);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const prepareImageUpload = async file => {
  uploadBusy.value++;
  try { return await uploadImageToServer(await resizeAndConvertImage(file),file.name); }
  finally { uploadBusy.value--; }
};

const uploadImageToServer = async (base64Data, filename) => {
  const data = await requestApi('/api/upload', {
    method: 'POST', body: { image: base64Data, filename }
  });
  if (typeof data.url !== 'string' || !data.url) throw new Error('Сервер не подтвердил загрузку изображения.');
  return data.url;
};

const onSizeImageFileChange = async (event, target) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите файл изображения');
    return;
  }
  try {
    const finalUrl = await prepareImageUpload(file);
    if (typeof target === 'number') {
      prodSizesList.value[target].image = finalUrl;
    } else if (target && typeof target === 'object') {
      target.image = finalUrl;
    }
  } catch (err) {
    alert('Ошибка при загрузке изображения');
  }
  event.target.value = ''; // reset
};

const onGalleryImageFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите файл изображения');
    return;
  }
  try {
    const finalUrl = await prepareImageUpload(file);
    prodImagesList.value.push(finalUrl);
    // Update main image if this is the first image
    if (prodImagesList.value.length === 1) {
      prodImageUrl.value = finalUrl;
    }
  } catch (err) {
    alert('Ошибка при загрузке изображения');
  }
  event.target.value = ''; // reset
};

const removeGalleryImage = (idx) => {
  prodImagesList.value.splice(idx, 1);
};

const addGalleryImageUrl = () => {
  const url = newGalleryImageUrl.value.trim();
  if (url) {
    prodImagesList.value.push(url);
    newGalleryImageUrl.value = '';
  }
};

const setAsMainImage = (idx) => {
  if (idx < 0 || idx >= prodImagesList.value.length) return;
  const img = prodImagesList.value[idx];
  // Move image to the front
  prodImagesList.value.splice(idx, 1);
  prodImagesList.value.unshift(img);
};

const onSizeGalleryFileChange = async (event, target) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите файл изображения');
    return;
  }
  try {
    const finalUrl = await prepareImageUpload(file);
    if (typeof target === 'number') {
      prodSizesList.value[target].imagesList.push(finalUrl);
    } else if (target && typeof target === 'object') {
      if (!target.imagesList) target.imagesList = [];
      target.imagesList.push(finalUrl);
    }
  } catch (err) {
    alert('Ошибка при загрузке изображения');
  }
  event.target.value = ''; // reset
};

const addSizeGalleryUrl = (target) => {
  const item = typeof target === 'number' ? prodSizesList.value[target] : target;
  if (!item) return;
  const url = (item.newUrl || '').trim();
  if (url) {
    if (!item.imagesList) item.imagesList = [];
    item.imagesList.push(url);
    item.newUrl = '';
  }
};

// Product Saving
const buildProductDraft = () => {
  // Build specs object from list
  const specsObj = {};
  prodSpecsList.value.forEach(item => {
    const k = item.key.trim();
    const v = item.value.trim();
    if (k && v) {
      specsObj[k] = v;
    }
  });

  // Build tasks object
  const tasksObj = {};
  Object.entries(prodTasksMap.value).forEach(([tId, lvl]) => {
    const numLvl = Number(lvl);
    if (numLvl > 0) {
      tasksObj[tId] = numLvl;
    }
  });

  // Build sizes array
  const sizesArr = [];
  prodSizesList.value.forEach(item => {
    const s = item.size.trim();
    const p = Number(item.price);
    if (s && p >= 0) {
      const sizeImages = item.image ? [item.image, ...(item.imagesList || [])] : (item.imagesList || []);
      sizesArr.push({ 
        size: s, 
        price: p, 
        image: item.image || '', 
        images: sizeImages,
        kaspiLink: item.kaspiLink ? item.kaspiLink.trim() : '',
        halykLink: item.halykLink ? item.halykLink.trim() : '',
        forteLink: item.forteLink ? item.forteLink.trim() : ''
      });
    }
  });

  // Build final images list for the product (prodImagesList already contains all images including main)
  const imagesArr = [...prodImagesList.value];

  return {
    id: prodId.value.trim() || (editingProduct.value?.id ?? crypto.randomUUID()),
    title: prodTitle.value.trim(),
    desc: prodDesc.value.trim(),
    price: Number(prodPrice.value),
    unit: prodUnit.value,
    category: prodCategory.value,
    visual: prodVisual.value,
    color: prodColor.value,
    image: prodImagesList.value.length > 0 ? prodImagesList.value[0] : 'https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=350',
    images: imagesArr,
    specs: specsObj,
    sizes: sizesArr,
    tasks: tasksObj,
    sortOrder: Number(prodSortOrder.value) || 0,
    categorySortOrder: editingProduct.value?.categorySortOrder ?? (Number(prodSortOrder.value) || 0),
    isVisible: prodIsVisible.value,
    kaspiLink: prodKaspiLink.value.trim(),
    halykLink: prodHalykLink.value.trim(),
    forteLink: prodForteLink.value.trim()
  };

};
const handleSaveProduct = async () => {
  if (isProductSaving.value || catalogBlocked.value) return;
  if (!prodTitle.value.trim()) { alert('Заполните название товара.'); return; }
  if (prodSizesList.value.some(item => !item.size.trim() || !Number.isFinite(Number(item.price)) || Number(item.price) < 0)) {
    reportSaveError(new Error('Заполните название каждого размера и неотрицательную цену.'),{entity:'products',draft:productFormState()});
    return;
  }
  const draft=buildProductDraft();
  prodId.value=draft.id;
  isProductSaving.value=true;
  try {
    const operation=editingProduct.value ? makeUpdateOperation('products',editingProduct.value,draft,productBaseline.value) : {entity:'products',action:'create',data:draft};
    if (await runAction([operation],{entity:'products',draft})) isProductModalOpen.value=false;
  } finally { isProductSaving.value=false; }
};
const handleDeleteProduct = (id,title) => {
  const product=products.find(p=>p.id===id);
  if (product && confirm(`Удалить товар «${title}»?`)) return runAction([deleteOperation('products',product)]);
};

const productFormState = () => ({
  id:prodId.value,title:prodTitle.value,desc:prodDesc.value,price:prodPrice.value,unit:prodUnit.value,category:prodCategory.value,
  visual:prodVisual.value,color:prodColor.value,images:prodImagesList.value,specs:prodSpecsList.value,
  sizes:prodSizesList.value.map(({_id,newUrl,showGallery,...size})=>size),tasks:prodTasksMap.value,sortOrder:prodSortOrder.value,isVisible:prodIsVisible.value,
  kaspiLink:prodKaspiLink.value,halykLink:prodHalykLink.value,forteLink:prodForteLink.value
});
const taskFormState = () => ({id:taskId.value,title:taskTitle.value,desc:taskDesc.value,titleKk:taskTitleKk.value,descKk:taskDescKk.value,icon:taskIcon.value,image:taskImage.value,sortOrder:taskSortOrder.value});
const productDirty = computed(()=>isProductModalOpen.value && JSON.stringify(productFormState())!==productInitialState.value);
const taskDirty = computed(()=>isTaskModalOpen.value && JSON.stringify(taskFormState())!==taskInitialState.value);
const categoryDirty = computed(()=>editingCategoryIndex.value!==-1 && (editingCategoryName.value!==categoryBaseline.value?.name || editingCategoryIcon.value!==(categoryBaseline.value?.icon||'')));
const userManagement=ref({draft:null,busy:false});
const userDraft=computed(()=>userManagement.value.draft);
const userManagementBusy=computed(()=>userManagement.value.busy);
const hasUnsavedChanges = computed(()=>userDraft.value || productDirty.value || taskDirty.value || categoryDirty.value || newCategoryName.value.trim() || importDraft.value || pendingContentSave.value);
const guardUnload = event => { if(hasUnsavedChanges.value || userManagementBusy.value || contentBusy.value || uploadBusy.value) { event.preventDefault(); event.returnValue=''; } };
onUnmounted(()=>window.removeEventListener('beforeunload',guardUnload));
const closeProductModal = () => {
  if (contentBusy.value || uploadBusy.value || pendingContentSave.value) return;
  if (!productDirty.value || confirm('Отменить несохранённые изменения товара?')) isProductModalOpen.value=false;
};
const closeTaskModal = () => {
  if (contentBusy.value || uploadBusy.value || pendingContentSave.value) return;
  if (!taskDirty.value || confirm('Отменить несохранённые изменения задачи?')) isTaskModalOpen.value=false;
};
const cancelCategoryEdit = () => { if(!categoryDirty.value || confirm('Отменить несохранённые изменения категории?')) editingCategoryIndex.value=-1; };
const closeAdmin = () => {
  if(userManagementBusy.value || contentBusy.value || uploadBusy.value || pendingContentSave.value) return;
  if(!hasUnsavedChanges.value || confirm('Выйти из админки и отменить несохранённые изменения?')) emit('close');
};
const deleteOperation = (entity,item) => ({entity,action:'delete',id:item.id,version:item.version});
const saveOrdered = (entity,items) => runAction(items.map((item,index)=>makeUpdateOperation(entity,item,{sortOrder:index})));
const moveOrdered = (entity,items,index,direction) => {
  if(catalogBlocked.value || index+direction<0 || index+direction>=items.length) return;
  const ordered=[...items];
  const item=ordered.splice(index,1)[0]; ordered.splice(index+direction,0,item);
  return saveOrdered(entity,ordered);
};
const reportSaveError = (error,context={}) => {
  const message=error.status===409 ? 'Объект изменён другим пользователем. Ваши правки не записаны; черновик сохранён.' : error.status===404 ? 'Объект уже удалён. Ваш черновик сохранён, повторная запись не восстановит его.' : error.message;
  saveNotice.value='';
  saveIssue.value={message,status:error.status,code:error.code,entity:context.entity ?? error.data?.entity,current:error.data?.current,draft:clone(context.draft ?? context.operations ?? {}),snapshot:error.data?.snapshot};
};
const runAction = async (operations,context={}) => {
  if(catalogBlocked.value) { reportSaveError(new Error(pendingContentSave.value ? 'Сначала проверьте результат записи.' : 'Дождитесь загрузки каталога или завершения сохранения.'),context); return false; }
  saveNotice.value='';
  try {
    const result=await saveOperations(operations);
    saveIssue.value=null;
    saveNotice.value=result.unchanged ? 'Нет изменений для сохранения.' : result.reconciled ? 'Данные на сервере проверены: изменения сохранены.' : 'Изменения сохранены.';
    return true;
  } catch(error) { reportSaveError(error,{...context,operations}); return false; }
};
const reloadCatalog = async () => {
  if(contentBusy.value || uploadBusy.value || pendingContentSave.value) return;
  try { await loadDatabase(); saveNotice.value='Каталог обновлён. Открытые черновики сохранены.'; }
  catch(error) { reportSaveError(error); }
};
const checkSaveResult = async () => {
  const pending=clone(pendingContentSave.value || []);
  try {
    const result=await checkPendingSave();
    if(!result) return;
    if(result.outcome==='confirmed') {
      saveNotice.value='Данные на сервере проверены: изменения сохранены.';
      saveIssue.value=null;
      if(pending.some(op=>op.entity==='products' && (op.id ?? op.data?.id)===prodId.value)) isProductModalOpen.value=false;
      if(pending.some(op=>op.entity==='tasks' && (op.id ?? op.data?.id)===taskId.value)) isTaskModalOpen.value=false;
      if(importDraft.value) importDraft.value=null;
      if(pending.some(op=>op.entity==='categories' && op.action==='create' && op.data.name===newCategoryName.value.trim())) {newCategoryName.value='';newCategoryIcon.value='';}
    } else {
      saveIssue.value={...saveIssue.value,message:result.outcome==='not-written' ? 'Изменения не записаны. Проверьте черновик и повторите сохранение.' : 'Состояние на сервере отличается от запроса. Обновите форму и вручную перенесите правки.',code:result.outcome==='not-written' ? 'SAVE_NOT_WRITTEN':'SAVE_DIVERGED',snapshot:result.snapshot};
    }
  } catch(error) { reportSaveError(error,{entity:saveIssue.value?.entity,draft:saveIssue.value?.draft}); }
};
const issueCurrent = computed(()=>saveIssue.value?.current ?? saveIssue.value?.snapshot?.[saveIssue.value?.entity]?.find(item=>item.id===saveIssue.value?.draft?.id));
const loadConflictVersion = () => {
  const issue=saveIssue.value;
  const current=issueCurrent.value;
  if(!current || !confirm('Загрузить свежую версию в форму? Старый черновик останется ниже для ручного переноса правок.')) return;
  if(issue.entity==='products') openProductModal(current);
  if(issue.entity==='tasks') openTaskModal(current);
  if(issue.entity==='categories') {
    categoryBaseline.value=clone(current);
    editingCategoryIndex.value=categories.findIndex(item=>item.id===current.id);
    editingCategoryName.value=current.name;
    editingCategoryIcon.value=current.icon || '';
  }
  saveIssue.value={...issue,current,reviewed:true,message:'Свежая версия загружена. Перенесите нужные правки вручную из сохранённого черновика.'};
};
const formatDraft = value => JSON.stringify(value,null,2);
const readImportFile = async event => {
  const file=event.target.files[0]; event.target.value='';
  if(!file || catalogBlocked.value) return;
  try {
    const XLSX=await import('xlsx');
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:''});
    const {prepareProductImport}=await import('../adminImport.js');
    importDraft.value=prepareProductImport(rows,{products,categories,tasks});
    saveIssue.value=null;
  } catch(error) { reportSaveError(error); }
};
const confirmImport = async () => {
  if(importDraft.value && await runAction(importDraft.value.operations,{draft:importDraft.value.preview})) importDraft.value=null;
};
const cancelImport = () => { if(confirm('Отменить подготовленный импорт?')) importDraft.value=null; };

const onProdImageFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите файл изображения');
    return;
  }
  try {
    const finalUrl = await prepareImageUpload(file);
    // Add to the images list and set as main
    prodImagesList.value.unshift(finalUrl);
  } catch (err) {
    alert('Ошибка при загрузке изображения');
  }
  event.target.value = ''; // reset
};
</script>

<template>
  <div class="admin-overlay">
    <!-- Login Screen -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <div class="brand login-brand">
          <img src="/logo2.png" alt="Packerra" onerror="this.src='https://packerra.kz/logo2.png'" />
        </div>
        <p class="login-subtitle">Управление каталогом и материалами</p>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label class="form-label" for="admin-user">Логин</label>
            <input 
              v-model="username" 
              class="form-control" 
              type="text" 
              id="admin-user" autocomplete="username"
              placeholder="Введите свой логин"
              required 
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="admin-pass">Пароль</label>
            <input 
              v-model="password" 
              class="form-control" 
              type="password" 
              id="admin-pass" autocomplete="current-password"
              placeholder="Введите пароль"
              required 
            />
          </div>

          <p v-if="authNotice" class="login-error-msg">{{ authNotice }}</p>
          <p v-if="loginError" class="login-error-msg">{{ loginError }}</p>

          <button class="btn btn-primary login-submit-btn" type="submit" :disabled="authBusy || !authReady">
            {{ !authReady ? 'Проверка сессии…' : authBusy ? 'Вход…' : 'Войти в панель' }}
          </button>
        </form>

        <button @click="closeAdmin" class="btn-back-to-shop">
          Вернуться на сайт
        </button>
      </div>
    </div>

    <div v-else-if="currentUser.mustChangePassword || isPasswordChangeOpen" class="login-container">
      <div class="login-card">
        <h2>Смена пароля</h2>
        <p v-if="currentUser.mustChangePassword" class="login-subtitle">Перед работой смените временный пароль.</p>
        <form @submit.prevent="handleChangePassword" class="login-form">
          <div class="form-group">
            <label for="current-password" class="form-label">Текущий пароль</label>
            <input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password" class="form-control" required maxlength="128" />
          </div>
          <div class="form-group">
            <label for="new-password" class="form-label">Новый пароль — минимум 12 символов</label>
            <input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" class="form-control" required minlength="12" maxlength="128" />
          </div>
          <p v-if="passwordError" class="login-error-msg">{{ passwordError }}</p>
          <button type="submit" class="btn btn-primary login-submit-btn" :disabled="authBusy">{{ authBusy ? 'Сохранение…' : 'Сменить пароль' }}</button>
        </form>
        <button v-if="!currentUser.mustChangePassword" @click="isPasswordChangeOpen = false" class="btn-back-to-shop">Вернуться в админку</button>
        <button @click="handleLogout" :disabled="authBusy" class="btn-back-to-shop">Выйти</button>
      </div>
    </div>

    <!-- Main Dashboard -->
    <div v-else class="dashboard-wrapper">
      <!-- Sidebar -->
      <aside class="dashboard-sidebar">
        <div class="brand sidebar-brand">
          <img src="/logo2.png" alt="Packerra" onerror="this.src='https://packerra.kz/logo2.png'" />
        </div>

        <nav class="sidebar-nav">
          <button 
            @click="activeTab = 'summary'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'summary' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="9" rx="1"></rect>
              <rect x="14" y="3" width="7" height="5" rx="1"></rect>
              <rect x="14" y="12" width="7" height="9" rx="1"></rect>
              <rect x="3" y="16" width="7" height="5" rx="1"></rect>
            </svg>
            <span>Сводка</span>
          </button>

          <button 
            @click="activeTab = 'products'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'products' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>Товары ({{ totalProducts }})</span>
          </button>

          <button 
            @click="activeTab = 'categories'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'categories' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
            <span>Категории ({{ totalCategories }})</span>
          </button>

          <button 
            @click="activeTab = 'tasks'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'tasks' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Задачи ({{ tasks.length }})</span>
          </button>

          <button 
            @click="activeTab = 'sorting'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'sorting' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3h7v7H3z"></path><path d="M14 3h7v7h-7z"></path><path d="M14 14h7v7h-7z"></path><path d="M3 14h7v7H3z"></path>
            </svg>
            <span>Сортировка</span>
          </button>

          <button 
            @click="activeTab = 'banners'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'banners' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Баннеры ({{ banners.length }})</span>
          </button>

          <button 
            @click="activeTab = 'settings'" 
            :class="['sidebar-nav-btn', { active: activeTab === 'settings' }]"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Настройки</span>
          </button>
        <button v-if="currentUser.role === 'admin'" @click="activeTab = 'users'" :class="['sidebar-nav-btn', { active: activeTab === 'users' }]">Пользователи</button>
          <button v-if="currentUser.role === 'admin'" @click="activeTab = 'history'" :class="['sidebar-nav-btn', { active: activeTab === 'history' }]">История изменений</button>
        </nav>


        <div class="sidebar-footer">
          <p>{{ currentUser.name }} · {{ currentUser.role === 'admin' ? 'Администратор' : 'Редактор' }}</p>
          <button :disabled="userManagementBusy" @click="isPasswordChangeOpen = true; passwordError = ''" class="sidebar-logout-btn">Сменить пароль</button>
          <button @click="handleLogout" :disabled="authBusy" class="sidebar-logout-btn">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <!-- Dashboard Main Workspace -->
      <main class="dashboard-content">
        <!-- Top Toolbar -->
        <header class="dashboard-header">
          <h2>{{ activeTab === 'users' ? 'Управление пользователями' : activeTab === 'history' ? 'История изменений' : activeTab === 'summary' ? 'Сводная статистика' : activeTab === 'products' ? 'Управление товарами' : activeTab === 'tasks' ? 'Управление задачами' : activeTab === 'sorting' ? 'Сортировка товаров' : activeTab === 'banners' ? 'Баннеры' : activeTab === 'settings' ? 'Настройки сайта' : 'Категории каталога' }}</h2>
          
          <div class="dashboard-header-actions">
            <button @click="closeAdmin" class="btn btn-dark btn-back-store">
              Вернуться на сайт
            </button>
          </div>
        </header>

        <div v-if="saveNotice" class="save-feedback save-success" role="status">{{ saveNotice }}</div>
        <div v-if="databaseError || saveIssue" class="save-feedback save-error" role="alert">
          {{ databaseError || saveIssue.message }}
          <button v-if="!pendingContentSave" class="btn btn-secondary" :disabled="contentBusy" @click="reloadCatalog">Обновить каталог</button>
          <button v-else class="btn btn-secondary" :disabled="contentBusy" @click="checkSaveResult">Проверить результат</button>
          <button v-if="saveIssue?.entity === 'categories' && issueCurrent && !saveIssue.reviewed" class="btn btn-secondary" @click="loadConflictVersion">Загрузить свежую версию</button>
          <details v-if="saveIssue?.current && !isProductModalOpen && !isTaskModalOpen"><summary>Свежие данные сервера</summary><pre>{{ formatDraft(saveIssue.current) }}</pre></details>
          <details v-if="saveIssue?.draft && !isProductModalOpen && !isTaskModalOpen"><summary>Отправленные правки</summary><pre>{{ formatDraft(saveIssue.draft) }}</pre></details>
        </div>
        <fieldset class="catalog-actions" :disabled="catalogBlocked">
        <!-- CONTENT TAB 1: SUMMARY -->
        <div v-if="activeTab === 'summary'" class="tab-pane-content fade-in">
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-icon" style="background-color: var(--primary-light); color: var(--primary)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <div class="metric-info">
                <span class="metric-label">Всего товаров</span>
                <span class="metric-val">{{ totalProducts }}</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-icon" style="background-color: var(--success-light); color: var(--success)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                </svg>
              </div>
              <div class="metric-info">
                <span class="metric-label">Категорий</span>
                <span class="metric-val">{{ totalCategories }}</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-icon" style="background-color: rgba(99, 102, 241, 0.1); color: rgb(99, 102, 241)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div class="metric-info">
                <span class="metric-label">Средняя цена</span>
                <span class="metric-val">{{ averageProductPrice.toLocaleString('ru-RU') }} ₸</span>
              </div>
            </div>
          </div>

          <div class="summary-details-grid">
            <div class="details-card">
              <h3>Товары по категориям</h3>
              <ul class="summary-category-list">
                <li v-for="(count, catName) in productsByCategoryCount" :key="catName">
                  <span class="cat-name">{{ catName || 'Без категории' }}</span>
                  <span class="cat-count-badge">{{ count }} товаров</span>
                </li>
              </ul>
            </div>

            <div class="details-card quick-actions-card">
              <h3>Быстрые действия</h3>
              <div class="quick-actions-btns">
                <button @click="openProductModal()" class="btn btn-primary">
                  Добавить новый товар
                </button>
                <button @click="activeTab = 'categories'" class="btn btn-secondary">
                  Управление категориями
                </button>
              </div>
              <div class="quick-help-info">
                <p><strong>Инструкция:</strong> Добавленные или измененные здесь товары мгновенно появляются на основном сайте. Данные сохраняются локально в вашем браузере.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- CONTENT TAB 2: PRODUCTS TABLE -->
        <div v-if="activeTab === 'products'" class="tab-pane-content fade-in">
          <div class="import-toolbar">
            <button class="btn btn-secondary" :disabled="catalogBlocked" @click="importFileInput.click()">Импорт Excel</button>
            <input ref="importFileInput" type="file" accept=".xlsx,.xls,.csv" hidden @change="readImportFile" />
            <small>Столбцы: ID, Название, Цена; необязательно Описание, Категория, Единица, Фото. Импорт не удаляет товары.</small>
          </div>
          <div v-if="importDraft" class="save-feedback">
            <p>Подготовлено товаров: {{ importDraft.preview.length }}. Новых категорий: {{ importDraft.categoryCount }}. Запись ещё не выполнена.</p>
            <div class="import-preview"><table><thead><tr><th>ID</th><th>Название</th><th>Действие</th></tr></thead><tbody><tr v-for="item in importDraft.preview" :key="item.id"><td>{{ item.id }}</td><td>{{ item.title }}</td><td>{{ item.action }}</td></tr></tbody></table></div>
            <button class="btn btn-primary" :disabled="catalogBlocked" @click="confirmImport">Сохранить импорт</button>
            <button class="btn btn-secondary" :disabled="contentBusy || uploadBusy > 0 || Boolean(pendingContentSave)" @click="cancelImport">Отмена</button>
          </div>

          <!-- Filters & Actions Bar -->
          <div class="toolbar-bar">
            <div class="toolbar-search">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Поиск по названию, описанию или ID..." 
                class="toolbar-search-input"
              />
            </div>

            <select v-model="filterCategory" class="form-control form-select toolbar-category-select">
              <option value="">Все категории</option>
              <option v-for="cat in categories" :key="cat.name" :value="cat.name">
                {{ cat.name }}
              </option>
            </select>

            <select v-model="filterTask" class="form-control form-select toolbar-category-select" style="margin-left: 10px;">
              <option value="">Все задачи</option>
              <option v-for="t in tasks" :key="t.id" :value="t.id">
                {{ t.title }}
              </option>
            </select>

            <button @click="openProductModal()" class="btn btn-primary btn-add-prod" style="margin-left: auto;">
              + Добавить товар
            </button>
          </div>

          <!-- Products Table -->
          <div class="table-container">
            <table class="dashboard-table">
              <thead>
                <tr>
                  <th>Превью</th>
                  <th>ID / Название</th>
                  <th>Категория</th>
                  <th>Цена</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in filteredProducts" :key="product.id">
                  <td>
                    <div class="table-prod-img-box">
                      <img 
                        :src="product.image" 
                        :alt="product.title" 
                        onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'"
                      />
                    </div>
                  </td>
                  <td>
                    <div class="table-prod-title-group">
                      <strong>
                        {{ product.title }}
                        <span v-if="product.isVisible === false" class="badge-hidden" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 500; border: 1px solid rgba(239, 68, 68, 0.25);">Скрыт</span>
                      </strong>
                      <span class="table-prod-id">ID: {{ product.id }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="table-category-tag">{{ product.category || 'Без категории' }}</span>
                  </td>
                  <td>
                    <span class="table-price-tag">{{ product.price.toLocaleString('ru-RU') }} ₸ / {{ product.unit || 'шт' }}</span>
                  </td>
                  <td>
                    <div class="table-actions-cell">
                      <button @click="openProductModal(product)" class="btn-table-action edit" title="Редактировать">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button @click="handleDeleteProduct(product.id, product.title)" class="btn-table-action delete" title="Удалить">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <tr v-if="filteredProducts.length === 0">
                  <td colspan="5" class="table-empty-row">
                    Товары не найдены. Попробуйте изменить поисковый запрос.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <!-- CONTENT TAB 5: SORTING MANAGER -->
        <div v-if="activeTab === 'sorting'" class="tab-pane-content fade-in">
          
          <!-- STEP 1: SELECT SORT MODE -->
          <div v-if="!sortMode" class="sort-mode-selection fade-in">
            <div class="sort-mode-header">
              <h3>Выберите раздел для настройки сортировки</h3>
              <p>Настройте порядок отображения товаров внутри нужного раздела</p>
            </div>
            
            <div class="sort-mode-cards">
              <div class="sort-mode-card" @click="selectSortMode('category')">
                <div class="sort-mode-icon bg-primary-light">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </div>
                <h4>Сортировка по категориям</h4>
                <p>Настроить порядок разделов каталога и товаров внутри них</p>
              </div>
              
              <div class="sort-mode-card" @click="selectSortMode('task')">
                <div class="sort-mode-icon bg-success-light">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                </div>
                <h4>Выберите вашу задачу (Задачи)</h4>
                <p>Настроить порядок задач и товаров внутри них</p>
              </div>
            </div>
          </div>

          <!-- STEP 2: WORKSPACE -->
          <div v-else class="sort-workspace fade-in">
            <div class="sort-workspace-top-bar">
              <button class="btn btn-outline btn-back" @click="sortMode = null; filterCategory = ''; filterTask = ''">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Назад к разделам
              </button>

              <div class="sort-mode-pills">
                <button 
                  type="button" 
                  :class="['sort-mode-pill-btn', { active: sortMode === 'task' }]"
                  @click="selectSortMode('task')"
                >
                  <span class="pill-icon">🎯</span>
                  По задачам (Задачи)
                </button>
                <button 
                  type="button" 
                  :class="['sort-mode-pill-btn', { active: sortMode === 'category' }]"
                  @click="selectSortMode('category')"
                >
                  <span class="pill-icon">📦</span>
                  По категориям
                </button>
              </div>
            </div>

            <!-- SECTION A: TASKS SORTING & SELECTOR -->
            <div v-if="sortMode === 'task'" class="sort-interactive-deck">
              <div class="deck-header">
                <div class="deck-header-info">
                  <h4 class="deck-title">Задачи на сайте ({{ tasks.length }})</h4>
                  <p class="deck-subtitle">
                    Перетаскивайте задачи или нажимайте стрелки для смены их очередности на сайте.
                    <strong>Кликните по задаче</strong>, чтобы настроить товары внутри нее.
                  </p>
                </div>
                <div class="deck-status-pill">
                  ✓ Порядок сохраняется автоматически
                </div>
              </div>

              <!-- Task Cards List (Draggable + Click to select) -->
              <draggable 
                v-model="orderedTasks" 
                item-key="id" 
                class="sort-cards-grid"
                ghost-class="sortable-card-ghost"
                chosen-class="sortable-card-chosen"
                handle=".sort-card-drag-grip"
                animation="200"
                :disabled="catalogBlocked"
              >
                <template #item="{ element: task, index }">
                  <div 
                    :class="['sort-interactive-card', { active: filterTask === task.id }]"
                    @click="filterTask = task.id"
                  >
                    <!-- Card Top Controls -->
                    <div class="card-ctrl-bar">
                      <div class="sort-card-drag-grip" title="Зажмите и перетащите для смены порядка">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="grip-svg">
                          <circle cx="9" cy="6" r="1.5"></circle><circle cx="15" cy="6" r="1.5"></circle>
                          <circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle>
                          <circle cx="9" cy="18" r="1.5"></circle><circle cx="15" cy="18" r="1.5"></circle>
                        </svg>
                        <span class="card-num-badge">#{{ index + 1 }}</span>
                      </div>
                      <div class="card-arrows">
                        <button 
                          type="button" 
                          class="btn-card-arrow" 
                          :disabled="index === 0" 
                          @click.stop="moveTaskLeft(index)" 
                          title="Переместить левее"
                        >
                          ←
                        </button>
                        <button 
                          type="button" 
                          class="btn-card-arrow" 
                          :disabled="index === tasks.length - 1" 
                          @click.stop="moveTaskRight(index)" 
                          title="Переместить правее"
                        >
                          →
                        </button>
                      </div>
                    </div>

                    <!-- Card Visual -->
                    <div class="card-icon-area">
                      <img 
                        v-if="task.image" 
                        :src="task.image" 
                        :alt="task.title" 
                        class="task-img-element"
                        onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=80'"
                      />
                      <span v-else-if="task.icon && icons[task.icon]" v-html="icons[task.icon]" class="task-svg-element"></span>
                      <span v-else class="task-img-fallback">🎯</span>
                    </div>

                    <!-- Card Body -->
                    <div class="card-main-content">
                      <strong class="card-title-text">{{ task.title }}</strong>
                      <span class="card-desc-text">{{ task.desc || 'Нет описания' }}</span>
                    </div>

                    <!-- Card Bottom -->
                    <div class="card-footer-info">
                      <span class="card-count-tag">{{ getTaskProductsCount(task.id) }} товаров</span>
                      <span v-if="filterTask === task.id" class="card-active-tag">Выбрано ✓</span>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>

            <!-- SECTION B: CATEGORIES SORTING & SELECTOR -->
            <div v-if="sortMode === 'category'" class="sort-interactive-deck">
              <div class="deck-header">
                <div class="deck-header-info">
                  <h4 class="deck-title">Категории каталога ({{ categories.length }})</h4>
                  <p class="deck-subtitle">
                    Перетаскивайте категории или нажимайте стрелки для смены их очередности на сайте.
                    <strong>Кликните по категории</strong>, чтобы настроить товары внутри нее.
                  </p>
                </div>
                <div class="deck-status-pill">
                  ✓ Порядок сохраняется автоматически
                </div>
              </div>

              <!-- Categories Cards List (Draggable + Click to select) -->
              <draggable 
                v-model="orderedCategories" 
                item-key="name" 
                class="sort-cards-grid"
                ghost-class="sortable-card-ghost"
                chosen-class="sortable-card-chosen"
                handle=".sort-card-drag-grip"
                animation="200"
                :disabled="catalogBlocked"
              >
                <template #item="{ element: cat, index }">
                  <div 
                    :class="['sort-interactive-card', { active: filterCategory === cat.name }]"
                    @click="filterCategory = cat.name"
                  >
                    <!-- Card Top Controls -->
                    <div class="card-ctrl-bar">
                      <div class="sort-card-drag-grip" title="Зажмите и перетащите для смены порядка">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="grip-svg">
                          <circle cx="9" cy="6" r="1.5"></circle><circle cx="15" cy="6" r="1.5"></circle>
                          <circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle>
                          <circle cx="9" cy="18" r="1.5"></circle><circle cx="15" cy="18" r="1.5"></circle>
                        </svg>
                        <span class="card-num-badge">#{{ index + 1 }}</span>
                      </div>
                      <div class="card-arrows">
                        <button 
                          type="button" 
                          class="btn-card-arrow" 
                          :disabled="index === 0" 
                          @click.stop="moveCategoryLeft(index)" 
                          title="Переместить левее"
                        >
                          ←
                        </button>
                        <button 
                          type="button" 
                          class="btn-card-arrow" 
                          :disabled="index === categories.length - 1" 
                          @click.stop="moveCategoryRight(index)" 
                          title="Переместить правее"
                        >
                          →
                        </button>
                      </div>
                    </div>

                    <!-- Card Visual -->
                    <div class="card-icon-area">
                      <img 
                        v-if="cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('/') || cat.icon.startsWith('data:'))" 
                        :src="cat.icon" 
                        :alt="cat.name" 
                        class="cat-img-element"
                      />
                      <span v-else class="cat-svg-element" v-html="getCatDisplayIcon(cat)"></span>
                    </div>

                    <!-- Card Body -->
                    <div class="card-main-content">
                      <strong class="card-title-text">{{ cat.name }}</strong>
                    </div>

                    <!-- Card Bottom -->
                    <div class="card-footer-info">
                      <span class="card-count-tag">{{ getCategoryProductsCount(cat.name) }} товаров</span>
                      <span v-if="filterCategory === cat.name" class="card-active-tag">Выбрано ✓</span>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>

            <!-- SECTION C: PRODUCTS SORTING WORKSPACE -->
            <div class="sort-products-deck">
              <!-- Header info banner -->
              <div class="sort-products-deck-header">
                <div class="sort-header-text">
                  <h3 v-if="sortMode === 'task'">
                    Товары в задаче: <span class="highlight-entity">«{{ currentTask ? currentTask.title : 'Не выбрана' }}»</span>
                  </h3>
                  <h3 v-else>
                    Товары в категории: <span class="highlight-entity">«{{ filterCategory || 'Не выбрана' }}»</span>
                  </h3>
                  <p v-if="sortMode === 'task'">
                    Распределяйте товары между зонами приоритета (Необходимое, Часто берут, Остальное) и меняйте их порядок внутри зоны.
                  </p>
                  <p v-else>
                    Перетаскивайте карточки товаров, чтобы задать порядок их показа в каталоге на сайте.
                  </p>
                </div>

                <!-- Search -->
                <div class="toolbar-search compact">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Быстрый поиск товаров..." 
                    class="toolbar-search-input"
                  />
                </div>
              </div>

              <!-- Empty state if no task or category is selected -->
              <div v-if="(!filterCategory && sortMode === 'category') || (!filterTask && sortMode === 'task')" class="visual-sort-empty-state">
                <p>👆 Пожалуйста, нажмите на карточку выше, чтобы настроить товары внутри нее.</p>
              </div>

              <!-- Task Priority Zones -->
              <div v-else-if="sortMode === 'task' && filterTask" class="popularity-zones">
                <!-- Zone 1: НЕОБХОДИМОЕ -->
                <div class="popularity-zone">
                  <div class="zone-badge-header zone-priority-1">
                    <span class="zone-emoji">🔥</span>
                    <h4 class="zone-title">НЕОБХОДИМОЕ</h4>
                    <span class="zone-count-pill">{{ taskLevel1Products.length }} тов.</span>
                    <span class="zone-rank-badge">Приоритет 1</span>
                  </div>
                  <draggable 
                    v-model="taskLevel1Products" 
                    item-key="id" 
                    group="taskLevels"
                    :disabled="catalogBlocked"
                    @end="saveTaskZones"
                    class="visual-sort-grid"
                    ghost-class="sortable-ghost"
                    animation="200"
                    style="min-height: 100px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px;"
                  >
                    <template #item="{ element, index }">
                      <div class="visual-sort-card">
                        <div class="sort-card-number">{{ index + 1 }}</div>
                        <div class="sort-card-img"><img :src="element.image" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'" /></div>
                        <div class="sort-card-info">
                          <div class="sort-card-title">{{ element.title }}</div>
                          <div class="sort-card-id">{{ element.id }}</div>
                        </div>
                        <div class="sort-card-inline-arrows">
                          <button type="button" class="btn-card-mini-nav" :disabled="index === 0" @click.stop="moveProductInZone(element, -1, 1)" title="Выше">↑</button>
                          <button type="button" class="btn-card-mini-nav" :disabled="index === taskLevel1Products.length - 1" @click.stop="moveProductInZone(element, 1, 1)" title="Ниже">↓</button>
                        </div>
                      </div>
                    </template>
                  </draggable>
                  <p v-if="taskLevel1Products.length === 0" class="zone-empty-tip">Перетащите сюда товары первостепенной важности</p>
                </div>

                <!-- Zone 2: ЧАСТО БЕРУТ -->
                <div class="popularity-zone" style="margin-top: 25px;">
                  <div class="zone-badge-header zone-priority-2">
                    <span class="zone-emoji">⭐</span>
                    <h4 class="zone-title">ЧАСТО БЕРУТ</h4>
                    <span class="zone-count-pill">{{ taskLevel2Products.length }} тов.</span>
                    <span class="zone-rank-badge">Приоритет 2</span>
                  </div>
                  <draggable 
                    v-model="taskLevel2Products" 
                    item-key="id" 
                    group="taskLevels"
                    :disabled="catalogBlocked"
                    @end="saveTaskZones"
                    class="visual-sort-grid"
                    ghost-class="sortable-ghost"
                    animation="200"
                    style="min-height: 100px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px;"
                  >
                    <template #item="{ element, index }">
                      <div class="visual-sort-card">
                        <div class="sort-card-number">{{ index + 1 }}</div>
                        <div class="sort-card-img"><img :src="element.image" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'" /></div>
                        <div class="sort-card-info">
                          <div class="sort-card-title">{{ element.title }}</div>
                          <div class="sort-card-id">{{ element.id }}</div>
                        </div>
                        <div class="sort-card-inline-arrows">
                          <button type="button" class="btn-card-mini-nav" :disabled="index === 0" @click.stop="moveProductInZone(element, -1, 2)" title="Выше">↑</button>
                          <button type="button" class="btn-card-mini-nav" :disabled="index === taskLevel2Products.length - 1" @click.stop="moveProductInZone(element, 1, 2)" title="Ниже">↓</button>
                        </div>
                      </div>
                    </template>
                  </draggable>
                  <p v-if="taskLevel2Products.length === 0" class="zone-empty-tip">Перетащите сюда сопутствующие товары</p>
                </div>

                <!-- Zone 3: ОСТАЛЬНОЕ -->
                <div class="popularity-zone" style="margin-top: 25px;">
                  <div class="zone-badge-header zone-priority-3">
                    <span class="zone-emoji">📦</span>
                    <h4 class="zone-title">ОСТАЛЬНОЕ</h4>
                    <span class="zone-count-pill">{{ taskLevel3Products.length }} тов.</span>
                    <span class="zone-rank-badge">Приоритет 3</span>
                  </div>
                  <draggable 
                    v-model="taskLevel3Products" 
                    item-key="id" 
                    group="taskLevels"
                    :disabled="catalogBlocked"
                    @end="saveTaskZones"
                    class="visual-sort-grid"
                    ghost-class="sortable-ghost"
                    animation="200"
                    style="min-height: 100px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px;"
                  >
                    <template #item="{ element, index }">
                      <div class="visual-sort-card">
                        <div class="sort-card-number">{{ index + 1 }}</div>
                        <div class="sort-card-img"><img :src="element.image" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'" /></div>
                        <div class="sort-card-info">
                          <div class="sort-card-title">{{ element.title }}</div>
                          <div class="sort-card-id">{{ element.id }}</div>
                        </div>
                        <div class="sort-card-inline-arrows">
                          <button type="button" class="btn-card-mini-nav" :disabled="index === 0" @click.stop="moveProductInZone(element, -1, 3)" title="Выше">↑</button>
                          <button type="button" class="btn-card-mini-nav" :disabled="index === taskLevel3Products.length - 1" @click.stop="moveProductInZone(element, 1, 3)" title="Ниже">↓</button>
                        </div>
                      </div>
                    </template>
                  </draggable>
                </div>
              </div>

              <!-- Category Products Grid -->
              <div v-else-if="sortMode === 'category' && filterCategory" class="category-sort-wrapper">
                <draggable 
                  v-model="filteredProductsDraggable" :disabled="catalogBlocked" 
                  item-key="id" 
                  class="visual-sort-grid"
                  ghost-class="sortable-ghost"
                  animation="200"
                >
                  <template #item="{ element, index }">
                    <div class="visual-sort-card">
                      <div class="sort-card-number">{{ index + 1 }}</div>
                      <div class="sort-card-img">
                        <img :src="element.image" :alt="element.title" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'" />
                      </div>
                      <div class="sort-card-info">
                        <div class="sort-card-title">{{ element.title }}</div>
                        <div class="sort-card-id">{{ element.id }}</div>
                      </div>
                      <div class="sort-card-inline-arrows">
                        <button type="button" class="btn-card-mini-nav" :disabled="index === 0" @click.stop="moveProductInCategory(element, -1)" title="Выше">↑</button>
                        <button type="button" class="btn-card-mini-nav" :disabled="index === filteredProductsDraggable.length - 1" @click.stop="moveProductInCategory(element, 1)" title="Ниже">↓</button>
                      </div>
                    </div>
                  </template>
                </draggable>
                <p v-if="filteredProductsDraggable.length === 0" class="zone-empty-tip" style="margin-top: 15px;">В этой категории пока нет товаров.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- CONTENT TAB 3: CATEGORIES MANAGER -->
        <div v-if="activeTab === 'categories'" class="tab-pane-content fade-in">
          <div class="categories-manager-grid">
            <!-- Left: Add new -->
            <div class="cat-action-card">
              <h3>Создать категорию</h3>
              <p>Добавьте новый раздел для классификации товаров в каталоге</p>
              
              <form @submit.prevent="handleAddCategory" class="cat-add-form">
                <div class="form-group">
                  <label class="form-label" for="cat-name-input">Название категории</label>
                  <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button type="button" @click="triggerCatIconUpload(false)" class="btn btn-secondary" style="height: 38px; padding: 0 10px; display: flex; align-items: center; justify-content: center; min-width: 42px;" title="Загрузить иконку">
                      <img v-if="newCategoryIcon" :src="newCategoryIcon" style="width: 24px; height: 24px; object-fit: contain;" />
                      <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </button>
                    <input 
                      v-model="newCategoryName" 
                      id="cat-name-input"
                      class="form-control" 
                      type="text" 
                      placeholder="Введите название..." 
                      required
                    />
                  </div>
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
                  + Создать категорию
                </button>
              </form>
            </div>

            <!-- Right: List and edit -->
            <div class="cat-list-card">
              <h3>Существующие категории</h3>
              
              <ul class="cat-dashboard-list">
                <li v-for="(cat, index) in categories" :key="index" class="cat-dashboard-item">
                  <div v-if="editingCategoryIndex !== index" class="cat-display-row">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <img v-if="cat.icon" :src="cat.icon" style="width: 24px; height: 24px; object-fit: contain;" />
                      <span class="cat-title-text">{{ cat.name }}</span>
                    </div>
                    
                    <div class="cat-row-actions">
                      <button @click="startEditCategory(index)" class="btn-table-action edit" title="Редактировать">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        </svg>
                      </button>
                      <button @click="handleDeleteCategory(cat)" class="btn-table-action delete" title="Удалить">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div v-else class="cat-edit-row">
                    <div style="display: flex; gap: 8px; align-items: center; position: relative; flex: 1;">
                      <button type="button" @click="triggerCatIconUpload(true)" class="btn btn-secondary" style="height: 38px; padding: 0 10px; display: flex; align-items: center; justify-content: center; min-width: 42px;" title="Загрузить иконку">
                        <img v-if="editingCategoryIcon" :src="editingCategoryIcon" style="width: 24px; height: 24px; object-fit: contain;" />
                        <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </button>
                      <input 
                        v-model="editingCategoryName" 
                        class="form-control" 
                        type="text" 
                        required
                        style="width: 100%;"
                      />
                    </div>
                    <div class="cat-edit-actions">
                      <button @click="saveEditCategory" class="btn btn-success" style="height: 38px; padding: 0 12px;">
                        Сохранить
                      </button>
                      <button @click="cancelCategoryEdit" class="btn btn-secondary" style="height: 38px; padding: 0 12px;">
                        Отмена
                      </button>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- CONTENT TAB: BANNERS -->
        <div v-if="activeTab === 'banners'" class="tab-pane-content fade-in">
          <div class="card" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="margin: 0; font-size: 16px;">Управление баннерами</h3>
              <button @click="triggerBannerUpload" class="btn btn-primary">
                + Добавить баннер
              </button>
            </div>
            
            <div class="table-container">
              <table class="dashboard-table">
                <thead>
                  <tr>
                    <th style="width: 150px;">Изображение</th>
                    <th style="width: 100px;">Статус</th>
                    <th>Сортировка</th>
                    <th style="text-align: right;">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(banner, index) in banners" :key="banner.id">
                    <td>
                      <img :src="banner.image" style="max-width: 120px; max-height: 60px; object-fit: contain; background: #eee; border-radius: 4px;" />
                    </td>
                    <td>
                      <button 
                        @click="toggleBanner(banner)" 
                        :class="['btn', banner.isActive ? 'btn-success' : 'btn-secondary']"
                        style="padding: 4px 8px; font-size: 12px; min-width: 80px;"
                      >
                        {{ banner.isActive ? 'Активен' : 'Отключен' }}
                      </button>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px; align-items: center;">
                        <button @click="moveBannerUp(index)" :disabled="index === 0" class="btn btn-secondary" style="padding: 2px 6px;">↑</button>
                        <button @click="moveBannerDown(index)" :disabled="index === banners.length - 1" class="btn btn-secondary" style="padding: 2px 6px;">↓</button>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <button @click="removeBanner(index)" class="btn" style="background: transparent; color: #e74c3c; border: 1px solid #e74c3c; padding: 4px 8px;">
                        Удалить
                      </button>
                    </td>
                  </tr>
                  <tr v-if="banners.length === 0">
                    <td colspan="4" style="text-align: center; color: #999; padding: 30px;">
                      Нет баннеров. Добавьте первый баннер.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- CONTENT TAB: SETTINGS -->
        <div v-if="activeTab === 'settings'" class="tab-pane-content fade-in">
          <div class="card" style="padding: 28px; max-width: 600px;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700;">Настройки сайта</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 28px 0;">Управляйте функциями, отображаемыми на лендинге</p>

            <!-- Installment toggle -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px; background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; gap: 20px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px; color: var(--primary);">
                    <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                  </svg>
                  <strong style="font-size: 15px;">Рассрочка (Бөліп төлеу)</strong>
                </div>
                <p style="font-size: 13px; color: var(--text-muted); margin: 0; line-height: 1.5;">
                  Если выключить — кнопка «Рассрочка» исчезнет из корзины и карточек товаров на лендинге.
                </p>
              </div>

              <!-- Toggle switch -->
              <button
                @click="toggleInstallment" :disabled="catalogBlocked"
                :style="{
                  width: '56px',
                  height: '30px',
                  borderRadius: '15px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.25s ease',
                  background: siteSettings.installmentEnabled ? 'var(--primary)' : '#ccc',
                  position: 'relative',
                  flexShrink: '0',
                  padding: '0'
                }"
                :title="siteSettings.installmentEnabled ? 'Выключить рассрочку' : 'Включить рассрочку'"
              >
                <span :style="{
                  position: 'absolute',
                  top: '3px',
                  left: siteSettings.installmentEnabled ? '29px' : '3px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.25s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  display: 'block'
                }"></span>
              </button>
            </div>

            <!-- Status badge -->
            <div style="margin-top: 14px; display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <span :style="{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: siteSettings.installmentEnabled ? '#10b981' : '#ef4444',
                display: 'inline-block',
                flexShrink: '0'
              }"></span>
              <span :style="{ color: siteSettings.installmentEnabled ? '#10b981' : '#ef4444', fontWeight: '600' }">
                {{ siteSettings.installmentEnabled ? 'Рассрочка активна — видна на сайте' : 'Рассрочка отключена — скрыта на сайте' }}
              </span>
            </div>
          </div>
        </div>

        <!-- CONTENT TAB 4: TASKS MANAGER -->
        <div v-if="activeTab === 'tasks'" class="tab-pane-content fade-in">
          <div class="tasks-manager-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3>Управление задачами</h3>
              <p style="font-size: 13px; color: var(--text-muted); margin: 0;">Добавляйте, редактируйте или удаляйте задачи</p>
            </div>
            <button @click="openTaskModal()" class="btn btn-primary">
              + Добавить задачу
            </button>
          </div>

          <div class="table-container">
            <table class="dashboard-table">
              <thead>
                <tr>
                  <th>Иконка</th>
                  <th>ID / Slug</th>
                  <th>Сортировка</th>
                  <th>Название (RU)</th>
                  <th>Название (KK)</th>
                  <th>Описание (RU)</th>
                  <th>Описание (KK)</th>
                  <th style="text-align: right;">Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in tasks" :key="t.id">
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <img v-if="t.image" :src="t.image" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;" onerror="this.src='/whatsapp.png'" />
                    </div>
                  </td>

                  <td style="font-weight: 600; font-family: monospace;">{{ t.id }}</td>
                  <td style="font-weight: 600;">{{ t.sortOrder || 0 }}</td>
                  <td>{{ t.title }}</td>
                  <td>{{ t.titleKk || '-' }}</td>
                  <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ t.desc }}</td>
                  <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ t.descKk || '-' }}</td>
                  <td>
                    <div class="row-action-buttons">
                      <button @click="openTaskModal(t)" class="btn-table-action edit" title="Редактировать">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        </svg>
                      </button>
                      <button @click="handleDeleteTask(t.id)" class="btn-table-action delete" title="Удалить">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
        </fieldset>
        <AdminUsers class="tab-pane-content" v-if="currentUser.role === 'admin' && (activeTab === 'users' || userDraft || userManagementBusy)" v-show="activeTab === 'users'" :state="userManagement" />
        <AdminHistory class="tab-pane-content" v-if="currentUser.role === 'admin' && activeTab === 'history'" />
      </main>
    </div>


    <!-- PRODUCT MODAL FORM (Slide-in / Backdrop Overlay) -->
    <div v-if="isLoggedIn && !currentUser.mustChangePassword && !isPasswordChangeOpen && isProductModalOpen" class="modal-backdrop-overlay animate-fade-in">
      <div class="product-form-modal animate-slide-up">
        <header class="modal-header">
          <h3>{{ editingProduct ? 'Редактирование товара' : 'Создание нового товара' }}</h3>
          <button @click="closeProductModal" class="btn-close-modal" v-html="icons.x"></button>
        </header>

        <div class="modal-body-scroll">
          <div v-if="saveIssue && (!saveIssue.entity || saveIssue.entity === 'products')" class="save-feedback save-error" role="alert">
            <p>{{ saveIssue.message }}</p>
            <button v-if="pendingContentSave" class="btn btn-secondary" :disabled="contentBusy" @click="checkSaveResult">Проверить результат</button>
            <button v-if="issueCurrent && !saveIssue.reviewed" class="btn btn-secondary" @click="loadConflictVersion">Загрузить свежую версию</button>
            <div v-if="issueCurrent" class="conflict-columns">
              <details open><summary>Свежие данные сервера</summary><pre>{{ formatDraft(issueCurrent) }}</pre></details>
              <details open><summary>Ваш сохранённый черновик</summary><pre>{{ formatDraft(saveIssue.draft) }}</pre></details>
            </div>
            <details v-else><summary>Ваш черновик</summary><pre>{{ formatDraft(saveIssue.draft) }}</pre></details>
          </div>
          <form @submit.prevent="handleSaveProduct" class="product-creation-form">
            <fieldset class="form-fields" :disabled="contentBusy || uploadBusy > 0 || Boolean(pendingContentSave)">
            <!-- Title & ID -->
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="p-title">Название товара *</label>
                <input v-model="prodTitle" id="p-title" class="form-control" type="text" placeholder="Коробка прочная..." required />
              </div>

              <div class="form-group">
                <label class="form-label" for="p-id">Артикул / ID (оставьте пустым для автогенерации)</label>
                <input 
                  v-model="prodId" 
                  id="p-id" 
                  class="form-control" 
                  type="text" 
                  placeholder="box-heavy" 
                  :disabled="!!editingProduct" 
                />
              </div>
            </div>

            <!-- Price & Unit -->
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="p-price">Цена (₸) *</label>
                <input v-model="prodPrice" id="p-price" class="form-control" type="number" min="0" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="p-unit">Ед. измерения</label>
                <input v-model="prodUnit" id="p-unit" class="form-control" type="text" placeholder="шт, рул, пач..." />
              </div>
            </div>

            <!-- Category, Sort Order & Visibility -->
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label" for="p-category">Категория</label>
                <select v-model="prodCategory" id="p-category" class="form-control form-select">
                  <option v-for="cat in categories" :key="cat.name" :value="cat.name">
                    {{ cat.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="p-sort-order">Порядок сортировки</label>
                <input v-model="prodSortOrder" id="p-sort-order" class="form-control" type="number" placeholder="0" />
              </div>

              <div class="form-group" style="display: flex; align-items: center; height: 100%; margin-top: auto; padding-bottom: 12px;">
                <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                  <input v-model="prodIsVisible" type="checkbox" style="width: 18px; height: 18px; cursor: pointer;" />
                  <span>Показывать на сайте</span>
                </label>
              </div>
            </div>

            <!-- Visual, Color & Image -->
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label" for="p-visual">Иконка / Тип визуализации</label>
                <select v-model="prodVisual" id="p-visual" class="form-control form-select">
                  <option value="box">📦 Коробка (box)</option>
                  <option value="roll">🫧 Рулон / Пленка (roll)</option>
                  <option value="tape">📎 Скотч / Лента (tape)</option>
                  <option value="bag">🧳 Сумка / Баул (bag)</option>
                  <option value="tool">✂️ Инструмент (tool)</option>
                  <option value="soft">🧤 Защита / Ткань (soft)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="p-color">Цвет подложки</label>
                <div class="color-picker-wrapper">
                  <input v-model="prodColor" id="p-color" type="color" class="color-selector-input" />
                  <span class="color-hex-text">{{ prodColor }}</span>
                </div>
              </div>

              <div class="form-group image-upload-group">
                <label class="form-label" for="p-image">URL Картинки или Файл</label>
                <div class="image-input-container">
                  <input v-model="prodImageUrl" id="p-image" class="form-control image-url-input" type="text" placeholder="https://... или выберите файл" />
                  <button type="button" class="btn btn-secondary btn-file-upload" @click="$refs.prodImageFileInput.click()" title="Загрузить локальное изображение">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin: 0;">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </button>
                  <input 
                    ref="prodImageFileInput" 
                    type="file" 
                    accept="image/*" 
                    style="display:none" 
                    @change="onProdImageFileChange" 
                  />
                </div>
              </div>
            </div>

            <!-- ALL Product Images Gallery (Unified) -->
            <div class="form-group product-gallery-group" style="margin-top: 15px; margin-bottom: 15px;">
              <label class="form-label">Все изображения товара ({{ prodImagesList.length }} шт.) — первое = основное</label>
              
              <!-- Thumbs list showing ALL images -->
              <div class="gallery-thumbs-grid" v-if="prodImagesList.length > 0">
                <div v-for="(img, idx) in prodImagesList" :key="idx" :class="['gallery-thumb-wrapper', { 'main-image-thumb': idx === 0 }]">
                  <img :src="img" :alt="idx === 0 ? 'Основное фото' : 'Дополнительное фото'" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=100'" />
                  <span v-if="idx === 0" class="main-image-badge">★ Главное</span>
                  <button v-if="idx !== 0" type="button" class="btn-set-main-img" @click="setAsMainImage(idx)" title="Сделать основным">★</button>
                  <button type="button" class="btn-remove-gallery-img" @click="removeGalleryImage(idx)" title="Удалить из галереи">&times;</button>
                </div>
              </div>
              <p v-else class="gallery-empty-hint" style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">Нет изображений. Добавьте изображения ниже.</p>
              
              <!-- Input URL / File Upload -->
              <div class="image-input-container">
                <input v-model="newGalleryImageUrl" class="form-control image-url-input" type="text" placeholder="https://... или выберите файл" />
                <button type="button" class="btn btn-secondary btn-file-upload" @click="$refs.galleryImageFileInput.click()" title="Загрузить изображение">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin: 0;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </button>
                <input 
                  ref="galleryImageFileInput" 
                  type="file" 
                  accept="image/*" 
                  style="display:none" 
                  @change="onGalleryImageFileChange" 
                />
                <button type="button" class="btn btn-primary btn-add-gallery-img" @click="addGalleryImageUrl" style="padding: 0 20px;">Добавить</button>
              </div>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label" for="p-desc">Описание товара</label>
              <textarea v-model="prodDesc" id="p-desc" class="form-control form-textarea" placeholder="Короткое рекламное описание..." rows="3"></textarea>
            </div>

            <hr class="form-divider" />

            <!-- Bank Links -->
            <div class="form-group">
              <h4 style="margin-top: 10px; margin-bottom: 8px;">Ссылки на рассрочку банков</h4>
              <p class="section-subtitle" style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">
                Укажите ссылки на покупку товара в рассрочку. Если ссылка не указана, соответствующий банк не будет отображаться в калькуляторе.
              </p>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label" for="p-kaspi-link">Kaspi Банк (ссылка)</label>
                  <input v-model="prodKaspiLink" id="p-kaspi-link" class="form-control" type="text" placeholder="https://kaspi.kz/..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="p-halyk-link">Halyk Банк (ссылка)</label>
                  <input v-model="prodHalykLink" id="p-halyk-link" class="form-control" type="text" placeholder="https://halykbank.kz/..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="p-forte-link">Forte Банк (ссылка)</label>
                  <input v-model="prodForteLink" id="p-forte-link" class="form-control" type="text" placeholder="https://forte.kz/..." />
                </div>
              </div>
            </div>

            <hr class="form-divider" />

            <!-- Dynamic Specs List -->
            <div class="specs-builder-section">
              <div class="specs-builder-header">
                <h4>Характеристики товара</h4>
                <button type="button" @click="addSpecRow" class="btn btn-secondary btn-small-action">
                  + Добавить строку
                </button>
              </div>

              <div class="specs-rows-container">
                <div v-for="(spec, idx) in prodSpecsList" :key="idx" class="spec-form-row">
                  <input v-model="spec.key" class="form-control" type="text" placeholder="Материал, Объем, Макс. нагрузка..." />
                  <input v-model="spec.value" class="form-control" type="text" placeholder="Значение..." />
                  <div class="spec-row-actions">
                    <button 
                      type="button" 
                      @click="moveSpecRowUp(idx)" 
                      :disabled="idx === 0" 
                      class="btn-move-row" 
                      title="Поднять вверх"
                    >
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin: 0;">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                      </svg>
                    </button>
                    <button 
                      type="button" 
                      @click="moveSpecRowDown(idx)" 
                      :disabled="idx === prodSpecsList.length - 1" 
                      class="btn-move-row" 
                      title="Опустить вниз"
                    >
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin: 0;">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                      </svg>
                    </button>
                    <button type="button" @click="removeSpecRow(idx)" class="btn-delete-spec-row" title="Удалить строку">
                      &times;
                    </button>
                  </div>
                </div>
                <p v-if="prodSpecsList.length === 0" class="specs-empty-hint">Характеристики не заданы.</p>
              </div>
            </div>

            <hr class="form-divider" />

            <!-- Dynamic Sizes List -->
            <div class="specs-builder-section">
              <div class="specs-builder-header">
                <h4>Размеры и цены (Варианты товара)</h4>
                <button type="button" @click="addSizeRow" class="btn btn-secondary btn-small-action">
                  + Добавить размер
                </button>
              </div>

              <div class="specs-rows-container">
                <div v-for="(item, idx) in prodSizesList" :key="item._id || idx" class="size-row-container" style="margin-bottom: 12px;">
                  <div class="size-form-row">
                    <input v-model="item.size" class="form-control" type="text" placeholder="Размер (S, M, L)..." required />
                    <input v-model="item.price" class="form-control" type="number" placeholder="Цена (₸)..." required min="0" />
                    
                    <div class="image-input-container" style="gap: 5px;">
                      <input v-model="item.image" class="form-control image-url-input" type="text" placeholder="URL картинки или файл" style="height: 38px; font-size: 12px;" />
                      <button type="button" class="btn btn-secondary btn-file-upload" @click="($refs['sizeImageFileInput_' + idx]?.[0] || $refs['sizeImageFileInput_' + idx] || $event.currentTarget.parentElement.querySelector('input[type=file]')).click()" title="Загрузить локальное изображение" style="height: 38px; width: 38px;">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin: 0;">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                      </button>
                      <input 
                        :ref="'sizeImageFileInput_' + idx" 
                        type="file" 
                        accept="image/*" 
                        style="display:none" 
                        @change="onSizeImageFileChange($event, item)" 
                      />
                      <div v-if="item.image" class="size-image-preview" :style="{ backgroundImage: 'url(' + item.image + ')' }"></div>
                    </div>

                    <div class="size-row-actions">
                      <button 
                        type="button" 
                        @click="moveSizeRowUp(idx)" 
                        :disabled="idx === 0" 
                        class="btn-move-row" 
                        title="Поднять вверх"
                      >
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin: 0;">
                          <line x1="12" y1="19" x2="12" y2="5"></line>
                          <polyline points="5 12 12 5 19 12"></polyline>
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        @click="moveSizeRowDown(idx)" 
                        :disabled="idx === prodSizesList.length - 1" 
                        class="btn-move-row" 
                        title="Опустить вниз"
                      >
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin: 0;">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <polyline points="19 12 12 19 5 12"></polyline>
                        </svg>
                      </button>
                      <button type="button" @click="item.showGallery = !item.showGallery" class="btn-toggle-size-gallery" :class="{ active: item.showGallery }" title="Управление галереей размера">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin: 0;">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                      </button>
                      <button type="button" @click="removeSizeRow(idx)" class="btn-delete-spec-row" title="Удалить размер">
                        &times;
                      </button>
                    </div>
                  </div>

                  <!-- Banks installment links for size -->
                  <div class="size-links-row">
                    <div class="size-link-input-group">
                      <span class="size-link-label">Kaspi Link:</span>
                      <input v-model="item.kaspiLink" class="form-control compact-input" type="text" placeholder="https://kaspi.kz/..." />
                    </div>
                    <div class="size-link-input-group">
                      <span class="size-link-label">Halyk Link:</span>
                      <input v-model="item.halykLink" class="form-control compact-input" type="text" placeholder="https://halykbank.kz/..." />
                    </div>
                    <div class="size-link-input-group">
                      <span class="size-link-label">Forte Link:</span>
                      <input v-model="item.forteLink" class="form-control compact-input" type="text" placeholder="https://forte.kz/..." />
                    </div>
                  </div>

                  <!-- Size Variant Collapsible Gallery -->
                  <div v-if="item.showGallery" class="size-gallery-section">
                    <label class="form-label" style="font-size: 11px; margin-bottom: 4px; display: block; color: var(--text-lead);">Дополнительные фото для размера: {{ item.size || '(не указан)' }}</label>
                    
                    <div class="gallery-thumbs-grid compact" v-if="item.imagesList && item.imagesList.length > 0">
                      <div v-for="(img, gIdx) in item.imagesList" :key="gIdx" class="gallery-thumb-wrapper compact">
                        <img :src="img" alt="Доп. фото размера" onerror="this.src='https://commons.wikimedia.org/wiki/Special:FilePath/Cardboard%20box.png?width=80'" />
                        <button type="button" class="btn-remove-gallery-img" @click="item.imagesList.splice(gIdx, 1)" title="Удалить из галереи">&times;</button>
                      </div>
                    </div>
                    <p v-else class="gallery-empty-hint" style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Дополнительных фото нет.</p>
                    
                    <div class="image-input-container compact" style="margin-top: 6px; gap: 5px;">
                      <input v-model="item.newUrl" class="form-control image-url-input" type="text" placeholder="URL фото или выберите файл" style="height: 32px; font-size: 11px;" />
                      <button type="button" class="btn btn-secondary btn-file-upload" @click="($refs['sizeGalleryFileInput_' + idx]?.[0] || $refs['sizeGalleryFileInput_' + idx] || $event.currentTarget.parentElement.querySelector('input[type=file]')).click()" title="Загрузить изображение" style="height: 32px; width: 32px;">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin: 0;">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                      </button>
                      <input 
                        :ref="'sizeGalleryFileInput_' + idx" 
                        type="file" 
                        accept="image/*" 
                        style="display:none" 
                        @change="onSizeGalleryFileChange($event, item)" 
                      />
                      <button type="button" class="btn btn-primary" style="height: 32px; font-size: 11px; padding: 0 10px;" @click="addSizeGalleryUrl(item)">+</button>
                    </div>
                  </div>
                </div>
                <p v-if="prodSizesList.length === 0" class="specs-empty-hint">Размеры не заданы. Будет использоваться базовая цена товара.</p>
              </div>
            </div>

            <hr class="form-divider" />

            <!-- Task Recommendations -->
            <div class="tasks-priorities-section">
              <h4>Рекомендации по задачам покупателя</h4>
              <p class="section-subtitle">Задайте приоритет показа товара в мастере задач на главном экране</p>
              
              <div class="tasks-priorities-grid">
                <div v-for="task in tasks" :key="task.id" class="task-priority-row">
                  <span class="task-priority-title">{{ task.title }}</span>
                  <select v-model="prodTasksMap[task.id]" class="form-control form-select priority-select">
                    <option :value="0">Не показывать</option>
                    <option :value="1">Необходимое (Приоритет 1)</option>
                    <option :value="2">Часто берут (Приоритет 2)</option>
                    <option :value="3">Остальное (Приоритет 3)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-submit-actions">
              <button type="button" @click="closeProductModal" class="btn btn-secondary">
                Отмена
              </button>
              <button type="submit" class="btn btn-primary" :disabled="catalogBlocked || isProductSaving || saveIssue?.status === 404">
                {{ isProductSaving ? 'Сохранение…' : uploadBusy ? 'Загрузка фото…' : 'Сохранить изменения' }}
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      </div>
    </div>

    <!-- TASK MODAL FORM (Slide-in / Backdrop Overlay) -->
    <div v-if="isLoggedIn && !currentUser.mustChangePassword && !isPasswordChangeOpen && isTaskModalOpen" class="modal-backdrop-overlay animate-fade-in">
      <div class="product-form-modal animate-slide-up" style="max-width: 600px;">
        <header class="modal-header">
          <h3>{{ editingTask ? 'Редактирование задачи' : 'Создание новой задачи' }}</h3>
          <button @click="closeTaskModal" class="btn-close-modal" v-html="icons.x"></button>
        </header>

        <div class="modal-body-form">
          <div v-if="saveIssue && (!saveIssue.entity || saveIssue.entity === 'tasks')" class="save-feedback save-error" role="alert">
            <p>{{ saveIssue.message }}</p>
            <button v-if="pendingContentSave" class="btn btn-secondary" :disabled="contentBusy" @click="checkSaveResult">Проверить результат</button>
            <button v-if="issueCurrent && !saveIssue.reviewed" class="btn btn-secondary" @click="loadConflictVersion">Загрузить свежую версию</button>
            <div v-if="issueCurrent" class="conflict-columns">
              <details open><summary>Свежие данные сервера</summary><pre>{{ formatDraft(issueCurrent) }}</pre></details>
              <details open><summary>Ваш сохранённый черновик</summary><pre>{{ formatDraft(saveIssue.draft) }}</pre></details>
            </div>
            <details v-else><summary>Ваш черновик</summary><pre>{{ formatDraft(saveIssue.draft) }}</pre></details>
          </div>
          <form @submit.prevent="handleSaveTask">
            <fieldset class="form-fields" :disabled="contentBusy || uploadBusy > 0 || Boolean(pendingContentSave)">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 15px;">
              <div class="form-group">
                <label class="form-label" for="t-id">ID / Slug *</label>
                <input 
                  v-model="taskId" 
                  id="t-id" 
                  class="form-control" 
                  type="text" 
                  placeholder="Например: move, repair" 
                  required 
                  :disabled="!!editingTask" 
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="t-image">Иконка задачи (Изображение / Файл)</label>
                <div class="image-input-container">
                  <input v-model="taskImage" id="t-image" class="form-control image-url-input" type="text" placeholder="/task_icon_0.png" />
                  <button type="button" class="btn btn-secondary btn-file-upload" @click="$refs.taskImageFileInput.click()" title="Загрузить иконку">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin: 0;">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </button>
                  <input 
                    ref="taskImageFileInput" 
                    type="file" 
                    accept="image/svg+xml" 
                    style="display:none" 
                    @change="onTaskImageFileChange" 
                  />
                </div>
                <small style="display: block; color: #ef4444; font-size: 11px; margin-top: 5px; font-weight: 500;">* Поддерживаются форматы JPEG, PNG, SVG</small>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label" for="t-title">Название (RU) *</label>
                <input v-model="taskTitle" id="t-title" class="form-control" type="text" placeholder="Переезд" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="t-title-kk">Название (KK)</label>
                <input v-model="taskTitleKk" id="t-title-kk" class="form-control" type="text" placeholder="Көшу" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label" for="t-desc">Описание (RU) *</label>
                <input v-model="taskDesc" id="t-desc" class="form-control" type="text" placeholder="Всё для безопасной упаковки..." required />
              </div>
              <div class="form-group">
                <label class="form-label" for="t-desc-kk">Описание (KK)</label>
                <input v-model="taskDescKk" id="t-desc-kk" class="form-control" type="text" placeholder="Заттарды қауіпсіз қаптауға..." />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 15px;">
              <div class="form-group">
                <label class="form-label" for="t-sort-order">Порядок сортировки</label>
                <input v-model="taskSortOrder" id="t-sort-order" class="form-control" type="number" placeholder="0" />
              </div>
            </div>

            <div class="form-submit-actions" style="margin-top: 20px;">
              <button type="button" @click="closeTaskModal" class="btn btn-secondary">
                Отмена
              </button>
              <button type="submit" class="btn btn-primary" :disabled="catalogBlocked || isTaskSaving || saveIssue?.status === 404">
                {{ isTaskSaving ? 'Сохранение…' : uploadBusy ? 'Загрузка фото…' : 'Сохранить изменения' }}
              </button>
            </div>

            </fieldset>
          </form>
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped>
.catalog-actions, .form-fields { border: 0; padding: 0; margin: 0; min-width: 0; }
.catalog-actions { display: contents; }
.form-fields:disabled { opacity: .75; }
.save-feedback { margin: 12px 0; padding: 12px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; overflow-wrap: anywhere; }
.save-feedback button { margin: 8px 8px 0 0; }
.save-success { color: #166534; background: #f0fdf4; }
.save-error { color: #991b1b; background: #fff7ed; }
.save-feedback pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 220px; overflow: auto; font-size: 12px; margin-top: 8px; }
.conflict-columns { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin-top: 12px; }
.import-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.import-preview { max-height: 240px; overflow: auto; }
@media (max-width: 600px) { .conflict-columns { grid-template-columns: 1fr; } }

/* Advanced CSS styles matching elegant, premium dark glassmorphism storefront design system */
.admin-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-app);
  z-index: 1000;
  display: flex;
  font-family: var(--font-body);
  color: var(--text-ink);
  overflow: hidden;
}

/* LOGIN CONTAINER WITH ANIMATED COLOR GRADIENT MESH */
.login-container {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  position: relative;
  background: linear-gradient(-45deg, #0A0C0F, #171B24, #122219, #281D05);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  padding: 20px;
  overflow: hidden;
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Floating colored glowing mesh orbs */
.login-container::before,
.login-container::after {
  content: '';
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  filter: blur(130px);
  z-index: 0;
  opacity: 0.3;
  pointer-events: none;
}
.login-container::before {
  background: var(--primary);
  top: 15%;
  left: 20%;
  animation: floatOrb1 12s ease-in-out infinite alternate;
}
.login-container::after {
  background: var(--success);
  bottom: 15%;
  right: 20%;
  animation: floatOrb2 15s ease-in-out infinite alternate;
}

@keyframes floatOrb1 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(80px, 40px) scale(1.3); }
}
@keyframes floatOrb2 {
  0% { transform: translate(0, 0) scale(1.3); }
  100% { transform: translate(-80px, -50px) scale(0.9); }
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: rgba(18, 21, 27, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: var(--shadow-lg), 0 30px 60px rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-lg);
  padding: 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #FFFFFF;
  animation: scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleIn {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.login-brand {
  justify-content: center;
  margin-bottom: 4px;
}

.login-brand span {
  color: #FFFFFF;
}

.login-subtitle {
  font-size: 14px;
  color: #9CA3AF;
  margin-bottom: 12px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.login-form .form-label {
  color: #E5E7EB;
  text-align: left;
}

.login-form .form-control {
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #FFFFFF;
  transition: all var(--transition-fast);
}

.login-form .form-control:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(229, 169, 0, 0.3);
}

.login-submit-btn {
  width: 100%;
  height: 48px;
  margin-top: 8px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: #16181C;
  font-weight: 800;
  box-shadow: 0 4px 15px rgba(229, 169, 0, 0.2);
}

.login-submit-btn:hover {
  box-shadow: 0 6px 20px rgba(229, 169, 0, 0.35);
  transform: translateY(-2px);
}

.login-error-msg {
  color: #EF4444;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  line-height: 1.4;
}

.btn-back-to-shop {
  font-size: 13px;
  color: #9CA3AF;
  font-weight: 600;
  text-decoration: underline;
  transition: color var(--transition-fast);
  margin-top: 12px;
}

.btn-back-to-shop:hover {
  color: var(--primary);
}

/* SIDEBAR LAYOUT WITH NEON HARMONIES */
.dashboard-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
}

.dashboard-sidebar {
  width: 260px;
  background-color: var(--bg-paper);
  border-right: 1px solid var(--border-line);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: 5px 0 25px rgba(0, 0, 0, 0.02);
  z-index: 10;
}

body.dark-theme .dashboard-sidebar {
  box-shadow: 5px 0 25px rgba(0, 0, 0, 0.2);
}

.sidebar-brand {
  height: 76px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-line);
  display: flex;
  align-items: center;
  overflow: hidden;
}

.sidebar-brand img {
  max-height: 48px;
  width: auto;
  object-fit: contain;
}

.sidebar-nav {
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 20px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-lead);
  transition: all var(--transition-medium);
  text-align: left;
  border-left: 4px solid transparent;
}

.sidebar-nav-btn:hover {
  background-color: var(--bg-soft);
  color: var(--text-ink);
  padding-left: 24px;
}

.sidebar-nav-btn.active {
  background: linear-gradient(90deg, var(--primary-light), rgba(229, 169, 0, 0.01));
  color: var(--primary);
  border-left-color: var(--primary);
  font-weight: 800;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-line);
}

.sidebar-logout-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 42px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  color: #EF4444;
  font-weight: 600;
  font-size: 14px;
  transition: all var(--transition-fast);
}

.sidebar-logout-btn:hover {
  background-color: rgba(239, 68, 68, 0.08);
  transform: translateX(4px);
}

/* CONTENT CONTAINER */
.dashboard-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-app);
  overflow-y: auto;
}

.dashboard-header {
  height: 76px;
  padding: 0 32px;
  border-bottom: 1px solid var(--border-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-paper);
  flex-shrink: 0;
}

.dashboard-header h2 {
  font-size: 20px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.01em;
}

.dashboard-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-pane-content {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.fade-in {
  animation: fadeIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* METRICS PANEL */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.metric-card {
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-md);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-medium);
  position: relative;
  overflow: hidden;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md), 0 10px 25px rgba(0, 0, 0, 0.05);
  border-color: var(--primary);
}

body.dark-theme .metric-card:hover {
  box-shadow: var(--shadow-md), 0 10px 30px rgba(0, 0, 0, 0.3);
}

/* Beautiful color-gradient glowing indicator bands */
.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--success));
}

.metric-icon {
  width: 54px;
  height: 54px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: inset 0 2px 5px rgba(255, 255, 255, 0.05);
}

.metric-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.metric-val {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

/* DETAILS & QUICK ACTIONS */
.summary-details-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: 24px;
}

.details-card {
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-sm);
}

.details-card h3 {
  font-size: 18px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-line);
  padding-bottom: 12px;
}

.summary-category-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-category-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-soft);
  font-size: 14px;
}

.cat-name {
  font-weight: 600;
}

.cat-count-badge {
  background-color: var(--primary-light);
  color: var(--primary);
  font-weight: 700;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 99px;
}

.quick-actions-card {
  display: flex;
  flex-direction: column;
}

.quick-actions-btns {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.quick-actions-btns button {
  width: 100%;
}

.quick-help-info {
  margin-top: auto;
  background-color: var(--bg-soft);
  border-radius: var(--radius-md);
  padding: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-lead);
}

/* PRODUCT TAB TOOLBAR */
.toolbar-bar {
  display: flex;
  gap: 14px;
  align-items: center;
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
}

.toolbar-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-line);
  background-color: var(--bg-soft);
  border-radius: var(--radius-md);
  padding: 0 14px;
  height: 44px;
}

.toolbar-search-input {
  border: none;
  background: transparent;
  flex: 1;
  color: var(--text-ink);
  outline: none;
  font-size: 14px;
}

.toolbar-category-select {
  width: 220px;
  height: 44px;
}

.btn-add-prod {
  height: 44px;
  font-size: 14px;
  padding: 0 20px;
}

/* TABLE STYLING */
.table-container {
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.dashboard-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.dashboard-table th {
  background-color: var(--bg-soft);
  padding: 16px 20px;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-line);
}

.dashboard-table td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-line);
  font-size: 14px;
  vertical-align: middle;
}

.dashboard-table tr:last-child td {
  border-bottom: none;
}

.table-prod-img-box {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-soft);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.table-prod-img-box img {
  width: 85%;
  height: 85%;
  object-fit: contain;
}

.table-prod-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-prod-title-group strong {
  font-size: 15px;
  color: var(--text-ink);
}

.table-prod-id {
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
}

.table-category-tag {
  background-color: var(--bg-soft);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
}

.table-price-tag {
  font-weight: 800;
  font-family: var(--font-display);
}

.table-actions-cell {
  display: flex;
  gap: 8px;
}

.btn-table-action {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  transition: all var(--transition-fast);
  border: 1px solid var(--border-line);
  background-color: var(--bg-paper);
}

.btn-table-action.edit {
  color: var(--primary);
}

.btn-table-action.edit:hover {
  background-color: var(--primary-light);
  border-color: var(--primary);
}

.btn-table-action.delete {
  color: #EF4444;
}

.btn-table-action.delete:hover {
  background-color: rgba(239, 68, 68, 0.08);
  border-color: #EF4444;
}

.table-empty-row {
  text-align: center;
  color: var(--text-muted);
  padding: 48px !important;
}

/* CATEGORIES MANAGER */
.categories-manager-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 28px;
  align-items: start;
}

.cat-action-card,
.cat-list-card {
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-sm);
}

.cat-action-card h3,
.cat-list-card h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

.cat-action-card p {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.cat-dashboard-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
}

.cat-dashboard-item {
  border-bottom: 1px solid var(--border-line);
  padding-bottom: 10px;
}

.cat-dashboard-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.cat-display-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cat-title-text {
  font-weight: 600;
  font-size: 15px;
}

.cat-row-actions {
  display: flex;
  gap: 8px;
}

.cat-edit-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.cat-edit-row input {
  flex: 1;
  height: 38px;
}

.cat-edit-actions {
  display: flex;
  gap: 6px;
}

/* MODAL FORMS */
.modal-backdrop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 30px;
}

.product-form-modal {
  width: 100%;
  max-width: 800px;
  max-height: calc(100vh - 60px);
  background-color: var(--bg-paper);
  border: 1px solid var(--border-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.animate-fade-in {
  animation: fadeInModal 0.2s ease-out;
}

.animate-slide-up {
  animation: slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInModal {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUpModal {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  height: 64px;
  padding: 0 28px;
  border-bottom: 1px solid var(--border-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-size: 18px;
  text-transform: uppercase;
}

.btn-close-modal {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  background-color: var(--bg-soft);
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.btn-close-modal:hover {
  background-color: rgba(239, 68, 68, 0.08);
  color: #EF4444;
}

.modal-body-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

.product-creation-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}

.form-row-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.form-textarea {
  resize: vertical;
  padding-top: 10px;
  height: auto;
}

.form-divider {
  border: none;
  border-top: 1px solid var(--border-line);
  margin: 10px 0;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  border: 1px solid var(--border-line);
  border-radius: var(--radius-md);
  padding: 0 12px;
  background-color: var(--bg-paper);
}

.color-selector-input {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: none;
}

.color-hex-text {
  font-size: 13px;
  font-weight: 700;
  font-family: monospace;
}

/* Image Upload Widgets & Gallery */
.gallery-thumbs-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.gallery-thumbs-grid.compact {
  gap: 6px;
  margin-top: 4px;
  margin-bottom: 4px;
}

.gallery-thumb-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-line);
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.03);
}

.gallery-thumb-wrapper.compact {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-sm);
}

.gallery-thumb-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Main image highlight in unified gallery */
.gallery-thumb-wrapper.main-image-thumb {
  border: 2px solid #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
}

.main-image-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(34, 197, 94, 0.9);
  color: white;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  padding: 1px 0;
  letter-spacing: 0.3px;
}

.btn-set-main-img {
  position: absolute;
  bottom: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(234, 179, 8, 0.85);
  color: white;
  border: none;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  padding: 0;
  z-index: 5;
  opacity: 0;
}

.gallery-thumb-wrapper:hover .btn-set-main-img {
  opacity: 1;
}

.btn-set-main-img:hover {
  background: rgba(234, 179, 8, 1);
  transform: scale(1.15);
}

.btn-remove-gallery-img {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
  z-index: 5;
}

.btn-remove-gallery-img:hover {
  background: rgb(220, 38, 38);
}

.btn-toggle-size-gallery {
  background: none;
  border: 1px solid var(--border-line);
  color: var(--text-lead);
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-toggle-size-gallery:hover,
.btn-toggle-size-gallery.active {
  border-color: var(--primary);
  color: var(--primary);
  background-color: var(--primary-light);
}

.size-row-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-line);
  border-radius: var(--radius-md);
  background-color: rgba(255, 255, 255, 0.01);
  margin-bottom: 8px;
}

.size-links-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 4px;
}

.size-link-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.size-link-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.compact-input {
  height: 32px !important;
  font-size: 12px !important;
  padding: 4px 8px !important;
}

@media (max-width: 768px) {
  .size-links-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

.size-row-actions,
.spec-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-move-row {
  background: none;
  border: 1px solid var(--border-line);
  color: var(--text-lead);
  width: 34px;
  height: 38px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-move-row:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background-color: var(--primary-light);
}

.btn-move-row:disabled {
  opacity: 0.28;
  cursor: not-allowed;
  color: var(--text-muted);
  border-color: var(--border-line);
}

.size-gallery-section {
  padding-left: 20px;
  border-left: 2px solid var(--border-line);
  margin-top: 5px;
  animation: slideDown 0.25s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.image-input-container.compact {
  height: 32px;
}

.size-form-row {
  display: grid;
  grid-template-columns: 120px 120px 1fr auto;
  gap: 10px;
  align-items: center;
}

.size-image-preview {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-line);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  flex-shrink: 0;
}

.image-input-container {
  display: flex;
  gap: 8px;
  width: 100%;
}

.image-url-input {
  flex: 1;
  min-width: 0;
}

.btn-file-upload {
  height: 46px;
  width: 46px;
  padding: 0;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-line);
  background-color: var(--bg-soft);
  transition: all var(--transition-fast);
}

.btn-file-upload:hover {
  border-color: var(--primary);
  background-color: var(--primary-light);
  color: var(--primary);
}

.image-preview-thumbnail {
  margin-top: 8px;
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-line);
  overflow: hidden;
  background-color: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.btn-remove-preview-img {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  line-height: 1;
  transition: background-color 0.2s;
}

.btn-remove-preview-img:hover {
  background-color: rgba(225, 29, 42, 0.85);
}

/* Specs Dynamic Builder */
.specs-builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.specs-builder-header h4 {
  font-size: 15px;
}

.btn-small-action {
  height: 32px;
  font-size: 12px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
}

.specs-rows-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  align-items: center;
}

.spec-form-row input {
  height: 38px;
  font-size: 13px;
}

.btn-delete-spec-row {
  font-size: 24px;
  color: var(--text-muted);
  width: 32px;
  height: 38px;
  display: grid;
  place-items: center;
  transition: color var(--transition-fast);
}

.btn-delete-spec-row:hover {
  color: #EF4444;
}

.specs-empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px;
  background-color: var(--bg-soft);
  border-radius: var(--radius-md);
}

/* Tasks Priorities */
.tasks-priorities-section h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.tasks-priorities-section .section-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.tasks-priorities-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 20px;
  background-color: var(--bg-soft);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.task-priority-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.task-priority-title {
  font-size: 13px;
  font-weight: 600;
}

.priority-select {
  width: 170px;
  height: 36px;
  font-size: 12px;
  padding: 0 10px;
}

.form-submit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
}

/* ============================================================
   RESPONSIVE BREAKPOINTS — Full Mobile/Tablet/Desktop Coverage
   ============================================================ */

/* ---- TABLET (max-width: 1024px) ---- */
@media (max-width: 1024px) {
  .dashboard-sidebar {
    width: 220px;
  }

  .sidebar-nav-btn span {
    font-size: 13px;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-details-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .tasks-priorities-grid {
    grid-template-columns: 1fr;
  }

  .task-priority-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .priority-select {
    width: 100%;
  }
}

/* ---- SMALL TABLET (max-width: 900px) ---- */
@media (max-width: 900px) {
  .categories-manager-grid {
    grid-template-columns: 1fr;
  }

  .form-row-2 {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .form-row-3 {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* ---- MOBILE (max-width: 768px) ---- */
@media (max-width: 768px) {
  .admin-overlay {
    overflow-y: auto;
  }

  /* Sidebar becomes horizontal top navigation */
  .dashboard-wrapper {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }

  .dashboard-sidebar {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-line);
    flex-shrink: 0;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.04);
  }

  body.dark-theme .dashboard-sidebar {
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
  }

  .sidebar-brand {
    height: 56px;
    padding: 0 16px;
  }

  .sidebar-brand img {
    height: 28px;
  }

  .sidebar-nav {
    flex-direction: row;
    padding: 8px 12px;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .sidebar-nav::-webkit-scrollbar {
    display: none;
  }

  .sidebar-nav-btn {
    height: 38px;
    white-space: nowrap;
    padding: 0 14px;
    border-left: none;
    border-radius: var(--radius-md);
    flex-shrink: 0;
    font-size: 13px;
  }

  .sidebar-nav-btn:hover {
    padding-left: 14px;
  }

  .sidebar-nav-btn.active {
    border-left-color: transparent;
    background: var(--primary-light);
    border: 1px solid rgba(229, 169, 0, 0.25);
  }

  .sidebar-nav-btn .icon {
    width: 16px;
    height: 16px;
  }

  .sidebar-footer {
    display: none;
  }

  /* Dashboard Header */
  .dashboard-header {
    height: auto;
    min-height: 56px;
    padding: 12px 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .dashboard-header h2 {
    font-size: 16px;
  }

  .dashboard-header-actions {
    width: 100%;
    display: flex;
    gap: 8px;
  }

  .dashboard-header-actions .btn {
    flex: 1;
    height: 40px;
    font-size: 13px;
    padding: 0 12px;
  }

  /* Content Area */
  .dashboard-content {
    overflow-y: visible;
  }

  .tab-pane-content {
    padding: 16px;
    gap: 16px;
  }

  /* Metrics */
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .metric-card {
    padding: 16px;
    gap: 14px;
  }

  .metric-icon {
    width: 44px;
    height: 44px;
  }

  .metric-val {
    font-size: 20px;
  }

  /* Summary Details */
  .summary-details-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .details-card {
    padding: 20px;
  }

  .details-card h3 {
    font-size: 16px;
    margin-bottom: 14px;
    padding-bottom: 10px;
  }

  .summary-category-list li {
    padding: 6px 10px;
    font-size: 13px;
  }

  /* Toolbar */
  .toolbar-bar {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
    gap: 10px;
    border-radius: var(--radius-md);
  }

  .toolbar-search {
    height: 42px;
  }

  .toolbar-category-select {
    width: 100%;
    height: 42px;
  }

  .btn-add-prod {
    width: 100%;
    height: 42px;
  }

  /* Table: horizontally scrollable */
  .table-container {
    border-radius: var(--radius-md);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .dashboard-table {
    min-width: 600px;
  }

  .dashboard-table th,
  .dashboard-table td {
    padding: 12px 14px;
    font-size: 13px;
  }

  .table-prod-img-box {
    width: 40px;
    height: 40px;
  }

  .table-prod-title-group strong {
    font-size: 13px;
  }

  .table-prod-id {
    font-size: 10px;
  }

  /* Categories Manager */
  .categories-manager-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .cat-action-card,
  .cat-list-card {
    padding: 20px;
  }

  .cat-action-card h3,
  .cat-list-card h3 {
    font-size: 16px;
  }

  .cat-edit-row {
    flex-direction: column;
    gap: 8px;
  }

  .cat-edit-actions {
    width: 100%;
  }

  .cat-edit-actions .btn {
    flex: 1;
  }

  /* Modal: full-screen on mobile */
  .modal-backdrop-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .product-form-modal {
    max-width: 100%;
    max-height: 95vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    animation: slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUpMobile {
    from { transform: translateY(100%); opacity: 0.5; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-header {
    height: 56px;
    padding: 0 18px;
  }

  .modal-header h3 {
    font-size: 15px;
  }

  .modal-body-scroll {
    padding: 18px;
  }

  .product-creation-form {
    gap: 16px;
  }

  .form-row-2,
  .form-row-3 {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .spec-form-row {
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
  }

  .tasks-priorities-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px;
  }

  .task-priority-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .priority-select {
    width: 100%;
  }

  .form-submit-actions {
    flex-direction: column-reverse;
    gap: 8px;
  }

  .form-submit-actions .btn {
    width: 100%;
    height: 46px;
  }

  /* Login Screen */
  .login-card {
    padding: 28px 22px;
    max-width: 100%;
    border-radius: var(--radius-lg);
  }

  .login-container::before,
  .login-container::after {
    width: 200px;
    height: 200px;
  }
}

/* ---- SMALL MOBILE (max-width: 480px) ---- */
@media (max-width: 480px) {
  .sidebar-brand {
    height: 50px;
  }

  .sidebar-nav {
    padding: 6px 8px;
    gap: 4px;
  }

  .sidebar-nav-btn {
    height: 34px;
    padding: 0 10px;
    font-size: 12px;
    gap: 6px;
  }

  .sidebar-nav-btn .icon {
    width: 14px;
    height: 14px;
  }

  .dashboard-header h2 {
    font-size: 14px;
  }

  .dashboard-header-actions .btn {
    height: 38px;
    font-size: 12px;
    padding: 0 10px;
  }

  .tab-pane-content {
    padding: 12px;
    gap: 12px;
  }

  .metric-card {
    padding: 14px;
    gap: 12px;
  }

  .metric-icon {
    width: 40px;
    height: 40px;
  }

  .metric-icon .icon {
    width: 18px;
    height: 18px;
  }

  .metric-label {
    font-size: 11px;
  }

  .metric-val {
    font-size: 18px;
  }

  .details-card {
    padding: 16px;
  }

  .details-card h3 {
    font-size: 15px;
  }

  .summary-category-list li {
    font-size: 12px;
    padding: 6px 8px;
  }

  .cat-count-badge {
    font-size: 10px;
    padding: 3px 6px;
  }

  .quick-help-info {
    padding: 12px;
    font-size: 12px;
  }

  .toolbar-bar {
    padding: 10px;
    gap: 8px;
  }

  .toolbar-search {
    height: 40px;
    padding: 0 10px;
  }

  .toolbar-search-input {
    font-size: 13px;
  }

  .toolbar-category-select {
    height: 40px;
    font-size: 13px;
  }

  .btn-add-prod {
    height: 40px;
    font-size: 13px;
  }

  /* Table even smaller */
  .dashboard-table {
    min-width: 520px;
  }

  .dashboard-table th,
  .dashboard-table td {
    padding: 10px 10px;
    font-size: 12px;
  }

  .table-prod-img-box {
    width: 36px;
    height: 36px;
  }

  .table-prod-title-group strong {
    font-size: 12px;
  }

  .btn-table-action {
    width: 30px;
    height: 30px;
  }

  .btn-table-action .icon {
    width: 14px;
    height: 14px;
  }

  /* Categories */
  .cat-action-card,
  .cat-list-card {
    padding: 16px;
  }

  .cat-action-card h3,
  .cat-list-card h3 {
    font-size: 15px;
  }

  .cat-title-text {
    font-size: 13px;
  }

  .cat-display-row {
    gap: 8px;
  }

  /* Modal */
  .product-form-modal {
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header {
    height: 50px;
    padding: 0 14px;
  }

  .modal-header h3 {
    font-size: 14px;
  }

  .modal-body-scroll {
    padding: 14px;
  }

  .product-creation-form {
    gap: 14px;
  }

  .form-control {
    height: 42px;
    font-size: 14px;
  }

  .form-label {
    font-size: 12px;
  }

  .spec-form-row,
  .size-form-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .spec-form-row input,
  .size-form-row input {
    height: 36px;
    font-size: 12px;
  }

  .size-row-actions,
  .spec-row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    width: 100%;
    margin-top: 4px;
  }

  .size-row-actions .btn-delete-spec-row,
  .spec-row-actions .btn-delete-spec-row {
    width: 34px;
    height: 36px;
    justify-self: auto;
  }

  .btn-delete-spec-row {
    width: auto;
    height: 36px;
    font-size: 20px;
    justify-self: end;
  }

  .specs-builder-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .btn-small-action {
    width: 100%;
    justify-content: center;
  }

  .form-submit-actions .btn {
    height: 44px;
    font-size: 14px;
  }

  /* Login */
  .login-card {
    padding: 24px 18px;
    gap: 12px;
  }

  .login-brand span {
    font-size: 18px;
  }

  .login-subtitle {
    font-size: 13px;
  }

  .login-form {
    gap: 14px;
  }

  .login-submit-btn {
    height: 44px;
    font-size: 15px;
  }

  .login-container::before,
  .login-container::after {
    width: 160px;
    height: 160px;
  }
}

/* ---- ULTRA SMALL (max-width: 360px) ---- */
@media (max-width: 360px) {
  .sidebar-nav-btn span {
    font-size: 11px;
  }

  .sidebar-nav-btn .icon {
    display: none;
  }

  .dashboard-header h2 {
    font-size: 13px;
  }

  .dashboard-header-actions {
    flex-direction: column;
    gap: 6px;
  }

  .dashboard-header-actions .btn {
    width: 100%;
    font-size: 11px;
  }

  .metric-card {
    flex-direction: column;
    text-align: center;
    gap: 8px;
    padding: 12px;
  }

  .metric-val {
    font-size: 16px;
  }

  .details-card {
    padding: 14px;
  }

  .summary-category-list li {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .cat-display-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .cat-row-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .login-card {
    padding: 20px 14px;
  }

  .login-brand img {
    height: 28px;
  }

  .login-brand span {
    font-size: 16px;
  }

  .login-container::before,
  .login-container::after {
    width: 120px;
    height: 120px;
    filter: blur(90px);
  }
}

.visual-sort-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}
.visual-sort-card {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  position: relative;
  transition: box-shadow 0.2s;
}
.visual-sort-card:active {
  cursor: grabbing;
}
.visual-sort-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-color: var(--primary);
}
.sort-card-number {
  position: absolute;
  top: 8px;
  left: 8px;
  background: var(--primary);
  color: white;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  z-index: 2;
}
.sort-card-img {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.sort-card-img img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.sort-card-info {
  text-align: center;
  width: 100%;
}
.sort-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sort-card-id {
  font-size: 11px;
  color: var(--text-muted);
}
.sortable-ghost {
  opacity: 0.4;
  background: var(--surface-hover);
}

/* Sort Mode Selection */
.sort-mode-selection {
  padding: 30px 20px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-top: 20px;
}
.sort-mode-header {
  text-align: center;
  margin-bottom: 40px;
}
.sort-mode-header h3 {
  font-size: 20px;
  margin-bottom: 8px;
  color: var(--text-main);
}
.sort-mode-header p {
  color: var(--text-muted);
  font-size: 14px;
}
.sort-mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.sort-mode-card {
  background: var(--bg-body);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
}
.sort-mode-card:hover {
  border-color: var(--primary);
  transform: translateY(-4px);
  box-shadow: 0 12px 20px rgba(0,0,0,0.08);
}
.sort-mode-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: var(--primary);
}
.bg-primary-light { background: var(--primary-light, #eff6ff); color: var(--primary, #3b82f6); }
.bg-success-light { background: var(--success-light, #ecfdf5); color: var(--success, #10b981); }
.sort-mode-card h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}
.sort-mode-card p {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}
/* Sort Workspace Top Bar & Pills */
.sort-workspace-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  background: var(--surface);
  padding: 12px 18px;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-color);
  margin-bottom: 20px;
}

.sort-mode-pills {
  display: flex;
  gap: 8px;
  background: var(--bg-soft, #f3f4f6);
  padding: 4px;
  border-radius: var(--radius-md, 8px);
}

.sort-mode-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: all var(--transition-fast, 0.2s);
}

.sort-mode-pill-btn:hover {
  color: var(--text-lead);
}

.sort-mode-pill-btn.active {
  background: var(--surface, #ffffff);
  color: var(--primary, #111827);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

/* Interactive Cards Deck (Tasks & Categories) */
.sort-interactive-deck {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 14px);
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.02);
}

.deck-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
  gap: 15px;
  flex-wrap: wrap;
}

.deck-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-lead);
  margin: 0 0 4px 0;
}

.deck-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.deck-status-pill {
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  background: #ecfdf5;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #a7f3d0;
  white-space: nowrap;
}

/* Cards Grid */
.sort-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

/* Card item */
.sort-interactive-card {
  background: var(--bg-body, #ffffff);
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
  cursor: pointer;
  position: relative;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  user-select: none;
}

.sort-interactive-card:hover {
  transform: translateY(-3px);
  border-color: #cbd5e1;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
}

/* Active Highlight state (Matches Image 2) */
.sort-interactive-card.active {
  border: 2px solid #f59e0b !important;
  background: #fffdf2 !important;
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.2) !important;
}

body.dark-theme .sort-interactive-card.active {
  background: rgba(245, 158, 11, 0.12) !important;
  border-color: #f59e0b !important;
}

/* Card Control Bar */
.card-ctrl-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sort-card-drag-grip {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: grab;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}

.sort-card-drag-grip:hover {
  color: var(--primary);
  background: rgba(0, 0, 0, 0.04);
}

.grip-svg {
  width: 14px;
  height: 14px;
}

.card-num-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-soft, #f3f4f6);
  padding: 1px 6px;
  border-radius: 8px;
}

.card-arrows {
  display: flex;
  gap: 3px;
}

.btn-card-arrow {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border-line, #e2e8f0);
  background: var(--surface, #ffffff);
  color: var(--text-lead);
  font-size: 12px;
  font-weight: bold;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}

.btn-card-arrow:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light, #eff6ff);
}

.btn-card-arrow:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* Card Visual Icon/Image */
.card-icon-area {
  height: 52px;
  display: flex;
  align-items: center;
  margin: 4px 0 8px 0;
}

.task-img-element {
  max-height: 48px;
  max-width: 60px;
  object-fit: contain;
}

.cat-img-element {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.task-svg-element,
.cat-svg-element {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
}

.task-svg-element svg,
.cat-svg-element svg {
  width: 28px;
  height: 28px;
}

.card-main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-title-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-lead);
  line-height: 1.25;
  margin-bottom: 4px;
}

.card-desc-text {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}

.card-count-tag {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.card-active-tag {
  font-size: 11px;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  padding: 2px 7px;
  border-radius: 10px;
}

/* Drag ghost states */
.sortable-card-ghost {
  opacity: 0.35;
  transform: scale(0.97);
  border: 2px dashed var(--primary) !important;
}

.sortable-card-chosen {
  opacity: 0.9;
}

/* Products Sorting Workspace */
.sort-products-deck {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 14px);
  padding: 20px;
}

.sort-products-deck-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.sort-header-text h3 {
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 5px 0;
  color: var(--text-lead);
}

.sort-header-text p {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.highlight-entity {
  color: var(--primary);
  font-weight: 700;
}

.toolbar-search.compact {
  width: 280px;
}

.toolbar-search.compact .toolbar-search-input {
  height: 38px;
  font-size: 13px;
}

/* Zone header badges */
.zone-badge-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.zone-priority-1 {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left: 4px solid #ef4444;
}

.zone-priority-1 .zone-title { color: #991b1b; }

.zone-priority-2 {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left: 4px solid #f59e0b;
}

.zone-priority-2 .zone-title { color: #92400e; }

.zone-priority-3 {
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border-left: 4px solid #6b7280;
}

.zone-priority-3 .zone-title { color: #374151; }

.zone-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.zone-count-pill {
  font-size: 11px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
}

.zone-rank-badge {
  margin-left: auto;
  color: white;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.zone-priority-1 .zone-rank-badge { background: #ef4444; }
.zone-priority-2 .zone-rank-badge { background: #f59e0b; }
.zone-priority-3 .zone-rank-badge { background: #6b7280; }

.zone-empty-tip {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px;
  font-style: italic;
}

/* Product cards inline arrows */
.sort-card-inline-arrows {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 3px;
  opacity: 0.85;
}

.btn-card-mini-nav {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border-line, #e2e8f0);
  background: var(--surface, #ffffff);
  color: var(--text-lead);
  font-size: 11px;
  font-weight: bold;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}

.btn-card-mini-nav:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light, #eff6ff);
}

.btn-card-mini-nav:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .sort-cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .sort-workspace-top-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .sort-mode-pills {
    width: 100%;
    justify-content: center;
  }
  .toolbar-search.compact {
    width: 100%;
  }
}
</style>
