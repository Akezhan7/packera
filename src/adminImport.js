import {makeUpdateOperation} from './adminApi.js';
const headers={
  id:['ID','Артикул'],title:['Title','Название'],price:['Price','Цена'],desc:['Description','Описание'],category:['Category','Категория'],
  unit:['Unit','Единица'],image:['Image','Фото'],images:['Images','Фотографии'],sizes:['Sizes','Размеры'],specs:['Specs','Характеристики'],
  kaspiLink:['KaspiLink','Ссылка Kaspi'],halykLink:['HalykLink','Ссылка Halyk'],forteLink:['ForteLink','Ссылка Forte'],
};
const normalize=value=>String(value).trim().toLowerCase();
const aliases=new Map(Object.entries(headers).flatMap(([field,names])=>names.map(name=>[normalize(name),field])));

export function prepareProductImport(rows,catalog) {
  if(!rows.length) throw new Error('Файл не содержит товаров.');
  const columns=new Map();
  const usedFields=new Set();
  for(const header of Object.keys(rows[0])) {
    const field=aliases.get(normalize(header));
    const task=normalize(header).startsWith('task:') ? String(header).trim().slice(5) : null;
    if(!field && !catalog.tasks.some(item=>item.id===task)) throw new Error(`Неизвестный столбец «${header}».`);
    const key=field || `task:${task}`;
    if(usedFields.has(key)) throw new Error(`Повторный столбец «${header}».`);
    usedFields.add(key); columns.set(header,key);
  }
  if(!['id','title','price'].every(field=>usedFields.has(field))) throw new Error('Нужны столбцы ID, Название, Цена (или ID, Title, Price).');
  const categoryOperations=[]; const operations=[]; const preview=[]; const ids=new Set();
  const categoryNames=new Set(catalog.categories.map(item=>item.name));
  for(const [index,row] of rows.entries()) {
    const draft={}; const levels={};
    for(const [header,field] of columns) {
      const raw=row[header];
      if(field.startsWith('task:')) {
        const level=raw==='' ? 0 : Number(raw);
        if(![0,1,2,3].includes(level)) throw new Error(`Строка ${index+2}: приоритет задачи должен быть 0–3.`);
        levels[field.slice(5)]=level;
      } else if(field==='price') {
        const price=typeof raw==='number' ? raw : Number(String(raw).replace(/\s/g,'').replace(',','.'));
        if(raw==='' || raw==null || !Number.isFinite(price) || price<0) throw new Error(`Строка ${index+2}: неверная цена.`);
        draft.price=price;
      } else if(['sizes','specs'].includes(field)) {
        try { draft[field]=raw==='' ? (field==='sizes'?[]:{}) : JSON.parse(String(raw)); }
        catch { throw new Error(`Строка ${index+2}: ${header} должен содержать JSON.`); }
      } else if(field==='images') draft.images=String(raw ?? '').split(';').map(value=>value.trim()).filter(Boolean);
      else draft[field]=String(raw ?? '').trim();
    }
    if(!draft.id || draft.id.length>200 || !draft.title) throw new Error(`Строка ${index+2}: заполните ID и название.`);
    if(ids.has(draft.id)) throw new Error(`Повторный ID «${draft.id}».`);
    ids.add(draft.id);
    const original=catalog.products.find(item=>item.id===draft.id);
    if(Object.keys(levels).length) {
      draft.tasks={...original?.tasks};
      for(const [id,level] of Object.entries(levels)) { if(level) draft.tasks[id]=level; else delete draft.tasks[id]; }
    }
    if(draft.category && !categoryNames.has(draft.category)) {
      categoryNames.add(draft.category);
      categoryOperations.push({entity:'categories',action:'create',data:{id:crypto.randomUUID(),name:draft.category,sortOrder:categoryNames.size-1}});
    }
    const baseline=original ? {...original,price:Number(original.price)} : null;
    const operation=original ? makeUpdateOperation('products',original,draft,baseline) : {entity:'products',action:'create',data:draft};
    if(operation) operations.push(operation);
    preview.push({id:draft.id,title:draft.title,action:original ? (operation ? 'Изменение':'Без изменений'):'Создание'});
  }
  if(categoryOperations.length+operations.length>2000) throw new Error('Максимум 2000 операций в одном импорте. Разделите файл.');
  return {operations:[...categoryOperations,...operations],preview,categoryCount:categoryOperations.length};
}
