<script setup>
import {ref,computed,onMounted} from 'vue';
import {requestApi,currentUser,forgetAdmin} from '../adminApi.js';
const props=defineProps({state:{type:Object,required:true}});
const draft=computed({get:()=>props.state.draft,set:v=>{props.state.draft=v;}});
const busy=computed({get:()=>props.state.busy,set:v=>{props.state.busy=v;}});
const users=ref([]),loading=ref(false),error=ref(''),notice=ref('');
const labels={admin:'Администратор',editor:'Редактор'};
async function load() {
  loading.value=true;error.value='';
  try {users.value=(await requestApi('/api/users')).users;} catch(e) {error.value=e.message;}
  finally {loading.value=false;}
}
function open(mode,user=null) {
  if(busy.value || (draft.value && !confirm('Отменить текущие несохранённые изменения?'))) return;
  draft.value={mode,original:user?{...user}:null,login:user?.login||'',name:user?.name||'',role:user?.role||'editor',isActive:user?.isActive??true,temporaryPassword:''};
  error.value='';notice.value='';
}
function cancel() {if(!busy.value && confirm('Отменить несохранённые изменения?')) draft.value=null;}
function refreshDraft() {
  const user=users.value.find(u=>u.id===draft.value?.original?.id);
  if(user && confirm('Загрузить актуальные данные и отменить свои изменения?')) {draft.value=null;open('edit',user);}
}
async function save() {
  if(busy.value || !draft.value) return;
  const d=draft.value;
  let path='/api/users',method='POST',body;
  if(d.mode==='create') body={login:d.login,name:d.name,role:d.role,temporaryPassword:d.temporaryPassword};
  else {
    path+='/'+d.original.id;
    if(d.mode==='reset') {path+='/reset-password';body={updatedAt:d.original.updatedAt,temporaryPassword:d.temporaryPassword};}
    else {
      const changes={};
      for(const k of ['login','name','role','isActive']) if(d[k]!==d.original[k]) changes[k]=d[k];
      if(!Object.keys(changes).length) {notice.value='Нет изменений';return;}
      method='PATCH';body={updatedAt:d.original.updatedAt,changes};
    }
  }
  if(d.original?.id===currentUser.value.id && (d.mode==='reset' || !d.isActive || d.role!==currentUser.value.role || d.login!==currentUser.value.login)) {
    if(!confirm('Изменение завершит ваши сессии. Продолжить?')) return;
  }
  busy.value=true;error.value='';notice.value='';
  try {
    const result=await requestApi(path,{method,body});
    const index=users.value.findIndex(u=>u.id===result.user.id);
    if(index<0) users.value.push(result.user);else users.value[index]=result.user;
    draft.value=null;
    notice.value='Изменения сохранены';
    if(result.reauthenticate) forgetAdmin('Ваши данные входа изменены. Войдите снова.');
    else if(result.user.id===currentUser.value?.id) currentUser.value={...currentUser.value,login:result.user.login,name:result.user.name,role:result.user.role};
  } catch(e) {
    error.value=e.status?e.message:'Ответ не получен. Обновите список и проверьте историю перед повторной отправкой.';
    if(e.code==='USER_CONFLICT') {
      const index=users.value.findIndex(u=>u.id===e.data.current.id);
      if(index>=0) users.value[index]=e.data.current;
    }
  } finally {busy.value=false;}
}
onMounted(load);
</script>

<template>
  <section class="users-view">
    <div class="toolbar">
      <p>Личные аккаунты. Редактор управляет каталогом; администратор также управляет доступом и историей.</p>
      <button class="btn btn-primary" :disabled="busy" @click="open('create')">Создать аккаунт</button>
      <button class="btn btn-outline" :disabled="busy || loading" @click="load">Обновить список</button>
    </div>
    <p v-if="error" role="alert" class="error">{{error}}</p>
    <p v-if="notice" role="status" class="success">{{notice}}</p>
    <form v-if="draft" class="account-form" @submit.prevent="save">
      <h3>{{draft.mode==='create'?'Новый аккаунт':draft.mode==='reset'?'Сброс пароля':'Редактирование аккаунта'}}</h3>
      <fieldset :disabled="busy">
        <template v-if="draft.mode!=='reset'">
          <label>Имя<input v-model="draft.name" class="form-control" required maxlength="100" autocomplete="name"></label>
          <label>Логин<input v-model="draft.login" class="form-control" required minlength="3" maxlength="64" pattern="[a-zA-Z0-9](?:[a-zA-Z0-9._]|-){2,63}" autocomplete="off"></label><small>Латинские буквы, цифры, точка, дефис и подчёркивание.</small>
          <label>Роль<select v-model="draft.role" class="form-control"><option value="editor">Редактор</option><option value="admin">Администратор</option></select></label>
          <label v-if="draft.mode==='edit'" class="active-label"><input v-model="draft.isActive" type="checkbox"> Аккаунт активен</label>
        </template>
        <template v-if="draft.mode!=='edit'">
          <p v-if="draft.original">Аккаунт: {{draft.original.name}} ({{draft.original.login}})</p>
          <label>Временный пароль<input v-model="draft.temporaryPassword" class="form-control" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
          <small>Передайте пароль лично. При входе пользователь обязан заменить его. После сохранения пароль недоступен; при сбросе все сессии завершаются.</small>
        </template>
        <div class="actions">
          <button class="btn btn-primary" type="submit">{{busy?'Сохранение…':'Сохранить изменения'}}</button>
          <button class="btn btn-outline" type="button" @click="cancel">Отмена</button>
          <button v-if="draft.original && error" class="btn btn-outline" type="button" @click="refreshDraft">Загрузить актуальную версию</button>
        </div>
      </fieldset>
    </form>
    <p v-if="loading" role="status">Загрузка аккаунтов…</p>
    <div class="accounts">
      <article v-for="user in users" :key="user.id" class="account">
        <div><strong>{{user.name}}</strong><p>{{user.login}} · {{labels[user.role]}}</p><small>{{user.isActive?'Активен':'Отключён'}}{{user.mustChangePassword?' · Требуется смена пароля':''}}</small></div>
        <div class="actions">
          <button class="btn btn-outline" :disabled="busy" @click="open('edit',user)">Редактировать</button>
          <button class="btn btn-outline" :disabled="busy" @click="open('reset',user)">Сбросить пароль</button>
        </div>
      </article>
    </div>
    <p v-if="!loading && !error && !users.length">Аккаунтов нет.</p>
  </section>
</template>

<style scoped>
.users-view{max-width:1100px}.toolbar,.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.toolbar{margin-bottom:24px}.toolbar p{flex:1;min-width:200px}.account-form,.account{border:1px solid var(--border-color,#e2e8f0);background:var(--surface,#fff);border-radius:12px;padding:20px;margin-bottom:16px}.account-form{max-width:600px}.account-form h3{margin:0 0 20px}fieldset{border:0;padding:0;min-width:0}label{display:grid;gap:8px;margin-bottom:16px}small{color:var(--text-muted,#64748b);overflow-wrap:anywhere}.active-label{display:flex;align-items:center}.account{display:flex;justify-content:space-between;gap:16px;align-items:center}.account p{margin:6px 0}.actions{margin-top:16px}.error{color:#b91c1c;overflow-wrap:anywhere}.success{color:#15803d}@media(max-width:600px){.account{align-items:stretch;flex-direction:column}.actions .btn{flex:1}.account-form,.account{padding:16px}}
</style>
