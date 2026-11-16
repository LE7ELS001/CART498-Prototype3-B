'use strict';
window.CornerSet = (() => {
 const preferenceKey='corner-set-version-b-app-preferences';
 let preferences={};try{preferences=JSON.parse(localStorage.getItem(preferenceKey))||{};}catch{}
 const base=new Date();
 // Fictional previews only; upcoming remains future on subsequent visits.
 const performances=[
  {id:'westmount',location:'Westmount Park',date:new Date(base.getFullYear(),base.getMonth(),base.getDate()+7,17,30),status:'Scheduled',image:'park.png'},
  {id:'victoria',location:'Victoria Square',date:new Date(2025,10,21),status:'Completed',image:'square.png'}
 ];
 const navigation={performer:[{page:'home',label:'Home',icon:'home.svg',folder:'performer-home'},{page:'browse',label:'Browse',icon:'browse.svg',folder:'performer-home'},{page:'profile',label:'Profile',icon:'profile.svg',folder:'performer-home'}],audience:[{page:'discover',label:'Discover',icon:'discover.svg'},{page:'browse',label:'Browse',icon:'browse.svg'},{page:'favorite',label:'Favorite',icon:'favorite.svg'},{page:'profile',label:'Profile',icon:'profile.svg'}]};
 const state={role:preferences.role==='audience'?'audience':'performer',theme:preferences.theme==='night'?'night':'day',page:'home',selectedPerformance:null,category:null};
 const root=role=>role==='audience'?'discover':'home';
 function save(){try{localStorage.setItem(preferenceKey,JSON.stringify({role:state.role,theme:state.theme}));}catch{}}
 function readRoute(hash){
  const parts=hash.replace(/^#\/?/,'').split('/');
  const fallback=role=>({role,page:root(role),selectedPerformance:null,category:null});
  if(!['performer','audience'].includes(parts[0]))return fallback(state.role);
  const role=parts[0],page=parts[1];
  const allowed=role==='performer'?['home','browse','profile','setup','upcoming','past','details']:['discover','browse','favorite','profile'];
  if(!allowed.includes(page))return fallback(role);
  const selectedPerformance=page==='details'?performances.find(s=>s.id===parts[2])?.id:null;
  if(page==='details'&&!selectedPerformance)return fallback(role);
  const category=role==='audience'&&page==='browse'&&['guitar','saxophone','accordion','keyboard'].includes(parts[2])?parts[2]:null;
  return {role,page,selectedPerformance,category};
 }
 return {state,performances,navigation,root,save,readRoute};
})();
