/* BFC Smart Work local Laravel app. Account and task data use the private JSON store;
   localStorage is read only to offer an explicit import of older browser tasks. */
import { strFromU8, unzipSync } from 'fflate';
const root = document.getElementById('app');
const STORAGE_KEY = 'bfc-smart-work-demo-v2';
const LEGACY_STORAGE_KEY = 'bfc-smart-work-demo-v1';
const UI_STORAGE_KEY = 'bfc-smart-work-ui-v2';
const STORAGE_VERSION = 1;
const today = new Date(); today.setHours(12,0,0,0);
const addDays = (n) => {const d=new Date(today);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const sample = Array.isArray(window.BFC_DEMO?.tasks) ? window.BFC_DEMO.tasks : [];
const SECTIONS=[{id:'overview',name:'Tổng quan',icon:'layout'},{id:'goals',name:'Mục tiêu & KPI',icon:'target'},{id:'projects',name:'Dự án',icon:'folder'},{id:'tasks',name:'Công việc',icon:'check-square'},{id:'workflow',name:'Mindmap quy trình',icon:'map'},{id:'settings',name:'Cài đặt',icon:'settings'}];
const ICONS={
 'layout':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 'target':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 'folder':'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10H3z"/>',
 'check-square':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
 'chart':'<path d="M4 20h16M7 17V9M12 17V5M17 17v-6"/>',
 'settings':'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M19.4 15a2 2 0 0 1 .1 1.3l-1 1.7-2-.2a9 9 0 0 1-1.3.8l-.9 1.8h-2l-.9-1.8a9 9 0 0 1-1.4-.8l-2 .2-1-1.7a2 2 0 0 1 .1-1.3L6 13.6v-2l1.1-1.4a2 2 0 0 1-.1-1.3l1-1.7 2 .2a9 9 0 0 1 1.3-.8l.9-1.8h2l.9 1.8a9 9 0 0 1 1.4.8l2-.2 1 1.7-.1 1.3 1.1 1.4v2z"/>',
 'search':'<circle cx="10.9" cy="10.9" r="6.9"/><path d="m16 16 5 5"/>',
 'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
 'menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'chevron':'<path d="m7 10 5 5 5-5"/>',
 'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 'close':'<path d="M5 5l14 14M19 5 5 19"/>',
 'sparkles':'<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3ZM19 18l.6 1.4L21 20l-1.4.6L19 22l-.6-1.4L17 20l1.4-.6L19 18Z"/>',
 'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 'users':'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 4 5"/>',
 'list':'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
 'kanban':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16"/>',
 'download':'<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>',
 'moon':'<path d="M19 15a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"/>',
 'activity':'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
 'shield':'<path d="M12 2 20 6v6c0 5-4 8-8 10-4-2-8-5-8-10V6z"/>',
 'check':'<path d="m4 12 5 5L20 6"/>',
 'alert':'<path d="m12 3 10 18H2zM12 9v5m0 3v.5"/>',
 'send':'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
 'edit':'<path d="m3 21 5-.8L20 8l-4-4L4 16zM14 6l4 4"/>',
 'logout':'<path d="M10 4H4v16h6M15 7l5 5-5 5M20 12H9"/>',
 'file':'<path d="M6 2h9l4 4v16H6zM14 2v5h5"/>',
 'filter':'<path d="M3 5h18L14 13v6l-4 2v-8z"/>',
 'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>'
 ,'map':'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>'
};
function ic(name,size=18){return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.info}</svg>`}
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNum=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
const generateNextTaskId=()=>{const maxNum=(state.tasks||[]).reduce((max,t)=>{const m=String(t.id||'').match(/CV-(\d+)/i);return m?Math.max(max,parseInt(m[1],10)):max},1000);return `CV-${maxNum+1}`};
const dateHuman=(s)=>{if(!s)return 'Chưa đặt';const parts=String(s).slice(0,10).split('-');return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:s};
const deadlineHuman=task=>`${dateHuman(task.due)}${task.due_time?` · ${safe(task.due_time)}`:''}`;
const dateMonth=(s)=>{const a=String(s).slice(0,10).split('-');return [a[2],a[1]]};
const roleLabel=role=>state.authUser?.role_id===role?state.authUser.role_label:(state.users.find(user=>user.role_id===role)?.role_label||role);
const meUser=()=>state.authUser;
const meName=()=>state.authUser?.name||'';
const isSystemAdmin=()=>state.authUser?.role_id==='SYSTEM_ADMIN';
const isAdminView=()=>isSystemAdmin()&&state.workspaceMode==='admin';
const hasOversight=()=>state.permissions.includes('tasks.view_scoped');
const canAssignTasks=()=>state.permissions.includes('tasks.assign');
const canManage=()=>state.permissions.includes('tasks.edit_scoped')||canAssignTasks();
function employeePickerMarkup(context,selectedId=''){
 const selected=state.users.find(user=>user.id===selectedId);
 const id=`employee-search-${context}`;
 return `<div class="employee-picker" data-employee-picker="${safe(context)}"><input class="field" id="${id}" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" autocomplete="off" data-employee-search placeholder="Tìm theo tên, phòng ban hoặc chức danh" value="${safe(selected?.name||'')}"><input type="hidden" name="assigneeId" data-employee-id value="${safe(selected?.id||'')}"><input type="hidden" name="assignee" data-employee-name value="${safe(selected?.name||'')}"><div class="employee-picker-options" id="${id}-options" role="listbox" data-employee-options hidden></div><div class="small muted employee-picker-status" data-employee-status>${selected?`Đã chọn: ${safe(selected.name)}${selected.department?` · ${safe(selected.department)}`:''}`:'Chưa chọn người nhận.'}</div></div>`;
}
function renderEmployeeOptions(picker,query=''){
 const list=picker.querySelector('[data-employee-options]'),input=picker.querySelector('[data-employee-search]');
 if(!list||!input)return;
 const needle=normalizeForMatch(query).text.trim();
 const matches=state.users.filter(user=>!needle||normalizeForMatch([user.name,user.department,user.job_title,user.email].filter(Boolean).join(' ')).text.includes(needle)).slice(0,12);
 list.innerHTML=matches.length?matches.map(user=>`<button type="button" class="employee-option" role="option" aria-selected="${picker.querySelector('[data-employee-id]')?.value===user.id}" data-employee-option="${safe(user.id)}"><strong>${safe(user.name)}</strong><span>${safe([user.department,user.job_title,user.email].filter(Boolean).join(' · ')||'Thông tin hồ sơ chưa có')}</span></button>`).join(''):'<div class="employee-picker-empty">Không có nhân viên phù hợp trong phạm vi được phép giao việc.</div>';
 list.hidden=false;input.setAttribute('aria-expanded','true');
}
root.addEventListener('input',e=>{
 const input=e.target.closest('[data-employee-search]');
 if(!input)return;
 const picker=input.closest('[data-employee-picker]'),selectedId=picker?.querySelector('[data-employee-id]')?.value;
 if(!picker)return;
 const selected=state.users.find(user=>user.id===selectedId);
 if(selected&&normalizeForMatch(input.value).text!==normalizeForMatch(selected.name).text){
  picker.querySelector('[data-employee-id]').value='';picker.querySelector('[data-employee-name]').value='';
  picker.querySelector('[data-employee-status]').textContent='Hãy chọn một nhân viên trong danh sách gợi ý.';
  if(picker.dataset.employeePicker==='draft'&&state.pendingTaskDraft){state.pendingTaskDraft.assigneeId='';state.pendingTaskDraft.assignee='';const confirm=root.querySelector('[data-action="confirm-task-draft"]');if(confirm)confirm.disabled=true}
 }
 renderEmployeeOptions(picker,input.value);
});
root.addEventListener('focusin',e=>{
 const input=e.target.closest('[data-employee-search]');
 if(input)renderEmployeeOptions(input.closest('[data-employee-picker]'),input.value);
});
root.addEventListener('keydown',e=>{
 const input=e.target.closest('[data-employee-search]');
 if(!input)return;
 const picker=input.closest('[data-employee-picker]'),list=picker?.querySelector('[data-employee-options]');
 if(!picker||!list)return;
 if(e.key==='Escape'){list.hidden=true;input.setAttribute('aria-expanded','false');return}
 if((e.key==='ArrowDown'||e.key==='Enter')&&!list.hidden){
  e.preventDefault();
  const options=[...list.querySelectorAll('[data-employee-option]')];
  const exact=options.filter(option=>normalizeForMatch(state.users.find(user=>user.id===option.dataset.employeeOption)?.name||'').text===normalizeForMatch(input.value).text);
  if(e.key==='Enter'&&exact.length===1){exact[0].click();return}
  (options[0]||input).focus();
 }
});
root.addEventListener('click',e=>{
 const option=e.target.closest('[data-employee-option]');
 if(!option)return;
 const picker=option.closest('[data-employee-picker]'),user=state.users.find(item=>item.id===option.dataset.employeeOption);
 if(!picker||!user)return;
 picker.querySelector('[data-employee-search]').value=user.name;
 picker.querySelector('[data-employee-id]').value=user.id;
 picker.querySelector('[data-employee-name]').value=user.name;
 picker.querySelector('[data-employee-status]').textContent=`Đã chọn: ${user.name}${user.department?` · ${user.department}`:''}`;
 picker.querySelector('[data-employee-options]').hidden=true;
 picker.querySelector('[data-employee-search]').setAttribute('aria-expanded','false');
 if(picker.dataset.employeePicker==='draft'&&state.pendingTaskDraft){state.pendingTaskDraft.assigneeId=user.id;state.pendingTaskDraft.assignee=user.name;const confirm=root.querySelector('[data-action="confirm-task-draft"]');if(confirm)confirm.disabled=false}
});
const statuses={TODO:'Cần thực hiện',IN_PROGRESS:'Đang thực hiện',PAUSED:'Tạm dừng',IN_REVIEW:'Chờ duyệt',COMPLETED:'Hoàn thành'};
const tagClass={TODO:'todo',IN_PROGRESS:'progress',PAUSED:'paused',IN_REVIEW:'review',COMPLETED:'done'};
const priority={HIGH:'Cao',MEDIUM:'Trung bình',LOW:'Thấp'};
const priorities={HIGH:'high',MEDIUM:'medium',LOW:'low'};
function readStoredUi(){
  try {
    const stored = JSON.parse(localStorage.getItem(UI_STORAGE_KEY));
    return stored && typeof stored === 'object' ? stored : {};
  } catch (error) {
    return {};
  }
}
const storedUi=readStoredUi();
const boot=window.BFC_DEMO||{};
function readLegacyTasks(){try{const current=JSON.parse(localStorage.getItem(STORAGE_KEY));if(current?.version===STORAGE_VERSION&&Array.isArray(current.tasks))return current.tasks;const legacy=JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));return Array.isArray(legacy)?legacy:[]}catch(error){console.warn('Không thể đọc bản sao công việc cũ trên thiết bị.',error);return []}}
const localDate=new Date(),currentPeriod=`${localDate.getFullYear()}-${String(localDate.getMonth()+1).padStart(2,'0')}`;
const legacyTasks=readLegacyTasks();
const authUser=boot.authUser||null;
const workspaceMode=authUser?.role_id==='SYSTEM_ADMIN'&&storedUi.workspaceMode!=='employee'?'admin':'employee';
const initialPages=workspaceMode==='admin'?['settings']:SECTIONS.map(section=>section.id);
const state={tasks:Array.isArray(boot.tasks)?boot.tasks:[],serverTasks:Array.isArray(boot.tasks)?structuredClone(boot.tasks):[],users:Array.isArray(boot.assignableUsers)?boot.assignableUsers:[],reviewerUsers:Array.isArray(boot.reviewerUsers)?boot.reviewerUsers:[],authUser,permissions:Array.isArray(boot.permissions)?boot.permissions:[],notifications:Array.isArray(boot.notifications)?boot.notifications:[],kpiBank:boot.kpiBank&&Array.isArray(boot.kpiBank.kpis)?boot.kpiBank:null,departmentKpis:Array.isArray(boot.departmentKpis)?boot.departmentKpis:[],projects:Array.isArray(boot.projects)?boot.projects:[],projectModal:null,kpiBankView:Boolean(storedUi.kpiBankView),kpiAnalyticsView:Boolean(storedUi.kpiAnalyticsView),kpiBankSearch:'',kpiBankDepartment:'',kpiBankPerspective:'',goalNavOpen:typeof storedUi.goalNavOpen==='boolean'?storedUi.goalNavOpen:storedUi.page==='goals',adminData:null,adminLoading:false,legacyTasks,legacyImported:Boolean(authUser&&localStorage.getItem(`bfc-smart-work-legacy-imported-${authUser.id}`)),authScreen:'login',authMessage:'',adminMessage:'',workspaceMode,page:initialPages.includes(storedUi.page)?storedUi.page:(workspaceMode==='admin'?'settings':'tasks'),view:'list',filter:'all',search:'',theme:storedUi.theme==='dark'?'dark':'light',period:currentPeriod,kpiScope:storedUi.kpiScope||(['DEPARTMENT_MANAGER','SYSTEM_ADMIN'].includes(authUser?.role_id)?'department':'mine'),detail:null,modal:null,pendingTaskDraft:null,ai:false,aiMessages:[],aiBriefing:null,aiThinking:false,aiLoadingBriefing:false,mobile:false,login:!authUser,saveQueue:Promise.resolve()};
function save(){
  if(!state.authUser)return false;
  const snapshot=structuredClone(state.tasks);
  state.saveQueue=state.saveQueue.then(async()=>{
    const response=await fetch('/demo-work/tasks/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]')?.content||''},body:JSON.stringify({tasks:snapshot})});
    const body=await response.json();
    if(!response.ok)throw new Error(body.message||Object.values(body.errors||{}).flat().join(' ')||'Không thể lưu công việc.');
    state.tasks=body.tasks;state.serverTasks=structuredClone(body.tasks);layout();
  }).catch(error=>{
    console.error('Máy chủ từ chối hoặc không thể lưu công việc.',error);
    toast(error.message);
    window.setTimeout(()=>window.location.reload(),700);
  });
  return true;
}
function saveUi(){
  try {
    localStorage.setItem(UI_STORAGE_KEY,JSON.stringify({theme:state.theme,page:state.page,workspaceMode:state.workspaceMode,kpiBankView:state.kpiBankView,kpiAnalyticsView:state.kpiAnalyticsView,goalNavOpen:state.goalNavOpen,kpiScope:state.kpiScope}));
  } catch (error) {
    console.warn('Không thể lưu tùy chọn giao diện.', error);
  }
}
function overdue(t){if(['COMPLETED','IN_REVIEW'].includes(t.status))return false;const todayString=localDateString(new Date());if(t.due<todayString)return true;if(t.due>todayString||!t.due_time)return false;const [hour,minute]=t.due_time.split(':').map(Number),now=new Date();return now.getHours()*60+now.getMinutes()>hour*60+minute}
function visibleTasks(){return state.tasks}
function stats(){const t=visibleTasks();return {all:t.length,active:t.filter(x=>x.status==='IN_PROGRESS').length,review:t.filter(x=>x.status==='IN_REVIEW').length,done:t.filter(x=>x.status==='COMPLETED').length,overdue:t.filter(overdue).length,avg:t.length?Math.round(t.reduce((a,b)=>a+(Number(b.progress)||0),0)/t.length):0};}
function incompleteSubtasks(task){return (Array.isArray(task.subtasks)?task.subtasks:[]).filter(item=>!item.done)}
function requireCompletedSubtasks(task){const incomplete=incompleteSubtasks(task);if(!incomplete.length)return true;toast(`Chưa thể hoàn tất công việc cha: còn ${incomplete.length} công việc con chưa hoàn thành.`);return false}
function roleAllowed(t,action){const person=meName();if(action==='read')return state.tasks.some(item=>item.id===t.id);if(action==='edit')return canManage()||t.assignee===person||t.creator===person;if(action==='submit'||action==='checkin'||action==='start')return Boolean(meUser())&&(t.assignee===person||canAssignTasks());if(action==='approve')return state.permissions.includes('tasks.review')&&t.reviewer_id===state.authUser?.id;if(action==='create')return state.permissions.includes('tasks.create');return false}
function displayStatus(t){const reviewer=t.review?(state.reviewerUsers.find(user=>user.id===t.reviewer_id)?.name||(t.reviewer_id?'Người nghiệm thu đã chỉ định':'Chưa chỉ định người nghiệm thu')):'';return `<span class="tag ${tagClass[t.status]||'todo'}">${safe(statuses[t.status]||'Cần thực hiện')}</span>${reviewer?`<span class="small muted">${safe(reviewer)}</span>`:''}`}
function brand(){return `<span class="brandmark" aria-label="Dấu hiệu nhận diện tạm thời BFC">BFC</span>`}
function layout(){
 document.documentElement.setAttribute('data-theme',state.theme);
 if(!state.authUser){root.innerHTML=authPage();return}
 const isAdmin=isSystemAdmin(),adminView=isAdminView(),sections=adminView?SECTIONS.filter(x=>x.id==='settings'):SECTIONS;
 if(!sections.some(x=>x.id===state.page))state.page=adminView?'settings':'tasks';
 const current=sections.find(x=>x.id===state.page)||{name:state.page==='reports'?'Báo cáo':'Cài đặt'};
 const navItem=section=>section.id==='goals'?`<div class="nav-group ${state.page==='goals'?'is-current':''}"><button type="button" class="nav-link nav-parent ${state.page==='goals'?'active':''}" data-goals-toggle aria-expanded="${state.goalNavOpen}" aria-controls="goalSubnav">${ic(section.icon)}<span>${section.name}</span><span class="nav-chevron">${ic('chevron',15)}</span></button><div class="nav-submenu ${state.goalNavOpen?'is-open':''}" id="goalSubnav" aria-hidden="${!state.goalNavOpen}" ${state.goalNavOpen?'':'inert'}><button type="button" class="nav-sublink ${!state.reportView&&!state.kpiBankView&&!state.kpiAnalyticsView?'active':''}" data-kpi-view="score" ${!state.reportView&&!state.kpiBankView&&!state.kpiAnalyticsView?'aria-current="page"':''}>KPI công việc</button><button type="button" class="nav-sublink ${!state.reportView&&state.kpiBankView?'active':''}" data-kpi-view="bank" ${!state.reportView&&state.kpiBankView?'aria-current="page"':''}>Ngân hàng KPI demo 2026</button><button type="button" class="nav-sublink ${!state.reportView&&state.kpiAnalyticsView?'active':''}" data-kpi-view="analytics" ${!state.reportView&&state.kpiAnalyticsView?'aria-current="page"':''}>Phân tích danh mục KPI</button></div></div>`:`<button type="button" class="nav-link ${section.id===state.page?'active':''}" data-page="${section.id}" ${section.id===state.page?'aria-current="page"':''}>${ic(section.icon)}<span>${section.name}</span></button>`;
 root.innerHTML=`<div class="app"><aside class="sidebar ${state.mobile?'mobile-open':''}" aria-label="Điều hướng chính"><div class="brand">${brand()}<div><span class="brandname">BFC Smart Work</span><span class="brandsub">Không gian làm việc</span></div></div><div class="nav-head">Không gian làm việc</div><nav class="nav">${sections.map(navItem).join('')}</nav><div class="side-bottom"><span class="sample-chip">LƯU TRÊN MÁY CHỦ CỤC BỘ</span><div class="side-sub">${ic('shield',16)}<span>Chế độ local · Không đồng bộ máy khác</span></div></div></aside><main class="main"><header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="icon-btn menu-btn" data-action="menu" aria-label="Mở điều hướng">${ic('menu')}</button><div><p class="top-title">Không gian BFC / BFC Smart Work</p><div class="crumb">${safe(current.name)}</div></div></div><div class="top-actions">${!adminView?`<label class="search">${ic('search')}<input id="globalSearch" aria-label="Tìm công việc" placeholder="Tìm nhanh công việc..." value="${safe(state.search)}"></label>`:''}${isAdmin?`<button class="btn workspace-switch" data-action="workspace-switch">${adminView?'Không gian nhân viên':'Quản trị hệ thống'}</button>`:''}<div class="auth-identity"><strong>${safe(meName())}</strong><span>${safe(state.authUser.role_label)}</span></div><button class="icon-btn" data-action="logout" title="Đăng xuất" aria-label="Đăng xuất">${ic('logout')}</button></div></header><div class="content">${renderPage()}</div></main></div>${state.mobile?'<div class="mobile-backdrop" data-action="menu"></div>':''}${adminView?'':mascotHTML()}${state.detail?detailHTML():''}${(state.modal||state.projectModal)?modalHTML():''}${state.ai?aiHTML():''}<div class="toast" role="status" id="toast" hidden></div>`;
 if(adminView&&!state.adminData&&!state.adminLoading&&!state.adminMessage)loadAdminData();
}
function initials(x){return x.split(' ').slice(-2).map(x=>x[0]).join('').toUpperCase()}
function pageHeader(eyebrow,title,desc,actions=''){actions=actions.replace('Dữ liệu mẫu','Dữ liệu theo phạm vi');return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div><div class="page-actions">${actions}</div></div>`}
function taskCreateButton(){return state.permissions.includes('tasks.create')?`<button class="btn btn-primary" data-action="create">${ic('plus')} Tạo công việc</button>`:''}
function statBlock(label,value,foot,accent=false,icon=''){const shown=typeof value==='string'&&value.endsWith('%')?safe(value):fmtNum(value);if(foot==='Trong dữ liệu mẫu')foot='Trong phạm vi tài khoản';return `<div class="stat-card"><div class="stat-label">${label}<span class="stat-icon">${icon?ic(icon):''}</span></div><div class="stat-value ${accent?'accent':''}">${shown}</div><div class="stat-foot">${foot}</div></div>`}
function card(content,className=''){return `<section class="card ${className}">${content}</section>`}
function sectionHead(title,btn=''){return `<div class="card-head"><h2>${title}</h2>${btn}</div>`}
function currentTasks(){let t=visibleTasks();const me=meName();if(state.filter==='mine')t=t.filter(x=>x.assignee===me);if(state.filter==='assigned')t=t.filter(x=>x.creator===me);if(state.filter==='follow')t=t.filter(x=>(x.watchers||[]).includes(me));const q=state.search.trim().toLowerCase();if(q)t=t.filter(x=>[x.title,x.id,x.project,x.assignee].join(' ').toLowerCase().includes(q));return t}
function tab(label,val){return `<button class="tab ${state.filter===val?'active':''}" data-filter="${val}">${label}</button>`}
function taskTable(ts,compact=false){return `<div class="table-wrap"><table class="task-table"><thead><tr><th>Công việc</th><th>Phụ trách</th><th>Tiến độ</th><th>Hạn xử lý</th><th>Trạng thái</th></tr></thead><tbody>${ts.map(t=>`<tr><td><button class="task-open" data-task="${safe(t.id)}"><div class="task-name">${safe(t.title)}</div><div class="task-sub">${safe(t.id)} · ${safe(t.project)}</div></button></td><td><div style="display:flex;align-items:center;gap:7px"><div class="avatar-mini">${safe(initials(t.assignee))}</div><span>${safe(t.assignee)}</span></div></td><td><div class="progress-wrap"><div class="progressbar"><span style="width:${Math.max(0,Math.min(100,t.progress))}%"></span></div><span class="progress-num">${fmtNum(t.progress)}%</span></div></td><td>${deadlineHuman(t)} ${overdue(t)?`<div style="margin-top:5px"><span class="tag late">Quá hạn</span></div>`:''}</td><td>${displayStatus(t)}</td></tr>`).join('')}</tbody></table>${!ts.length?'<div class="empty">Không tìm thấy công việc phù hợp.</div>':''}</div><div class="mobile-task-list">${ts.map(t=>`<button class="mobile-task-card" data-task="${safe(t.id)}"><div class="mobile-card-top"><strong>${safe(t.title)}</strong>${displayStatus(t)}</div><div class="small muted">${safe(t.project)} · ${safe(t.assignee)}</div><div class="mobile-card-bottom"><div class="progressbar"><span style="width:${t.progress}%"></span></div><span>${fmtNum(t.progress)}%</span><span>${ic('calendar',14)} ${deadlineHuman(t)}</span></div>${overdue(t)?'<span class="tag late" style="margin-top:8px">Quá hạn</span>':''}</button>`).join('')}</div>${!compact?`<div class="list-note">Hiển thị ${fmtNum(ts.length)} công việc · Nhấn vào tên để mở chi tiết và cập nhật.</div>`:''}`}
function taskBoard(ts){const columns=[{id:'TODO',label:'Cần thực hiện'},{id:'IN_PROGRESS',label:'Đang thực hiện'},{id:'IN_REVIEW',label:'Chờ duyệt'},{id:'COMPLETED',label:'Hoàn thành'}];return `<div class="board-hint">${ic('info',15)} Kéo thẻ sang cột khác để chuyển giai đoạn. Trên điện thoại, dùng danh sách chuyển giai đoạn trên thẻ. Quyền, tiến độ và công việc con vẫn được kiểm tra.</div><div class="board">${columns.map(c=>{const inColumn=ts.filter(t=>t.status===c.id||(c.id==='IN_PROGRESS'&&t.status==='PAUSED'));return `<div class="board-col" data-kanban-status="${c.id}" aria-label="Thả công việc vào cột ${c.label}"><div class="board-head">${c.label}<span class="tag todo">${fmtNum(inColumn.length)}</span></div>${inColumn.map(t=>`<div class="board-task" tabindex="0" role="button" draggable="true" aria-label="Kéo để chuyển giai đoạn hoặc mở chi tiết: ${safe(t.title)}" data-task="${safe(t.id)}"><div class="board-task-grip" aria-hidden="true">⠿ <span>Kéo để chuyển</span></div><h4>${safe(t.title)}</h4>${displayStatus(t)}<div class="small muted">${safe(t.project)}</div><div class="mini-footer"><span>${deadlineHuman(t)}</span><span>${fmtNum(t.progress)}%</span></div><select class="board-move-select" data-board-move="${safe(t.id)}" aria-label="Chuyển giai đoạn cho ${safe(t.title)}"><option value="">Chuyển giai đoạn...</option>${columns.filter(option=>option.id!==t.status).map(option=>`<option value="${option.id}">${option.label}</option>`).join('')}</select></div>`).join('')||'<div class="board-empty">Thả công việc vào đây</div>'}</div>`}).join('')}</div>`}
function rightTasks(){const relevant=visibleTasks().filter(x=>x.status!=='COMPLETED').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4);return card(`${sectionHead('Sắp đến hạn','<span class="small muted">Ưu tiên</span>')}${relevant.map(t=>{const [day,mon]=dateMonth(t.due);return `<div class="calendar-item"><div class="datebox">${day}<small>TH ${mon}</small></div><div style="min-width:0"><div class="cal-title">${safe(t.title)}</div><div class="cal-sub">${safe(t.assignee)}</div><div style="margin-top:7px">${overdue(t)?'<span class="tag late">Đã quá hạn</span>':displayStatus(t)}</div></div></div>`}).join('')}`,'right-card')}
function renderPage(){switch(state.page){case 'tasks':return pageTasks();case 'overview':return pageOverviewScoped();case 'goals':return `${state.reportView?pageReportsScoped():state.kpiBankView||state.kpiAnalyticsView?pageKpiBank():pageKpi()}${state.reportView?'<div class="page-actions" style="margin-top:16px"><button class="btn" data-page="goals">Quay lại KPI</button></div>':'<div class="page-actions" style="margin-top:16px"><button class="btn" data-page="reports">Mở báo cáo công việc</button></div>'}`;case 'projects':return pageProjects();case 'workflow':return pageWorkflowMap();case 'reports':return pageReportsScoped();case 'settings':return pageSettings();}}
function usersPanelForRole(){return ''}
function pageOverviewScoped(){const s=stats(),tasks=visibleTasks().filter(t=>t.status!=='COMPLETED').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);return `${pageHeader('TỔNG QUAN','Tổng quan công việc',`Tình hình công việc của ${safe(meName())}.`,taskCreateButton())}<div class="grid stats">${statBlock('Công việc',s.all,'Trong phạm vi hồ sơ',false,'list')}${statBlock('Đang thực hiện',s.active,'',false,'activity')}${statBlock('Chờ duyệt',s.review,'',true,'clock')}${statBlock('Hoàn thành',s.done,'',false,'check')}</div>${card(`${sectionHead('Công việc cần chú ý')}${tasks.length?tasks.map(t=>`<div class="list-line"><div><strong>${safe(t.title)}</strong><div class="description">${safe(t.assignee)} · Hạn ${dateHuman(t.due)}</div></div>${overdue(t)?'<span class="tag late">Quá hạn</span>':displayStatus(t)}</div>`).join(''):'<div class="empty">Chưa có công việc trong phạm vi của hồ sơ này.</div>'}`)}`}
function pageReportsScoped(){const s=stats(),tasks=visibleTasks();return `${pageHeader('BÁO CÁO','Báo cáo công việc',`Tổng hợp dữ liệu trong phạm vi ${safe(meName())}.`,'<button class="btn btn-primary" data-action="export">'+ic('download')+' Xuất CSV</button>')}<div class="grid stats">${statBlock('Tổng công việc',s.all,'',false,'list')}${statBlock('Hoàn thành',s.done,'',false,'check')}${statBlock('Chờ duyệt',s.review,'',true,'clock')}${statBlock('Quá hạn',s.overdue,'',false,'alert')}</div>${card(`${sectionHead('Phân bố trạng thái')}${[{id:'TODO',name:'Cần thực hiện'},{id:'IN_PROGRESS',name:'Đang thực hiện'},{id:'IN_REVIEW',name:'Chờ duyệt'},{id:'COMPLETED',name:'Hoàn thành'},{id:'PAUSED',name:'Tạm dừng'}].map(row=>`<div class="chartbar"><div class="title">${row.name}</div><div class="progressbar"><span style="width:${s.all?100*tasks.filter(task=>task.status===row.id).length/s.all:0}%"></span></div><div class="pct">${tasks.filter(task=>task.status===row.id).length}</div></div>`).join('')}<p class="small muted">KPI cá nhân được tính theo kỳ trong mục Mục tiêu & KPI; không gộp điểm khi chưa có trọng số được thống nhất.</p>`)}`}
function pageTasks(){const s=stats(),t=currentTasks();return `${pageHeader('TRUNG TÂM CÔNG VIỆC','Công việc của BFC','Theo dõi, giao việc và check-in nhanh trong một nơi.',taskCreateButton())}<div class="grid stats">${statBlock('Tổng công việc',s.all,'Trong dữ liệu mẫu',false,'list')}${statBlock('Đang thực hiện',s.active,'Cần cập nhật tiến độ',false,'activity')}${statBlock('Chờ phê duyệt',s.review,'Kết quả đã được nộp',true,'clock')}${statBlock('Quá hạn',s.overdue,'Cần ưu tiên xử lý',false,'alert')}</div><div class="task-layout"><div>${card(`<div class="toolbar"><div class="tabs">${tab('Tất cả','all')}${tab('Tôi làm','mine')}${tab('Tôi giao','assigned')}${tab('Tôi theo dõi','follow')}</div><div class="tabs"><button class="tab ${state.view==='list'?'active':''}" data-view="list">${ic('list')} Danh sách</button><button class="tab ${state.view==='board'?'active':''}" data-view="board">${ic('kanban')} Kanban</button></div></div>${state.view==='list'?taskTable(t):taskBoard(t)}`)}</div><div>${rightTasks()}<div class="ai-tip"><div class="tip-icon">${ic('sparkles',23)}</div><div><h3>Gợi ý cho bạn</h3><p>Đang có <strong>${fmtNum(s.overdue)}</strong> công việc quá hạn. Nhấn Trợ lý AI để xem gợi ý xử lý từ dữ liệu Demo.</p><button class="btn btn-min" data-action="ai" style="padding-left:0;margin-top:9px;font-size:12px">Xem gợi ý ${ic('arrow-right',16)}</button></div></div></div></div>`}
function pageWorkflowMap(){const branches=[
 {number:'01',title:'Đăng nhập & cấp quyền',tone:'violet',icon:'users',steps:['Nhân viên đăng ký bằng email thuộc miền công ty đã cấu hình; tài khoản bắt đầu ở trạng thái chờ duyệt.','SYSTEM_ADMIN xem yêu cầu, chấp thuận/từ chối/yêu cầu bổ sung và cấp vai trò cùng phạm vi dữ liệu.','Nhân viên và quản trị viên dùng chung trang đăng nhập; tài khoản chưa duyệt hoặc bị khóa không truy cập được.'],action:'settings',label:'Mở Cài đặt'},
 {number:'02',title:'Chuyển không gian làm việc',tone:'amber',icon:'shield',steps:['SYSTEM_ADMIN đăng nhập bằng tài khoản hiện có như nhân viên; chỉ tài khoản này thấy nút chuyển không gian.','Chọn Quản trị hệ thống để quản lý yêu cầu, tài khoản, vai trò, phạm vi và nhật ký.','Tại trang quản trị, chọn Không gian nhân viên để quay lại; chuyển không gian không làm thay đổi quyền nghiệp vụ.'],action:'settings',label:'Mở Cài đặt',extra:'admin'},
 {number:'03',title:'Tạo & giao việc cha',tone:'blue',icon:'send',steps:['Người có quyền tạo việc nhập mục tiêu, mô tả, kết quả cần đạt, người phụ trách, dự án, hạn và ưu tiên; chọn có cần nghiệm thu hay không.','Có thể dùng Trợ lý AI để soạn nháp; người giao kiểm tra thông tin rồi xác nhận mới lưu và giao cho người phụ trách.','Sau khi tạo, mở chi tiết công việc cha để chia nhỏ thành các đầu việc con cụ thể, có thể kiểm tra được.','Việc con hiện là checklist thuộc việc cha, do người phụ trách việc cha thực hiện; chưa hỗ trợ giao riêng từng việc con cho người khác.'],action:'tasks',label:'Mở Công việc',extra:'ai'},
 {number:'04',title:'Thực hiện & hoàn thành việc con',tone:'green',icon:'activity',steps:['Người phụ trách xem các đầu việc con trong chi tiết công việc cha và thực hiện lần lượt.','Đánh dấu từng việc con hoàn thành sau khi đạt yêu cầu; tiến độ tổng của công việc cha được cập nhật từ checklist.','Có việc con chưa hoàn thành thì hệ thống chặn gửi nghiệm thu hoặc kết thúc công việc cha; trạng thái con không thể bị bỏ qua.','Check-in, bình luận và cập nhật tiến độ ghi lại quá trình; quyền thao tác được Laravel kiểm tra ở máy chủ.'],action:'tasks',label:'Theo dõi công việc'},
 {number:'05',title:'Nộp việc cha & nghiệm thu',tone:'rose',icon:'check',steps:['Chỉ nộp hoặc hoàn tất việc cha khi tiến độ đạt 100% và tất cả việc con đã được đánh dấu hoàn thành.','Nếu cần nghiệm thu, việc cha chuyển sang Chờ duyệt; người có quyền trong đúng phạm vi duyệt hoặc trả lại để bổ sung.','Nếu không cần nghiệm thu, người phụ trách hoàn tất trực tiếp sau khi đủ điều kiện; Kanban cũng không bỏ qua các kiểm tra này.'],action:'tasks',label:'Theo dõi trạng thái'},
 {number:'06',title:'Theo dõi dự án, KPI & báo cáo',tone:'blue',icon:'chart',steps:['Dự án tổng hợp công việc theo dự án; KPI và báo cáo chỉ dùng dữ liệu trong phạm vi tài khoản được phép xem.','Theo dõi tỷ lệ hoàn thành, đúng hạn, có check-in và đạt duyệt; các chỉ số hiển thị riêng, không cộng thành điểm tổng.','Có thể xem báo cáo và xuất CSV; KPI hiện là minh họa, chưa phải công thức doanh nghiệp đã xác nhận.'],action:'goals',label:'Mở Mục tiêu & KPI',extra:'reports'}
 ];return `${pageHeader('HƯỚNG DẪN KHÔNG GIAN LÀM VIỆC','Mindmap quy trình quản lý công việc','Sơ đồ thể hiện các luồng tài khoản, phân quyền và quản lý công việc theo cập nhật mới nhất.')}${card(`<p class="mindmap-hint">Luồng tổng thể: đăng nhập/cấp quyền → chọn không gian phù hợp → giao việc → thực hiện → nghiệm thu → theo dõi KPI. Nhánh quản trị chỉ dành cho SYSTEM_ADMIN.</p><div class="mindmap-diagram"><div class="mindmap-root">${ic('map',22)}<div><strong>Quy trình quản lý công việc</strong><span>Đăng nhập → phân quyền → giao việc → thực hiện → nghiệm thu → KPI</span></div></div><div class="mindmap-tree">${branches.map(branch=>`<article class="mindmap-branch ${branch.tone}"><div class="mindmap-branch-head"><span class="mindmap-number">${branch.number}</span><span class="mindmap-icon">${ic(branch.icon,19)}</span><h2>${branch.title}</h2></div><ol class="mindmap-leaves">${branch.steps.map(step=>`<li>${step}</li>`).join('')}</ol><div class="mindmap-actions"><button class="btn btn-min" data-page="${branch.action}">${branch.label} ${ic('arrow-right',15)}</button>${branch.extra==='ai'?'<button class="btn btn-min" data-action="ai">Mở Trợ lý AI</button>':''}${branch.extra==='reports'?'<button class="btn btn-min" data-page="reports">Mở Báo cáo</button>':''}${branch.extra==='admin'&&isSystemAdmin()&&state.workspaceMode==='employee'?'<button class="btn btn-min" data-action="workspace-switch">Mở Quản trị hệ thống</button>':''}</div></article>`).join('')}</div></div><div class="mindmap-note">${ic('info',17)}<span>Quyền công việc được kiểm tra phía Laravel; dữ liệu tài khoản, quyền, nhật ký và công việc lưu ở kho JSON riêng tư trên máy local. Email chưa xác minh quyền sở hữu; Trợ lý AI chạy quy tắc cục bộ; KPI mang tính minh họa; dữ liệu chưa đồng bộ giữa các máy.</span></div>`,'mindmap-card')}`}
function pageOverview(){const s=stats();return `${pageHeader('CHÀO MỪNG TRỞ LẠI','Tổng quan công việc','Tình hình thực hiện tại BFC trong dữ liệu minh họa.',taskCreateButton())}<div class="grid stats">${statBlock('Công việc đang mở',s.all-s.done,'Tất cả phòng ban',false,'activity')}${statBlock('Hoàn thành',s.done,'Đã chốt kết quả',false,'check')}${statBlock('Chờ phê duyệt',s.review,'Cần người có thẩm quyền',true,'clock')}${statBlock('Tiến độ trung bình',s.avg+'','%',false,'chart')}</div><div class="card-row">${card(`${sectionHead('Công việc cần chú ý',`<button class="btn btn-min" data-page="tasks">Xem tất cả ${ic('arrow-right')}</button>`)}${state.tasks.filter(t=>t.status!=='COMPLETED').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5).map(t=>`<div class="list-line"><div class="project-icon" style="height:34px;width:34px">${ic('check-square',17)}</div><div style="min-width:0;flex:1"><button class="task-open name" data-task="${safe(t.id)}">${safe(t.title)}</button><div class="description">${safe(t.assignee)} · ${dateHuman(t.due)}</div></div>${overdue(t)?'<span class="tag late">Quá hạn</span>':displayStatus(t)}</div>`).join('')}`)}${card(`${sectionHead('Tiến độ theo dự án')}${projectList().map(p=>`<div class="chartbar"><div class="title">${safe(p.name)}</div><div class="progressbar"><span style="width:${p.progress}%"></span></div><div class="pct">${p.progress}%</div></div>`).join('')}<div class="ai-tip"><div class="tip-icon">${ic('sparkles',21)}</div><div><h3>Trợ lý tại nơi làm việc</h3><p>Tóm tắt nhanh công việc quá hạn, chờ phê duyệt hoặc cần check-in.</p></div></div>`)} </div>`}
function periodTasks(){
 const isDept=state.kpiScope==='department'&&canManage();
 return state.tasks.filter(t=>{
  if(String(t.due||'').slice(0,7)!==state.period)return false;
  return isDept?true:t.assignee===meName();
 });
}
function departmentKpisTrackerHTML(){
 const kpis=state.departmentKpis||[];
 if(!kpis.length)return '';
 const isDept=state.kpiScope==='department'&&canManage();
 const items=kpis.map(k=>{
  const linked=state.tasks.filter(t=>{
   if(t.kpi_id!==k.id)return false;
   if(!isDept&&t.assignee!==meName())return false;
   return String(t.due||'').slice(0,7)===state.period;
  });
  const completed=linked.filter(t=>t.status==='COMPLETED');
  const inProgress=linked.filter(t=>['IN_PROGRESS','IN_REVIEW','PAUSED'].includes(t.status));
  const avgProgress=linked.length?Math.round(linked.reduce((sum,t)=>sum+(Number(t.progress)||0),0)/linked.length):0;
  return {kpi:k,total:linked.length,completed:completed.length,inProgress:inProgress.length,avgProgress,tasks:linked};
 });
 return card(`<div class="card-head"><div><h2 style="font-size:16px;font-weight:780;display:flex;align-items:center;gap:8px">${ic('target',18)} Tiến độ theo chỉ tiêu KPI phòng ban</h2><p class="small muted" style="margin-top:4px">Tự động tổng hợp và tính % tiến độ từ các công việc được đính kèm mã KPI trong kỳ ${safe(state.period)}.</p></div><span class="tag progress">${fmtNum(kpis.length)} Chỉ tiêu</span></div><div class="department-kpi-grid">${items.map(item=>{
  const k=item.kpi,color=item.avgProgress>=100?'var(--success)':(item.avgProgress>0?'var(--brand-primary)':'var(--ink-muted)');
  return `<article class="department-kpi-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span class="tag tag-kpi" style="font-weight:700;font-size:11px;background:rgba(124,42,118,0.12);color:var(--brand-primary);border:1px solid rgba(124,42,118,0.2)">[${safe(k.code||k.id)}]</span><span class="small muted" style="font-size:11px">${safe(k.category||'Vận hành')}</span></div><strong style="font-size:14px;line-height:1.4;display:block;color:var(--ink)">${safe(k.name)}</strong></div><div style="text-align:right;flex-shrink:0"><span style="font-size:22px;font-weight:800;color:${color}">${item.avgProgress}%</span><div class="small muted" style="font-size:10px">Tiến độ TB</div></div></div><p class="small muted" style="margin:8px 0;font-size:11.5px;line-height:1.45">${safe(k.description||'')}</p><div class="progressbar" style="width:100%;height:8px;background:var(--stroke);border-radius:10px;overflow:hidden"><span style="display:block;height:100%;background:${color};border-radius:10px;width:${item.avgProgress}%"></span></div><div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;padding-top:6px;border-top:1px dashed var(--stroke);color:var(--ink-soft);margin-top:6px"><span><strong>${fmtNum(item.total)}</strong> việc đính kèm</span><span><strong>${item.completed}</strong> hoàn thành · <strong>${item.inProgress}</strong> đang làm</span></div>${item.tasks.length?`<div class="kpi-task-pills" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${item.tasks.map(t=>`<button type="button" class="btn btn-min task-open" data-task="${safe(t.id)}" style="font-size:11px;padding:3px 8px;background:var(--surface-secondary);border:1px solid var(--stroke);border-radius:6px;display:inline-flex;align-items:center;gap:5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safe(t.title)} (${t.progress}%)"><span class="dot" style="background:${t.status==='COMPLETED'?'var(--success)':(t.status==='IN_REVIEW'?'var(--warning)':'var(--brand-primary)')}"></span><span style="overflow:hidden;text-overflow:ellipsis">${safe(t.id)}: ${safe(t.title)} (${t.progress}%)</span></button>`).join('')}</div>`:`<div class="small muted" style="font-size:11px;font-style:italic;margin-top:6px">Chưa có công việc nào đính kèm chỉ tiêu này trong kỳ ${safe(state.period)}.</div>`}</article>`;
 }).join('')}</div>`,'department-kpi-wrapper');
}
function pageKpi(){
 const isDept=state.kpiScope==='department'&&canManage();
 const ts=periodTasks(),completed=ts.filter(t=>t.status==='COMPLETED'),onTime=completed.filter(t=>t.completedAt&&t.completedAt.slice(0,10)<=t.due),checked=ts.filter(t=>t.checkins?.length),submitted=ts.filter(t=>t.submittedAt?.slice(0,7)===state.period),approved=submitted.filter(t=>t.approvedAt?.slice(0,7)===state.period);
 const rate=(n,d)=>d?Math.round(n*100/d):0;
 const scopeTabs=canManage()?`<div class="kpi-scope-tabs"><button type="button" class="kpi-scope-btn ${state.kpiScope==='department'?'active':''}" data-kpi-scope="department">${ic('users',14)} Toàn phòng ban (${safe(state.authUser?.department||'CNTT')})</button><button type="button" class="kpi-scope-btn ${state.kpiScope==='mine'?'active':''}" data-kpi-scope="mine">${ic('user',14)} Cá nhân tôi (${safe(meName())})</button></div>`:'';
 const subtitle=isDept?`Số liệu tổng hợp toàn bộ nhân sự phòng ${safe(state.authUser?.department||'CNTT')} · Kỳ ${safe(state.period)}.`:`Kết quả của ${safe(meName())} · Công việc có hạn trong kỳ đã chọn.`;
 return `${pageHeader('ĐO LƯỜNG KẾT QUẢ','KPI công việc',subtitle,scopeTabs)}<div class="card kpi-period" style="margin-bottom:20px"><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap"><div style="min-width:180px"><label class="formlabel" for="kpiPeriod" style="margin-top:0">Kỳ KPI</label><input class="field" id="kpiPeriod" type="month" value="${safe(state.period)}"></div><div class="small muted" style="margin-top:14px">${isDept?'Tính cho tất cả công việc của phòng ban có hạn trong tháng được chọn.':'Tính theo các công việc được giao có hạn trong tháng này.'}</div></div></div><div class="grid stats">${statBlock('Tỷ lệ hoàn thành',`${rate(completed.length,ts.length)}%`,`${completed.length} / ${ts.length} công việc đến hạn`,false,'check')}${statBlock('Tỷ lệ đúng hạn',`${rate(onTime.length,completed.length)}%`,`${onTime.length} / ${completed.length} công việc hoàn thành có ngày hoàn thành`,false,'clock')}${statBlock('Tỷ lệ có check-in',`${rate(checked.length,ts.length)}%`,`${checked.length} / ${ts.length} công việc đến hạn`,false,'activity')}${statBlock('Tỷ lệ đạt duyệt',`${rate(approved.length,submitted.length)}%`,`${approved.length} / ${submitted.length} công việc đã gửi duyệt trong kỳ`,true,'shield')}</div>${departmentKpisTrackerHTML()}${card(`${sectionHead('Công thức và phạm vi')}<div class="report-row"><span class="small muted">Hoàn thành</span><strong>Tổng việc trạng thái Hoàn thành / tổng việc có hạn trong tháng</strong></div><div class="report-row"><span class="small muted">Đúng hạn</span><strong>Việc hoàn thành có thời điểm hoàn thành không sau hạn / số việc hoàn thành</strong></div><div class="report-row"><span class="small muted">Có check-in</span><strong>Việc có ít nhất một check-in / tổng việc có hạn trong tháng</strong></div><div class="report-row"><span class="small muted">Đạt duyệt</span><strong>Việc đã được duyệt / việc đã gửi duyệt trong tháng</strong></div><div class="report-row"><span class="small muted">Tiến độ chỉ tiêu KPI</span><strong>Trung bình cộng % tiến độ của các công việc được đính kèm mã chỉ tiêu tương ứng</strong></div><p class="small muted" style="margin-top:10px">Các chỉ số hiển thị minh bạch theo thời gian thực khi nhân sự check-in tiến độ hoặc hoàn tất nghiệm thu công việc.</p>`)}`
}
function pageKpiBank(){
 const source=state.kpiBank,rows=source?.kpis||[],departments=[...new Set(rows.map(row=>row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')),perspectives=[...new Set(rows.map(row=>row.bsc_perspective).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')),search=normalizeForMatch(state.kpiBankSearch).text;
 const filtered=rows.filter(row=>(!state.kpiBankDepartment||row.department===state.kpiBankDepartment)&&(!state.kpiBankPerspective||row.bsc_perspective===state.kpiBankPerspective)&&(!search||normalizeForMatch([row.id,row.original_code,row.name,row.department,row.company_objective,row.department_objective,row.calculation_description,row.data_source,row.data_provider].filter(Boolean).join(' ')).text.includes(search)));
 const flagged=rows.filter(row=>Array.isArray(row.review_flags)&&row.review_flags.length>0).length,company=rows.filter(row=>row.level==='Cong ty').length;
 const departmentCounts=departments.map(name=>({name:name==='Toan cong ty'?'Toàn công ty':name,count:rows.filter(row=>row.department===name).length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'vi'));
 const perspectiveCounts=perspectives.map(name=>({name,count:rows.filter(row=>row.bsc_perspective===name).length})).sort((a,b)=>b.count-a.count);
 const flagLabels={CHUA_CO_TAN_SUAT:'Chưa có tần suất',TRUNG_MA_GOC_TRONG_CUNG_BO_PHAN:'Trùng mã gốc trong phòng ban',THIEU_MA_GOC:'Thiếu mã gốc',CAN_XAC_MINH_PHAM_VI_BFC:'Cần xác minh phạm vi BFC',THIEU_CONG_THUC_MO_TA:'Thiếu mô tả công thức'};
 const flagCounts=Object.entries(rows.flatMap(row=>Array.isArray(row.review_flags)?row.review_flags:[]).reduce((counts,flag)=>{counts[flag]=(counts[flag]||0)+1;return counts},{})).sort((a,b)=>b[1]-a[1]);
 const barRows=(items,total,label)=>items.map(item=>`<div class="kpi-chart-row ${safe(item.color||'')}"><div class="kpi-chart-label" title="${safe(item.name)}">${safe(label?label(item.name):item.name)}</div><div class="kpi-chart-track" role="img" aria-label="${safe(item.name)}: ${fmtNum(item.count)} trên ${fmtNum(total)}"><span style="width:${total?Math.max(2,item.count*100/total):0}%"></span></div><strong class="kpi-chart-value">${fmtNum(item.count)}</strong></div>`).join('');
 const pieChart=(items,total,label)=>{let cursor=-90;const segments=items.map((item,index)=>{const share=total?item.count*100/total:0,start=cursor,end=cursor+share*3.6;cursor=end;const point=angle=>({x:100+96*Math.cos(angle*Math.PI/180),y:100+96*Math.sin(angle*Math.PI/180)});const from=point(start),to=point(end),path=share>=99.999?'M 100 4 A 96 96 0 1 1 99.999 4 Z':`M 100 100 L ${from.x.toFixed(3)} ${from.y.toFixed(3)} A 96 96 0 ${share>50?1:0} 1 ${to.x.toFixed(3)} ${to.y.toFixed(3)} Z`;return {item,index,share,path}});const paths=segments.map(segment=>{const percentage=`${segment.share.toFixed(1)}%`,description=`${segment.item.name}: ${fmtNum(segment.item.count)} KPI (${percentage})`;return `<path class="kpi-pie-slice" d="${segment.path}" fill="var(--kpi-pie-${segment.index%10})" tabindex="0" role="img" aria-label="${safe(description)}" data-kpi-tooltip="${safe(description)}"></path>`}).join('');return `<div class="kpi-pie-layout"><div class="kpi-pie-visual"><svg class="kpi-pie" viewBox="0 0 200 200" role="group" aria-label="${safe(label)}">${paths||'<circle cx="100" cy="100" r="96" fill="var(--stroke)"><title>Chưa có dữ liệu</title></circle>'}</svg><div class="kpi-pie-total"><strong>${fmtNum(total)}</strong><span>Tổng chỉ tiêu</span></div><div class="kpi-pie-tooltip" role="tooltip" hidden></div></div><div class="kpi-pie-legend">${segments.map(segment=>`<div class="kpi-pie-legend-row"><i class="kpi-pie-dot" style="--kpi-dot:var(--kpi-pie-${segment.index%10})"></i><span title="${safe(segment.item.name)}">${safe(segment.item.name)}</span><strong>${fmtNum(segment.item.count)}</strong><small>${segment.share.toFixed(1)}%</small></div>`).join('')||'<p class="small muted">Chưa có dữ liệu để biểu diễn.</p>'}</div></div>`};
 const departmentChart=pieChart(departmentCounts,rows.length,'Tỷ trọng số KPI theo cấp/phòng ban');
 const perspectiveChart=pieChart(perspectiveCounts,rows.length,'Tỷ trọng số KPI theo khía cạnh BSC');
 const flagChart=barRows(flagCounts.map(([name,count])=>({name:flagLabels[name]||name,count})),Math.max(1,...flagCounts.map(([,count])=>count)));
 const statusCounts=Object.entries(rows.reduce((counts,row)=>{const status=row.approval_status||'Chưa xác định';counts[status]=(counts[status]||0)+1;return counts},{})).map(([name,count])=>({name:name==='CAN_RA_SOAT'?'Cần rà soát':name,count}));
 const statusChart=barRows(statusCounts,Math.max(1,rows.length));
 const dashboard=`<section class="kpi-dashboard" aria-label="Phân tích danh mục KPI"><article class="card kpi-chart-card"><div class="kpi-chart-head"><div><h2>Cơ cấu KPI theo phòng ban</h2><p>Tỷ trọng trong toàn bộ danh mục · cấp công ty và các phòng ban</p></div></div>${departmentChart}</article><article class="card kpi-chart-card"><div class="kpi-chart-head"><div><h2>Cơ cấu theo khía cạnh BSC</h2><p>Tỷ trọng số lượng chỉ tiêu trong danh mục</p></div></div>${perspectiveChart}</article><article class="card kpi-chart-card kpi-review-card"><div class="kpi-chart-head"><div><h2>Tình trạng rà soát</h2><p>Tình trạng hồ sơ và các vấn đề cần kiểm tra trong tệp nguồn</p></div><span class="tag review">${fmtNum(flagged)} KPI có cờ rà soát</span></div><div class="kpi-review-grid"><section class="kpi-review-section"><h3 class="kpi-chart-subtitle">Trạng thái hồ sơ</h3><div class="kpi-chart-list">${statusChart}</div></section><section class="kpi-review-section"><h3 class="kpi-chart-subtitle">Vấn đề dữ liệu được gắn cờ</h3><div class="kpi-chart-list">${flagChart}</div><p class="kpi-chart-note">Một KPI có thể có nhiều cờ; số lượt cờ không phải số KPI duy nhất.</p></section></div></article></section>`;
 const departmentOptions=departments.map(value=>`<option value="${safe(value)}" ${state.kpiBankDepartment===value?'selected':''}>${safe(value)}</option>`).join('');
 const perspectiveOptions=perspectives.map(value=>`<option value="${safe(value)}" ${state.kpiBankPerspective===value?'selected':''}>${safe(value)}</option>`).join('');
 const tableRows=filtered.map(row=>{
  const flags=Array.isArray(row.review_flags)?row.review_flags:[];
  const approval=row.approval_status==='CAN_RA_SOAT'?'Cần rà soát':safe(row.approval_status||'Chưa xác định');
  const target=row.reference_target_2024===null||row.reference_target_2024===undefined?'':fmtNum(row.reference_target_2024);
  const cell=value=>`<td>${safe(value||'')}</td>`;
  return `<tr>${cell(row.org)}${cell(row.source_year)}${cell(row.level)}${cell(row.department)}${cell(row.bsc_perspective)}<td><strong>${safe(row.original_code||row.id)}</strong></td><td class="kpi-bank-name"><strong>${safe(row.name)}</strong></td>${cell(row.company_objective)}${cell(row.department_objective)}${cell(target)}${cell(row.unit)}${cell(row.reference_weight_pct===null||row.reference_weight_pct===undefined?'':`${fmtNum(row.reference_weight_pct)}%`)}${cell(row.frequency)}<td class="kpi-bank-description">${safe(row.calculation_description)}</td>${cell(row.data_source)}${cell(row.data_provider)}${cell(row.source_sheet)}${cell(row.source_row)}${cell(row.source_priority)}<td><span class="tag review">${approval}</span></td><td>${flags.map(flag=>`<span class="tag todo">${safe(flag)}</span>`).join(' ')}</td></tr>`;
 }).join('');
 const pageSummary=`<div class="grid stats">${statBlock('Tổng chỉ tiêu',rows.length,'Danh mục tham khảo')}${statBlock('Cấp công ty',company,'Chưa phân bổ theo nhân viên')}${statBlock('Cấp phòng ban',rows.length-company,'Các nhóm/phòng ban')}${statBlock('Cần rà soát',flagged,'Có cờ dữ liệu cần kiểm tra',true,'alert')}</div><div class="kpi-bank-warning"><strong>Chỉ dùng thử nghiệm.</strong> Đây là dữ liệu tham khảo có nguồn năm ${fmtNum(source?.historical_source_year||2024)}. ${safe(source?.disclaimer||'Chưa có KPI 2026 được phê duyệt. Không dùng chỉ tiêu hoặc trọng số này để chấm điểm hay tính thưởng.')}</div>`;
 if(state.kpiAnalyticsView)return `${pageHeader('TỔNG QUAN DANH MỤC','Phân tích danh mục KPI',`Cơ cấu và chất lượng của ${fmtNum(rows.length)} chỉ tiêu tham khảo. Đây không phải báo cáo kết quả thực hiện.`,`<span class="tag progress">DEMO ${safe(source?.demo_cycle_year||2026)}</span>`)}${pageSummary}${dashboard}`;
 return `${pageHeader('DANH MỤC THAM KHẢO','Ngân hàng KPI · Demo 2026',`${fmtNum(filtered.length)} / ${fmtNum(rows.length)} chỉ tiêu · Bảng đầy đủ theo các cột dữ liệu nguồn. Cuộn ngang để xem toàn bộ; không dùng tính điểm.`,`<span class="tag progress">DEMO ${safe(source?.demo_cycle_year||2026)}</span>`)}${pageSummary}<section class="card kpi-bank-card"><div class="kpi-bank-filters"><label><span class="formlabel">Tìm KPI</span><input class="field" id="kpiBankSearch" type="search" value="${safe(state.kpiBankSearch)}" placeholder="Tên, mã, phòng ban, mục tiêu..."></label><label><span class="formlabel">Phòng ban</span><select class="field" id="kpiBankDepartment"><option value="">Tất cả phòng ban</option>${departmentOptions}</select></label><label><span class="formlabel">Khía cạnh BSC</span><select class="field" id="kpiBankPerspective"><option value="">Tất cả khía cạnh</option>${perspectiveOptions}</select></label></div><div class="kpi-bank-table-meta"><span>${fmtNum(filtered.length)} dòng hiển thị · ${fmtNum(rows.length)} dòng trong danh mục</span><span>Cuộn ngang để xem các cột còn lại</span></div><div class="table-wrap kpi-spreadsheet-wrap" role="region" aria-label="Bảng đầy đủ ngân hàng KPI" tabindex="0"><table class="task-table kpi-bank-table"><thead><tr><th>Tổ chức</th><th>Năm nguồn</th><th>Cấp KPI</th><th>Phòng ban</th><th>Khía cạnh BSC</th><th>Mã gốc</th><th>Tên chỉ tiêu</th><th>Mục tiêu công ty</th><th>Mục tiêu phòng ban</th><th>Chỉ tiêu tham khảo</th><th>Đơn vị</th><th>Trọng số tham khảo</th><th>Tần suất</th><th>Mô tả cách tính</th><th>Nguồn dữ liệu</th><th>Đơn vị cung cấp</th><th>Sheet nguồn</th><th>Dòng nguồn</th><th>Ưu tiên nguồn</th><th>Trạng thái</th><th>Cờ rà soát</th></tr></thead><tbody>${tableRows||'<tr><td colspan="21"><div class="empty">Không tìm thấy chỉ tiêu phù hợp.</div></td></tr>'}</tbody></table></div></section>`;
}
function pageGoals(){const s=stats();return `${pageHeader('ĐỊNH HƯỚNG VÀ ĐO LƯỜNG','Mục tiêu & KPI','Xem mối liên kết mục tiêu, KPI và công việc thực hiện.','<span class="tag progress">Minh họa liên kết</span>')}<div class="kpi-hero">${card(`<div class="eyebrow">MỤC TIÊU BFC · 2026</div><div class="objective"><div class="muted small">O1 · Nâng cao hiệu quả vận hành</div><h3>Chuẩn hóa quản trị công việc và đánh giá hiệu suất</h3><div class="muted small">Mục tiêu liên kết với dự án Nâng cấp WeWork và Chuẩn hóa KPI BFC.</div></div><h2>Chỉ số kết quả chính</h2><div class="kpi-card"><div class="small muted">KPI-01 · Tỷ lệ công việc hoàn thành đúng hạn</div><div class="kpi-num">${s.done?Math.round(s.done/s.all*100):0}% <span class="small muted" style="font-weight:normal">/ Mục tiêu 95%</span></div><div class="progressbar"><span style="width:${Math.min(100,s.done/s.all*100)}%"></span></div><div class="small muted" style="margin-top:9px">Giá trị demo minh họa; chưa phải công thức KPI thực tế.</div></div><div class="kpi-card"><div class="small muted">KPI-02 · Tỷ lệ công việc có check-in</div><div class="kpi-num">${Math.round(state.tasks.filter(x=>x.checkins?.length).length/Math.max(1,s.all)*100)}%</div><div class="progressbar"><span style="width:${Math.round(state.tasks.filter(x=>x.checkins?.length).length/Math.max(1,s.all)*100)}%"></span></div></div>`)}${card(`${sectionHead('Dữ liệu liên kết')}<p class="small muted">Một mục tiêu có thể liên kết nhiều KPI, dự án và công việc. Kết quả công việc chỉ được đưa vào KPI khi đủ công thức và bằng chứng.</p><div class="list-line"><div class="project-icon">${ic('target')}</div><div><strong>Mục tiêu O1</strong><div class="description">Nâng cao hiệu suất quản trị</div></div></div><div class="list-line"><div class="project-icon">${ic('chart')}</div><div><strong>KPI-01, KPI-02</strong><div class="description">Chỉ số kết quả được đo theo kỳ</div></div></div><div class="list-line"><div class="project-icon">${ic('folder')}</div><div><strong>${fmtNum(projectList().length)} dự án liên quan</strong><div class="description">Phân rã thành các công việc thực hiện</div></div></div><button class="btn" data-page="projects" style="margin-top:18px">Mở danh sách dự án ${ic('arrow-right')}</button>`)}</div>`}
function projectList(){const visible=visibleTasks();return [...new Set(visible.map(t=>t.project))].map(name=>{const t=visible.filter(x=>x.project===name);return {name,count:t.length,done:t.filter(x=>x.status==='COMPLETED').length,progress:Math.round(t.reduce((a,b)=>a+b.progress,0)/Math.max(1,t.length))}})}
function pageProjects(){const projects=projectList();return `${pageHeader('KẾ HOẠCH THỰC HIỆN','Dự án','Theo dõi tình hình các dự án và công việc liên quan.','<span class="tag progress">Dữ liệu mẫu</span>')}<div class="project-grid">${projects.map((p,i)=>card(`<div class="project-icon">${ic('folder',22)}</div><div class="project-title">${safe(p.name)}</div><div class="project-meta">${fmtNum(p.count)} công việc · ${fmtNum(p.done)} đã hoàn thành<br>Liên kết mục tiêu vận hành BFC</div><div class="project-progress"><div class="progressbar"><span style="width:${p.progress}%"></span></div><strong>${p.progress}%</strong></div><button class="btn" data-project="${safe(p.name)}" style="margin-top:22px;width:100%">Xem công việc ${ic('arrow-right')}</button>`,'project-card')).join('')}</div>`}
function pageReports(){const s=stats();let per=[{name:'Cần thực hiện',total:state.tasks.filter(t=>t.status==='TODO').length},{name:'Đang thực hiện',total:s.active},{name:'Chờ duyệt',total:s.review},{name:'Hoàn thành',total:s.done},{name:'Tạm dừng',total:state.tasks.filter(t=>t.status==='PAUSED').length}];return `${pageHeader('PHÂN TÍCH KẾT QUẢ','Báo cáo công việc','Tổng hợp từ dữ liệu của bản Demo – không phải số liệu BFC thực tế.',`<button class="btn btn-primary" data-action="export">${ic('download')} Xuất CSV</button>`)}<div class="grid stats">${statBlock('Tổng bản ghi công việc',s.all,'Đếm theo ID',false,'list')}${statBlock('Đã hoàn thành',s.done,'Trạng thái chính thức',false,'check')}${statBlock('Chờ người duyệt',s.review,'Không tính là hoàn thành',true,'clock')}${statBlock('Quá hạn',s.overdue,'Chỉ số độc lập trạng thái',false,'alert')}</div><div class="card-row">${card(`${sectionHead('Phân bố trạng thái')}${per.map(x=>`<div class="chartbar"><div class="title">${x.name}</div><div class="progressbar"><span style="width:${s.all?100*x.total/s.all:0}%"></span></div><div class="pct">${fmtNum(x.total)}</div></div>`).join('')}<div class="report-summary">Tỷ lệ và số liệu thay đổi sau khi thao tác trên công việc trong bản Demo.</div>`)}${card(`${sectionHead('Quản trị dữ liệu')}<div class="report-row"><span class="small muted">Nguồn dữ liệu</span><strong style="font-size:13px">Laravel + localStorage</strong></div><div class="report-row"><span class="small muted">Cập nhật</span><strong style="font-size:13px">Khi thao tác</strong></div><div class="report-row"><span class="small muted">Thời gian</span><strong style="font-size:13px">${dateHuman(addDays(0))}</strong></div><div class="report-row"><span class="small muted">Phiên duyệt, check-in</span><strong style="font-size:13px">Mô phỏng</strong></div><p class="small muted">Khi triển khai thật cần phân quyền dữ liệu, công thức KPI, bằng chứng và cơ chế lưu lịch sử không sửa đè.</p>`)}</div>`}
async function refreshCsrfToken(){const response=await fetch('/demo-auth/csrf',{credentials:'same-origin',headers:{Accept:'application/json'}});const data=await response.json();if(!response.ok||typeof data.token!=='string'||!data.token)throw new Error(data.message||'Không thể làm mới mã bảo mật. Hãy tải lại trang và thử lại.');const meta=document.querySelector('meta[name="csrf-token"]');if(!meta)throw new Error('Không tìm thấy thẻ CSRF trên trang. Hãy tải lại trang và thử lại.');meta.content=data.token;return data.token}
async function apiRequest(url,options={}){const send=()=>fetch(url,{credentials:'same-origin',...options,headers:{'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]')?.content||'',...(options.headers||{})}});let response=await send();if(response.status===419){await refreshCsrfToken();response=await send()}let data={};try{data=await response.json()}catch(error){if(response.ok)throw error}if(!response.ok){if(response.status===401){state.authUser=null;state.login=true;layout()}throw new Error(data.message||Object.values(data.errors||{}).flat().join(' ')||'Yêu cầu không thành công.')}return data}
function legacyImportHTML(){if(!state.legacyTasks.length||state.legacyImported)return '';return card(`${sectionHead('Nhập công việc cũ từ trình duyệt')}<p class="small muted">Tìm thấy ${state.legacyTasks.length} công việc trong localStorage. Có thể nhập một bản sao lên máy chủ local; công việc cũ không bị xóa. Người nhập sẽ trở thành người tạo và người thực hiện của các công việc được nhập.</p><button class="btn btn-primary" data-action="import-legacy">${ic('download')} Nhập bản sao công việc cũ</button>`)}
async function loadAdminData(){state.adminMessage='';state.adminLoading=true;layout();try{const data=await apiRequest('/demo-auth/admin/');data.audit_logs=(data.audit_logs||[]).map(log=>({...log,target:log.target||log.subject,at:log.at||log.created_at}));state.adminData=data}catch(error){state.adminMessage=error.message;state.adminData=null}finally{state.adminLoading=false;layout()}}
function adminSettingsHTML(){const data=state.adminData;if(state.adminLoading)return card('<div class="empty">Đang tải dữ liệu quản trị...</div>');if(!data)return card(`<div class="empty">${safe(state.adminMessage||'Không tải được dữ liệu quản trị.')}</div><button class="btn" data-action="reload-admin">Thử lại</button>`);const roles=data.roles||[],permissions=[['tasks.create','Tạo công việc'],['tasks.view_related','Xem công việc liên quan'],['tasks.update_related','Cập nhật công việc liên quan'],['tasks.comment_related','Bình luận công việc'],['tasks.view_scoped','Xem trong phạm vi được cấp'],['tasks.assign','Giao việc'],['tasks.review','Duyệt nghiệm thu'],['tasks.edit_scoped','Sửa trong phạm vi được cấp']];const scopeFields=(scope={})=>`<label class="formlabel">Phòng ban (phân cách dấu phẩy)</label><input class="field" name="departments" value="${safe((scope.departments||[]).join(', '))}" placeholder="VD: Kinh doanh, Sản xuất"><label class="formlabel">Dự án (phân cách dấu phẩy)</label><input class="field" name="projects" value="${safe((scope.projects||[]).join(', '))}" placeholder="VD: Dự án A"><label class="checkline"><input type="checkbox" name="organization" ${scope.organization?'checked':''}> Toàn tổ chức (cấp rõ ràng)</label>`;return `<div class="admin-grid"><section class="card"><div class="card-head"><h2>Miền email đăng ký</h2></div><p class="small muted">Để trống miền thì tạm khóa đăng ký. Chỉ nhập tên miền đã được BFC xác nhận, không gồm ký tự @.</p><form data-admin-form="domains"><label class="formlabel" for="emailDomains">Danh sách miền</label><input class="field" id="emailDomains" name="domains" value="${safe((data.email_domains||[]).join(', '))}" placeholder="bfc.vn, congty.vn"><button class="btn btn-primary" type="submit">Lưu miền đăng ký</button></form></section><section class="card"><div class="card-head"><h2>Yêu cầu cấp quyền (${(data.requests||[]).filter(item=>['PENDING','MORE_INFO'].includes(item.status)).length})</h2></div>${(data.requests||[]).filter(item=>['PENDING','MORE_INFO'].includes(item.status)).map(item=>`<article class="admin-item"><strong>${safe(item.name)} · ${safe(item.email)}</strong><p>${safe(item.department||'Chưa khai báo phòng ban')} · ${safe(item.job_title||'Chưa khai báo chức vụ')}</p><span class="tag ${item.status==='PENDING'?'todo':'progress'}">${safe(item.status==='PENDING'?'Chờ duyệt':'Chờ bổ sung')}</span><form data-admin-form="decision" data-id="${safe(item.id)}"><label class="formlabel">Vai trò</label><select class="field" name="role_id">${roles.filter(role=>role.id!=='SYSTEM_ADMIN').map(role=>`<option value="${safe(role.id)}">${safe(role.label)}</option>`).join('')}</select>${scopeFields()}<label class="formlabel">Ghi chú cho nhân viên</label><input class="field" name="note" maxlength="1000"><div class="button-row"><button class="btn btn-primary" name="decision" value="approve">Chấp thuận</button><button class="btn" name="decision" value="more_info">Yêu cầu bổ sung</button><button class="btn btn-danger" name="decision" value="reject">Từ chối</button></div></form></article>`).join('')||'<div class="empty">Không có yêu cầu đang chờ.</div>'}</section></div><section class="card"><div class="card-head"><h2>Tài khoản & phạm vi</h2></div>${(data.users||[]).map(user=>{const selfAdmin=user.role_id==='SYSTEM_ADMIN'&&user.id===state.authUser?.id;return `<form class="admin-user" data-admin-form="user" data-id="${safe(user.id)}" data-self-admin="${selfAdmin}"><div class="admin-user-heading"><strong>${safe(user.name)}</strong><span>${safe(user.email)} · ${safe(user.status)}</span></div><div class="admin-fields"><label class="formlabel">Họ và tên</label><input class="field" name="name" value="${safe(user.name)}" required minlength="2" maxlength="120"><label class="formlabel">Vai trò</label><select class="field" name="role_id" ${user.role_id==='SYSTEM_ADMIN'?'disabled':''}>${roles.filter(role=>role.id!=='SYSTEM_ADMIN'||user.role_id==='SYSTEM_ADMIN').map(role=>`<option value="${safe(role.id)}" ${role.id===user.role_id?'selected':''}>${safe(role.label)}</option>`).join('')}</select><label class="formlabel">Trạng thái</label><select class="field" name="status" ${user.role_id==='SYSTEM_ADMIN'?'disabled':''}>${['ACTIVE','SUSPENDED','DISABLED'].map(status=>`<option ${status===user.status?'selected':''}>${status}</option>`).join('')}</select><label class="formlabel">Phòng ban</label><input class="field" name="department" value="${safe(user.department||'')}" maxlength="100" placeholder="VD: CNTT"><label class="formlabel">Chức danh</label><input class="field" name="job_title" value="${safe(user.job_title||'')}" maxlength="100" placeholder="VD: Nhân viên CNTT">${scopeFields(user.scope)}</div>${selfAdmin?'<p class="small muted">Hồ sơ của bạn dùng cùng tài khoản và email quản trị. Có thể sửa tên, phòng ban, chức danh và phạm vi (ví dụ: CNTT); vai trò và trạng thái được bảo vệ để tránh khóa quyền quản trị.</p>':''}<button class="btn" type="submit" ${user.role_id==='SYSTEM_ADMIN'&&!selfAdmin?'disabled':''}>Lưu hồ sơ & quyền</button></form>`}).join('')||'<div class="empty">Chưa có tài khoản.</div>'}</section><section class="card"><div class="card-head"><h2>Cấu hình vai trò & quyền</h2></div>${roles.filter(role=>role.id!=='SYSTEM_ADMIN').map(role=>`<form class="admin-role" data-admin-form="role" data-id="${safe(role.id)}"><label class="formlabel">Tên vai trò</label><input class="field" name="label" value="${safe(role.label)}" required minlength="2" maxlength="100"><div class="permission-grid">${permissions.map(([id,label])=>`<label class="checkline"><input type="checkbox" name="permissions" value="${id}" ${(role.permissions||[]).includes(id)?'checked':''}> ${label}</label>`).join('')}</div><button class="btn" type="submit">Lưu vai trò ${safe(role.label)}</button></form>`).join('')}</section><section class="card"><div class="card-head"><h2>Nhật ký phân quyền gần đây</h2></div><div class="audit-list">${(data.audit_logs||[]).map(log=>`<div class="list-line"><div><strong>${safe(log.action)}</strong><div class="description">${safe(log.actor_id||'Hệ thống')} · ${safe(log.target||'')}</div></div><time>${safe(log.at||'')}</time></div>`).join('')||'<div class="empty">Chưa có nhật ký.</div>'}</div></section><p class="small muted">SYSTEM_ADMIN quản lý tài khoản/cấu hình và có quyền xem, sửa, giao việc, tạo và duyệt công việc trên toàn tổ chức. Hồ sơ (tên, phòng ban, chức danh) có thể chỉnh sửa; vai trò và trạng thái quản trị được bảo vệ. Đây là ứng dụng local; chưa có xác minh email, khôi phục mật khẩu hoặc hardening cho mạng công cộng.</p>`}
function pageSettings(){const admin=isAdminView();return `${pageHeader(admin?'QUẢN TRỊ HỆ THỐNG':'CÁ NHÂN HÓA',admin?'Quản lý tài khoản & phân quyền':'Cài đặt giao diện',admin?'Duyệt đăng ký, cấp quyền và quản lý phạm vi dữ liệu.':'Thiết lập hiển thị và bảo toàn dữ liệu công việc hiện có.', '')}${admin?adminSettingsHTML():`${legacyImportHTML()}<div class="card-row">${card(`${sectionHead('Hiển thị')}<div class="toggleline"><div><strong>Giao diện nền tối</strong><div class="small muted">Tùy chọn, không bắt buộc</div></div><button class="btn" data-action="theme">${ic('moon')} ${state.theme==='dark'?'Chuyển nền sáng':'Bật nền tối'}</button></div><div class="toggleline"><div><strong>Ngôn ngữ</strong><div class="small muted">Tiếng Việt</div></div><span class="tag todo">VI</span></div><div class="toggleline"><div><strong>Định dạng ngày</strong><div class="small muted">Ngày / tháng / năm</div></div><strong>dd/mm/yyyy</strong></div><div class="toggleline"><div><strong>Phân cách hàng nghìn</strong><div class="small muted">Chuẩn tiếng Việt</div></div><strong>1.000</strong></div>`)}${card(`${sectionHead('Bộ nhận diện & chế độ vận hành')}<div class="list-line"><div class="project-icon">${ic('target')}</div><div><div class="name">Tím BFC</div><div class="description">#7C2A76</div></div></div><div class="list-line"><div class="project-icon" style="background:var(--brand-accent-soft);color:#89560b">${ic('sparkles')}</div><div><div class="name">Vàng cam BFC</div><div class="description">#CD8B2D</div></div></div><p class="small muted">Tài khoản, phiên và quyền được xử lý bởi Laravel trong máy chủ local; dữ liệu nghiệp vụ lưu trong tệp JSON riêng tư, không dùng MySQL. Chưa có xác minh email hoặc triển khai an toàn cho mạng công cộng.</p>`)}</div>`}`}
function detailHTML(){const t=state.tasks.find(x=>x.id===state.detail);if(!t||!roleAllowed(t,'read')){state.detail=null;return ''}let actions=[];
 if(t.status==='TODO'&&roleAllowed(t,'start'))actions.push(`<button class="btn btn-primary" data-transition="start">${ic('activity')} Bắt đầu</button>`);
 if((t.status==='IN_PROGRESS'||t.status==='PAUSED')&&roleAllowed(t,'checkin'))actions.push(`<button class="btn btn-primary" data-action="checkin">${ic('edit')} Check-in</button>`);
 if(t.status==='IN_PROGRESS'&&roleAllowed(t,'submit'))actions.push(`<button class="btn" data-transition="submit">${ic('send')} ${t.review?'Gửi nghiệm thu':'Hoàn thành'}</button>`);
 if(t.status==='IN_REVIEW'&&roleAllowed(t,'approve')){actions.push(`<button class="btn btn-primary" data-transition="approve">${ic('check')} Phê duyệt</button>`);actions.push(`<button class="btn btn-danger" data-action="reject">Trả lại</button>`)}
 if(t.status==='PAUSED'&&roleAllowed(t,'start'))actions.push(`<button class="btn" data-transition="resume">Tiếp tục</button>`);
 const canEdit=roleAllowed(t,'edit'),subtasks=Array.isArray(t.subtasks)?t.subtasks:[],comments=Array.isArray(t.comments)?t.comments:[];
 const description=String(t.description||''),result=String(t.result||'');
 const isProjectTask=Boolean(t.project&&t.project!=='Công việc độc lập');
 const isUrgent=['HIGH','URGENT'].includes(t.priority);
 const isOverdue=overdue(t);
 const hasExtensions=Number(t.extensions_count||0)>0;
 const requiresFormalExtension=isProjectTask||isUrgent||isOverdue||hasExtensions;
 const kpiBadge=t.kpi_id?`<span class="tag tag-kpi" style="background:rgba(124,42,118,0.12);color:var(--brand-primary);border:1px solid rgba(124,42,118,0.25);font-size:11px;font-weight:600" title="${safe(t.kpi_name||'')}">🏷️ [${safe(t.kpi_id)}] ${safe(t.kpi_name||'')}</span>`:'';
 return `<div class="panel-backdrop" data-action="detail-close"></div><aside class="detail-panel" role="dialog" aria-modal="true" aria-label="Chi tiết công việc"><div class="panel-head"><div><div class="eyebrow">${safe(t.id)} · ${safe(t.project)}</div><h2 class="detail-title">${safe(t.title)}</h2><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${displayStatus(t)}${kpiBadge}</div></div><button class="icon-btn" data-action="detail-close" aria-label="Đóng">${ic('close')}</button></div><div class="detail-modal-layout"><div class="detail-main-col"><section class="detail-section"><div class="detail-section-head"><h3>Mô tả công việc</h3>${canEdit?'<span class="small muted">Nội dung, tài liệu, checklist và liên kết</span>':''}</div>${canEdit?`<form class="detail-edit-form" data-detail-form="description"><textarea class="field detail-textarea" name="value" maxlength="5000" placeholder="Thêm mô tả công việc, yêu cầu và phạm vi thực hiện...">${safe(description)}</textarea><button class="btn btn-min" type="submit">${ic('check')} Lưu mô tả</button></form><div class="task-resource-actions">${attachmentInput('description')}<button class="btn btn-min" type="button" data-action="show-checklist-form">${ic('list')} Thêm checklist</button><button class="btn btn-min" type="button" data-action="show-link-form">${ic('link')} Thêm liên kết</button></div><form class="subtask-form task-resource-form" data-detail-form="checklist" hidden><input class="field" name="title" minlength="2" maxlength="100" required placeholder="Tên checklist"><button class="btn" type="submit">Tạo checklist</button></form><form class="task-link-form" data-detail-form="link" hidden><input class="field" name="title" maxlength="100" required placeholder="Tên liên kết"><input class="field" name="url" type="url" maxlength="2048" required placeholder="https://..."><button class="btn" type="submit">Thêm</button></form><p class="small muted">Tài liệu được lưu trên máy chủ local; chưa kết nối Base Drive/Pro.</p>`:`<div class="detail-prose">${description?safe(description):'<span class="muted">Chưa có mô tả công việc.</span>'}</div>`}${taskAttachmentsHTML(t,'description')}${taskLinksHTML(t)}${taskChecklistsHTML(t,canEdit)}</section><section class="detail-section"><div class="detail-section-head"><h3>Kết quả công việc</h3>${canEdit?'<span class="small muted">Cập nhật kết quả và tài liệu bàn giao</span>':''}</div>${canEdit?`<form class="detail-edit-form" data-detail-form="result"><textarea class="field detail-textarea" name="value" maxlength="5000" placeholder="Cập nhật kết quả, đường dẫn hoặc ghi chú bàn giao...">${safe(result)}</textarea><button class="btn btn-min" type="submit">${ic('edit')} Cập nhật kết quả</button></form><div class="task-resource-actions">${attachmentInput('result')}</div>`:`<div class="detail-prose">${result?safe(result):'<span class="muted">Chưa cập nhật kết quả.</span>'}</div>`}${taskAttachmentsHTML(t,'result')}</section><section class="detail-section"><div class="detail-section-head"><h3>Công việc con <span class="detail-count">${subtasks.filter(item=>item.done).length}/${subtasks.length}</span></h3>${canEdit&&t.status!=='COMPLETED'?'<label class="btn btn-min task-attach-button">'+ic('download')+' Nhập từ Excel<input type="file" data-subtask-import accept=".xlsx,.csv" hidden></label>':''}</div>${subtasks.length?`${subtasks.some(item=>!item.done)?'<p class="subtask-gate-note">Cần hoàn thành toàn bộ công việc con trước khi gửi nghiệm thu hoặc hoàn thành công việc cha.</p>':''}<div class="subtask-list">${subtasks.map((item,index)=>`<label class="subtask-row ${item.done?'is-done':''}"><input type="checkbox" data-subtask-toggle="${index}" ${item.done?'checked':''} ${canEdit&&!(t.status==='COMPLETED'&&item.done)?'':'disabled'}><span>${safe(item.title)}</span></label>`).join('')}</div>`:'<p class="detail-empty">Chưa có công việc con.</p>'}${canEdit&&t.status!=='COMPLETED'?'<form class="subtask-form" data-detail-form="subtask"><input class="field" name="title" maxlength="160" minlength="2" required placeholder="Thêm công việc con"><button class="btn btn-primary" type="submit" aria-label="Thêm công việc con">'+ic('plus')+'</button></form><p class="small muted">Excel: mỗi dòng nhập một tên công việc con ở cột đầu tiên (.xlsx hoặc .csv).</p>':''}</section><section class="detail-section"><div class="detail-section-head"><h3>Bình luận <span class="detail-count">${comments.length}</span></h3></div>${comments.length?`<div class="comment-list">${comments.map(comment=>`<article class="comment-item"><div class="comment-avatar">${safe(initials(comment.author||'?'))}</div><div class="comment-content"><div class="comment-meta"><strong>${safe(comment.author||'Người dùng')}</strong><time>${safe(comment.at?new Date(comment.at).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'}):'')}</time></div><p>${safe(comment.text)}</p></div></article>`).join('')}</div>`:'<p class="detail-empty">Chưa có bình luận. Hãy bắt đầu trao đổi về công việc này.</p>'}<form class="comment-form" data-detail-form="comment"><div class="comment-input-wrap"><textarea class="field" name="text" rows="2" maxlength="2000" minlength="1" required placeholder="Viết bình luận..."></textarea><div class="comment-emoji-row"><button type="button" data-comment-emoji="😊" aria-label="Chèn mặt cười">😊</button><button type="button" data-comment-emoji="✅" aria-label="Chèn dấu hoàn thành">✅</button><button type="button" data-comment-emoji="🙏" aria-label="Chèn lời cảm ơn">🙏</button><label class="task-attach-button" title="Đính kèm tài liệu">📎<input type="file" data-task-attachment="comment" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.docx,.xlsx" hidden></label></div></div><button class="btn btn-primary" type="submit">${ic('send')} Gửi</button></form>${taskAttachmentsHTML(t,'comment')}</section></div><div class="detail-side-col"><div class="detail-action-card"><div class="detail-action-title">${ic('activity',15)} Thao tác thực hiện</div><div class="detail-action-buttons">${actions.join('')||'<span class="small muted">Không có thao tác khả dụng với trạng thái và vai trò hiện tại.</span>'}</div><div style="margin-top:14px"><div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px"><span class="small muted">Tiến độ hiện tại</span><strong>${fmtNum(t.progress)}%</strong></div><div class="progressbar" style="width:100%"><span style="width:${t.progress}%"></span></div></div></div><div class="detail-side-props"><div class="kv"><small>Phụ trách</small><strong>${safe(t.assignee)}</strong></div><div class="kv"><small>Người giao</small><strong>${safe(t.creator)}</strong></div><div class="kv"><small>Chỉ tiêu KPI</small>${canEdit&&t.status!=='COMPLETED'?`<form data-detail-form="kpi" style="margin-top:4px"><select class="field small-field" name="kpi_id" data-detail-kpi-select style="font-size:12px;padding:3px 6px"><option value="">-- Chưa gắn KPI --</option>${(state.departmentKpis||[]).map(k=>`<option value="${safe(k.id)}" ${k.id===t.kpi_id?'selected':''}>[${safe(k.code||k.id)}] ${safe(k.name)}</option>`).join('')}</select></form>`:`<strong>${t.kpi_id?`[${safe(t.kpi_id)}] ${safe(t.kpi_name||'')}`:'<span class=\"muted\">Chưa gắn KPI</span>'}</strong>`}</div><div class="kv"><small>Bắt đầu</small><strong>${dateHuman(t.start_date)}</strong></div><div class="kv"><small>Hạn xử lý</small><strong>${deadlineHuman(t)}</strong>${hasExtensions?`<div style="margin-top:4px"><span class="tag late" style="font-size:10.5px">Đã gia hạn ${t.extensions_count} lần (Hạn gốc: ${dateHuman(t.original_due||t.due)})</span></div>`:''}${canEdit&&t.status!=='COMPLETED'?(requiresFormalExtension?`<button type="button" class="btn btn-min" style="margin-top:6px;width:100%;font-size:11px" data-action="open-extend-modal">${ic('clock',13)} Xin gia hạn (có lý do)</button>`:`<form data-detail-form="quick-due" style="margin-top:6px;display:flex;flex-direction:column;gap:4px"><div style="display:flex;gap:4px"><input class="field small-field" type="date" name="due" value="${safe(t.due)}" required style="font-size:11px;padding:3px 6px"><input class="field small-field" type="time" name="due_time" value="${safe(t.due_time||'')}" style="font-size:11px;padding:3px 6px;max-width:85px"></div><button class="btn btn-min" type="submit" style="font-size:11px;padding:3px 8px">${ic('check',11)} Đổi hạn nhanh</button></form>`):''}</div><div class="kv"><small>Ưu tiên</small><span class="tag ${priorities[t.priority]}">${priority[t.priority]}</span></div><div class="kv"><small>Nghiệm thu</small><strong>${t.review?'Có':'Không'}</strong></div></div><section class="detail-section"><div class="detail-section-head"><h3 class="detail-history-title">Check-in tiến độ</h3></div><div class="checkin-list">${(t.checkins?.length?t.checkins.slice().reverse().map(c=>`<div class="checkin-box"><strong class="small">${fmtNum(c.pct)}% · ${dateHuman(c.at)}</strong><div class="small muted">${safe(c.text)}</div></div>`).join(''):'<p class="small muted">Chưa có check-in nào.</p>')}</div></section><section class="detail-section"><div class="detail-section-head"><h3 class="detail-history-title">Lịch sử xử lý</h3></div><div class="history">${(t.events?.length?t.events.slice().reverse().map(e=>`<div class="history-item">${safe(e.text)}<div class="muted">${safe(e.actor)} · ${dateHuman(e.at)}</div></div>`).join(''):'<div class="history-item">Đã khởi tạo công việc</div>')}</div></section>${!canEdit?'<div class="ai-tip"><div class="tip-icon">'+ic('info')+'</div><div class="small">Bạn chỉ có thể thêm bình luận. Chỉnh sửa mô tả, kết quả và công việc con dành cho người giao, người thực hiện hoặc người quản lý.</div></div>':''}</div></div></aside>`}
function modalHTML(){if(state.modal==='create'){return `<div class="modal-backdrop" data-action="modal-close"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Tạo công việc"><div class="modal-head"><h2>Tạo công việc</h2><button class="icon-btn" data-action="modal-close" aria-label="Đóng">${ic('close')}</button></div><form id="createTask"><div class="modal-body"><label class="formlabel" for="title">Tên công việc *</label><input class="field" id="title" name="title" minlength="4" maxlength="160" required placeholder="Ví dụ: Rà soát KPI tháng 10" autofocus><label class="formlabel" for="project">Dự án</label><select class="field" id="project" name="project">${[...new Set([...state.tasks.map(t=>t.project),'Công việc độc lập'])].map(x=>`<option>${safe(x)}</option>`).join('')}</select><label class="formlabel" for="create_kpi_id">Chỉ tiêu KPI phòng ban</label><select class="field" id="create_kpi_id" name="kpi_id"><option value="">-- Không gắn KPI / Thường quy --</option>${(state.departmentKpis||[]).map(k=>`<option value="${safe(k.id)}">[${safe(k.code||k.id)}] ${safe(k.name)} (${safe(k.category||'')})</option>`).join('')}</select><div class="field-row task-date-fields"><div><label class="formlabel" for="start_date">Thời gian bắt đầu *</label><input class="field" id="start_date" name="start_date" required type="date" value="${addDays(0)}"></div><div class="task-deadline-fields"><label><span class="formlabel">Hạn hoàn thành *</span><input class="field" id="due" name="due" required type="date" value="${addDays(7)}"></label><label><span class="formlabel">Giờ (tùy chọn)</span><input class="field" id="due_time" name="due_time" type="time"></label></div></div><label class="formlabel" for="employee-search-create">Người thực hiện *</label>${employeePickerMarkup('create')}<div class="field-row"><div><label class="formlabel" for="prio">Ưu tiên</label><select class="field" id="prio" name="priority"><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="LOW">Thấp</option></select></div><div><label class="formlabel" for="progress">Tiến độ ban đầu</label><input class="field" id="progress" disabled value="0% (khi tạo)"></div></div><label class="checkline"><input type="checkbox" name="review" checked> Cần phê duyệt kết quả trước khi hoàn thành</label><label class="formlabel" for="reviewer_id">Người nghiệm thu *</label><select class="field" id="reviewer_id" name="reviewer_id" required><option value="">Chọn người nghiệm thu</option>${state.reviewerUsers.map(user=>`<option value="${safe(user.id)}">${safe(user.name)} · ${safe(user.role_label)}</option>`).join('')}</select><div class="small muted" style="margin-top:15px">${state.reviewerUsers.length?'Người nghiệm thu phải đang hoạt động, có quyền duyệt và nằm trong phạm vi của công việc.':'Chưa có tài khoản đang hoạt động được cấp quyền nghiệm thu. Bạn có thể bỏ chọn yêu cầu nghiệm thu để dùng luồng hoàn thành demo hiện hành.'} Chọn rõ người thực hiện và người nghiệm thu trước khi tạo.</div></div><div class="modal-footer"><button class="btn" type="button" data-action="modal-close">Hủy</button><button class="btn btn-primary" type="submit">${ic('plus')} Tạo công việc</button></div></form></div>`}
 if(state.modal==='extend'){const t=state.tasks.find(x=>x.id===state.detail);if(!t)return '';const currentDue=t.due||localDateString(new Date());return `<div class="modal-backdrop" data-action="modal-close"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Gia hạn công việc"><div class="modal-head"><h2>${ic('clock',18)} Yêu cầu gia hạn công việc</h2><button class="icon-btn" data-action="modal-close">${ic('close')}</button></div><form id="extendTaskForm"><div class="modal-body"><div class="ai-tip" style="margin-bottom:14px"><div class="tip-icon">${ic('info',18)}</div><div class="small">Công việc <strong>“${safe(t.title)}”</strong> thuộc dự án / ưu tiên cao / quá hạn. Cần giải trình lý do chính đáng để lưu vết audit log.</div></div><div class="kv" style="margin-bottom:12px;background:var(--card-subtle);padding:8px 12px;border-radius:6px"><small>Hạn hiện tại:</small><strong>${deadlineHuman(t)} ${t.original_due?`(Hạn ban đầu: ${dateHuman(t.original_due)})`:''}</strong></div><div class="field-row"><div><label class="formlabel" for="extend_due">Hạn mới đề xuất *</label><input class="field" id="extend_due" name="new_due" type="date" required min="${currentDue}" value="${addDays(3)}"></div><div><label class="formlabel" for="extend_due_time">Giờ mới (tùy chọn)</label><input class="field" id="extend_due_time" name="new_due_time" type="time" value="${safe(t.due_time||'')}"></div></div><label class="formlabel" for="reason_preset">Nhóm lý do gia hạn *</label><select class="field" id="reason_preset" name="reason_preset" required><option value="Chờ phụ thuộc bên thứ ba / đối tác">Chờ phụ thuộc bên thứ ba / đối tác</option><option value="Phát sinh yêu cầu kỹ thuật phức tạp">Phát sinh yêu cầu kỹ thuật phức tạp</option><option value="Thay đổi phạm vi / yêu cầu từ cấp trên">Thay đổi phạm vi / yêu cầu từ cấp trên</option><option value="Ưu tiên xử lý sự cố khẩn cấp khác">Ưu tiên xử lý sự cố khẩn cấp khác</option><option value="Lý do khác">Lý do khác (ghi rõ bên dưới)</option></select><label class="formlabel" for="reason_detail">Giải trình chi tiết * (tối thiểu 10 ký tự)</label><textarea class="field" id="reason_detail" name="reason_detail" required minlength="10" maxlength="1000" rows="3" placeholder="Nêu rõ vướng mắc cụ thể và phương án khắc phục..."></textarea></div><div class="modal-footer"><button class="btn" data-action="modal-close" type="button">Hủy</button><button class="btn btn-primary" type="submit">${ic('check')} Xác nhận gia hạn</button></div></form></div>`}
 if(state.modal==='checkin')return `<div class="modal-backdrop" data-action="modal-close"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Check-in tiến độ"><div class="modal-head"><h2>Cập nhật check-in</h2><button class="icon-btn" data-action="modal-close">${ic('close')}</button></div><form id="checkinTask"><div class="modal-body"><label class="formlabel" for="pct">Tiến độ (%) *</label><input id="pct" name="pct" class="field" type="number" min="0" max="100" required value="${state.tasks.find(t=>t.id===state.detail)?.progress||0}"><label class="formlabel" for="comment">Kết quả / vướng mắc *</label><textarea class="field" id="comment" name="comment" required minlength="5" placeholder="Mô tả đã làm được gì, cần hỗ trợ gì..."></textarea><div class="small muted">Bản Demo ghi nhận nội dung check-in, không tải tệp lên máy chủ.</div></div><div class="modal-footer"><button class="btn" type="button" data-action="modal-close">Hủy</button><button class="btn btn-primary" type="submit">Lưu check-in</button></div></form></div>`;
 if(state.modal==='reject')return `<div class="modal-backdrop" data-action="modal-close"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Trả lại kết quả"><div class="modal-head"><h2>Trả lại kết quả</h2><button class="icon-btn" data-action="modal-close">${ic('close')}</button></div><form id="rejectTask"><div class="modal-body"><label class="formlabel" for="reason">Lý do trả lại *</label><textarea class="field" id="reason" name="reason" required minlength="5" placeholder="Nêu rõ thông tin hoặc bằng chứng cần bổ sung..."></textarea><p class="small muted">Công việc chuyển về Đang thực hiện. Lịch sử đánh giá được giữ lại.</p></div><div class="modal-footer"><button class="btn" data-action="modal-close" type="button">Hủy</button><button class="btn btn-danger" type="submit">Trả lại công việc</button></div></form></div>`;
 return ''}
function mascotHTML(){
 if(isAdminView()||state.ai||state.detail)return '';
 const briefing=state.aiBriefing;
 const count=briefing?.attention_count||0;
 const overdueCount=briefing?.overdue_count||0;
 const urgentCount=briefing?.urgent_count||0;
 const dueTodayCount=briefing?.due_today_count||0;
 const hasAlert=count>0;

 let quoteText='Hôm nay bạn làm rất tốt! Cùng bứt phá nhé! ✨';
 if(overdueCount>0){
  quoteText=`Cố lên nhé! Bạn có <strong>${overdueCount} việc quá hạn</strong> cần xử lý 💪`;
 }else if(urgentCount>0){
  quoteText=`Tập trung nào! Có <strong>${urgentCount} việc ưu tiên cao</strong> hôm nay 🚀`;
 }else if(dueTodayCount>0){
  quoteText=`Hôm nay có <strong>${dueTodayCount} việc đến hạn</strong>. Cùng hoàn thành nhé! 📅`;
 }else if(count>0){
  quoteText=`Có <strong>${count} việc</strong> cần chú ý. Tôi luôn đồng hành cùng bạn! 💡`;
 }

 let savedPos='';
 try{
  const p=JSON.parse(localStorage.getItem('bfc_mascot_pos')||'null');
  if(p&&typeof p.left==='number'&&typeof p.top==='number'){
   savedPos=`style="left:${p.left}px;top:${p.top}px;right:auto;bottom:auto;"`;
  }
 }catch{}

 return `<div class="ai-mascot-widget ${hasAlert?'has-attention':''} ${state.aiLoadingBriefing?'is-loading':''}" ${savedPos} data-action="ai" role="button" tabindex="0" aria-label="Mở Trợ lý AI BFC">
  <div class="ai-mascot-speech" title="Nhấp để mở Trợ lý AI">
   <span class="ai-mascot-speech-icon">${ic('sparkles',12)}</span>
   <span class="ai-mascot-speech-text">${quoteText}</span>
  </div>
  <div class="ai-mascot-avatar">
   <div class="mascot-halo"></div>
   ${hasAlert?`<div class="ai-mascot-badge" title="${count} việc cần chú ý"><span class="badge-dot"></span><span class="badge-num">${count>99?'99+':count}</span></div>`:''}
   <svg class="mascot-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
     <linearGradient id="mHeadGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="25%" stop-color="#EDE7F6"/>
      <stop offset="70%" stop-color="#9C27B0"/>
      <stop offset="100%" stop-color="#5E1B5A"/>
     </linearGradient>
     <linearGradient id="mBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#E1BEE7"/>
      <stop offset="100%" stop-color="#7C2A76"/>
     </linearGradient>
     <linearGradient id="mVisorGrad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#1A1A2E"/>
      <stop offset="100%" stop-color="#080814"/>
     </linearGradient>
     <linearGradient id="mEyeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E5FF"/>
      <stop offset="100%" stop-color="#18FFFF"/>
     </linearGradient>
     <linearGradient id="mGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD54F"/>
      <stop offset="50%" stop-color="#FF9800"/>
      <stop offset="100%" stop-color="#CD8B2D"/>
     </linearGradient>
     <filter id="mCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
     </filter>
    </defs>
    <!-- Vòng đệm từ trường chống trọng lực -->
    <ellipse cx="40" cy="73" rx="18" ry="4" fill="#00E5FF" opacity="0.4" filter="url(#mCyanGlow)"/>
    <ellipse cx="40" cy="71" rx="14" ry="3" fill="#B388FF" opacity="0.6"/>
    <!-- Thân robot nhỏ gọn -->
    <rect x="26" y="44" width="28" height="22" rx="11" fill="url(#mBodyGrad)" stroke="#B388FF" stroke-width="1.2"/>
    <!-- Lõi năng lượng ngực robot BFC Arc Core -->
    <circle cx="40" cy="55" r="5" fill="#0D0D19"/>
    <polygon class="mascot-reactor-core" points="40,51 43.5,55 40,59 36.5,55" fill="url(#mGoldGrad)" filter="url(#mCyanGlow)"/>
    <!-- Tay trái -->
    <rect x="19" y="48" width="6" height="12" rx="3" fill="url(#mBodyGrad)" stroke="#9C27B0" stroke-width="1"/>
    <!-- Tay phải vẫy chào -->
    <g class="mascot-wave-arm">
     <rect x="55" y="42" width="6" height="13" rx="3" fill="url(#mBodyGrad)" stroke="#9C27B0" stroke-width="1"/>
     <circle cx="58" cy="40" r="3.5" fill="url(#mGoldGrad)"/>
    </g>
    <!-- Ăng-ten quả cầu trí tuệ -->
    <line x1="40" y1="18" x2="40" y2="10" stroke="#CD8B2D" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="40" cy="8" r="4" fill="#00E5FF" filter="url(#mCyanGlow)"/>
    <circle cx="39" cy="7" r="1.5" fill="#FFFFFF"/>
    <!-- Tai nghe Cyber 2 bên -->
    <rect x="10" y="24" width="6" height="16" rx="3" fill="url(#mGoldGrad)"/>
    <rect x="64" y="24" width="6" height="16" rx="3" fill="url(#mGoldGrad)"/>
    <circle cx="13" cy="32" r="2" fill="#00E5FF"/>
    <circle cx="67" cy="32" r="2" fill="#00E5FF"/>
    <!-- Đầu robot mũ bảo hộ 3D bo tròn -->
    <rect x="14" y="16" width="52" height="38" rx="19" fill="url(#mHeadGrad)" stroke="#D1C4E9" stroke-width="1.8"/>
    <!-- Highlight vòm kính mũ -->
    <path d="M 22 20 Q 40 14 58 20" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
    <!-- Kính Visor OLED cong 3D -->
    <rect x="19" y="23" width="42" height="24" rx="12" fill="url(#mVisorGrad)" stroke="#7C2A76" stroke-width="1.2"/>
    <path d="M 23 27 Q 40 23 57 27" stroke="#4A148C" stroke-width="1.2" opacity="0.7"/>
    <!-- Đôi mắt LED Cyan Biểu Cảm Chớp Mắt -->
    <g class="mascot-eye">
     <path d="M 27 34 Q 32 30 37 34" stroke="url(#mEyeGrad)" stroke-width="3.5" stroke-linecap="round" filter="url(#mCyanGlow)"/>
     <circle cx="32" cy="31.5" r="1.5" fill="#FFFFFF"/>
     <path d="M 43 34 Q 48 30 53 34" stroke="url(#mEyeGrad)" stroke-width="3.5" stroke-linecap="round" filter="url(#mCyanGlow)"/>
     <circle cx="48" cy="31.5" r="1.5" fill="#FFFFFF"/>
    </g>
    <!-- Má hồng công nghệ phấn khởi -->
    <ellipse cx="25" cy="39" rx="2.5" ry="1.2" fill="#FF4081" opacity="0.75"/>
    <ellipse cx="55" cy="39" rx="2.5" ry="1.2" fill="#FF4081" opacity="0.75"/>
    <!-- Nụ cười LED tinh nghịch -->
    <path d="M 37 39 Q 40 42 43 39" stroke="url(#mEyeGrad)" stroke-width="1.8" stroke-linecap="round"/>
   </svg>
  </div>
  <div class="ai-mascot-label">
   <span>Bot AI</span>
  </div>
 </div>`;
}
function taskDraftHTML(){
 const draft=state.pendingTaskDraft;if(!draft)return '';
 const reviewers=state.reviewerUsers||[];
 const projectOptions=(state.projects||[]).map(p=>`<option value="${safe(p.id)}" ${(draft.project_id===p.id||draft.project===p.name)?'selected':''}>${safe(p.name)}</option>`).join('');
 const reviewerOptions=reviewers.map(r=>`<option value="${safe(r.id)}" ${draft.reviewer_id===r.id?'selected':''}>${safe(r.name)} (${safe(r.role_label)})</option>`).join('');
 const isSelf=draft.assigneeId===meUser()?.id;
 const canAssign=canAssignTasks()||(state.permissions.includes('tasks.create')&&isSelf);
 return `<section class="task-draft" aria-label="Nháp công việc">
  <strong>${ic('sparkles',16)} Nháp công việc chờ xác nhận</strong>
  <div><span>Công việc:</span> <strong>${safe(draft.title)}</strong></div>
  <div><span>Người nhận:</span></div>
  <label class="formlabel" for="employee-search-draft">Tìm và xác nhận nhân viên *</label>
  ${employeePickerMarkup('draft',draft.assigneeId)}
  <div style="margin-top:10px">
   <label class="task-draft-option">
    <span>Dự án</span>
    <select class="field" data-draft-field="project_id" aria-label="Chọn dự án">
     <option value="">-- Công việc độc lập --</option>
     ${projectOptions}
    </select>
   </label>
  </div>
  <div style="margin-top:10px">
   <label class="task-draft-option">
    <span>Chỉ tiêu KPI</span>
    <select class="field" data-draft-field="kpi_id" aria-label="Chọn chỉ tiêu KPI">
     <option value="">-- Không gắn KPI / Thường quy --</option>
     ${(state.departmentKpis||[]).map(k=>`<option value="${safe(k.id)}" ${draft.kpi_id===k.id?'selected':''}>[${safe(k.code||k.id)}] ${safe(k.name)}</option>`).join('')}
    </select>
   </label>
   ${draft.kpi_id?`<div class="small muted" style="margin-top:4px;color:var(--brand-primary);display:flex;align-items:center;gap:4px">${ic('sparkles',13)} <span>AI đã khớp KPI phòng ban: <strong>[${safe(draft.kpi_id)}]</strong></span></div>`:''}
  </div>
  <div><span>Thời gian bắt đầu:</span> ${dateHuman(draft.start_date)}</div>
  <div><span>Hạn hoàn thành:</span> ${deadlineHuman(draft)} <span class="muted">(${safe(draft.dueNote)})</span></div>
  <div class="task-draft-options">
   <label class="task-draft-option">
    <span>Ưu tiên</span>
    <select class="field" aria-label="Chọn mức ưu tiên" data-draft-field="priority">
     <option value="LOW" ${draft.priority==='LOW'?'selected':''}>Thấp</option>
     <option value="MEDIUM" ${draft.priority==='MEDIUM'?'selected':''}>Trung bình</option>
     <option value="HIGH" ${draft.priority==='HIGH'?'selected':''}>Cao</option>
    </select>
   </label>
   <label class="task-draft-option">
    <span>Nghiệm thu</span>
    <select class="field" aria-label="Chọn yêu cầu nghiệm thu" data-draft-field="review">
     <option value="false" ${draft.review?'':'selected'}>Không cần nghiệm thu</option>
     <option value="true" ${draft.review?'selected':''}>Cần nghiệm thu</option>
    </select>
   </label>
  </div>
  ${draft.review?`<div style="margin-top:8px"><label class="task-draft-option"><span>Người nghiệm thu</span><select class="field" data-draft-field="reviewer_id" aria-label="Chọn người nghiệm thu"><option value="">-- Chọn người nghiệm thu --</option>${reviewerOptions}</select></label></div>`:''}
  ${draft.subtasks&&draft.subtasks.length?`<div class="draft-subtasks"><strong>${ic('list',14)} Đầu việc con bóc tách (${draft.subtasks.length}):</strong>${draft.subtasks.map((s,i)=>`<div class="draft-subtask-item">${i+1}. ${safe(s.title)}</div>`).join('')}</div>`:''}
  <div class="small muted" style="margin-top:8px">${isSelf?'Bạn đang tạo công việc cho chính mình.':'Kiểm tra lại người nhận trước khi xác nhận giao việc.'}</div>
  <div class="task-draft-actions">
   <button type="button" class="btn" data-action="cancel-task-draft">Hủy nháp</button>
   <button type="button" class="btn btn-primary" data-action="confirm-task-draft" ${draft.assigneeId&&canAssign?'':'disabled'}>${ic('check')} ${isSelf?'Xác nhận tạo việc':'Xác nhận giao việc'}</button>
  </div>
 </section>`;
}
function aiHTML(){
 const briefing=state.aiBriefing;
 const currentTab=state.aiBriefingTab||'all';
 let activeTasks=[];
 let tabTitle='Toàn bộ việc cần chú ý';
 if(currentTab==='overdue'){
  activeTasks=briefing?.overdue_tasks||(state.tasks||[]).filter(overdue);
  tabTitle=`Danh sách công việc quá hạn (${activeTasks.length})`;
 }else if(currentTab==='urgent'){
  activeTasks=briefing?.urgent_tasks||(state.tasks||[]).filter(t=>['HIGH','URGENT'].includes(t.priority)&&t.status!=='COMPLETED');
  tabTitle=`Danh sách công việc gấp (Ưu tiên cao) (${activeTasks.length})`;
 }else if(currentTab==='today'){
  activeTasks=briefing?.due_today_tasks||[];
  tabTitle=`Danh sách công việc đến hạn hôm nay (${activeTasks.length})`;
 }else{
  activeTasks=briefing?.all_critical_tasks||briefing?.critical_tasks||[];
  tabTitle=`Toàn bộ công việc cần chú ý (${activeTasks.length})`;
 }

 return `<div class="panel-backdrop ${state.aiOpening?'backdrop-anim':''}" data-action="ai-close"></div>
 <aside class="ai-panel ${state.aiOpening?'ai-panel-slide':''}" role="dialog" aria-modal="true" aria-label="Trợ lý công việc">
  <div class="ai-header">
   <div style="display:flex;align-items:center;gap:12px">
    <div style="width:38px;height:38px;border-radius:50%;background:#5E1B5A;display:grid;place-items:center;box-shadow:0 0 12px rgba(0,229,255,0.45)">
     <svg width="26" height="26" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="32" fill="#7C2A76"/>
      <rect x="22" y="24" width="36" height="26" rx="10" fill="#0B0C1E"/>
      <path d="M 28 36 Q 32 32 36 36" stroke="#00E5FF" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M 44 36 Q 48 32 52 36" stroke="#00E5FF" stroke-width="2.8" stroke-linecap="round"/>
      <polygon points="40,54 43,57 40,60 37,57" fill="#FF9800"/>
     </svg>
    </div>
    <div>
     <strong>Trợ lý AI BFC · Smart Work</strong>
     <small>${safe(meName())} · ${safe(state.authUser?.role_label)}</small>
    </div>
   </div>
   <button class="icon-btn" data-action="ai-close" aria-label="Đóng trợ lý">${ic('close')}</button>
  </div>
  <div class="ai-body" id="chatBody">
   ${briefing?`<div class="ai-briefing-card">
    <div class="briefing-head">
     <div class="briefing-title">${ic('sparkles',16)} <span>Điểm tin thông minh</span></div>
     <button type="button" class="btn btn-min" data-action="refresh-briefing" style="font-size:11px;padding:2px 8px">${ic('activity',13)} Cập nhật</button>
    </div>
    ${briefing.memory_note?`<div class="briefing-memory-note">${safe(briefing.memory_note)}</div>`:''}
    <div class="briefing-stats" role="tablist" aria-label="Lọc nhanh việc cần chú ý">
     <button type="button" class="briefing-pill all ${currentTab==='all'?'is-active':''}" data-action="briefing-tab" data-tab="all" title="Xem tất cả việc cần chú ý">
      ${ic('target',13)} Tất cả (${briefing.attention_count||0})
     </button>
     ${briefing.overdue_count>0?`<button type="button" class="briefing-pill overdue ${currentTab==='overdue'?'is-active':''}" data-action="briefing-tab" data-tab="overdue" title="Bấm để xem danh sách việc quá hạn">
      ${ic('alert',13)} ${briefing.overdue_count} quá hạn
     </button>`:''}
     ${briefing.urgent_count>0?`<button type="button" class="briefing-pill urgent ${currentTab==='urgent'?'is-active':''}" data-action="briefing-tab" data-tab="urgent" title="Bấm để xem danh sách việc gấp">
      ${ic('clock',13)} ${briefing.urgent_count} việc gấp
     </button>`:''}
     ${briefing.due_today_count>0?`<button type="button" class="briefing-pill today ${currentTab==='today'?'is-active':''}" data-action="briefing-tab" data-tab="today" title="Bấm để xem danh sách việc hạn hôm nay">
      ${ic('check',13)} ${briefing.due_today_count} hạn hôm nay
     </button>`:''}
    </div>
    <div class="briefing-list-header">
     <span>${safe(tabTitle)}</span>
     <small class="muted">Nhấp vào việc để mở chi tiết</small>
    </div>
    <div class="briefing-critical-list">
     ${activeTasks.length?activeTasks.map(t=>`<div class="briefing-task-item" data-action="open-briefing-task" data-id="${safe(t.id)}">
      <div class="task-item-main">
       <strong>${safe(t.title)}</strong>
       <div class="task-item-meta">
        <span>${safe(t.project||'Công việc độc lập')}</span>
        <span>·</span>
        <span>${safe(t.assignee)}</span>
       </div>
      </div>
      <div class="briefing-task-action">
       <span class="tag ${tagClass[t.status]||'todo'}">${deadlineHuman(t)}</span>
       ${ic('arrow-right',13)}
      </div>
     </div>`).join(''):'<div class="small muted" style="padding:10px;text-align:center">Không có công việc nào trong mục này.</div>'}
    </div>
    ${activeTasks.length?`<button type="button" class="btn briefing-jump-btn" data-action="filter-main-tasks" data-filter="${safe(currentTab)}">
     ${ic('list',13)} Xem nhóm này trên bảng công việc chính ${ic('arrow-right',13)}
    </button>`:''}
   </div>`:''}
   <div class="ai-suggestions">
    <button class="suggestion" data-prompt="Hôm nay tôi cần làm gì?">Hôm nay tôi cần làm gì?</button>
    <button class="suggestion" data-prompt="Việc ưu tiên cao nào chưa xong?">Việc ưu tiên cao</button>
    <button class="suggestion" data-prompt="Công việc quá hạn">Việc quá hạn</button>
    <button class="suggestion" data-prompt="Tiến độ các dự án">Tiến độ dự án</button>
   </div>
   ${state.aiMessages.map(m=>`<div class="ai-bubble ${m.who}">${safe(m.text)}</div>`).join('')}
   ${state.aiThinking?`<div class="ai-thinking"><span>Trợ lý AI đang xử lý</span><div class="ai-thinking-dots"><span></span><span></span><span></span></div></div>`:''}
   ${taskDraftHTML()}
  </div>
  <form class="ai-input" id="aiForm">
   <input class="field" id="aiQuery" autocomplete="off" aria-label="Nhập prompt giao việc" placeholder="Ví dụ: tạo việc ... cho nhân viên ... hạn mai 4h30" required ${state.aiThinking?'disabled':''}>
   <button class="btn btn-primary" aria-label="Gửi" type="submit" ${state.aiThinking?'disabled':''}>${ic('send')}</button>
  </form>
  <div class="ai-foot">Zero-Trust RBAC: Chỉ truy xuất dữ liệu trong phạm vi của bạn. Kết nối OpenAI / Bộ phân tích dữ liệu cục bộ.</div>
 </aside>`;
}
function authPage(){
 const register=state.authScreen==='register',pending=state.authScreen==='pending';
 const registrationFields=register?`<label class="formlabel" for="authName">Họ và tên *</label><input class="field" id="authName" name="name" minlength="2" maxlength="120" required><label class="formlabel" for="authDepartment">Phòng ban *</label><input class="field" id="authDepartment" name="department" maxlength="120" required><label class="formlabel" for="authTitle">Chức vụ dự kiến</label><input class="field" id="authTitle" name="job_title" maxlength="120">`:'';
 const passwordConfirmation=register?`<label class="formlabel" for="authPasswordConfirmation">Xác nhận mật khẩu *</label><input class="field" id="authPasswordConfirmation" name="password_confirmation" type="password" minlength="8" maxlength="200" required autocomplete="new-password"><p class="login-note">Email công ty phải thuộc miền đã được Quản trị hệ thống cấu hình. Nhập email không đồng nghĩa đã xác minh quyền sở hữu.</p>`:'';
 const content=pending
  ?`<div class="auth-card-content"><span class="auth-kicker">HOÀN TẤT ĐĂNG KÝ</span><h2>Đang chờ cấp quyền</h2><p>${safe(state.authMessage||'Yêu cầu đã được gửi đến Quản trị hệ thống. Bạn sẽ truy cập được sau khi được duyệt.')}</p><button class="btn" data-action="auth-screen" data-screen="login">Quay lại đăng nhập</button></div>`
  :`<div class="auth-card-content"><span class="auth-kicker">${register?'TẠO TÀI KHOẢN':'CHÀO MỪNG TRỞ LẠI'}</span><h2>${register?'Đăng ký tài khoản':'Đăng nhập'}</h2><p>${register?'Tạo yêu cầu truy cập. Quản trị viên sẽ kiểm tra và cấp vai trò.':'Đăng nhập bằng tài khoản đã được Quản trị hệ thống kích hoạt.'}</p>${state.authMessage?`<div class="auth-error" role="alert">${safe(state.authMessage)}</div>`:''}<form id="${register?'authRegister':'authLogin'}">${registrationFields}<label class="formlabel" for="authEmail">Email công ty *</label><input class="field" id="authEmail" name="email" type="email" maxlength="190" required autocomplete="username"><label class="formlabel" for="authPassword">Mật khẩu *</label><input class="field" id="authPassword" name="password" type="password" minlength="8" required autocomplete="${register?'new-password':'current-password'}">${passwordConfirmation}<button class="btn btn-primary" type="submit">${register?'Gửi yêu cầu cấp quyền':'Đăng nhập'} ${ic('arrow-right')}</button></form><p class="login-note">${register?'Đã có tài khoản?':'Chưa có tài khoản?'} <button class="link-button" data-action="auth-screen" data-screen="${register?'login':'register'}">${register?'Đăng nhập':'Đăng ký'}</button></p><p class="login-note">Không thể đăng nhập? Liên hệ Quản trị hệ thống để kiểm tra trạng thái tài khoản.</p></div>`;
 return `<div class="login-wrap auth-screen-${pending?'pending':register?'register':'login'}"><div class="login-left"><div class="auth-orbit auth-orbit-one"></div><div class="auth-orbit auth-orbit-two"></div><div class="login-logo-panel"><img src="/images/bfc/logo-bfc-on-purple.png" alt="BFC — Khác biệt để bứt phá"></div><div class="login-pitch"><span class="auth-kicker">KHÔNG GIAN LÀM VIỆC BFC</span><h1>Quản lý công việc.<br>Chủ động mỗi ngày.</h1><p>Không gian làm việc tập trung, rõ trách nhiệm và theo dõi tiến độ dễ dàng.</p><div class="login-benefits"><span>${ic('check',15)} Rõ trách nhiệm</span><span>${ic('activity',15)} Minh bạch tiến độ</span><span>${ic('shield',15)} Phân quyền rõ ràng</span></div></div><p class="small login-local-note">Chế độ local trên máy chủ Laravel · Không phải dịch vụ triển khai cho mạng công cộng</p></div><div class="login-right"><div class="login-card"><div class="login-card-brand"><img src="/images/bfc/logo-bfc.jpg" alt="BFC"><span class="auth-step">${pending?'03':register?'02':'01'} <i>/ 03</i></span></div>${content}</div></div></div>`;
}
function toast(msg){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.hidden=false;clearTimeout(toast._timer);toast._timer=setTimeout(()=>{if(el)el.hidden=true},3600)}
function go(page){if(page==='reports'){state.page='goals';state.reportView=true}else{state.page=page;if(page==='goals'){state.reportView=false;state.goalNavOpen=true}}state.detail=null;state.modal=null;state.mobile=false;state.search='';saveUi();layout();window.scrollTo({top:0,behavior:'instant'})}
function transition(action,taskId=state.detail){const t=state.tasks.find(x=>x.id===taskId);if(!t)return false;const changes={start:{from:['TODO'],to:'IN_PROGRESS',actor:'start',text:'Bắt đầu thực hiện'},resume:{from:['PAUSED'],to:'IN_PROGRESS',actor:'start',text:'Tiếp tục thực hiện'},submit:{from:['IN_PROGRESS'],to:t.review?'IN_REVIEW':'COMPLETED',actor:'submit',text:t.review?'Đã gửi yêu cầu nghiệm thu':'Đã hoàn thành không cần nghiệm thu'},approve:{from:['IN_REVIEW'],to:'COMPLETED',actor:'approve',text:'Phê duyệt kết quả công việc'}};const spec=changes[action];if(!spec||!spec.from.includes(t.status)||!roleAllowed(t,spec.actor)){toast('Không đủ quyền hoặc trạng thái chưa hợp lệ.');return false}if((action==='submit'||action==='approve')&&!requireCompletedSubtasks(t))return false;if(action==='submit'&&t.progress<100){toast('Cần check-in tiến độ đạt 100% trước khi gửi kết quả.');return false}const previous=structuredClone(t),now=new Date().toISOString();t.status=spec.to;if(action==='submit')t.submittedAt=now;if(action==='approve'){t.approvedAt=now;t.completedAt=now}if(action==='submit'&&spec.to==='COMPLETED')t.completedAt=now;t.events??=[];t.events.push({text:spec.text,actor:meName(),at:now});if(!save()){Object.assign(t,previous);toast('Không thể lưu thay đổi vào trình duyệt.');return false}layout();toast(spec.text);return true}
function transitionTaskToStatus(task,status){if(!task)return false;if(task.status===status||(status==='IN_PROGRESS'&&task.status==='PAUSED')){if(task.status===status)return false;if(task.status==='PAUSED')return transition('resume',task.id)}
 if(status==='IN_PROGRESS'&&task.status==='TODO')return transition('start',task.id);
 if(status==='IN_REVIEW'){if(task.status!=='IN_PROGRESS'){toast('Hãy chuyển công việc sang “Đang thực hiện” trước khi gửi nghiệm thu.');return false}if(!task.review){toast('Công việc này không yêu cầu nghiệm thu; hãy hoàn thành trực tiếp khi đủ điều kiện.');return false}return transition('submit',task.id)}
 if(status==='COMPLETED'){if(task.status==='IN_REVIEW')return transition('approve',task.id);if(task.status==='IN_PROGRESS'&&!task.review)return transition('submit',task.id);if(task.status==='IN_PROGRESS'&&task.review){toast('Công việc cần nghiệm thu. Hãy thả vào “Chờ duyệt”; người có quyền sẽ phê duyệt sau.');return false}toast('Hãy bắt đầu công việc trước khi chuyển sang hoàn thành.');return false}
 if(status==='TODO'){toast('Không thể kéo công việc ngược về “Cần thực hiện”.');return false}
 toast('Không thể chuyển công việc sang giai đoạn này.');return false}
root.addEventListener('dragstart',e=>{
 const taskCard=e.target.closest('.board-task');
 if(!taskCard)return;
 if(!e.dataTransfer){e.preventDefault();return}
 e.dataTransfer.setData('text/plain',taskCard.dataset.task);e.dataTransfer.effectAllowed='move';
 taskCard.classList.add('is-dragging');
});
root.addEventListener('dragend',e=>{
 e.target.closest('.board-task')?.classList.remove('is-dragging');
 root.querySelectorAll('.board-col.is-drop-target').forEach(column=>column.classList.remove('is-drop-target'));
});
root.addEventListener('dragover',e=>{
 const column=e.target.closest('[data-kanban-status]');
 if(!column)return;
 e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';
 column.classList.add('is-drop-target');
});
root.addEventListener('dragleave',e=>{
 const column=e.target.closest('[data-kanban-status]');
 if(column&&!column.contains(e.relatedTarget))column.classList.remove('is-drop-target');
});
root.addEventListener('drop',e=>{
 const column=e.target.closest('[data-kanban-status]');
 if(!column)return;
 e.preventDefault();
 const taskId=e.dataTransfer?.getData('text/plain'),task=state.tasks.find(item=>item.id===taskId);
 root.querySelectorAll('.board-col.is-drop-target').forEach(item=>item.classList.remove('is-drop-target'));
 if(task)transitionTaskToStatus(task,column.dataset.kanbanStatus);
});
root.addEventListener('change',e=>{
 const selector=e.target.closest('[data-board-move]');
 if(!selector||!selector.value)return;
 const task=state.tasks.find(item=>item.id===selector.dataset.boardMove);
 transitionTaskToStatus(task,selector.value);
});
function aiReply(q){const text=q.toLowerCase();const s=stats();if(/quá hạn|trễ hạn|gần hạn|deadline/.test(text)){const late=state.tasks.filter(overdue);return `Hiện có ${fmtNum(late.length)} công việc quá hạn.\n${late.map(x=>`• ${x.id}: ${x.title} (${x.assignee}, hạn ${dateHuman(x.due)})`).join('\n')||'Chưa có công việc quá hạn.'}\nGợi ý: liên hệ người thực hiện để cập nhật check-in và xác định vướng mắc.`}if(/duyệt|nghiệm thu|review/.test(text)){const t=state.tasks.filter(x=>x.status==='IN_REVIEW');return `Có ${fmtNum(t.length)} công việc chờ duyệt.\n${t.map(x=>`• ${x.title} — ${x.assignee}`).join('\n')||'Không có công việc chờ duyệt.'}\nĐề xuất: người có quyền review trong phạm vi được cấp kiểm tra và phê duyệt.`}if(/báo cáo|tiến độ|tổng hợp|kpi/.test(text)){return `Tổng hợp từ dữ liệu Demo:\n• ${fmtNum(s.all)} công việc\n• ${fmtNum(s.active)} đang thực hiện\n• ${fmtNum(s.review)} chờ duyệt\n• ${fmtNum(s.done)} đã hoàn thành\n• ${fmtNum(s.overdue)} quá hạn\n• Tiến độ trung bình ${fmtNum(s.avg)}%.\nLưu ý: số liệu chưa phải KPI BFC thực tế.`}if(/tạo|giao việc|phân công/.test(text)){return 'Tôi đề xuất tạo công việc với 4 thông tin tối thiểu: tên công việc, người thực hiện chính, hạn xử lý và dự án. Bạn có thể nhấn “Tạo công việc” ở trang Công việc để tạo bản ghi mẫu.'}return 'Hiện bản Demo chỉ hỗ trợ các nhóm câu hỏi: công việc quá hạn, chờ duyệt, báo cáo tiến độ và gợi ý giao việc. Khi tích hợp mô hình AI thật, trợ lý có thể phân tích yêu cầu tự do và lập đề xuất chi tiết hơn.'}
function normalizeForMatch(value){let text='',offsets=[];for(let i=0;i<value.length;){const char=String.fromCodePoint(value.codePointAt(i)),folded=char.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').replace(/đ/g,'d');for(let j=0;j<folded.length;j++)offsets.push(i);text+=folded;i+=char.length}offsets.push(value.length);return {text,offsets}}
function localDateString(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function dateFromParts(year,month,day){const date=new Date(year,month-1,day,12);return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date:null}
function parsePromptTime(prompt){
 const text=normalizeForMatch(prompt).text,match=/\b(\d{1,2})\s*(?::(\d{2})|h(?:\s*(ruoi|kem\s+\d{1,2}|\d{1,2}))?|gio(?:\s*(ruoi|kem\s+\d{1,2}|\d{1,2}))?|ruoi)(?:\s*phut)?\s*(sang|trua|chieu|toi|dem)?\b/.exec(text);
 if(!match)return null;
 let hour=Number(match[1]),minute=match[2]?Number(match[2]):0,minuteText=match[3]||match[4]||(/ruoi/.test(match[0])?'ruoi':''),period=match[5]||'';
 if(minuteText==='ruoi')minute=30;
 else if(minuteText?.startsWith('kem')){minute=60-Number(minuteText.replace(/\D/g,''));hour=(hour+1)%24}
 else if(minuteText)minute=Number(minuteText);
 if(minute>59)return {error:`Giờ “${match[0]}” không hợp lệ. Hãy ghi giờ từ 0 đến 23 và phút từ 00 đến 59.`};
 if(period&&hour>12)return {error:`Giờ “${match[0]}” không hợp lệ khi có buổi sáng/trưa/chiều/tối.`};
 if(hour>23)return {error:`Giờ “${match[0]}” không hợp lệ. Hãy ghi giờ từ 0 đến 23.`};
 if(period==='dem'||period==='sang')hour=hour===12?0:hour;
 else if(period==='chieu'||period==='toi')hour=hour<12?hour+12:hour;
 else if(period==='trua')hour=hour>0&&hour<12?hour+12:hour;
 const normalized=normalizeForMatch(prompt);
 return {due_time:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,note:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,range:{start:match.index,end:match.index+match[0].length},offsets:normalized.offsets};
}
function parsePromptDeadline(prompt){
 const normalized=normalizeForMatch(prompt),text=normalized.text,today=new Date(),currentYear=today.getFullYear(),time=parsePromptTime(prompt);
 if(time?.error)return time;
 const finish=(date,note,match)=>{const phrase=match?prompt.slice(normalized.offsets[match.index],normalized.offsets[match.index+match[0].length]).trim():note;return {due:localDateString(date),due_time:time?.due_time||'',dueNote:`hạn ${phrase||note}${time?` · ${time.note}`:''}`,dateRange:match?{start:match.index,end:match.index+match[0].length}:null,timeRange:time?.range||null,offsets:normalized.offsets}};
 const formatDate=(year,month,day,description,match)=>{const date=dateFromParts(year,month,day);return date?finish(date,description,match):{error:`Ngày hạn “${description}” không hợp lệ. Hãy kiểm tra lại ngày, tháng và năm.`}};
 const absolute=[
  {regex:/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/,order:0},
  {regex:/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/,order:1},
  {regex:/\b(?:ngay\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/,order:3},
  {regex:/\b(?:ngay\s+)?(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(20\d{2}))?\b/,order:2}
 ].map(item=>{const match=item.regex.exec(text);return match?{...item,match}:null}).filter(Boolean).sort((a,b)=>a.match.index-b.match.index)[0];
 if(absolute){
  const [first,second,third]=absolute.match.slice(1),year=absolute.order===0?Number(first):Number(third||currentYear),month=Number(second),day=absolute.order===0?Number(third):Number(first);
  const description=absolute.order===0?`${first}-${second.padStart(2,'0')}-${third.padStart(2,'0')}`:`${day}/${month}/${year}`;
  return formatDate(year,month,day,description,absolute.match);
 }
 const relative=/\b(?:trong\s+(?:vong\s+)?)?(?:sau\s+)?(\d{1,3})\s*(ngay|hom|tuan|thang)(?:\s+(?:toi|nua))?\b/.exec(text);
 if(relative&&(/\b(?:trong|sau)\b/.test(text.slice(Math.max(0,relative.index-16),relative.index+relative[0].length))||/\b(?:toi|nua)\b/.test(relative[0]))){
  const amount=Number(relative[1]),unit=relative[2],date=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
  if(unit==='ngay'||unit==='hom')date.setDate(date.getDate()+amount);
  else if(unit==='tuan')date.setDate(date.getDate()+amount*7);
  else date.setMonth(date.getMonth()+amount);
  return finish(date,`sau ${amount} ${unit}`,relative);
 }
 const relativeDay=[
  {regex:/\b(?:ngay kia|ngay mot|ngay mot nua)\b/,offset:2,note:'ngày kia'},
  {regex:/\b(?:ngay mai|mai)\b/,offset:1,note:'ngày mai'},
  {regex:/\b(?:hom nay|bay gio)\b/,offset:0,note:'hôm nay'}
 ].map(item=>{const match=item.regex.exec(text);return match?{...item,index:match.index,match}:null}).filter(Boolean).sort((a,b)=>a.index-b.index)[0];
 if(relativeDay){const date=new Date(today.getFullYear(),today.getMonth(),today.getDate()+relativeDay.offset,12);return finish(date,relativeDay.note,relativeDay.match)}
 const nextMonthStart=/\bdau thang sau\b/.exec(text);
 if(nextMonthStart)return finish(new Date(today.getFullYear(),today.getMonth()+1,1,12),'đầu tháng sau',nextMonthStart);
 const nextMonthEnd=/\bcuoi thang sau\b/.exec(text);
 if(nextMonthEnd)return finish(new Date(today.getFullYear(),today.getMonth()+2,0,12),'cuối tháng sau',nextMonthEnd);
 const monthStart=/\b(?:dau thang(?: nay)?|mung mot thang(?: nay)?)\b/.exec(text);
 if(monthStart)return finish(new Date(today.getFullYear(),today.getMonth(),1,12),'đầu tháng này',monthStart);
 const monthEnd=/\bcuoi thang(?: nay)?\b/.exec(text);
 if(monthEnd)return finish(new Date(today.getFullYear(),today.getMonth()+1,0,12),'cuối tháng này',monthEnd);
 const weekStart=/\bdau tuan(?:\s+(nay|sau|toi))?\b/.exec(text);
 if(weekStart){const date=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);date.setDate(date.getDate()-((date.getDay()+6)%7)+(weekStart[1]==='sau'||weekStart[1]==='toi'?7:0));return finish(date,weekStart[0],weekStart)}
 const weekdayNames={hai:1,ba:2,tu:3,nam:4,sau:5,bay:6},weekday=/\b(?:tuan\s+(nay|sau|toi)\s+)?(thu\s+(?:[2-7]|hai|ba|tu|nam|sau|bay)|chu nhat)(?:\s+tuan\s+(nay|sau|toi))?\b/.exec(text);
 if(weekday){const dayToken=weekday[2].replace(/\s+/g,' ').replace('thu ','');const targetDay=dayToken==='chu nhat'?0:/^\d$/.test(dayToken)?Number(dayToken)===7?6:Number(dayToken)-1:weekdayNames[dayToken]||0,date=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12),weekQualifier=weekday[1]||weekday[3];if(weekQualifier){const weekdayIndex=targetDay===0?6:targetDay-1;date.setDate(date.getDate()-((date.getDay()+6)%7)+weekdayIndex+(weekQualifier==='sau'||weekQualifier==='toi'?7:0))}else date.setDate(date.getDate()+(targetDay-date.getDay()+7)%7);return finish(date,weekday[0].replace(/\s+/g,' '),weekday)}
 const nextMonthDay=/\b(?:ngay|mung)\s+(\d{1,2})\s+thang\s+(?:sau|toi)\b/.exec(text);
 if(nextMonthDay){const targetMonth=new Date(today.getFullYear(),today.getMonth()+1,1,12),day=Number(nextMonthDay[1]),date=dateFromParts(targetMonth.getFullYear(),targetMonth.getMonth()+1,day);return date?finish(date,nextMonthDay[0],nextMonthDay):{error:`Ngày “${nextMonthDay[0]}” không hợp lệ.`}}
 const dayOfMonth=/\b(?:ngay|mung)\s+(\d{1,2})\b/.exec(text);
 if(dayOfMonth){let year=today.getFullYear(),month=today.getMonth(),day=Number(dayOfMonth[1]);let date=dateFromParts(year,month+1,day);if(!date)return {error:`Ngày “${dayOfMonth[0]}” không hợp lệ.`};if(date<new Date(today.getFullYear(),today.getMonth(),today.getDate(),12)){month++;if(month>11){year++;month=0}date=dateFromParts(year,month+1,day);if(!date)return {error:`Ngày “${dayOfMonth[0]}” không hợp lệ.`}}return finish(date,dayOfMonth[0],dayOfMonth)}
 const weekend=/\bcuoi tuan(?:\s+(nay|sau|toi))?\b/.exec(text);
 if(weekend){const date=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12),daysUntilSunday=(7-date.getDay())%7;date.setDate(date.getDate()+daysUntilSunday+(weekend[1]==='sau'||weekend[1]==='toi'?7:0));return finish(date,weekend[0],weekend)}
 if(/\b(?:han|deadline|ket thuc|hoan thanh|xong|truoc ngay)\b/.test(text)&&time){const now=new Date(),[hour,minute]=time.due_time.split(':').map(Number);if(hour<now.getHours()||hour===now.getHours()&&minute<=now.getMinutes())today.setDate(today.getDate()+1);return finish(new Date(today.getFullYear(),today.getMonth(),today.getDate(),12),'ngày gần nhất có giờ phù hợp',null)}
 if(/\b(?:han|deadline|ket thuc|hoan thanh|xong|truoc ngay)\b/.test(text))return {error:'Tôi nhận ra prompt có nhắc hạn nhưng chưa hiểu được ngày. Hãy ghi ngày như “ngày mai”, “thứ hai tuần sau”, “ngày 25/10”, “cuối tuần này” hoặc “trong 3 ngày”.'};
 return {...finish(new Date(today.getFullYear(),today.getMonth(),today.getDate()+7,12),'đề xuất sau 7 ngày',null),dueNote:`hạn đề xuất sau 7 ngày${time?` · ${time.note}`:''}`};
}
function taskDraftFromPrompt(prompt){
 if(!canAssignTasks())return {error:'Chỉ hồ sơ Quản lý hoặc Chủ tịch được tạo nháp giao việc.'};
 if(!/\b(?:tao|giao|lap|phan cong)\b/i.test(normalizeForMatch(prompt).text))return null;
 const normalized=normalizeForMatch(prompt),users=state.users.slice().sort((a,b)=>normalizeForMatch(b.name).text.length-normalizeForMatch(a.name).text.length);
 const cuePattern=/(?:giao cho|cho)\s+(?:(?:nhan vien|nhan su)\s+)?/ig;
 let cue,lastCue=null;
 while((cue=cuePattern.exec(normalized.text))!==null)lastCue={index:cue.index,end:cuePattern.lastIndex};
 const recipients=lastCue?users.filter(user=>{
  const name=normalizeForMatch(user.name).text,index=normalized.text.indexOf(name,lastCue.end);
  return index>=lastCue.end&&/(?:^|[\s,;:.!?])/.test(normalized.text[index-1]||' ')&&/(?:$|[\s,;:.!?])/.test(normalized.text[index+name.length]||' ');
 }):[];
 const recipient=recipients.length===1?recipients[0]:null;
 let title=prompt.slice(0,normalized.offsets[lastCue?.index??prompt.length]);
 const deadline=parsePromptDeadline(prompt);if(deadline.error)return deadline;
 const removeRange=(range,words)=>{if(!range)return;let start=normalized.offsets[range.start],end=normalized.offsets[range.end];const prefixStart=Math.max(0,range.start-28),prefix=normalized.text.slice(prefixStart,range.start),cue=new RegExp(`(?:\\b(?:${words})\\s*)+$`,'i').exec(prefix);if(cue)start=normalized.offsets[prefixStart+cue.index];title=title.slice(0,Math.max(0,start))+title.slice(Math.min(title.length,end))};
 removeRange(deadline.dateRange,'han|deadline|vao|truoc|den|ngay');
 removeRange(deadline.timeRange,'han|deadline|luc|vao|den');
 title=title.replace(/(?:giao\s+)?cho\s+(?:(?:nhân\s+viên|nhân\s+sự)\s+)?$/iu,'');
 title=title.replace(/^\s*(?:(?:hãy|vui lòng)\s+)?(?:tạo|giao|lập|phân công)\s+(?:cho tôi\s+)?(?:(?:một\s+)?(?:công\s+việc|việc|nhiệm vụ)\s*)?(?:(?:ví dụ(?: như)?|như)\s*)?/iu,'');
 title=title.replace(/\s*(?:chẳng hạn|ví dụ|như)\s*$/iu,'').replace(/(?:\s+)?(?:hạn|deadline|vào|lúc|trước|đến)\s*$/iu,'').replace(/^[\s:,-]+|[\s:,-]+$/g,'').trim().replace(/\bwordflow\b/giu,'workflow');
 if(title.length<4)return {error:'Chưa nhận diện được tên công việc. Hãy mô tả rõ việc cần làm trong lời nhắc.'};
 const projectMatch=/(?:du\s+an)\s+(.+?)(?=\s+(?:han|deadline|uu tien|trong vong|vao|thu\s+(?:[2-7]|hai|ba|tu|nam|sau|bay)|tuan\s+(?:nay|sau|toi)\s+thu|chu nhat|ngay|cho nhan vien|cho nhan su)\b|[,;.]|$)/i.exec(normalized.text);
 const project=projectMatch?prompt.slice(normalized.offsets[projectMatch.index+projectMatch[0].indexOf(projectMatch[1])],normalized.offsets[projectMatch.index+projectMatch[0].indexOf(projectMatch[1])+projectMatch[1].length]).trim():'Công việc độc lập';
 const priorityMatch=prompt.match(/\b(cao|khẩn cấp|trung bình|thấp)\b/iu),priorityValue=priorityMatch&&/khẩn cấp|cao/i.test(priorityMatch[1])?'HIGH':priorityMatch&&/thấp/i.test(priorityMatch[1])?'LOW':'MEDIUM';
 return {title:title.slice(0,160),assignee:recipient?.name||'',assigneeId:recipient?.id||'',project,start_date:addDays(0),due:deadline.due,due_time:deadline.due_time,dueNote:deadline.dueNote,priority:priorityValue,review:true};
}
function aiReplyScoped(q){const text=normalizeForMatch(q).text,tasks=visibleTasks(),s=stats();if(/\b(?:tao|giao|lap|phan cong)\b/.test(text)){const draft=taskDraftFromPrompt(q);if(draft?.error)return draft.error;if(draft){state.pendingTaskDraft=draft;return `${draft.assignee?'Tôi đã chuẩn bị nháp bên dưới. Hãy kiểm tra người nhận đã được chọn.':'Tôi đã chuẩn bị nháp nhưng chưa xác định duy nhất được người nhận. Hãy tìm và chọn đúng nhân viên bên dưới trước khi xác nhận.'} Có thể nhập hạn như “thứ hai tuần sau 4h30” hoặc “ngày mai lúc 4h”. Nếu chỉ nêu giờ, hệ thống chọn lần tới đến giờ đó; nếu không nêu ngày lẫn giờ, hạn mặc định là 7 ngày. “4h” được hiểu là 04:00; ghi “4h chiều” nếu muốn 16:00.`}}
 if(/qua han|tre han|gan han|deadline/.test(text)){const late=tasks.filter(overdue);return `Có ${late.length} công việc quá hạn trong phạm vi hồ sơ hiện tại.\n${late.map(task=>`• ${task.title} (${task.assignee}, hạn ${dateHuman(task.due)})`).join('\n')||'Chưa có công việc quá hạn.'}`}
 if(/duyet|nghiem thu|review/.test(text)){const review=tasks.filter(task=>task.status==='IN_REVIEW');return `Có ${review.length} công việc chờ duyệt trong phạm vi hồ sơ hiện tại.\n${review.map(task=>`• ${task.title} — ${task.assignee}`).join('\n')||'Không có công việc chờ duyệt.'}`}
 if(/bao cao|tien do|tong hop|kpi/.test(text))return `Tổng hợp trong phạm vi ${meName()}:\n• ${s.all} công việc\n• ${s.active} đang thực hiện\n• ${s.review} chờ duyệt\n• ${s.done} đã hoàn thành\n• ${s.overdue} quá hạn\nXem các KPI riêng theo tháng tại mục Mục tiêu & KPI.`;
 return 'Hãy mô tả công việc, người nhận và hạn theo cách tự nhiên, ví dụ: “Tạo công việc phân tích workflow cho nhân viên Phạm Hoàng Tuấn, hạn thứ hai tuần sau 4h30”. “4h” là 04:00; thêm “chiều” để chỉ buổi chiều.'}
function confirmTaskDraft(){
 const draft=state.pendingTaskDraft;if(!draft)return;
 const me=meUser();
 const isSelf=Boolean(me&&draft.assigneeId===me.id);
 const canConfirm=canAssignTasks()||(state.permissions.includes('tasks.create')&&isSelf);
 if(!canConfirm){toast('Bạn chỉ có quyền tạo việc cho chính mình hoặc cần quyền Quản lý/Chủ tịch để giao việc.');return}
 if(!draft.assigneeId){toast('Hãy tìm và chọn rõ người nhận trước khi xác nhận.');return}
 if(!state.users.some(user=>user.id===draft.assigneeId&&user.name===draft.assignee)){
  toast('Người nhận không còn trong danh sách nhân sự. Hãy chọn lại người nhận.');
  draft.assigneeId='';draft.assignee='';layout();return;
 }
 const now=new Date().toISOString();
 const number=state.tasks.reduce((max,task)=>Math.max(max,Number(task.id.split('-')[1])||1000),1000)+1;
 const taskSubtasks=Array.isArray(draft.subtasks)
  ?draft.subtasks.map((item,idx)=>typeof item==='string'?{id:`sub-${Date.now()}-${idx}`,title:item,done:false,createdBy:meName(),createdAt:now}:{id:item.id||`sub-${Date.now()}-${idx}`,title:item.title||item.text||'',done:Boolean(item.done),createdBy:meName(),createdAt:now})
  :[];
 const kpiObj=(state.departmentKpis||[]).find(k=>k.id===draft.kpi_id);
 const task={
  id:`CV-${number}`,
  title:draft.title,
  description:draft.description||'',
  result:'',
  subtasks:taskSubtasks,
  comments:[],
  project:draft.project||'Công việc độc lập',
  project_id:draft.project_id||null,
  kpi_id:draft.kpi_id||null,
  kpi_name:draft.kpi_name||(kpiObj?kpiObj.name:null),
  assignee:draft.assignee,
  assignee_id:draft.assigneeId,
  creator:meName(),
  creator_id:me?.id||null,
  reviewer_id:draft.review?(draft.reviewer_id||null):null,
  watchers:[],
  start_date:draft.start_date||addDays(0),
  due:draft.due,
  due_time:draft.due_time||null,
  original_due:draft.original_due||draft.due,
  extensions_count:Number(draft.extensions_count||0),
  priority:draft.priority||'MEDIUM',
  review:Boolean(draft.review),
  status:'TODO',
  progress:0,
  createdAt:now,
  checkins:[],
  events:[{actor:meName(),text:isSelf?'Nhân sự tự tạo việc qua Trợ lý AI':'Quản lý xác nhận giao việc qua Trợ lý AI',at:now}]
 };
 state.tasks.unshift(task);
 if(!save()){
  state.tasks.shift();
  toast('Không thể lưu công việc vào máy chủ local. Hãy kiểm tra lại.');
  return;
 }
 state.pendingTaskDraft=null;
 state.ai=false;
 state.page='tasks';
 state.detail=task.id;
 state.filter='all';
 layout();
 loadAiBriefing(false);
 toast(`Đã ${isSelf?'tạo việc':'giao việc'} “${task.title}” thành công.`);
}
async function loadAiBriefing(openPanel=false){
 if(isAdminView())return;
 state.aiLoadingBriefing=true;
 try{
  const res=await apiRequest('/demo-work/ai/briefing');
  if(res&&res.success&&res.data){
   state.aiBriefing=res.data;
   if(res.data.projects&&Array.isArray(res.data.projects)){
    state.projects=res.data.projects;
   }
   if(openPanel&&state.aiMessages.length===0&&res.data.greeting){
    state.aiMessages.push({who:'bot',text:res.data.greeting});
   }
  }
 }catch(err){
  console.warn('AI Briefing API error:',err);
 }finally{
  state.aiLoadingBriefing=false;
  if(!state.aiOpening){
   layout();
  }
 }
}
async function sendAI(q){
 const prompt=String(q||'').trim();
 if(!prompt)return;
 state.aiMessages.push({who:'user',text:prompt});
 state.aiThinking=true;
 layout();
 const c=document.getElementById('chatBody');
 if(c)c.scrollTop=c.scrollHeight;
 try{
  const res=await apiRequest('/demo-work/ai/chat',{
   method:'POST',
   body:JSON.stringify({prompt})
  });
  if(res&&res.data){
   state.aiMessages.push({who:'bot',text:res.data.message});
   if(res.data.draft){
    const d=res.data.draft;
    state.pendingTaskDraft={
     title:d.title,
     assignee:d.assignee||'',
     assigneeId:d.assignee_id||'',
     project:d.project||'Công việc độc lập',
     project_id:d.project_id||null,
     kpi_id:d.kpi_id||null,
     kpi_name:d.kpi_name||null,
     start_date:d.start_date||addDays(0),
     due:d.due,
     due_time:d.due_time||null,
     original_due:d.original_due||d.due,
     extensions_count:Number(d.extensions_count||0),
     dueNote:d.dueNote||'',
     priority:d.priority||'MEDIUM',
     review:Boolean(d.review),
     reviewer_id:d.reviewer_id||'',
     subtasks:d.subtasks||[]
    };
   }
  }else{
   state.aiMessages.push({who:'bot',text:res.message||'Không nhận được phản hồi từ AI.'});
  }
 }catch(error){
  console.warn('AI Chat API fallback to local scoped engine:',error);
  const fallbackText=aiReplyScoped(prompt);
  state.aiMessages.push({who:'bot',text:fallbackText});
 }finally{
  state.aiThinking=false;
  layout();
  const chatContainer=document.getElementById('chatBody');
  if(chatContainer)chatContainer.scrollTop=chatContainer.scrollHeight;
  document.getElementById('aiQuery')?.focus();
 }
}
function saveTaskDetailChange(task,description,mutate){const index=state.tasks.indexOf(task);if(index<0)return;const previous=structuredClone(task);mutate(task);task.events??=[];task.events.push({actor:meName(),text:description,at:new Date().toISOString()});if(!save()){state.tasks[index]=previous;layout();toast('Không thể lưu thay đổi. Hãy kiểm tra dung lượng lưu trữ của trình duyệt.');return}layout();toast(description)}
function taskAttachmentsHTML(task,section){const files=(task.attachments||[]).map((file,index)=>({...file,index})).filter(file=>file.section===section);return files.length?`<div class="task-attachments">${files.map(file=>`<button type="button" class="task-attachment" data-attachment-download="${file.index}">${ic('file')}<span>${safe(file.name)}</span><small>${Math.max(1,Math.ceil(file.size/1024))} KB</small></button>`).join('')}</div>`:''}
function taskChecklistsHTML(task,canEdit){const lists=task.checklists||[];return `${lists.map((list,listIndex)=>`<div class="task-checklist"><strong>${safe(list.title)} <span class="detail-count">${list.items.filter(item=>item.done).length}/${list.items.length}</span></strong>${list.items.length?list.items.map((item,itemIndex)=>`<label class="subtask-row ${item.done?'is-done':''}"><input type="checkbox" data-checklist-toggle="${listIndex}:${itemIndex}" ${item.done?'checked':''} ${canEdit&&task.status!=='COMPLETED'?'':'disabled'}><span>${safe(item.text)}</span></label>`).join(''):'<p class="detail-empty">Checklist chưa có mục nào.</p>'}${canEdit&&task.status!=='COMPLETED'?`<form class="subtask-form" data-detail-form="checklist-item" data-checklist-index="${listIndex}"><input class="field" name="text" maxlength="160" minlength="2" required placeholder="Thêm mục checklist"><button class="btn" type="submit" aria-label="Thêm mục">${ic('plus')}</button></form>`:''}</div>`).join('')}`}
function taskLinksHTML(task){const links=task.links||[];return links.length?`<div class="task-links">${links.map(link=>`<a class="task-link" href="${safe(link.url)}" target="_blank" rel="noopener noreferrer">${ic('link')} ${safe(link.title)}</a>`).join('')}</div>`:''}
function attachmentInput(section){return `<label class="btn btn-min task-attach-button">${ic('file')} Thêm tài liệu<input type="file" data-task-attachment="${section}" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.docx,.xlsx" hidden></label>`}
async function uploadTaskAttachment(task,file,section){const form=new FormData();form.set('file',file);form.set('section',section);const response=await fetch(`/demo-work/tasks/${encodeURIComponent(task.id)}/attachments`,{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]')?.content||''},body:form});let data={};try{data=await response.json()}catch(error){if(response.ok)throw error}if(!response.ok)throw new Error(data.message||Object.values(data.errors||{}).flat().join(' ')||'Không thể tải tài liệu lên.');task.attachments??=[];task.attachments.push(data.attachment);state.serverTasks=state.serverTasks.map(item=>item.id===task.id?{...item,attachments:[...(item.attachments||[]),data.attachment]}:item);layout();toast('Đã đính kèm tài liệu trong kho local riêng.')}
function xmlElements(document,name){return Array.from(document.getElementsByTagName('*')).filter(element=>element.localName===name)}
function parseCsvFirstColumn(text){const rows=[];let row=[],cell='',quoted=false;for(let index=0;index<text.length;index++){const char=text[index];if(char==='"'&&quoted&&text[index+1]==='"'){cell+='"';index++}else if(char==='"'){quoted=!quoted}else if((char===','||char===';')&&!quoted){if(row.length===0)row.push(cell);cell=''}else if((char==='\n'||char==='\r')&&!quoted){if(row.length===0)row.push(cell);rows.push(row[0]);row=[];cell='';if(char==='\r'&&text[index+1]==='\n')index++}else cell+=char}if(cell||row.length){if(row.length===0)row.push(cell);rows.push(row[0])}return rows}
async function spreadsheetSubtaskTitles(file){if(file.size>5*1024*1024)throw new Error('Tệp nhập không được vượt quá 5 MB.');let values;if(file.name.toLowerCase().endsWith('.csv'))values=parseCsvFirstColumn(await file.text());else{const archive=unzipSync(new Uint8Array(await file.arrayBuffer())),readXml=path=>{if(!archive[path])throw new Error('Tệp Excel thiếu cấu trúc bảng tính hợp lệ.');return new DOMParser().parseFromString(strFromU8(archive[path]),'application/xml')},workbook=readXml('xl/workbook.xml'),relationId=xmlElements(workbook,'sheet')[0]?.getAttribute('r:id');if(!relationId)throw new Error('Không tìm thấy trang tính đầu tiên trong tệp.');const relations=readXml('xl/_rels/workbook.xml.rels'),relation=xmlElements(relations,'Relationship').find(item=>item.getAttribute('Id')===relationId),target=relation?.getAttribute('Target');if(!target)throw new Error('Không đọc được trang tính đầu tiên.');const sheetPath=target.startsWith('/')?target.slice(1):`xl/${target.replace(/^\.\//,'')}`;const sheet=readXml(sheetPath),shared=archive['xl/sharedStrings.xml']?xmlElements(readXml('xl/sharedStrings.xml'),'si').map(item=>xmlElements(item,'t').map(node=>node.textContent||'').join('')):[];values=xmlElements(sheet,'row').map(row=>{const cell=xmlElements(row,'c').find(item=>/^A\\d+$/.test(item.getAttribute('r')||''));if(!cell)return '';const value=xmlElements(cell,'v')[0]?.textContent||'';return cell.getAttribute('t')==='s'?shared[Number(value)]||'':cell.getAttribute('t')==='inlineStr'?xmlElements(cell,'t').map(node=>node.textContent||'').join(''):value})}const titles=values.map(value=>String(value||'').trim()).filter(Boolean);if(titles.length&&/^(công việc con|cong viec con|công việc|task|subtask|title)$/i.test(titles[0]))titles.shift();if(!titles.length)throw new Error('Không tìm thấy tên công việc con trong cột đầu tiên.');if(titles.length>500)throw new Error('Mỗi lần chỉ nhập tối đa 500 công việc con.');if(titles.some(title=>title.length<2||title.length>160))throw new Error('Tên công việc con phải có từ 2 đến 160 ký tự.');return titles}
function exportCSV(){const rows=[['Mã công việc','Tên công việc','Dự án','Người thực hiện','Hạn hoàn thành','Giờ hoàn thành','Trạng thái','Tiến độ (%)']];visibleTasks().forEach(t=>rows.push([t.id,t.title,t.project,t.assignee,dateHuman(t.due),t.due_time||'',statuses[t.status],String(t.progress)]));const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(';')).join('\r\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download='BFC_Smart_Work_Cong_viec.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(link.href);toast('Đã xuất báo cáo theo phạm vi hồ sơ hiện tại')}
root.addEventListener('submit',e=>{
 const form=e.target,kind=form.dataset.detailForm;
 if(!kind)return;
 e.preventDefault();e.stopImmediatePropagation();
 const task=state.tasks.find(item=>item.id===state.detail);
 if(!task||!roleAllowed(task,'read')){toast('Không thể cập nhật công việc này.');return}
 const data=new FormData(form);
 if(kind==='comment'){
  const text=String(data.get('text')||'').trim();if(!meUser()||!text){toast('Nhập nội dung bình luận trước khi gửi.');return}
  saveTaskDetailChange(task,'Đã thêm bình luận',item=>{item.comments??=[];item.comments.push({author:meName(),authorId:meUser().id,text,at:new Date().toISOString()})});return;
 }
 if(!roleAllowed(task,'edit')){toast('Bạn không có quyền sửa thông tin công việc này.');return}
 if(kind==='description'||kind==='result'){
  const value=String(data.get('value')||'').trim();
  saveTaskDetailChange(task,kind==='description'?'Đã cập nhật mô tả công việc':'Đã cập nhật kết quả công việc',item=>{item[kind]=value});return;
 }
 if(kind==='subtask'){
  if(task.status==='COMPLETED'){toast('Không thể thêm công việc con vào công việc cha đã hoàn thành.');return}
  const title=String(data.get('title')||'').trim();if(title.length<2){toast('Tên công việc con cần ít nhất 2 ký tự.');return}
  saveTaskDetailChange(task,'Đã thêm công việc con',item=>{item.subtasks??=[];item.subtasks.push({id:`sub-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,done:false,createdBy:meName(),createdAt:new Date().toISOString()})});
  return;
 }
 if(kind==='checklist'){
  const title=String(data.get('title')||'').trim();if(title.length<2){toast('Tên checklist cần ít nhất 2 ký tự.');return}
  saveTaskDetailChange(task,'Đã tạo checklist',item=>{item.checklists??=[];item.checklists.push({id:`check-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,items:[]})});return;
 }
 if(kind==='checklist-item'){
  const list=task.checklists?.[Number(form.dataset.checklistIndex)],text=String(data.get('text')||'').trim();if(!list||text.length<2){toast('Mục checklist cần ít nhất 2 ký tự.');return}
  saveTaskDetailChange(task,'Đã thêm mục checklist',item=>{item.checklists[Number(form.dataset.checklistIndex)].items.push({id:`item-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,text,done:false})});return;
 }
 if(kind==='link'){
  const title=String(data.get('title')||'').trim(),url=String(data.get('url')||'').trim();try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||title.length<2)throw new Error()}catch{toast('Nhập tên liên kết và địa chỉ HTTP/HTTPS hợp lệ.');return}
  saveTaskDetailChange(task,'Đã thêm liên kết',item=>{item.links??=[];item.links.push({title,url})});
 }
 if(kind==='kpi'){
  const kpiId=String(data.get('kpi_id')||'').trim();
  const kpiObj=(state.departmentKpis||[]).find(k=>k.id===kpiId);
  const kpiName=kpiObj?kpiObj.name:null;
  saveTaskDetailChange(task,kpiId?`Gắn KPI: [${kpiId}] ${kpiName}`:'Hủy gắn KPI',item=>{item.kpi_id=kpiId||null;item.kpi_name=kpiName});
  return;
 }
 if(kind==='quick-due'){
  const due=String(data.get('due')||'').trim();
  const dueTime=String(data.get('due_time')||'').trim()||null;
  if(!due){toast('Vui lòng chọn hạn hoàn thành.');return}
  const oldDue=task.due;
  saveTaskDetailChange(task,`Thay đổi hạn nhanh: ${dateHuman(oldDue)} -> ${dateHuman(due)}${dueTime?' '+dueTime:''}`,item=>{item.due=due;item.due_time=dueTime});
  return;
 }
},true);
root.addEventListener('change',async e=>{
 const input=e.target;
 if(input.matches('[data-task-attachment]')){
  const file=input.files?.[0],task=state.tasks.find(item=>item.id===state.detail);
  if(!file)return;
  const canAttach=roleAllowed(task||{},'edit')||(input.dataset.taskAttachment==='comment'&&roleAllowed(task||{},'read')&&state.permissions.includes('tasks.comment_related'));
  if(!task||!canAttach||(task.status==='COMPLETED'&&input.dataset.taskAttachment!=='comment')){toast('Bạn không có quyền đính kèm tài liệu cho công việc này.');input.value='';return}
  if(file.size>500*1024||(task.attachments||[]).length>=5||(task.attachments||[]).reduce((sum,item)=>sum+Number(item.size||0),0)+file.size>2*1024*1024){toast('Mỗi tệp tối đa 500 KB; mỗi công việc tối đa 5 tệp và tổng dung lượng 2 MB.');input.value='';return}
  input.disabled=true;try{await uploadTaskAttachment(task,file,input.dataset.taskAttachment)}catch(error){toast(error.message)}finally{input.value='';input.disabled=false}return;
 }
 if(input.matches('[data-subtask-import]')){
  const file=input.files?.[0],task=state.tasks.find(item=>item.id===state.detail);if(!file)return;
  if(!task||!roleAllowed(task,'edit')||task.status==='COMPLETED'){toast('Bạn không có quyền nhập công việc con.');input.value='';return}
  try{const titles=await spreadsheetSubtaskTitles(file);if((task.subtasks||[]).length+titles.length>500)throw new Error('Mỗi công việc cha có thể có tối đa 500 công việc con.');saveTaskDetailChange(task,`Đã nhập ${titles.length} công việc con`,item=>{item.subtasks??=[];item.subtasks.push(...titles.map(title=>({id:`sub-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,title,done:false,createdBy:meName(),createdAt:new Date().toISOString()})))})}catch(error){toast(error.message||'Không đọc được tệp Excel. Hãy chọn tệp .xlsx hoặc .csv hợp lệ.')}finally{input.value=''}return;
 }
 if(!input.matches('[data-subtask-toggle]'))return;
 const task=state.tasks.find(item=>item.id===state.detail),index=Number(input.dataset.subtaskToggle);
 if(!task||!roleAllowed(task,'edit')||!Number.isInteger(index)||!task.subtasks?.[index]){toast('Không thể cập nhật công việc con này.');layout();return}
 if(task.status==='COMPLETED'&&!input.checked){toast('Không thể mở lại công việc con khi công việc cha đã hoàn thành.');layout();return}
 saveTaskDetailChange(task,input.checked?'Đã hoàn thành công việc con':'Đã mở lại công việc con',item=>{item.subtasks[index].done=input.checked});
},true);
root.addEventListener('change',e=>{
 const input=e.target;if(!input.matches('[data-checklist-toggle]'))return;const task=state.tasks.find(item=>item.id===state.detail),[listIndex,itemIndex]=input.dataset.checklistToggle.split(':').map(Number),checklist=task?.checklists?.[listIndex],item=checklist?.items?.[itemIndex];
 if(!task||!roleAllowed(task,'edit')||!item||task.status==='COMPLETED'){toast('Không thể cập nhật mục checklist này.');layout();return}
 saveTaskDetailChange(task,input.checked?'Đã hoàn thành mục checklist':'Đã mở lại mục checklist',current=>{current.checklists[listIndex].items[itemIndex].done=input.checked});
},true);
root.addEventListener('click',async e=>{
 const button=e.target.closest('[data-action="show-checklist-form"],[data-action="show-link-form"],[data-comment-emoji],[data-attachment-download]');
 if(!button)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(button.dataset.action==='show-checklist-form'||button.dataset.action==='show-link-form'){const form=root.querySelector(`[data-detail-form="${button.dataset.action==='show-checklist-form'?'checklist':'link'}"]`);if(form){form.hidden=!form.hidden;form.querySelector('input')?.focus()}return}
 if(button.dataset.commentEmoji){const field=root.querySelector('.comment-form textarea');if(field){const start=field.selectionStart,end=field.selectionEnd;field.setRangeText(button.dataset.commentEmoji,start,end,'end');field.focus()}return}
 const task=state.tasks.find(item=>item.id===state.detail),attachment=task?.attachments?.[Number(button.dataset.attachmentDownload)];if(!attachment)return;
 try{const response=await fetch(`/demo-work/tasks/${encodeURIComponent(task.id)}/attachments/${encodeURIComponent(attachment.id)}`,{credentials:'same-origin',headers:{Accept:'application/octet-stream'}});if(!response.ok){let error={};try{error=await response.json()}catch{}throw new Error(error.message||'Không thể tải tài liệu xuống.')}const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=attachment.name;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)}catch(error){toast(error.message)}
},true);
function updateKpiTooltip(slice,x,y){const visual=slice.closest('.kpi-pie-visual'),tooltip=visual?.querySelector('.kpi-pie-tooltip');if(!tooltip)return;tooltip.textContent=slice.dataset.kpiTooltip;tooltip.hidden=false;tooltip.classList.add('is-visible');const bounds=tooltip.getBoundingClientRect();tooltip.style.left=`${Math.min(Math.max(8,x+12),window.innerWidth-bounds.width-8)}px`;tooltip.style.top=`${Math.min(Math.max(8,y+12),window.innerHeight-bounds.height-8)}px`}
function hideKpiTooltip(slice){const tooltip=slice.closest('.kpi-pie-visual')?.querySelector('.kpi-pie-tooltip');if(tooltip){tooltip.hidden=true;tooltip.classList.remove('is-visible')}}
root.addEventListener('pointerover',e=>{const slice=e.target instanceof Element?e.target.closest('.kpi-pie-slice'):null;if(slice)updateKpiTooltip(slice,e.clientX,e.clientY)});
root.addEventListener('pointermove',e=>{const slice=e.target instanceof Element?e.target.closest('.kpi-pie-slice'):null;if(slice)updateKpiTooltip(slice,e.clientX,e.clientY)});
root.addEventListener('pointerout',e=>{const slice=e.target instanceof Element?e.target.closest('.kpi-pie-slice'):null;if(!slice)return;const next=e.relatedTarget instanceof Element?e.relatedTarget.closest('.kpi-pie-slice'):null;if(next&&next.closest('.kpi-pie-visual')===slice.closest('.kpi-pie-visual'))return;hideKpiTooltip(slice)});
root.addEventListener('focusin',e=>{const slice=e.target instanceof Element?e.target.closest('.kpi-pie-slice'):null;if(slice){const bounds=slice.getBoundingClientRect();updateKpiTooltip(slice,bounds.left+bounds.width/2,bounds.top+bounds.height/2)}});
root.addEventListener('focusout',e=>{const slice=e.target instanceof Element?e.target.closest('.kpi-pie-slice'):null;if(!slice)return;const next=e.relatedTarget instanceof Element?e.relatedTarget.closest('.kpi-pie-slice'):null;if(next&&next.closest('.kpi-pie-visual')===slice.closest('.kpi-pie-visual'))return;hideKpiTooltip(slice)});
let isDraggingMascot=false,mascotDragStartX=0,mascotDragStartY=0,mascotInitialLeft=0,mascotInitialTop=0,hasMovedMascot=false;
root.addEventListener('pointerdown',e=>{
 const widget=e.target.closest('.ai-mascot-widget');
 if(!widget)return;
 isDraggingMascot=true;hasMovedMascot=false;
 mascotDragStartX=e.clientX;mascotDragStartY=e.clientY;
 const rect=widget.getBoundingClientRect();
 mascotInitialLeft=rect.left;mascotInitialTop=rect.top;
});
root.addEventListener('pointermove',e=>{
 if(!isDraggingMascot)return;
 const dx=e.clientX-mascotDragStartX,dy=e.clientY-mascotDragStartY;
 if(!hasMovedMascot&&Math.hypot(dx,dy)>12){
  hasMovedMascot=true;
  const widget=root.querySelector('.ai-mascot-widget');
  if(widget?.setPointerCapture)widget.setPointerCapture(e.pointerId);
 }
 if(!hasMovedMascot)return;
 const widget=root.querySelector('.ai-mascot-widget');
 if(!widget)return;
 widget.classList.add('is-dragging');
 const w=widget.offsetWidth||70,h=widget.offsetHeight||70;
 const nextLeft=Math.max(10,Math.min(window.innerWidth-w-10,mascotInitialLeft+dx));
 const nextTop=Math.max(10,Math.min(window.innerHeight-h-10,mascotInitialTop+dy));
 widget.style.left=`${nextLeft}px`;widget.style.top=`${nextTop}px`;
 widget.style.right='auto';widget.style.bottom='auto';
});
const endMascotDrag=e=>{
 if(!isDraggingMascot)return;
 isDraggingMascot=false;
 const widget=root.querySelector('.ai-mascot-widget');
 if(widget){
  widget.classList.remove('is-dragging');
  if(hasMovedMascot){
   const rect=widget.getBoundingClientRect();
   try{localStorage.setItem('bfc_mascot_pos',JSON.stringify({left:Math.round(rect.left),top:Math.round(rect.top)}))}catch{}
  }
 }
};
root.addEventListener('pointerup',endMascotDrag);
root.addEventListener('pointercancel',endMascotDrag);
if(!window._mascotSpeechTimer){
 window._mascotSpeechTimer=setInterval(()=>{
  const speech=document.querySelector('.ai-mascot-speech');
  if(!speech)return;
  speech.classList.add('is-popped');
  setTimeout(()=>{
   const el=document.querySelector('.ai-mascot-speech');
   if(el)el.classList.remove('is-popped');
  },3200);
 },5000);
}
root.addEventListener('click',(e)=>{const a=e.target.closest('[data-action]');const pg=e.target.closest('[data-page]');const task=e.target.closest('[data-task]');const filt=e.target.closest('[data-filter]');const view=e.target.closest('[data-view]');const goalToggle=e.target.closest('[data-goals-toggle]');const kpiView=e.target.closest('[data-kpi-view]');const proj=e.target.closest('[data-project]');const prompt=e.target.closest('[data-prompt]');const tr=e.target.closest('[data-transition]');
 if(e.target.closest('[data-board-move]')){e.stopPropagation();return}
 if(goalToggle){if(state.page!=='goals'||state.reportView){state.page='goals';state.reportView=false;state.goalNavOpen=true}else state.goalNavOpen=!state.goalNavOpen;state.detail=null;state.modal=null;state.mobile=false;saveUi();layout();return}
 if(kpiView){state.page='goals';state.reportView=false;state.kpiBankView=kpiView.dataset.kpiView==='bank';state.kpiAnalyticsView=kpiView.dataset.kpiView==='analytics';state.goalNavOpen=true;state.detail=null;state.modal=null;state.mobile=false;state.search='';saveUi();layout();window.scrollTo({top:0,behavior:'instant'});return}
 if(pg){go(pg.dataset.page);return}
 if(task){state.detail=task.dataset.task;state.modal=null;layout();return}
 if(filt){state.filter=filt.dataset.filter;layout();return}
 if(view){state.view=view.dataset.view;layout();return}
 const kpiScopeBtn=e.target.closest('[data-kpi-scope]');
 if(kpiScopeBtn){state.kpiScope=kpiScopeBtn.dataset.kpiScope;saveUi();layout();return}
 if(proj){state.page='tasks';state.search=proj.dataset.project;layout();return}
 if(prompt){sendAI(prompt.dataset.prompt);return}
 if(tr){transition(tr.dataset.transition);return}
 if(!a)return;
 switch(a.dataset.action){case 'menu':state.mobile=!state.mobile;layout();break;case 'notice':toast(`Bạn có ${fmtNum(stats().review)} việc chờ duyệt và ${fmtNum(stats().overdue)} việc quá hạn trong dữ liệu Demo.`);break;case 'create':state.modal='create';layout();document.getElementById('title')?.focus();break;case 'open-extend-modal':state.modal='extend';layout();break;case 'modal-close':state.modal=null;layout();break;case 'detail-close':state.detail=null;state.modal=null;layout();break;case 'checkin':state.modal='checkin';layout();document.getElementById('pct')?.focus();break;case 'reject':state.modal='reject';layout();document.getElementById('reason')?.focus();break;case 'ai':if(hasMovedMascot){hasMovedMascot=false;break;}state.ai=true;state.aiOpening=true;layout();setTimeout(()=>{state.aiOpening=false;root.querySelector('.ai-panel')?.classList.remove('ai-panel-slide');root.querySelector('.panel-backdrop')?.classList.remove('backdrop-anim');},300);if(!state.aiBriefing){loadAiBriefing(false);}document.getElementById('aiQuery')?.focus();break;case 'ai-close':state.ai=false;state.aiOpening=false;layout();break;case 'refresh-briefing':loadAiBriefing(true);break;case 'briefing-tab':if(a.dataset.tab){state.aiBriefingTab=a.dataset.tab;layout();}break;case 'filter-main-tasks':{const tab=a.dataset.filter;state.ai=false;state.page='tasks';if(tab==='overdue')state.filter='overdue';else state.filter='all';layout();break;}case 'open-briefing-task':if(a.dataset.id){state.detail=a.dataset.id;state.ai=false;state.modal=null;layout();}break;case 'confirm-task-draft':confirmTaskDraft();break;case 'cancel-task-draft':state.pendingTaskDraft=null;state.aiMessages.push({who:'bot',text:'Đã hủy nháp. Chưa có công việc nào được tạo.'});layout();break;case 'export':exportCSV();break;case 'theme':state.theme=state.theme==='dark'?'light':'dark';saveUi();layout();break;case 'login':state.login=!state.login;layout();break;case 'reset':if(confirm('Khôi phục toàn bộ dữ liệu Demo ban đầu?')){state.tasks=structuredClone(sample);save();layout();toast('Đã khôi phục dữ liệu Demo');}break;}
});
root.addEventListener('change',e=>{if(e.target.id==='kpiPeriod'){state.period=e.target.value;layout();return}if(e.target.matches('[data-detail-kpi-select]')){e.target.form?.requestSubmit();return}if(e.target.matches('#createTask input[name="review"]')){const reviewerField=root.querySelector('#createTask [name="reviewer_id"]');if(reviewerField){reviewerField.disabled=!e.target.checked;reviewerField.required=e.target.checked;if(!e.target.checked)reviewerField.value=''}}if(e.target.id==='roleSwitch'){state.activeUserId=e.target.value;saveUi();layout();loadAiBriefing(false);toast(`Đang sử dụng hồ sơ ${meName()} · ${roleLabel(meUser()?.role)}`);return}const field=e.target.dataset.draftField,draft=state.pendingTaskDraft;if(!draft||!field)return;if(field==='kpi_id'){draft.kpi_id=e.target.value;const k=(state.departmentKpis||[]).find(item=>item.id===e.target.value);draft.kpi_name=k?k.name:'';layout();return}if(field==='priority'&&['LOW','MEDIUM','HIGH'].includes(e.target.value))draft.priority=e.target.value;if(field==='review'&&['true','false'].includes(e.target.value)){draft.review=e.target.value==='true';layout();}if(field==='project_id'){draft.project_id=e.target.value;const found=(state.projects||[]).find(p=>p.id===e.target.value);draft.project=found?found.name:'Công việc độc lập';}if(field==='reviewer_id'){draft.reviewer_id=e.target.value;}});
root.addEventListener('input',e=>{if(e.target.id==='globalSearch'){let pos=e.target.selectionStart;state.search=e.target.value;state.page='tasks';layout();let s=document.getElementById('globalSearch');s?.focus();s?.setSelectionRange(pos,pos)}});
root.addEventListener('input',e=>{if(e.target.id==='kpiBankSearch'){const pos=e.target.selectionStart;state.kpiBankSearch=e.target.value;layout();const input=document.getElementById('kpiBankSearch');input?.focus();input?.setSelectionRange(pos,pos)}});
root.addEventListener('submit',e=>{e.preventDefault();const f=e.target;const fd=new FormData(f);if(f.id==='createTask'){const title=String(fd.get('title')||'').trim();if(title.length<4){toast('Tên công việc cần ít nhất 4 ký tự.');return}const id=generateNextTaskId();const kpiId=String(fd.get('kpi_id')||'').trim();const kpiObj=(state.departmentKpis||[]).find(k=>k.id===kpiId);const dueVal=String(fd.get('due')||'');const dueTimeVal=String(fd.get('due_time')||'').trim()||null;const t={id,title,description:'',result:'',subtasks:[],comments:[],project:String(fd.get('project')),assignee:String(fd.get('assignee')),creator:meName(),watchers:[],kpi_id:kpiId||null,kpi_name:kpiObj?kpiObj.name:null,due:dueVal,due_time:dueTimeVal,original_due:dueVal,extensions_count:0,priority:String(fd.get('priority')),review:fd.get('review')==='on',status:'TODO',progress:0,checkins:[],events:[{actor:meName(),text:'Tạo công việc mới',at:new Date().toISOString()}]};state.tasks.unshift(t);save();state.modal=null;state.page='tasks';state.detail=t.id;state.filter='all';state.search='';layout();toast('Đã tạo công việc mới trên dữ liệu Demo');return}
 if(f.id==='extendTaskForm'){const t=state.tasks.find(x=>x.id===state.detail);if(!t||!roleAllowed(t,'edit')||t.status==='COMPLETED'){toast('Không thể gia hạn công việc này.');return}const newDue=String(fd.get('new_due')||'').trim();const newDueTime=String(fd.get('new_due_time')||'').trim()||null;const preset=String(fd.get('reason_preset')||'').trim();const detail=String(fd.get('reason_detail')||'').trim();if(!newDue||detail.length<10){toast('Vui lòng chọn ngày mới và nhập giải trình ít nhất 10 ký tự.');return}if(!t.original_due)t.original_due=t.due;t.due=newDue;t.due_time=newDueTime;t.extensions_count=(Number(t.extensions_count)||0)+1;const extLog=`Gia hạn lần ${t.extensions_count} đến ${dateHuman(newDue)}${newDueTime?' '+newDueTime:''}: [${preset}] ${detail}`;t.events=t.events||[];t.events.push({actor:meName(),text:extLog,at:new Date().toISOString()});save();state.modal=null;layout();toast(`Đã gửi gia hạn công việc lần ${t.extensions_count}.`);return}
 if(f.id==='checkinTask'){const t=state.tasks.find(x=>x.id===state.detail);const pct=Number(fd.get('pct'));const comment=String(fd.get('comment')||'').trim();if(!t||!roleAllowed(t,'checkin')||!['IN_PROGRESS','PAUSED'].includes(t.status)||pct<0||pct>100||comment.length<5){toast('Kiểm tra lại quyền, tiến độ và nội dung check-in.');return}t.progress=pct;t.checkins??=[];t.checkins.push({text:comment,pct,at:new Date().toISOString()});t.events??=[];t.events.push({text:'Đã check-in tiến độ '+pct+'%',actor:meName(),at:new Date().toISOString()});save();state.modal=null;layout();toast('Đã lưu check-in');return}
 if(f.id==='rejectTask'){const t=state.tasks.find(x=>x.id===state.detail);const reason=String(fd.get('reason')||'').trim();if(!t||!roleAllowed(t,'approve')||t.status!=='IN_REVIEW'||reason.length<5){toast('Yêu cầu không hợp lệ.');return}t.status='IN_PROGRESS';t.events??=[];t.events.push({text:'Trả lại kết quả: '+reason,actor:meName(),at:new Date().toISOString()});save();state.modal=null;layout();toast('Đã trả lại công việc');return}
 if(f.id==='aiForm'){const q=String(fd.get('')||document.getElementById('aiQuery')?.value||'').trim();if(q)sendAI(q)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.modal)state.modal=null;else if(state.ai)state.ai=false;else if(state.detail)state.detail=null;else state.mobile=false;layout()}});
layout();
function syncLocalUsers(){return;
 const resetButton=root.querySelector('[data-action="reset"]');if(resetButton&&!state.users.length)resetButton.remove();
 const loginButton=root.querySelector('[data-action="login"]');if(loginButton)loginButton.remove();
 const sampleBadge=root.querySelector('.sample-chip');if(sampleBadge&&sampleBadge.textContent!=='LƯU TRÊN TRÌNH DUYỆT')sampleBadge.textContent='LƯU TRÊN TRÌNH DUYỆT';
 const storageNote=root.querySelector('.side-sub span');if(storageNote&&storageNote.textContent!=='Dữ liệu chỉ có trên thiết bị này')storageNote.textContent='Dữ liệu chỉ có trên thiết bị này';
 root.querySelectorAll('.stat-foot').forEach(item=>{if(item.textContent==='Trong dữ liệu mẫu')item.textContent='Trong phạm vi hồ sơ'});
 root.querySelectorAll('.tag.progress').forEach(item=>{if(item.textContent.trim()==='Dữ liệu mẫu')item.textContent='Tính từ công việc'});
 root.querySelectorAll('p').forEach(item=>{if(item.textContent.includes('Laravel cung cấp dữ liệu mẫu'))item.textContent='Hồ sơ và công việc được lưu trong localStorage của trình duyệt này; chưa đồng bộ giữa máy hoặc người dùng.'});
 const profilePanel=root.querySelector('.user-management');
 if(profilePanel&&!profilePanel.querySelector('.role-policy')){const note=document.createElement('p');note.className='small muted role-policy';note.textContent='Nhân viên: nhận và cập nhật việc của mình. Quản lý: giao việc và duyệt trong toàn bộ dữ liệu cục bộ hiện có. Phó tổng giám đốc: xem và duyệt toàn bộ. Chủ tịch: toàn quyền quản lý hồ sơ. Phạm vi quản lý theo phòng ban/dự án chưa được cấu hình.';profilePanel.append(note)}
 const selector=root.querySelector('#roleSwitch');
 if(selector){
  selector.setAttribute('aria-label','Chuyển hồ sơ người dùng cục bộ; đây không phải đăng nhập');
  const options=state.users.length?state.users.map(user=>({text:`${user.name} · ${roleLabel(user.role)}`,value:user.id})):[{text:'Tạo hồ sơ người dùng trong Cài đặt',value:''}];
  if(selector.options.length!==options.length||options.some((option,index)=>selector.options[index]?.value!==option.value||selector.options[index]?.text!==option.text))selector.replaceChildren(...options.map(option=>new Option(option.text,option.value)));
  selector.value=state.activeUserId;
 }
 const roleSelect=root.querySelector('#userRole');
 if(roleSelect&&!state.users.length){
  const firstRole=[{text:'Chủ tịch · quản trị hồ sơ người dùng',value:'CHAIRMAN'}];
  if(roleSelect.options.length!==1||roleSelect.options[0]?.value!=='CHAIRMAN')roleSelect.replaceChildren(...firstRole.map(option=>new Option(option.text,option.value)));
 }
 root.querySelectorAll('.user-management .user-list .list-line').forEach(row=>{
  const name=row.querySelector('strong')?.textContent,user=state.users.find(item=>item.name===name);
  if(!user||row.querySelector('.profile-role'))return;
  const select=document.createElement('select');select.className='field profile-role';select.dataset.userId=user.id;select.setAttribute('aria-label',`Chức danh của ${user.name}`);
  select.replaceChildren(...ROLE_LEVELS.map(role=>new Option(role.label,role.id)));select.value=user.role;select.disabled=user.id===state.activeUserId;
  row.append(select);
 });
 const assignee=root.querySelector('#assignee');
 if(assignee){
  const eligible=canManage()?state.users:[meUser()].filter(Boolean);
  if(assignee.options.length!==eligible.length||eligible.some((user,index)=>assignee.options[index]?.value!==user.name))assignee.replaceChildren(...eligible.map(user=>new Option(user.name,user.name)));
  assignee.value=meName();
 }
}
syncLocalUsers();
loadAiBriefing(false);
root.addEventListener('change',e=>{
 if(e.target.id==='kpiPeriod'&&/^\d{4}-\d{2}$/.test(e.target.value)){state.period=e.target.value;layout()}
 if(e.target.id==='kpiBankDepartment'){state.kpiBankDepartment=e.target.value;layout()}
 if(e.target.id==='kpiBankPerspective'){state.kpiBankPerspective=e.target.value;layout()}
 if(e.target.matches('.profile-role')){
  if(meUser()?.role!=='CHAIRMAN'){toast('Chỉ Chủ tịch được thay đổi chức danh.');return}
  const user=state.users.find(item=>item.id===e.target.dataset.userId);
  if(!user||!ROLE_LEVELS.some(role=>role.id===e.target.value)){toast('Không tìm thấy hồ sơ hoặc chức danh hợp lệ.');return}
  const previousRole=user.role;user.role=e.target.value;
  try{localStorage.setItem('bfc-smart-work-users-v1',JSON.stringify(state.users));layout();toast(`Đã cập nhật chức danh cho ${user.name}.`)}
  catch(error){user.role=previousRole;console.error('Không thể lưu chức danh người dùng.',error);layout();toast('Không thể lưu chức danh. Hãy kiểm tra dung lượng lưu trữ.')}
 }
});
root.addEventListener('submit',e=>{
 const form=e.target;
 if(form.id==='createUser'){
  e.preventDefault();e.stopImmediatePropagation();
  if(state.users.length&&meUser()?.role!=='CHAIRMAN'){toast('Chỉ Chủ tịch được thêm hồ sơ người dùng.');return}
  const data=new FormData(form),name=String(data.get('name')||'').trim(),role=String(data.get('role')||'');
  if(name.length<2||!ROLE_LEVELS.some(x=>x.id===role)){toast('Vui lòng nhập tên hợp lệ và chọn chức danh.');return}
  if(!state.users.length&&role!=='CHAIRMAN'){toast('Hồ sơ đầu tiên cần là Chủ tịch để quản trị người dùng.');return}
  if(state.users.some(user=>user.name.toLocaleLowerCase()===name.toLocaleLowerCase())){toast('Tên người dùng này đã tồn tại.');return}
  const user={id:globalThis.crypto?.randomUUID?.()||`user-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,role};
  const previousUserId=state.activeUserId;state.users.push(user);state.activeUserId=user.id;
  try{localStorage.setItem('bfc-smart-work-users-v1',JSON.stringify(state.users));saveUi()}
  catch(error){state.users.pop();state.activeUserId=previousUserId;console.error('Không thể lưu hồ sơ người dùng.',error);toast('Không thể lưu hồ sơ vào trình duyệt. Hãy kiểm tra dung lượng lưu trữ.');return}
  state.page='tasks';layout();toast(`Đã tạo hồ sơ ${name} · ${roleLabel(role)}`);return;
 }
 if(form.id==='createTask'){
  e.preventDefault();e.stopImmediatePropagation();
  const data=new FormData(form),title=String(data.get('title')||'').trim(),assigneeId=String(data.get('assigneeId')||''),assignee=String(data.get('assignee')||''),startDate=String(data.get('start_date')||''),due=String(data.get('due')||''),recipient=state.users.find(user=>user.id===assigneeId&&user.name===assignee),review= data.get('review')==='on',reviewerId=String(data.get('reviewer_id')||''),reviewer=state.reviewerUsers.find(user=>user.id===reviewerId);
  if(!meUser()){state.page='settings';state.modal=null;layout();toast('Hãy tạo hồ sơ người dùng trước khi giao việc.');return}
  if(title.length<4||!recipient||(!canManage()&&recipient.id!==meUser()?.id)||(review&&!reviewer)||!Number.isFinite(Date.parse(startDate))||!Number.isFinite(Date.parse(due))||startDate>due){toast('Kiểm tra lại tên việc, người thực hiện, người nghiệm thu và thời gian công việc.');return}
  const id=generateNextTaskId(),now=new Date().toISOString();
  const task={id,title,description:'',result:'',subtasks:[],comments:[],project:String(data.get('project')||'Công việc độc lập'),assignee,assignee_id:assigneeId,creator:meName(),creator_id:meUser()?.id,reviewer_id:review?reviewerId:null,watchers:[],start_date:startDate,due,due_time:String(data.get('due_time')||'')||null,priority:String(data.get('priority')||'MEDIUM'),review,status:'TODO',progress:0,createdAt:now,checkins:[],events:[{actor:meName(),text:'Tạo công việc mới',at:now}]};
  state.tasks.unshift(task);if(!save()){state.tasks.shift();toast('Không thể lưu công việc vào máy chủ local.');return}state.modal=null;state.page='tasks';state.detail=task.id;state.filter='all';state.search='';layout();toast('Đã lưu công việc trên máy chủ local.');return;
 }
},true);
root.addEventListener('click',e=>{
 const transitionButton=e.target.closest('[data-transition]');
 if(!transitionButton)return;
 const task=state.tasks.find(item=>item.id===state.detail),action=transitionButton.dataset.transition;
 if(!task||!roleAllowed(task,action==='approve'?'approve':action==='submit'?'submit':'start'))return;
 if((action==='submit'||action==='approve')&&!requireCompletedSubtasks(task)){e.stopImmediatePropagation();return}
 const now=new Date().toISOString();
 if(action==='submit'&&task.status==='IN_PROGRESS'&&task.progress>=100){if(task.review)task.submittedAt=now;else task.completedAt=now}
 if(action==='approve'&&task.status==='IN_REVIEW'){task.approvedAt=now;task.completedAt=now}
 save();
},true);
root.addEventListener('click',async e=>{
 const button=e.target.closest('[data-action]');if(!button)return;
 if(button.dataset.action==='notice'){e.preventDefault();e.stopImmediatePropagation();const unread=state.notifications.find(item=>!item.read_at);toast(unread?`${unread.title}: ${unread.message}`:`Không có thông báo mới. ${fmtNum(stats().review)} việc chờ duyệt.`)}
 if(button.dataset.action==='auth-screen'){state.authScreen=button.dataset.screen||'login';state.authMessage='';layout()}
 if(button.dataset.action==='workspace-switch'){
  if(!isSystemAdmin()){toast('Tài khoản hiện tại không có quyền chuyển sang khu vực quản trị.');return}
  state.workspaceMode=state.workspaceMode==='admin'?'employee':'admin';
  state.page=state.workspaceMode==='admin'?'settings':'tasks';
  state.detail=null;state.modal=null;state.ai=false;state.mobile=false;state.search='';
  saveUi();layout();return;
 }
 if(button.dataset.action==='logout'){button.disabled=true;try{await apiRequest('/demo-auth/logout',{method:'POST',body:'{}'});window.location.reload()}catch(error){button.disabled=false;toast(error.message)}}
 if(button.dataset.action==='reload-admin')loadAdminData();
 if(button.dataset.action==='import-legacy'){
  if(!state.permissions.includes('tasks.create')){toast('Tài khoản hiện không có quyền tạo công việc để nhập dữ liệu.');return}
  button.disabled=true;const imported=state.legacyTasks.map((task,index)=>({...task,id:`LEG-${state.authUser.id.slice(0,8)}-${Date.now()}-${index}`,assignee:meName(),creator:meName()}));
  try{const result=await apiRequest('/demo-work/tasks/import-legacy',{method:'POST',body:JSON.stringify({tasks:imported})});state.tasks=result.tasks;state.serverTasks=structuredClone(result.tasks);state.legacyImported=true;localStorage.setItem(`bfc-smart-work-legacy-imported-${state.authUser.id}`,'1');layout();toast(`Đã nhập ${imported.length} công việc; dữ liệu cũ vẫn được giữ.`)}catch(error){button.disabled=false;toast(error.message)}
 }
},true);
root.addEventListener('submit',async e=>{
 const form=e.target;
 if(form.id==='authLogin'||form.id==='authRegister'){
  e.preventDefault();e.stopImmediatePropagation();const data=new FormData(form),register=form.id==='authRegister',payload=Object.fromEntries(data.entries());state.authMessage='';
  if(register&&payload.password!==payload.password_confirmation){state.authMessage='Mật khẩu xác nhận không khớp.';layout();return}
  try{const result=await apiRequest(register?'/demo-auth/register':'/demo-auth/login',{method:'POST',body:JSON.stringify(payload)});if(register){state.authScreen='pending';state.authMessage=result.message;layout()}else window.location.reload()}catch(error){state.authMessage=error.message;layout()}return;
 }
 const type=form.dataset.adminForm;if(!type)return;e.preventDefault();e.stopImmediatePropagation();const values=new FormData(form);let url='',method='POST',payload={};
 if(type==='domains'){url='/demo-auth/admin/domains';method='PUT';payload={domains:String(values.get('domains')||'').split(',').map(item=>item.trim()).filter(Boolean)}}
 if(type==='decision'){url=`/demo-auth/admin/requests/${encodeURIComponent(form.dataset.id)}/decision`;payload={decision:e.submitter?.value||'approve',role_id:values.get('role_id'),scope:{departments:String(values.get('departments')||'').split(',').map(item=>item.trim()).filter(Boolean),projects:String(values.get('projects')||'').split(',').map(item=>item.trim()).filter(Boolean),organization:values.has('organization')},note:values.get('note')||''}}
 if(type==='user'){url=`/demo-auth/admin/users/${encodeURIComponent(form.dataset.id)}`;method='PUT';payload={name:values.get('name'),department:values.get('department'),job_title:values.get('job_title'),scope:{departments:String(values.get('departments')||'').split(',').map(item=>item.trim()).filter(Boolean),projects:String(values.get('projects')||'').split(',').map(item=>item.trim()).filter(Boolean),organization:values.has('organization')}};if(form.dataset.selfAdmin!=='true'){payload.role_id=values.get('role_id');payload.status=values.get('status')}}
 if(type==='role'){url=`/demo-auth/admin/roles/${encodeURIComponent(form.dataset.id)}`;method='PUT';payload={label:values.get('label'),permissions:values.getAll('permissions')}}
 const submitter=e.submitter;if(submitter)submitter.disabled=true;
 try{const result=await apiRequest(url,{method,body:JSON.stringify(payload)});if(type==='user'&&result.user?.id===state.authUser?.id){state.authUser={...state.authUser,...result.user};state.users=state.users.map(user=>user.id===result.user.id?{...user,...result.user}:user);state.tasks=state.tasks.map(task=>({...task,...(task.assignee_id===result.user.id?{assignee:result.user.name}:{}),...(task.creator_id===result.user.id?{creator:result.user.name}:{})}))}state.adminMessage='';await loadAdminData();toast('Đã lưu thay đổi; thao tác đã được ghi nhật ký.')}catch(error){if(submitter)submitter.disabled=false;toast(error.message)}
},true);
