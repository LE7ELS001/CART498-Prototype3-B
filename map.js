const points = {
  audience:{hubble:[.56,.49],newton:[.35,.65],kepler:[.64,.65],'your-set':[.74,.40]},
  performer:{westmount:[.62,.43],victoria:[.86,.26]}
};
let current;
const mapListeners = new WeakMap();

export function mountMap(container,items,role,selected,onSelect,onBackgroundClick) {
  const layer = document.createElement('div');
  layer.className = 'map-layer '+role;
  container.replaceChildren(layer);
  mapListeners.get(container)?.abort();
  const controller = new AbortController();
  mapListeners.set(container,controller);
  const {signal} = controller;
  const view = {container,layer,markers:new Map(),x:0,y:0,scale:1,role};
  current = view;
  for (const item of items) {
    const marker = document.createElement('button');
    const [x,y] = points[role][item.id];
    marker.type = 'button';
    marker.className = 'marker'+(selected===item.id?' selected':'');
    marker.style.left = x*100+'%';
    marker.style.top = y*100+'%';
    marker.setAttribute('aria-label',item.name);
    marker.setAttribute('aria-pressed',String(selected===item.id));
    let art;
    if (role==='audience') {
      art = 'assets/'+item.avatar+'.png';
      marker.dataset.crowd = item.audience>=20?'large':item.audience>=10?'medium':'small';
      for (let ring=0; ring<3; ring++) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.setProperty('--ring',ring);
        marker.append(ripple);
      }
      const badge = document.createElement('span');
      badge.className = 'audience-badge';
      badge.textContent = item.audience;
      badge.setAttribute('aria-hidden','true');
      marker.setAttribute('aria-label',item.name+', audience '+item.audience);
      marker.append(badge);
    } else {
      art = 'assets/'+(item.id==='westmount'?'park-cover':'square-marker')+'.jpg';
    }
    const image=document.createElement('img');
    image.src=art || 'assets/active-location.svg';
    image.alt='';
    if (!art) marker.classList.add('marker-pin');
    marker.append(image);
    marker.addEventListener('click',()=>onSelect(item.id));
    layer.append(marker);
    view.markers.set(item.id,{marker,x,y});
  }
  if (role==='audience') apply(view);
  container.tabIndex=0;
  container.setAttribute('aria-label','Performance map. Use plus or minus to zoom.');
  if (onBackgroundClick) {
    let start;
    container.addEventListener('pointerdown',event=>{
      start={x:event.clientX,y:event.clientY};
    },{signal});
    container.addEventListener('click',event=>{
      if (!event.target.closest('.marker') && start &&
          Math.hypot(event.clientX-start.x,event.clientY-start.y)<7) onBackgroundClick();
      start=undefined;
    },{signal});
  }
  container.addEventListener('wheel',event=>{
    event.preventDefault();
    zoom(view,event.deltaY<0?.12:-.12);
  },{passive:false,signal});
  container.addEventListener('keydown',event=>{
    if (event.target!==container) return;
    if (event.key==='+'||event.key==='='||event.key==='-') {
      event.preventDefault();
      zoom(view,event.key==='-'?-.2:.2);
    }
  },{signal});
}

function zoom(view,delta) {
  view.scale=Math.min(2.5,Math.max(1,view.scale+delta));
  if (view.selected) positionMarker(view,view.selected,view.cardHeight,false);
  else apply(view);
}

function apply(view,smooth=false) {
  view.layer.classList.toggle('moving',smooth);
  view.layer.style.setProperty('--marker-scale',1/view.scale);
  view.layer.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.scale+')';
  if (view.role==='audience') fitAudienceMarkers(view);
}

function fitAudienceMarkers(view) {
  const height = view.container.clientHeight;
  const width = view.container.clientWidth;
  const cardLimit = view.cardTop ?? height-56;
  const placements = [...view.markers.entries()].map(([id,entry])=>{
    const radius = id===view.selected?32:27;
    const x = width/2+view.x+(entry.x-.5)*width*view.scale;
    const y = height/2+view.y+(entry.y-.5)*height*view.scale;
    return {marker:entry.marker,radius,x,y,centerY:Math.min(y,cardLimit-5-radius-32)};
  }).sort((a,b)=>b.y-a.y);

  const controls = view.container.parentElement.querySelector('.browse-controls');
  const headerBottom = controls.getBoundingClientRect().bottom-view.container.getBoundingClientRect().top;
  // Short screens can fit one row between the filters and card. Keep it inside the map.
  const fitsRow = placements.reduce((sum,item)=>sum+2*item.radius+4,4)<=width;
  if (view.selected && cardLimit-headerBottom<175 && fitsRow) {
    let left = 4;
    const row = [...placements].sort((a,b)=>a.x-b.x);
    for (const item of row) {
      item.centerX=Math.max(item.x,left+item.radius);
      left=item.centerX+item.radius+4;
      item.centerY=Math.min(cardLimit-5-item.radius-32,Math.max(item.centerY,headerBottom+item.radius+4));
    }
    let right = width-4;
    for (const item of row.reverse()) {
      item.centerX=Math.min(item.centerX,right-item.radius);
      right=item.centerX-item.radius-4;
    }
  } else {
    for (const [index,item] of placements.entries()) {
      for (const lower of placements.slice(0,index)) {
        if (Math.abs(item.x-lower.x)<item.radius+lower.radius+4) {
          item.centerY=Math.min(item.centerY,lower.centerY-lower.radius-item.radius-36);
        }
      }
    }
  }
  for (const item of placements) {
    const shiftX = (item.centerX??item.x)-item.x;
    const shiftY = item.centerY-item.y;
    item.marker.style.setProperty('--marker-shift',shiftX+'px, '+shiftY+'px');
  }
}

export function resetMap() {
  if (!current) return;
  const view=current;
  if (view.selected) {
    const {marker}=view.markers.get(view.selected);
    marker.classList.remove('selected');
    marker.setAttribute('aria-pressed','false');
  }
  view.selected=undefined;
  view.cardTop=null;
  view.x=view.y=0;
  view.scale=1;
  apply(view,true);
}

export function centerMarker(id,cardHeight,smooth=true,cardTop=null) {
  const view=current;
  const entry=view?.markers.get(id);
  if (!entry) return;
  for (const [key,{marker}] of view.markers) {
    marker.classList.toggle('selected',key===id);
    marker.setAttribute('aria-pressed',String(key===id));
  }
  view.selected=id;
  view.cardHeight=cardHeight;
  view.cardTop=cardTop;
  positionMarker(view,id,cardHeight,smooth);
}

function positionMarker(view,id,cardHeight,smooth) {
  const {x,y}=view.markers.get(id);
  const {clientWidth:width,clientHeight:height}=view.container;
  if (!width || !height) return;
  const targetY=Math.max(90,Math.min(height-cardHeight-40,(height-cardHeight+118)/2));
  const fraction=targetY/height;
  view.scale=Math.max(view.scale,fraction/y,(1-fraction)/(1-y));
  view.x=(.5-x)*width*view.scale;
  view.y=targetY-height/2-(y-.5)*height*view.scale;
  apply(view,smooth);
}
