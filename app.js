import {areas,performanceLocations,shows,categories,filterLabels,distance,clock,day} from './data.js';
import {mountMap, centerMarker, resetMap} from './map.js';
import {createPreviewPlayer} from './preview.js';
import {enableDragScroll} from './drag-scroll.js';

const screen = document.querySelector('#screen');
const nav = document.querySelector('#navigation');
const dialog = document.querySelector('#dialog');
const modalOverlay = document.querySelector('#modal-overlay');
const {navigation} = window.CornerSet;
const titleRole = {audience:'Audience',performer:'Performer'};
const money = cents => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents/100);
const read = (key,fallback) => {
  try { return JSON.parse(localStorage.getItem('corner-set-version-b-'+key)) ?? fallback; }
  catch { return fallback; }
};
const save = (key,value) => {
  try { localStorage.setItem('corner-set-version-b-'+key,JSON.stringify(value)); } catch {}
};

let role = read('role','audience');
let night = read('night',false);
let page = role === 'audience' ? 'discover' : 'home';
let history = [];
let view = 'map';
let search = '';
let selected;
let show = shows[0];
let area = areas[0];
let category;
let scheduled = read('scheduled',[]);
let favorite = new Set(read('favorite',[]));
let tips = read('tips',{});
let attendance = read('attendance',{});
let active = read('active',null);
let published = read('published',null);
let confirmingEnd = false;
let draft;
let ticketTip = 0;
let customTip = false;
const player = createPreviewPlayer(updatePreviews);
let roleExpanded = false;
let simulatedOffline = read('offline',false);
let lastFocus;

const img = (name,cls='',folder='assets') => '<img alt="" class="'+cls+'" src="'+folder+'/'+name+'">';
const icon = (name,cls='icon') => night ? img(name+'-night.svg',cls) : img(name+'.svg',cls,'assets/app-shell');
const button = (label,action,cls='',extra='') => '<button type="button" class="'+cls+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
const goButton = (label,destination,cls='',extra='') => button(label,'go:'+destination,cls,extra);
const ui = (name,cls='ui-icon') => {
  const themed = night && ['filters','map-location'].includes(name);
  return img(name+(themed?'-night':'')+'.svg',cls+' mono-icon');
};
const back = () => button(ui('back'),'back','circle','aria-label="Back"');
const heading = (title,action='') => '<header class="page-heading">'+back()+action+'<h1>'+title+'</h1></header>';
const streetArt = {hubble:'hubble',newton:'newton',kepler:'kepler','your-set':'hubble'};
const photo = item => item.photo ? img('street-art/'+streetArt[item.id]+'.png','cover street-art') : '';
const areaPhoto = (item,cls='') => item.photo ? img(item.photo,cls,'assets/performer-home') : '';
const heart = (item,onPhoto=false) => button(img((favorite.has(item.id)?'favorite-solid':'favorite-outline')+(night&&!onPhoto?'-night':'')+'.svg','ui-icon'),'favorite:'+item.id,'heart','aria-label="Favorite '+item.name+'" aria-pressed="'+favorite.has(item.id)+'"');
function previewButton(item) {
  return button('','preview:'+item.id,'preview','data-preview="'+item.id+'" aria-label="Preview 15 seconds"');
}

function updatePreviews() {
  for (const control of screen.querySelectorAll('[data-preview]')) {
    const {status,elapsed} = player.state(control.dataset.preview);
    const active = status==='playing'||status==='paused';
    if (control.classList.contains('ticket-wave')) {
      control.setAttribute('aria-label',status==='playing'?'Pause song preview':status==='paused'?'Resume song preview':'Play song preview');
      control.setAttribute('aria-pressed',String(status==='playing'));
      continue;
    }
    if (control.dataset.status!==status) {
      control.dataset.status=status;
      control.setAttribute('aria-disabled',String(status==='connecting'));
      const art = {idle:ui('play'),connecting:ui('connecting','ui-icon preview-spinner'),
        playing:ui('pause'),paused:ui('play'),completed:ui('replay')}[status];
      const label = {idle:'Preview <small>15s</small>',connecting:'Connecting...',playing:'',paused:'',completed:'Replay'}[status];
      control.innerHTML='<span class="preview-content">'+art+' <span>'+label+'</span></span>';
      control.setAttribute('aria-label',{idle:'Preview 15 seconds',connecting:'Connecting...',playing:'Pause preview',paused:'Resume preview',completed:'Replay preview'}[status]);
    }
    if (active) {
      const time = '00:'+String(Math.floor(elapsed)).padStart(2,'0')+' / 15s';
      const label = control.querySelector('.preview-content > span');
      if (label.textContent!==time) label.textContent=time;
      control.style.setProperty('--playback',elapsed/15*100+'%');
    }
  }
}

const nCrowd = item => item.audience + (attendance[item.id] ? 1 : 0);
function nowShow() {
  if (!(published?.ends>Date.now())) return null;
  const publicArea = areas.find(item=>item.id===published.area);
  return {...shows[0],id:'your-set',area:publicArea,distance:publicArea.distance,
    remaining:Math.ceil((published.ends-Date.now())/60000),
    time:clock(published.starts)+' - '+clock(published.ends)};
}
const allShows = () => [...shows,...[nowShow()].filter(Boolean)];
const findShow = id => allShows().find(item=>item.id===id);
const root = () => role==='audience'?'discover':'home';
const offline = () => simulatedOffline || !navigator.onLine;

function move(destination,{replace=false,before,transition='forward'}={}) {
  const changed = destination!==page;
  roleExpanded = false;
  if (!replace) history.push({page,view,category,selected,show,area,search,sheetScroll:screen.querySelector('.sheet-cards')?.scrollTop});
  before?.();
  page = destination;
  render();
  screen.scrollTop = 0;
  if (changed) animatePage(transition);
}

function animatePage(direction) {
  screen.getAnimations().forEach(animation=>animation.cancel());
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frames = direction==='tab' ? [{opacity:.7},{opacity:1}] :
    [{transform:'translateX('+(direction==='back'?'-100%':'100%')+')'},{transform:'translateX(0)'}];
  screen.animate(frames,{duration:direction==='tab'?200:245,easing:'cubic-bezier(.22,.72,.28,1)'});
}

function topLevel(destination,transition='tab') {
  history = [];
  view = 'map';
  category = selected = undefined;
  search = '';
  move(destination,{replace:true,transition});
}

function goBack() {
  roleExpanded = false;
  const previous = history.pop() || {page:root()};
  Object.assign(route,previous);
  render();
  const cards = screen.querySelector('.sheet-cards');
  if (cards) cards.scrollTop = previous.sheetScroll || 0;
  screen.scrollTop = 0;
  animatePage('back');
}

const route = {
  set page(value){page=value;},set view(value){view=value;},set category(value){category=value;},
  set selected(value){selected=value;},set show(value){show=value;},set area(value){area=value;},
  set search(value){search=value;}
};

function modal(title,body,actions=button('OK','close','purple'),variant='') {
  if (!dialog.open) lastFocus = document.activeElement;
  dialog.className=variant;
  modalOverlay.dataset.variant=variant;
  dialog.innerHTML = '<h2 id="modal-title">'+title+'</h2>'+body+'<div class="dialog-actions">'+actions+'</div>';
  modalOverlay.hidden=false;
  screen.inert=nav.inert=true;
  if (!dialog.open) dialog.show();
  dialog.querySelector('button, input')?.focus();
}

function closeModal() {
  dialog.close();
  modalOverlay.hidden=true;
  screen.inert=nav.inert=false;
  lastFocus?.focus();
}

function comingSoon() {
  modal('Coming Soon','<p>This feature will be available in a future update.</p>');
}

function roleArt(key) {
  return img('role-'+key+(night?'-night':'')+'.svg','icon '+key+'-art');
}

function rolePicker(onlyIcon=false) {
  return button(roleArt(role)+(onlyIcon?'':titleRole[role])+ui('role-chevron','role-chevron'),'role','role',
    'aria-label="Switch role, current role '+titleRole[role]+'" aria-controls="role-selector" aria-expanded="'+roleExpanded+'"');
}

function roleOptions() {
  return '<div id="role-selector" class="role-selector" data-expanded="'+roleExpanded+'" '+(roleExpanded?'':'inert')+'>'+
    '<div><div class="role-options" role="group" aria-label="Choose role">'+Object.keys(titleRole).map(key=>
    button(roleArt(key)+titleRole[key],'switch:'+key,'role-choice','aria-pressed="'+(key===role)+'"')).join('')+'</div></div></div>';
}

function alignRolePointer() {
  const panel=screen.querySelector('#role-selector');
  const artwork=screen.querySelector('[data-action="role"] .icon');
  if (!panel || !artwork) return;
  const icon=artwork.getBoundingClientRect();
  panel.style.setProperty('--role-pointer-x',icon.left+icon.width/2-panel.getBoundingClientRect().left+'px');
}

function setRoleExpanded(expanded,restoreFocus=false) {
  roleExpanded=expanded;
  const panel=screen.querySelector('#role-selector');
  const toggle=screen.querySelector('[data-action="role"]');
  if (!panel || !toggle) return;
  if (expanded) alignRolePointer();
  if (restoreFocus) toggle.focus();
  toggle.setAttribute('aria-expanded',String(expanded));
  panel.dataset.expanded=String(expanded);
  panel.inert=!expanded;
}

function modeHeader() {
  return '<header class="mode-header">'+rolePicker()+button(img('sun.svg','sun')+(night?'NIGHT':'DAY'),'theme','theme',
    'aria-label="Toggle day or night appearance"')+'</header>'+roleOptions();
}

function showCard(item) {
  const timeClass = item.remaining<=10?'short':item.remaining<=20?'medium':'long';
  return '<article class="show-card"><button type="button" class="show-image" data-action="details:'+item.id+'" aria-label="View '+item.name+'">'+photo(item)+
    '<span class="remaining '+timeClass+'">'+item.remaining+'min left</span>'+img(item.avatar+'.png','avatar')+'</button>'+
    '<div class="show-name">'+button(item.name,'details:'+item.id,'text-button')+heart(item)+'</div>'+
    '<div class="show-meta"><span>Perform Time: '+item.time+'</span><span class="crowd">'+ui('audience-count','icon')+nCrowd(item)+'</span><span>'+distance(item.distance)+'</span></div>'+
    '<div class="show-actions">'+icon(item.genre.toLowerCase())+item.genre+previewButton(item)+'</div></article>';
}

function section(title,destination,items) {
  return '<section><div class="section-heading"><h2>'+title+'</h2>'+goButton(ui('next-chevron'),destination,'circle','aria-label="See all '+title+'"')+'</div><div class="carousel">'+items.map(showCard).join('')+'</div></section>';
}

function discover() {
  const items = allShows();
  return modeHeader()+'<div class="content discover">'+section('Live near You','nearby',items)+
    '<div class="categories" aria-label="Music Categories">'+categories.map(name=>button(icon(name.toLowerCase())+name,'category:'+name)).join('')+'</div>'+
    section('Recommend for You','recommended',[items[1],items[2],items[0]])+'</div>';
}

function showList(title,items) {
  return '<div class="content">'+heading(title)+'<div class="cards">'+(items.length?items.map(showCard).join(''):'<p>No performances yet.</p>')+'</div></div>';
}

function home() {
  const next = scheduled.filter(set=>set.starts+set.minutes*60000>Date.now()).sort((a,b)=>a.starts-b.starts);
  const summary = (item,action,sub='') => button(areaPhoto(item,'area-avatar')+'<span><strong>'+item.name+'</strong>'+sub+'</span>'+ui('next-chevron'),action,'set-card');
  return modeHeader()+'<div class="content home">'+img('logo.svg','brand')+
    button('Place A Set '+img('place-arrow.svg','place-arrow'),'place','place')+
    (active?button('Active Performance','go:active','lime wide'):'')+
    '<section class="set-section"><div class="section-heading"><h2>'+ui('next','icon')+' Next Set</h2>'+button('See all','go:upcoming','underlined')+'</div>'+
    (next.length?next.slice(0,1).map(set=>'<p>'+day(set.starts)+'</p>'+summary(areas.find(item=>item.id===set.area),'edit:'+set.id,'<small>'+clock(set.starts)+'</small>')).join(''):'<p>No upcoming sets.</p>')+
    '</section><section class="set-section"><div class="section-heading"><h2>'+ui('history','icon')+' Past Set</h2>'+button('See all','soon','underlined')+'</div><p>Nov 21 2025</p>'+
    summary(areas[1],'soon')+'</section></div>';
}

function upcoming() {
  const next = scheduled.filter(set=>set.starts+set.minutes*60000>Date.now()).sort((a,b)=>a.starts-b.starts);
  return '<div class="content">'+heading('Next Set')+(next.length?'':'<p>No upcoming sets.</p>')+next.map(set=>{
    const item = areas.find(value=>value.id===set.area);
    return '<p>'+day(set.starts)+'</p>'+button(areaPhoto(item,'area-avatar')+'<span><strong>'+item.name+'</strong><small>'+clock(set.starts)+'</small></span>','edit:'+set.id,'set-card');
  }).join('')+'</div>';
}

function profile() {
  const audience = role==='audience';
  const rows = (names,art) => names.map((name,i)=>button(ui(art[i],'ui-icon profile-icon')+name+ui('next-chevron','ui-icon profile-chevron'),'soon','profile-row')).join('');
  const stats = audience ? [['12','Trace'],['8','Following'],['46','Reward']] : [['12','Sets'],['8','Followers'],['$146','Tips Received']];
  return '<div class="content profile"><header>'+rolePicker(true)+'</header>'+roleOptions()+'<div class="profile-person">'+img(audience?'profile.png':'performer-avatar.png','profile-photo')+
    '<div><h1>Eric</h1><span>'+titleRole[role]+' account</span></div>'+button(ui('next-chevron'),'soon','plain','aria-label="Account details"')+'</div>'+
    '<div class="stats">'+stats.map(([value,label])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div>'+
    '<h2>'+(audience?'Preference':'Performer Profile')+'</h2>'+
    (audience?rows(['Favorite Music Genre','Notification'],['music','notification']):rows(['Music Genre','Audio Preview','Public Profile'],['music','disc','public-profile']))+
    '<h2>My Service</h2>'+rows(['Help Center','Settings'],['help','settings'])+'</div>';
}

function matching() {
  const query = search.trim().toLowerCase();
  if (role==='performer') return performanceLocations.filter(item=>
    !query || item.name.toLowerCase().includes(query) || item.address.toLowerCase().includes(query));
  return allShows().filter(item => (!category || category===item.genre) &&
    (!query || [item.name,item.genre,item.area.name].some(value=>value.toLowerCase().includes(query))));
}

function filterBar() {
  return '<div class="filter-row">'+button(ui('filters'),'filter','circle filter-settings','aria-label="Filters"')+
    '<div class="chips">'+filterLabels[role].map(name=>button(name+ui('chip-chevron'),'filter','chip')).join('')+
    (role==='audience'?button('Random Pick','random','purple'):'')+'</div></div>';
}

function locationCards(items) {
  return items.length?items.map(item=>locationCard(item,true)).join(''):'<p>No locations found.</p>';
}

function facilityItems(item) {
  const icons = {'Power Outlet':'location-power',Shelter:'location-shelter'};
  return item.facilities.map(name=>'<span>'+ui(icons[name])+' '+name+'</span>').join('');
}

function locationCard(item,inList=false) {
  const cover = item.id==='westmount'?img('park-cover.jpg','cover'):areaPhoto(item,'cover');
  const chosen = selected===item.id;
  const select = 'select-location:'+item.id;
  const title = inList?button(item.name,select,'location-select','aria-pressed="'+chosen+'"'):item.name;
  const state = inList?' data-action="'+select+'" data-selected="'+chosen+'"':'';
  return '<article class="location-card"'+state+'><div class="location-photo">'+cover+
    '<span class="remaining traffic-badge" data-level="'+item.traffic.toLowerCase()+'">'+item.traffic+' Traffic</span></div><h3>'+title+'</h3>'+
    '<p class="location-meta">'+facilityItems(item)+'<span>'+ui('active-location')+' '+distance(item.distance)+'</span></p>'+
    button('More Details '+ui('location-chevron'),'location:'+item.id,'location-detail-link')+
    (chosen?button('Use This Area','setup:'+item.id,'lime wide'):'')+'</article>';
}

function browseSearch() {
  const label=role==='audience'?'Search performances':'Search locations';
  return '<div class="browse-search"><input id="browse-search" type="search" aria-label="'+label+'" autocomplete="off">'+
    button(ui('map-location'),'map-reset','circle','aria-label="Reset map position"')+'</div>';
}

function audienceCards(items) {
  return items.length?items.map(showCard).join(''):'<p>No shows found.</p>';
}

function audienceBrowse(items) {
  const mapView = view==='map';
  const segments = ['map','list'].map(option=>{
    const label = option==='map'?'Map':'List';
    return button('<span class="segment-icon '+option+'-icon" aria-hidden="true"></span>'+label,
      'audience-view:'+option,'segment','aria-pressed="'+(option===view)+'"');
  }).join('');
  return '<div class="audience-browse" data-view="'+view+'">'+
    (mapView?'<div id="map" class="map"></div>':'')+
    '<header class="browse-controls">'+(category?'<div class="browse-category">'+back()+'<h1>'+category+'</h1></div>':'')+
    browseSearch()+filterBar()+'</header>'+
    (mapView?'<div class="map-dock"><div class="map-result"></div></div>':
      '<section class="sheet-cards cards" aria-label="Live shows">'+audienceCards(items)+'</section>')+
    '<div class="view-segments" role="group" aria-label="Browse view">'+segments+'</div></div>';
}

function browse() {
  const list = matching();
  if (role==='audience') return audienceBrowse(list);
  const item = list.find(entry=>entry.id===selected);
  const toggle = button(view==='map'?ui('list-view')+' List':'Map '+ui('map-view'),'view','purple view-toggle');
  if (view==='list') return '<div class="browse-list"><header class="browse-controls">'+browseSearch()+filterBar()+'</header>'+
    '<div class="sheet-cards cards">'+locationCards(list)+'</div><div class="list-footer">'+
    button('Map '+ui('map-view'),'view','purple map-return')+'</div></div>';
  return '<div class="map-screen performer-browse" data-selected="'+Boolean(item)+'"><div id="map" class="map"></div>'+
    '<header class="browse-controls">'+browseSearch()+filterBar()+'</header>'+
    '<div class="map-dock">'+toggle+'<div class="map-result">'+(item?locationCard(item):list.length?'':'<p>No locations found.</p>')+'</div></div></div>';
}

function drawMap() {
  const container = screen.querySelector('#map');
  mountMap(container,matching().map(item=>role==='audience'?{...item,audience:nCrowd(item)}:item),role,selected,id=>action('marker:'+id),()=>{if (selected) restoreOverview();});
  if (selected) mapSelection(selected,false);
}

function detail() {
  show = findShow(show.id) || show;
  return '<div class="details"><div class="hero">'+photo(show)+'<div class="hero-controls">'+back()+heart(show,true)+'</div>'+
    '<div class="badges"><span class="remaining long">'+show.remaining+'min left</span><span class="remaining">Audience: '+nCrowd(show)+'</span></div></div>'+
    '<div class="content"><div class="identity">'+img(show.avatar+'.png','avatar')+'<div><h2>'+show.name+'</h2>'+icon(show.genre.toLowerCase())+' '+show.genre+'</div></div>'+
    '<p>'+ui('time')+' Perform Time: '+show.time+'<br>'+ui('location-pin')+' Near '+show.area.name+', Montréal</p>'+
    '<section class="detail-section"><h2>About Performer</h2><p>Detailed Information</p>'+previewButton(show)+'</section>'+
    '<section class="detail-section"><h2>Direction</h2>'+button(directionPreview(show),'direction','map-link','aria-label="Direction near '+show.area.name+'"')+'</section></div>'+
    '<footer class="sticky-actions">'+button("I'm Here",'arrive','mint')+button('Direct','soon','lime')+'</footer></div>';
}

function mapPreview(location) {
  return img('direction-'+location.id+(night?'-night':'-day')+'.png','mini-map');
}

function directionPreview(item) {
  return '<span class="direction-preview">'+mapPreview(item.area)+
    '<span class="direction-area">'+img(item.avatar+'.png','avatar')+'</span><small>© OpenStreetMap contributors · OpenFreeMap</small></span>';
}

function ticket() {
  show = findShow(show.id) || show;
  const amounts = [100,200,500];
  const tipChips = amounts.map(cents=>{
    const chosen = !customTip && ticketTip===cents;
    return button(money(cents).replace('.00',''),'tip:'+cents,'chip'+(chosen?' on':''),'aria-pressed="'+chosen+'"');
  }).join('');
  const cover = photo(show);
  const stat = (label,art,value) => '<div><span>'+ui(art)+' '+label+'</span><strong>'+value+'</strong></div>';
  const wave = button(img('wave.svg','ticket-icon'),'preview:'+show.id,'ticket-wave',
    'data-preview="'+show.id+'" aria-label="Play song preview"');
  const confirmArt = '<span class="confirm-art"><span class="confirm-hand-layout">'+img('confirm-hand.svg','ticket-icon confirm-hand')+'</span>'+img('confirm-coin.svg','confirm-coin')+'</span>';
  return '<div class="ticket"><header class="ticket-cover" data-performer="'+streetArt[show.id]+'">'+cover+'<div>'+back()+'<h1>'+show.name+'</h1>'+heart(show,true)+'</div></header>'+
    '<div class="ticket-body"><div class="now">'+img('ticket-vinyl.svg','ticket-icon')+'<div><h2>Now Playing</h2><span>'+(show.id==='hubble'?'Mr.BrightLight':show.track)+'</span></div>'+wave+'</div>'+
    '<div class="ticket-stats">'+stat('Time Left','timer',show.remaining+':00')+stat('Audience','crowd',nCrowd(show))+
    stat('Tips','tips',money((show.id==='your-set'?4850:2300)+(tips[show.id]||0)).replace(/\.00$/,''))+'</div>'+
    '<h2 class="tip-heading">'+img('ticket-cash.svg','ticket-icon')+' Tip Performer</h2><div class="tip-options">'+tipChips+
    button('Custom','custom-tip','chip'+(customTip?' on':''),'aria-pressed="'+customTip+'"')+'</div>'+
    '<p class="selected-tip">'+(ticketTip?'Selected tip: '+money(ticketTip).replace(/\.00$/,'')+' CAD':'')+'</p></div>'+
    '<footer>'+img('ticket-perforation.svg','ticket-perforation')+
    button(confirmArt+'Confirm','confirm-tip','lime wide',ticketTip?'':'disabled')+'</footer><svg class="ticket-outline" aria-hidden="true"><path /></svg></div>';
}

function locationDetails() {
  const cover = area.id==='westmount'?img('park-cover.jpg','cover'):areaPhoto(area,'cover');
  const preview = mapPreview(area)+areaPhoto(area,'location-map-marker');
  const address = ui('location-address-pin')+'<span><strong>'+area.address+'</strong><small>Click to open map</small></span>'+ui('location-chevron');
  return '<div class="details location-details"><div class="hero">'+cover+'<div class="hero-controls">'+back()+'</div><h2>'+area.name+'</h2></div><div class="content">'+
    '<section class="detail-section"><h2>Location Description</h2><p>Detailed Information</p></section>'+
    '<section class="detail-section"><h2>Local Rules</h2><p>Detailed Information</p></section>'+
    '<section class="detail-section"><h2>Additional Facilities</h2><p class="location-facilities">'+facilityItems(area)+'</p></section>'+
    '<section class="detail-section"><h2>Crowd Activity</h2><p>Detailed Information</p></section>'+
    '<section class="detail-section"><h2>Direction</h2>'+button(preview,'direction','map-link','aria-label="Direction near '+area.name+'"')+
    button(address,'direction','location-address')+'</section></div><footer class="location-actions">'+
    button('Use This Area','setup:'+area.id,'lime wide')+'</footer></div>';
}

function scheduleDate(timestamp) {
  const date = new Date(timestamp);
  const pad = n => String(n).padStart(2,'0');
  return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('/');
}

function createDraft(item,set) {
  area = item;
  const demoStart = new Date();
  demoStart.setDate(demoStart.getDate()+1);
  demoStart.setHours(16,20,0,0);
  draft = set?{...set,mode:'later'}:{area:item.id,starts:+demoStart,minutes:45,mode:'now'};
  move('setup');
}

function setup() {
  const start = draft.mode==='now'?Date.now():draft.starts;
  const date = scheduleDate(draft.starts);
  return '<div class="setup">'+heading('Performance Detail')+
    '<section><h2>Location</h2><div class="area-preview">'+mapPreview(area)+'<div class="area-radius">'+areaPhoto(area,'area-avatar')+'</div></div>'+
    '<p>'+ui('location-pin')+' Near '+area.name+', Montréal<br><small>Only an approximate area will be visible to the audience.</small></p></section>'+
    '<section><h2>Performance Time</h2><div class="setup-tabs">'+['now','later'].map(mode=>
    button(mode==='now'?'Start Now':'Schedule Later','mode:'+mode,draft.mode===mode?'on':'','aria-pressed="'+(draft.mode===mode)+'"'+(draft.id&&mode==='now'?' disabled':''))).join('')+'</div>'+
    (draft.mode==='later'?'<dl class="schedule-fields"><div><dt>Start Date</dt><dd>'+ui('schedule-calendar')+date+'</dd></div>'+
    '<div><dt>Start Time</dt><dd>'+clock(draft.starts)+'</dd></div></dl>':'')+
    '<div class="durations">'+[30,45,60].map(minutes=>button('<strong>'+minutes+'</strong> '+'<span class="duration-indicator" aria-hidden="true"></span>'+'<small>minutes</small>','duration:'+minutes,draft.minutes===minutes?'on':'','aria-pressed="'+(draft.minutes===minutes)+'"')).join('')+'</div>'+
    button(([30,45,60].includes(draft.minutes)?'Custom Duration':'Custom Duration · '+draft.minutes+' minutes')+' '+ui('chip-chevron'),'custom-duration','custom-duration')+
    '<div class="times"><span>Starts: '+clock(start)+'</span><span>Ends: '+clock(start+draft.minutes*60000)+'</span></div></section>'+
    '<section><div class="section-heading"><div><h2>Audience Preview</h2><small>what the audience will see about you</small></div>'+button(ui('edit')+' Edit','soon','chip setup-edit')+'</div>'+
    '<article class="show-card setup-preview"><div class="show-image">'+photo(shows[0])+img('guitar-avatar.png','avatar')+'</div><strong>'+shows[0].name+'</strong>'+
    '<div>Perform Time: '+clock(start)+' - '+clock(start+draft.minutes*60000)+' · '+day(start)+'</div><div class="show-actions">'+icon('guitar')+' Guitar <span class="preview"><span class="preview-content">'+
    ui('play')+' <span>'+shows[0].track+' <small>15s</small></span></span></span></div></article></section>'+
    '<footer class="setup-actions">'+(draft.id?button('Cancel','cancel-set','muted'):'')+
    button(draft.mode==='now'?'Confirm Performance':'Schedule Performance','confirm-set','lime')+'</footer></div>';
}

function activePage() {
  const item = areas.find(value=>value.id===active.area);
  const disconnected = offline();
  const status = disconnected?'OFFLINE | Updates paused':'LIVE | Visible to audience';
  const tipTotal = disconnected ? active.lastSyncedTips ?? liveTips() : liveTips();
  const pending = active.pending || 0;
  const feedback = active.localAdjustment===15?'+15 minutes added locally':
    active.localAdjustment===-15?'15 minutes removed locally':'Duration adjusted locally';
  const controls = confirmingEnd && !disconnected
    ? '<section class="end-inline" aria-label="Confirm ending your set"><h2>This will end your set</h2>'+
      button('Keep Performing','keep-performing','purple wide')+button('End Performance','end-confirm','wide confirm-end')+'</section>'
    : '<div class="duration-actions">'+button('+15 MINUTES','adjust:15','lime')+
      button('-15','adjust:-15','muted')+'</div>'+button('End Set','end-set','end-set');
  return '<div class="active"><header>'+button(ui(disconnected?'offline-status':'live-status')+' '+status,'offline','status '+(disconnected?'warning':'lime'),'aria-label="'+status+'; switch connection mode"')+
    (disconnected?'<p class="offline-helper">Your timer still works. Changes will sync when reconnected.</p>':'')+
    '<div class="active-location">'+ui('active-location')+' '+item.name+'</div></header>'+
    '<div class="timer"><strong>TIME REMAINING</strong><output id="countdown"></output><div id="active-end"></div>'+
    (disconnected&&pending?'<div class="local-sync" role="status">'+(active.localAdjustment!==undefined?'<strong>'+feedback+'</strong>':'')+
      '<p>'+pending+(pending===1?' change':' changes')+' pending sync</p></div>':'')+'</div>'+
    '<div class="active-metrics">'+(!disconnected&&!confirmingEnd?'<p class="active-audience">'+ui('live-audience')+' Audience: '+nCrowd({...shows[0],id:'your-set'})+'</p>':'')+
    '<p class="active-tips"><span>'+ui('active-tip-jar')+' Tips This Set</span><strong>'+money(tipTotal)+'</strong></p>'+
    (disconnected?'<p class="last-sync">Last updated at '+clock(active.lastSync||active.starts)+'</p>':'')+'</div>'+controls+'</div>';
}

function liveTips() {
  return 4850+(tips['your-set']||0);
}

const ticketOutlineObserver = new ResizeObserver(([{target}])=>{
  const {width:w,height:h}=target.getBoundingClientRect();
  const seam=h-target.querySelector('footer').offsetHeight;
  const top=20, bottom=15, notch=15;
  const left=.5, right=w-.5, end=h-.5;
  target.querySelector('.ticket-outline path').setAttribute('d',
    `M ${top} .5 H ${w-top} A ${top} ${top} 0 0 0 ${right} ${top}
    V ${seam-notch} A ${notch} ${notch} 0 0 0 ${right} ${seam+notch}
    V ${h-bottom} A ${bottom} ${bottom} 0 0 0 ${w-bottom} ${end}
    H ${bottom} A ${bottom} ${bottom} 0 0 0 ${left} ${h-bottom}
    V ${seam+notch} A ${notch} ${notch} 0 0 0 ${left} ${seam-notch}
    V ${top} A ${top} ${top} 0 0 0 ${top} .5 Z`);
});

function render({preserve=false}={}) {
  const scroll = screen.scrollTop;
  const rowPositions = preserve ? Array.from(screen.querySelectorAll('.carousel, .chips'),row=>row.scrollLeft) : [];
  const listScroll = screen.querySelector('.sheet-cards')?.scrollTop || 0;
  document.documentElement.dataset.theme = night?'night':'day';
  const tabs = ['discover','home','browse','favorite','profile'];
  nav.hidden = !tabs.includes(page);
  nav.innerHTML = navigation[role].map(tab=>{
    const activeTab = tab.page===page;
    const name = role==='performer'&&tab.page!=='home'?'performer-'+tab.page:'nav-'+tab.page;
    const idleName = ['home','discover'].includes(tab.page)?name+'-idle':name;
    const activeName = ['home','discover'].includes(tab.page)?name:name+'-active';
    const fill = activeTab && role==='audience' && tab.page!=='discover'
      ? img(name+'-fill.svg','nav-fill '+tab.page) : '';
    const art = '<span class="nav-art">'+fill+img((activeTab?activeName:idleName)+'.svg','icon')+'</span>';
    return button(art+tab.label,'tab:'+tab.page,activeTab?'on':'',activeTab?'aria-current="page"':'');
  }).join('');
  const views = {discover,home,browse,profile,upcoming,detail,ticket,location:locationDetails,setup,active:activePage,
    nearby:()=>showList('Live near You',allShows()),recommended:()=>showList('Recommend for You',[...allShows()].sort((a,b)=>a.distance-b.distance)),
    favorite:()=>showList('Favorite',allShows().filter(item=>favorite.has(item.id)))};
  ticketOutlineObserver.disconnect();
  screen.innerHTML = views[page]();
  if (page==='ticket') ticketOutlineObserver.observe(screen.querySelector('.ticket'));
  if (page==='browse') screen.querySelector('#browse-search').value = search;
  if (page==='browse' && view==='map') drawMap();
  if (page==='active') updateTimer();
  if (preserve) {
    screen.scrollTop = scroll;
    screen.querySelectorAll('.carousel, .chips').forEach((row,index)=>{row.scrollLeft = rowPositions[index] || 0;});
    const cards = screen.querySelector('.sheet-cards');
    if (cards) cards.scrollTop = listScroll;
  }
  updatePreviews();
}

function syncPerformance() {
  if (offline()) return;
  if (active) {
    active.pending = 0;
    delete active.localAdjustment;
    active.lastSyncedTips = liveTips();
    active.lastSync = Date.now();
    save('active',active);
  }
  published = active && {...active};
  save('published',published);
  save('pending-end',null);
}

function setOnlineState() {
  if (offline()) confirmingEnd=false;
  else if (dialog.open && dialog.classList.contains('offline-end-dialog')) {
    closeModal();
    confirmingEnd=true;
  }
  syncPerformance();
  if (page==='active'||page==='home') render({preserve:true});
}

function updateTimer() {
  if (!active) return;
  const remaining = Math.max(0,Math.ceil((active.ends-Date.now())/1000));
  if (!remaining) {
    endPerformance();
    return;
  }
  const output = document.querySelector('#countdown');
  if (!output) return;
  output.value = Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  document.querySelector('#active-end').textContent = 'Ends at '+clock(active.ends);
}

function endPerformance() {
  if (offline() && active) {
    save('pending-end',{area:active.area,ends:Date.now(),changes:(active.pending||0)+1});
  }
  confirmingEnd=false;
  if (dialog.open && dialog.classList.contains('offline-end-dialog')) closeModal();
  active = null;
  save('active',null);
  syncPerformance();
  if (page==='active') topLevel('home');
}

function submitSet() {
  if (draft.mode==='later') {
    const set = {...draft,id:draft.id||crypto.randomUUID()};
    scheduled = [...scheduled.filter(item=>item.id!==set.id),set];
    save('scheduled',scheduled);
    topLevel('home');
    return;
  }
  if (active) {
    modal('Performance already active','<p>End the current set before starting a new performance.</p>');
    return;
  }
  const starts = Date.now();
  delete attendance['your-set'];
  delete tips['your-set'];
  save('attendance',attendance);
  save('tips',tips);
  active = {area:draft.area,starts,ends:starts+draft.minutes*60000,pending:offline()?1:0,lastSync:starts,lastSyncedTips:liveTips()};
  save('active',active);
  syncPerformance();
  move('active',{replace:true});
}

function numericDialog(title,label,id,min,max,step,apply) {
  modal(title,'<form id="numeric-form" data-submit="'+apply+'"><label>'+label+'<input required id="'+id+'" type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+'"></label></form>',
    button('Cancel','close','muted')+button('Apply',apply,'purple'));
}

function mapSelection(id,smooth=true) {
  const map = document.querySelector('#map');
  const result = document.querySelector('.map-result');
  if (!map||!result) return;
  const item = matching().find(entry=>entry.id===id);
  if (!item) return;
  const afterCamera = role==='audience' && smooth && !selected;
  selected = id;
  result.innerHTML = role==='audience'?showCard(item):locationCard(item);
  if (afterCamera) result.firstElementChild.classList.add('after-camera');
  const browse = screen.querySelector('.audience-browse, .performer-browse');
  if (browse) browse.dataset.selected='true';
  const audienceMap = role==='audience';
  centerMarker(id,audienceMap?result.offsetHeight+55:result.parentElement.offsetHeight,smooth,
    audienceMap?result.getBoundingClientRect().top-map.getBoundingClientRect().top:null);
  updatePreviews();
}

function restoreOverview() {
  selected=undefined;
  const browse=screen.querySelector('.audience-browse, .performer-browse');
  if (browse) {
    delete browse.dataset.selected;
    browse.querySelector('.map-result').replaceChildren();
  }
  if (role==='performer' && search) {
    search='';
    screen.querySelector('#browse-search').value='';
    if (view==='map') drawMap();
  } else if (view==='map') resetMap();
  if (role==='performer' && view==='list') screen.querySelector('.browse-list .cards').innerHTML=locationCards(matching());
}

function action(command) {
  const separator = command.indexOf(':');
  const type = separator<0?command:command.slice(0,separator);
  const value = separator<0?'':command.slice(separator+1);
  switch (type) {
    case 'tab': topLevel(value); return;
    case 'go': move(value); return;
    case 'back': goBack(); return;
    case 'close': closeModal(); return;
    case 'soon': comingSoon(); return;
    case 'role':
      setRoleExpanded(!roleExpanded);
      return;
    case 'switch':
      setRoleExpanded(false,true);
      if (role===value) return;
      role=value;
      save('role',role);
      player.stop();
      topLevel(page==='profile'?'profile':root());
      return;
    case 'theme':
      night=!night;
      save('night',night);
      break;
    case 'favorite':
      favorite.has(value)?favorite.delete(value):favorite.add(value);
      save('favorite',[...favorite]);
      break;
    case 'preview': {
      const item = findShow(value);
      if (item) player.toggle(item);
      return;
    }
    case 'category': {
      move('browse',{before:()=>{
        category=value;
        view='list';
        search='';
        selected=undefined;
      }});
      return;
    }
    case 'audience-view':
      if (view===value) return;
      view=value;
      render({preserve:true});
      screen.querySelector('.segment[aria-pressed="true"]').focus({preventScroll:true});
      return;
    case 'view':
      view=view==='map'?'list':'map';
      screen.scrollTop=0;
      break;
    case 'filter': comingSoon(); return;
    case 'random': {
      const matches = matching();
      if (!matches.length) {
        modal('No matches','<p>Change your filters and try again.</p>');
        return;
      }
      action('details:'+matches[Math.floor(Math.random()*matches.length)].id);
      return;
    }
    case 'marker': mapSelection(value); return;
    case 'select-location': {
      selected=value;
      const list=screen.querySelector('.browse-list .cards');
      list.innerHTML=locationCards(matching());
      list.querySelector('.location-card[data-selected="true"] .location-select')?.focus({preventScroll:true});
      return;
    }
    case 'map-reset': restoreOverview(); return;
    case 'details':
      move('detail',{before:()=>{show=findShow(value);}});
      break;
    case 'direction': comingSoon(); return;
    case 'arrive':
      attendance[show.id]=true;
      save('attendance',attendance);
      ticketTip=0;
      customTip=false;
      move('ticket');
      return;
    case 'tip':
      ticketTip=Number(value);
      customTip=false;
      break;
    case 'custom-tip': numericDialog('Custom tip','Amount (CAD)','amount',1,500,.01,'apply-tip'); return;
    case 'apply-tip': {
      const amount=document.querySelector('#amount');
      if (!amount.reportValidity()) return;
      ticketTip=Math.round(amount.valueAsNumber*100);
      customTip=true;
      closeModal();
      break;
    }
    case 'confirm-tip':
      if (!ticketTip) return;
      tips[show.id]=(tips[show.id]||0)+ticketTip;
      save('tips',tips);
      ticketTip=0;
      customTip=false;
      render({preserve:true});
      modal('Tip Confirmed','<p>Thanks for supporting '+show.name+'!</p>');
      return;
    case 'place': topLevel('browse','forward'); return;
    case 'location':
      move('location',{before:()=>{area=areas.find(item=>item.id===value);}});
      break;
    case 'setup': createDraft(areas.find(item=>item.id===value)); return;
    case 'edit': {
      const set=scheduled.find(item=>item.id===value);
      createDraft(areas.find(item=>item.id===set.area),set);
      return;
    }
    case 'mode': draft.mode=value; break;
    case 'duration': draft.minutes=Number(value); break;
    case 'custom-duration': numericDialog('Custom Duration','Minutes','minutes',5,240,1,'apply-duration'); return;
    case 'apply-duration': {
      const minutes=document.querySelector('#minutes');
      if (!minutes.reportValidity()) return;
      draft.minutes=minutes.valueAsNumber;
      closeModal();
      break;
    }
    case 'confirm-set': submitSet(); return;
    case 'cancel-set':
      modal('Cancel Scheduled Performance?',
        '<p>This will remove the performance from your upcoming sets.</p>',
        button('Keep Performance','close','lime wide')+button('Cancel Performance','cancel-confirm','wide confirm-end'),
        'confirmation-dialog');
      return;
    case 'cancel-confirm':
      scheduled=scheduled.filter(set=>set.id!==draft.id);
      save('scheduled',scheduled);
      closeModal();
      topLevel('home');
      return;
    case 'offline':
      simulatedOffline=!offline();
      save('offline',simulatedOffline);
      setOnlineState();
      screen.querySelector('[data-action="offline"]')?.focus({preventScroll:true});
      return;
    case 'adjust': {
      const previous = active.ends;
      active.ends=Math.max(Date.now()+60000,previous+Number(value)*60000);
      if (offline()) {
        active.pending=(active.pending||0)+1;
        active.localAdjustment=(active.ends-previous)/60000;
        active.lastSyncedTips ??= liveTips();
      }
      save('active',active);
      syncPerformance();
      break;
    }
    case 'end-set':
      if (offline()) {
        modal('End Set While Offline?',
          '<p>Your timer will stop on this device, but your performance may <em>still appear on the audience map</em> until the end update is synced.</p>',
          button('Keep Performing','close','lime wide')+button('End Set','end-confirm','wide offline-end-neutral'),
          'confirmation-dialog offline-end-dialog');
        return;
      }
      confirmingEnd=true;
      render({preserve:true});
      screen.querySelector('[data-action="keep-performing"]').focus();
      return;
    case 'keep-performing':
      confirmingEnd=false;
      render({preserve:true});
      screen.querySelector('[data-action="end-set"]').focus();
      return;
    case 'end-confirm':
      if (dialog.open) closeModal();
      endPerformance();
      return;
  }
  render({preserve:true});
}

dialog.addEventListener('keydown',event=>{
  if (event.key==='Escape') {
    event.preventDefault();
    closeModal();
  }
  if (event.key!=='Tab') return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
  const first=controls[0], last=controls.at(-1);
  if (event.shiftKey && document.activeElement===first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement===last) {
    event.preventDefault();
    first?.focus();
  }
});

enableDragScroll(screen);

document.addEventListener('keydown',event=>{
  if (event.key==='Escape' && roleExpanded && !dialog.open) setRoleExpanded(false,true);
});
document.addEventListener('click',event=>{
  if (roleExpanded && !event.target.closest('#role-selector, [data-action="role"]')) setRoleExpanded(false);
  const control=event.target.closest('[data-action]');
  if (control && !control.disabled) action(control.dataset.action);
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  if (event.target.dataset.submit) action(event.target.dataset.submit);
});
screen.addEventListener('input',event=>{
  if (event.target.id!=='browse-search') return;
  search=event.target.value;
  selected=undefined;
  const items=matching();
  if (role==='performer') {
    const list=screen.querySelector('.browse-list .cards');
    if (list) list.innerHTML=locationCards(items);
    else {
      const browse=screen.querySelector('.performer-browse');
      delete browse.dataset.selected;
      browse.querySelector('.map-result').innerHTML=items.length?'':'<p>No locations found.</p>';
      drawMap();
    }
    return;
  }
  if (view==='list') {
    const cards=screen.querySelector('.sheet-cards');
    cards.innerHTML=audienceCards(items);
    cards.scrollTop=0;
  } else {
    restoreOverview();
    drawMap();
  }
  updatePreviews();
});
window.addEventListener('resize',()=>{
  if (roleExpanded) alignRolePointer();
  if (page==='browse' && role==='audience' && view==='map' && selected) mapSelection(selected,false);
});
window.addEventListener('online',setOnlineState);
window.addEventListener('offline',setOnlineState);
setInterval(updateTimer,1000);
updateTimer();
syncPerformance();
render();


