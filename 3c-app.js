/* =====================================================================
   Player state
   ===================================================================== */
const P={cur:null,queue:[],orig:null,qi:-1,playing:false,pos:0,loaded:false,scrub:false};
const V={route:'home',arg:null,list:[],sort:'added',folder:'all',q:'',prev:'home'};

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2600)}

function doShuffle(curId){P.orig=P.queue.slice();const rest=P.queue.filter(x=>x!==curId);for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}P.queue=[curId,...rest]}
function setShuffle(on){
  st.play.shuffle=on;
  if(P.cur){if(on)doShuffle(P.cur.id);else if(P.orig&&P.orig.includes(P.cur.id)){P.queue=P.orig;P.orig=null}}
  P.qi=P.queue.indexOf(P.cur?.id);syncModes();renderQueue();persist();
}
function load(id,{pos=0,play=false}={}){
  const tr=T(id);if(!tr)return;
  if(!P.queue.includes(id))P.queue=[id];
  P.qi=P.queue.indexOf(id);P.cur=tr;P.pos=pos;P.loaded=false;P.scrub=false;st.last={id,pos};
  if(play)st.recent=[id,...st.recent.filter(x=>x!==id)].slice(0,24);
  Theme.apply(tr);ensurePal(tr.ak).then(()=>{if(P.cur===tr&&!st.theme.locked)Theme.live()});syncTrack();if(play)startPlayback();persist();
}
async function startPlayback(){Engine.start(P.cur,P.pos);P.loaded=true;P.playing=true;syncPlay();try{await Engine.resume()}catch(e){if(e&&e.name==='NotSupportedError')return;P.playing=false;syncPlay()}}
async function toggle(){
  if(!P.cur)return;
  if(P.playing){Engine.pause();P.playing=false;st.last.pos=P.pos;persist();syncPlay();return}
  if(!P.loaded)await startPlayback();else{P.playing=true;syncPlay();try{await Engine.resume()}catch(e){}}
}
function playFrom(id,list){P.queue=list.slice();P.orig=null;if(st.play.shuffle)doShuffle(id);load(id,{play:true})}
function next(auto){
  let i=P.qi+1;
  if(i>=P.queue.length){if(st.play.repeat==='all'||!auto)i=0;else{Engine.pause();P.playing=false;P.pos=0;P.loaded=false;syncPlay();return}}
  load(P.queue[i],{play:true});
}
function prev(){if(P.pos>3){seekTo(0);return}let i=P.qi-1;if(i<0)i=st.play.repeat==='all'?P.queue.length-1:0;load(P.queue[i],{play:P.playing||true})}
function seekTo(s){P.pos=clamp(s,0,Math.max(0,P.cur.dur-.3));P.scrub=false;if(P.loaded)Engine.seek(P.pos);st.last.pos=P.pos;persist()}
let errRun=0;
function ended(){errRun=0;if(st.play.repeat==='one'){P.pos=0;Engine.seek(0);Engine.resume();return}if(!st.play.autoplay){Engine.pause();P.playing=false;P.pos=0;Engine.seek(0);syncPlay();return}next(true)}
Engine.onended=()=>{if(P.playing)ended()};
Engine.onmeta=d=>{if(P.cur&&isFinite(d)&&d>0&&Math.abs(d-P.cur.dur)>1.5){P.cur.dur=Math.round(d);$('#m-dur').textContent=fmtT(P.cur.dur);$('#n-dur').textContent=fmtT(P.cur.dur)}};
Engine.onerror=()=>{if(!P.cur)return;const t=P.cur;toast(t.ext==='wma'?`“${t.t}” is a WMA file, which this version can’t play yet.`:`Can’t play “${t.t}”. Skipping.`);if(++errRun<Math.min(P.queue.length,6)&&P.playing)setTimeout(()=>next(true),700);else{P.playing=false;P.loaded=false;syncPlay()}};
function setVolume(v){st.vol=clamp(v,0,1);st.muted=st.vol===0?true:false;Engine.setVol();drawAll('vol');syncVol();updOut();persist()}
function toggleMute(){st.muted=!st.muted;if(!st.muted&&st.vol===0)st.vol=.4;Engine.setVol();drawAll('vol');syncVol();updOut();persist()}
function toggleFav(id){const i=st.favs.indexOf(id);i>=0?st.favs.splice(i,1):st.favs.push(id);persist();syncFavs();if(V.route==='favorites')render()}
const isFav=id=>st.favs.includes(id);

/* ---------- sliders ---------- */
const SL={
  seek:{get:()=>P.cur?clamp(P.pos/P.cur.dur,0,1):0,input:v=>{P.scrub=true;P.pos=v*P.cur.dur},change:v=>seekTo(v*P.cur.dur)},
  vol:{get:()=>st.muted?0:st.vol,input:v=>setVolume(v)},
  band:{get:el=>st.eq.bands[+el.dataset.i],input:(v,el)=>{st.eq.bands[+el.dataset.i]=v;st.eq.preset='Custom';eqChanged()}},
  bass:{get:()=>st.eq.bass,input:v=>{st.eq.bass=v;eqChanged()}},
  treble:{get:()=>st.eq.treble,input:v=>{st.eq.treble=v;eqChanged()}},
  preamp:{get:()=>st.eq.preamp,input:v=>{st.eq.preamp=v;eqChanged()}},
  balance:{get:()=>st.eq.balance,input:v=>{st.eq.balance=v;eqChanged()}},
  glass:{get:()=>st.ui.glass,input:v=>{st.ui.glass=v;applyUI();persist()}},
  blur:{get:()=>st.ui.blur,input:v=>{st.ui.blur=v;applyUI();persist()}},
  tdur:{get:()=>st.theme.dur,input:v=>{st.theme.dur=v;persist();updOut()}}
};
function drawAll(id){$$('[data-slider="'+id+'"]').forEach(el=>el._draw&&el._draw())}
function bindSliders(root){
  $$('[data-slider]',root).forEach(el=>{
    if(el._b)return;el._b=1;
    const id=el.dataset.slider,cfg=SL[id],min=+el.dataset.min,max=+el.dataset.max,step=+el.dataset.step||.01,vert=el.classList.contains('v'),bip=el.dataset.bip!==undefined;
    const rat=v=>(v-min)/(max-min);
    el._draw=()=>{const v=cfg.get(el),p=clamp(rat(v),0,1);el.style.setProperty('--p',p);
      if(bip){const z=rat(0);el.style.setProperty('--s',Math.min(p,z));el.style.setProperty('--w',Math.abs(p-z))}else{el.style.setProperty('--s',0);el.style.setProperty('--w',p)}
      el.setAttribute('aria-valuemin',min);el.setAttribute('aria-valuemax',max);el.setAttribute('aria-valuenow',+(+v).toFixed(2))};
    const ev=e=>{const rc=el.getBoundingClientRect();let r=vert?1-(e.clientY-rc.top)/rc.height:(e.clientX-rc.left)/rc.width;r=clamp(r,0,1);const v=Math.round((min+r*(max-min))/step)*step;return clamp(+v.toFixed(4),min,max)};
    el.addEventListener('pointerdown',e=>{if(id==='seek'&&!P.cur)return;el.setPointerCapture(e.pointerId);el.classList.add('drag');cfg.input(ev(e),el);drawAll(id)});
    el.addEventListener('pointermove',e=>{if(!el.classList.contains('drag'))return;cfg.input(ev(e),el);drawAll(id)});
    const end=e=>{if(!el.classList.contains('drag'))return;el.classList.remove('drag');const v=ev(e);cfg.input(v,el);(cfg.change||cfg.input)(v,el);drawAll(id)};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    el.addEventListener('keydown',e=>{let d=0;if(e.key==='ArrowRight'||e.key==='ArrowUp')d=1;else if(e.key==='ArrowLeft'||e.key==='ArrowDown')d=-1;else return;
      e.preventDefault();e.stopPropagation();const v=clamp(cfg.get(el)+d*(max-min)/(id==='seek'?40:20),min,max);cfg.input(v,el);(cfg.change||cfg.input)(v,el);drawAll(id)});
    el._draw();
  });
}

/* ---------- sync ui ---------- */
const seekEls=()=>$$('[data-slider="seek"]');
function syncTrack(){
  const t=P.cur;if(!t)return;
  $('#m-art').src=art(t.ak);$('#m-title').textContent=t.t;$('#m-artist').textContent=artistOf(t);
  $('#m-dur').textContent=fmtT(t.dur);$('#n-dur').textContent=fmtT(t.dur);
  const na=$('#np-art');na.classList.add('swap');setTimeout(()=>{na.src=artXL(t.ak);na.classList.remove('swap')},na.getAttribute('src')?260:0);
  if('mediaSession' in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:t.t,artist:t.artist,album:t.album,artwork:[{src:art(t.ak),sizes:'320x320'}]})}catch(_){}}
  $('#np-title').textContent=t.t;$('#np-artist').textContent=artistOf(t);$('#np-meta').textContent=albumOf(t);$('#np-from').textContent='Playing from '+t.f;
  syncFavs();syncModes();syncVol();renderQueue();syncRows();updHero();updProg(true);
}
function syncPlay(){
  document.body.dataset.playing=P.playing?'1':'0';if('mediaSession' in navigator)navigator.mediaSession.playbackState=P.playing?'playing':'paused';
  $$('.bars').forEach(b=>b.classList.toggle('paused',!P.playing));updHero();
}
function syncFavs(){
  if(!P.cur)return;$('#m-fav').classList.toggle('on',isFav(P.cur.id));
  $$('[data-fav]').forEach(b=>b.classList.toggle('on',isFav(+b.dataset.fav)));
}
function syncModes(){
  $$('#m-shuf,#n-shuf').forEach(b=>b.classList.toggle('on',st.play.shuffle));
  $$('#m-rep,#n-rep').forEach(b=>{b.classList.toggle('on',st.play.repeat!=='off');b.innerHTML=icon(st.play.repeat==='one'?'repeat1':'repeat')});
}
function syncVol(){$('#m-mute').innerHTML=icon(st.muted||st.vol===0?'mute':'volume')}
function syncRows(){
  $$('.row[data-play]').forEach(r=>{const on=P.cur&&+r.dataset.play===P.cur.id;r.classList.toggle('on',!!on);
    const c=$('.r-i',r);if(c)c.innerHTML=(on?`<i class="bars ${P.playing?'':'paused'}"><i></i><i></i><i></i></i>`:`<span>${+r.dataset.n+1}</span>`)+`<button class="rp" tabindex="-1" aria-label="Play">${icon('play')}</button>`});
}
let lastSec=-1;
function updProg(force){
  if(!P.cur)return;
  seekEls().forEach(e=>e._draw&&e._draw());
  const s=Math.floor(P.pos);if(s!==lastSec||force){lastSec=s;$('#m-pos').textContent=fmtT(P.pos);$('#n-pos').textContent=fmtT(P.pos);updHero();
    if(P.playing&&s%2===0){st.last.pos=P.pos;persist()}}
}
function updHero(){const e=$('#hero-st');if(e&&P.cur)e.textContent=P.playing?'Playing now':`Paused at ${fmtT(P.pos)} of ${fmtT(P.cur.dur)}`}
function renderQueue(){
  const up=P.queue.slice(P.qi+1);$('#np-qc').textContent=up.length?up.length+(up.length>1?' songs':' song'):'';
  $('#np-q').innerHTML=up.slice(0,40).map((id,k)=>{const t=T(id);return`<div class="qi" draggable="true" data-q="${P.qi+1+k}" data-id="${id}"><span class="g"><svg viewBox="0 0 10 16" width="10" height="16"><g fill="currentColor"><circle cx="2.5" cy="3" r="1.3"/><circle cx="7.5" cy="3" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="13" r="1.3"/><circle cx="7.5" cy="13" r="1.3"/></g></svg></span><img class="cov" src="${art(t.ak)}" alt=""><div><b>${esc(t.t)}</b><span>${esc(artistOf(t))}</span></div><time>${fmtT(t.dur)}</time></div>`}).join('')||'<div class="empty" style="padding:22px 10px">The queue is empty. Turn on repeat all to keep playing.</div>';
}

/* ---------- overlays ---------- */
let menuEl=null;
function closeMenu(){if(menuEl){menuEl.remove();menuEl=null}}
function showMenu(x,y,items){
  closeMenu();const m=document.createElement('div');m.className='menu';m.setAttribute('role','menu');
  m.innerHTML=items.map((it,i)=>it.sep?'<hr>':it.cap?`<div class="cap">${esc(it.cap)}</div>`:`<button role="menuitem" data-mi="${i}">${it.i?icon(it.i):''}<span>${esc(it.l)}</span></button>`).join('');
  document.body.appendChild(m);const w=m.offsetWidth,h=m.offsetHeight;m.style.left=clamp(x,8,innerWidth-w-8)+'px';m.style.top=clamp(y,8,innerHeight-h-8)+'px';
  m.addEventListener('click',e=>{const b=e.target.closest('[data-mi]');if(!b)return;e.stopPropagation();const it=items[+b.dataset.mi];closeMenu();it.fn&&it.fn()});
  menuEl=m;
}
function askModal({title,text,value,ok='Save',danger}){
  return new Promise(res=>{
    const w=document.createElement('div');w.className='modal';
    w.innerHTML=`<div class="box glass" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${text?`<p style="color:var(--tx2)">${esc(text)}</p>`:''}${value!==undefined?`<input class="ci" value="${esc(value)}" maxlength="40" aria-label="${esc(title)}">`:''}<div class="acts"><button class="btn gh sm" data-c>Cancel</button><button class="btn ${danger?'gh danger':'pri'} sm" data-o>${esc(ok)}</button></div></div>`;
    $('#win').appendChild(w);const inp=$('input',w);(inp||$('[data-o]',w)).focus();inp&&inp.select();
    const done=v=>{w.remove();res(v)};
    w.addEventListener('click',e=>{if(e.target===w||e.target.closest('[data-c]'))done(null);else if(e.target.closest('[data-o]'))done(inp?inp.value.trim()||null:true)});
    w.addEventListener('keydown',e=>{if(e.key==='Enter')done(inp?inp.value.trim()||null:true);if(e.key==='Escape'){e.stopPropagation();done(null)}});
  });
}

/* =====================================================================
   Views
   ===================================================================== */
const totalDur=ids=>ids.reduce((s,id)=>s+T(id).dur,0);
const durText=s=>{const m=Math.round(s/60);return m>=60?`${Math.floor(m/60)} hr ${m%60} min`:`${m} min`};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const SORTS={added:['Date added',(a,b)=>b.d.localeCompare(a.d)||a.id-b.id],name:['Name',(a,b)=>a.t.localeCompare(b.t)],artist:['Artist',(a,b)=>artistOf(a).localeCompare(artistOf(b))||a.t.localeCompare(b.t)],album:['Album',(a,b)=>albumOf(a).localeCompare(albumOf(b))||a.id-b.id],dur:['Duration',(a,b)=>a.dur-b.dur]};

function rowHtml(t,n){
  return`<div class="row" data-play="${t.id}" data-n="${n}" role="button" tabindex="0"><div class="r-i"></div>
  <div class="r-t"><img class="cov" src="${art(t.ak)}" alt="" loading="lazy"><div style="min-width:0"><div class="r-name">${esc(t.t)}</div><div class="r-sub">${esc(artistOf(t))}</div></div></div>
  <div class="r-al">${esc(albumOf(t))}</div><div class="r-f">${esc(t.f)}</div><div class="r-d">${fmtT(t.dur)}</div>
  <button class="ib fav ${isFav(t.id)?'on':''}" data-fav="${t.id}" aria-label="Favorite">${icon('heart')}</button><button class="ib mo" data-more="${t.id}" aria-label="More">${icon('more')}</button></div>`;
}
function listView(o){
  let ids=o.ids.filter(id=>T(id));
  if(o.chips&&V.folder!=='all')ids=ids.filter(id=>T(id).f===V.folder);
  if(o.sortable)ids=ids.map(T).sort(SORTS[V.sort][1]).map(t=>t.id);
  V.list=ids.slice();
  const chips=o.chips?`<button class="chip ${V.folder==='all'?'on':''}" data-folder="all">All folders</button>`+visibleFolders().map(f=>`<button class="chip ${V.folder===f?'on':''}" data-folder="${esc(f)}">${esc(f)}</button>`).join(''):'';
  const sort=o.sortable?`<select class="sel" data-sort aria-label="Sort by">${Object.entries(SORTS).map(([k,v])=>`<option value="${k}" ${V.sort===k?'selected':''}>Sort by ${v[0].toLowerCase()}</option>`).join('')}</select>`:'';
  return`<div class="lh">${o.cover?`<img class="cov-l" src="${artXL(o.cover)}" alt="">`:''}<div class="grow"><h1>${esc(o.title)}</h1><p>${o.sub?esc(o.sub)+' — ':''}${plural(ids.length,'song')}${ids.length?', '+durText(totalDur(ids)):''}</p></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">${ids.length?`<button class="btn pri" data-act="play-list">${icon('play')}Play</button><button class="btn gh" data-act="shuffle-list">${icon('shuffle')}Shuffle</button>`:''}${o.actions||''}</div></div>
  ${(chips||sort)?`<div class="tools">${sort}${chips}</div>`:''}
  <div class="rows">${ids.length?ids.map((id,i)=>rowHtml(T(id),i)).join(''):`<div class="empty"><b>${esc(o.emptyT||'Nothing here yet')}</b>${esc(o.emptyS||'')}</div>`}</div>`;
}
function tile(t,src,cls=''){return`<button class="tile ${cls}" data-play="${t.id}" data-src="${src}" style="--g:${glowOf(t.ak)}"><div class="cv"><img src="${art(t.ak)}" alt="" loading="lazy"><span class="pl">${icon('play')}</span></div><b>${esc(t.t)}</b><span>${esc(artistOf(t))}</span><span style="color:var(--tx3);font-size:12px">${fmtT(t.dur)}</span></button>`}
function foldCard(f){
  const ts=TRACKS.filter(t=>t.f===f),imgs=[0,1,2].map(i=>ts[i%Math.max(ts.length,1)]).filter(Boolean);
  return`<div class="fold glass" data-go="folder:${esc(f)}" role="button" tabindex="0" style="--g:${imgs[0]?glowOf(imgs[0].ak):'#000'}"><button class="fm" data-fmenu="${esc(f)}" aria-label="Folder options">${icon('more')}</button><div class="fan">${imgs.map(t=>`<img src="${art(t.ak)}" alt="">`).join('')}</div><b>${esc(f)}</b><span>${plural(ts.length,'song')}</span></div>`;
}
const addFolderCard=`<button class="fold" data-act="add-folder" style="border:1.5px dashed rgba(255,255,255,.16);display:grid;place-items:center;min-height:190px;color:var(--tx2)"><span style="display:grid;place-items:center;gap:10px">${icon('addfolder')}Add folder</span></button>`;

function vHome(){
  const h=new Date().getHours(),g=h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening',t=P.cur;
  const rec=[...new Set(st.recent)].map(T).filter(Boolean);V.list=rec.map(x=>x.id);
  return`<header class="greet"><h1>${g}</h1><p>What do you want to listen to?</p></header>
  <section class="hero glass" aria-label="Continue listening"><img class="cov-xl" src="${artXL(t.ak)}" alt=""><div><h2>${esc(t.t)}</h2><div class="by">${esc(artistOf(t))}</div><div class="st" id="hero-st"></div>
  <div class="btns"><button class="btn pri pp" data-act="toggle">${icon('play','i-play')}${icon('pause','i-pause')}<span class="l-play">Resume</span><span class="l-pause">Pause</span></button><button class="btn gh" data-act="np-open">Open player</button></div></div></section>
  ${rec.length?`<div class="sec"><h2>Recently played</h2><button data-nav="recent">See all</button></div>
  <div class="strip">${rec.slice(0,10).map(x=>tile(x,'recent')).join('')}</div>`:''}
  <div class="sec"><h2>Your folders</h2><button data-nav="folders">Manage</button></div>
  <div class="folders">${visibleFolders().map(foldCard).join('')}${addFolderCard}</div>`;
}
const vSongs=()=>listView({title:'Songs',ids:visibleTracks().map(t=>t.id),sortable:true,chips:true});
const vFavs=()=>listView({title:'Favorites',ids:st.favs,sortable:true,emptyT:'No favorites yet',emptyS:'Tap the heart on any song to keep it here.'});
const vRecent=()=>listView({title:'Recently played',ids:[...new Set(st.recent)],emptyT:'Nothing played yet',emptyS:'Songs you play show up here.'});
function vAlbums(){
  V.list=[];return`<div class="lh"><div class="grow"><h1>Albums</h1><p>${plural(Object.keys(ALBUMS).length,'album')}</p></div></div><div class="grid" style="margin-top:22px">${Object.entries(ALBUMS).map(([k,a])=>`<button class="tile" data-go="album:${k}" style="--g:${glowOf(k)}"><div class="cv"><img src="${art(k)}" alt=""></div><b>${esc(a.name)}</b><span>${esc(a.artist)}</span></button>`).join('')}</div>`;
}
function vArtists(){
  const seen=new Map();Object.entries(ALBUMS).forEach(([k,a])=>{if(!seen.has(a.artist))seen.set(a.artist,k)});
  return`<div class="lh"><div class="grow"><h1>Artists</h1><p>${plural(seen.size,'artist')}</p></div></div><div class="grid" style="margin-top:22px">${[...seen].map(([n,k])=>`<button class="tile round" data-go="artist:${esc(n)}" style="--g:${glowOf(k)}"><div class="cv"><img src="${art(k)}" alt=""></div><b style="text-align:center">${esc(n)}</b><span style="text-align:center">${plural(TRACKS.filter(t=>t.aartist===n).length,'song')}</span></button>`).join('')}</div>`;
}
function vFolders(){return`<div class="lh"><div class="grow"><h1>Folders</h1><p>Each folder is its own library. Removing one never deletes files from your drive.</p></div></div><div class="folders" style="margin-top:22px">${visibleFolders().map(foldCard).join('')}${addFolderCard}</div>`}
function vPlaylists(){
  return`<div class="lh"><div class="grow"><h1>Playlists</h1><p>${plural(st.playlists.length,'playlist')}</p></div></div><div class="pls" style="margin-top:22px">${st.playlists.map(p=>{const ids=p.tracks.filter(id=>T(id)).slice(0,4);return`<button class="pl-card glass" data-go="playlist:${p.id}"><div class="mosaic">${[0,1,2,3].map(i=>ids[i]?`<img src="${art(T(ids[i]).ak)}" alt="">`:'<div></div>').join('')}</div><div><b>${esc(p.name)}</b><span>${plural(p.tracks.length,'song')}</span></div></button>`}).join('')}<button class="pl-new" data-act="new-playlist">${icon('plus')}<span style="margin-top:6px;display:block">New playlist</span></button></div>`;
}
function vDetail(){
  const{k,v}=V.arg;
  if(k==='album'){const a=ALBUMS[v];return listView({title:a.name,sub:a.artist,cover:v,ids:TRACKS.filter(t=>t.al===v).map(t=>t.id)})}
  if(k==='artist'){const key=Object.keys(ALBUMS).find(x=>ALBUMS[x].artist===v);return listView({title:v,cover:key,ids:TRACKS.filter(t=>t.aartist===v).map(t=>t.id),sortable:true})}
  if(k==='folder')return listView({title:v,sub:'Folder',ids:TRACKS.filter(t=>t.f===v).map(t=>t.id),sortable:true,emptyT:'This folder has no songs',emptyS:'Add music files to it and rescan.'});
  if(k==='playlist'){const p=st.playlists.find(x=>x.id===v);if(!p)return vPlaylists();return listView({title:p.name,sub:'Playlist',cover:p.tracks[0]&&T(p.tracks[0]).ak,ids:p.tracks,actions:`<button class="btn gh" data-act="rename-pl" data-id="${p.id}">${icon('edit')}Rename</button><button class="btn gh danger" data-act="del-pl" data-id="${p.id}">${icon('trash')}Delete</button>`,emptyT:'This playlist is empty',emptyS:'Use the ⋯ menu on any song to add it.'})}
  if(k==='search'){const q=V.q.toLowerCase(),ids=visibleTracks().filter(t=>[t.t,artistOf(t),albumOf(t),t.f].some(s=>s.toLowerCase().includes(q))).map(t=>t.id);return listView({title:`Results for “${V.q}”`,ids,emptyT:'No matches',emptyS:'Try a title, artist, album or folder name.'})}
}
const eqCols=()=>EQ_FREQS.map((f,i)=>`<div class="eq-col"><div class="sl v show" data-slider="band" data-i="${i}" data-min="-12" data-max="12" data-step="0.5" data-bip role="slider" tabindex="0" aria-label="${EQ_LABELS[i]} hertz"><div class="tr"></div><div class="fl"></div><div class="th"></div></div></div>`).join('');
const ctl=(id,label,min,max,step,bip)=>`<div class="ctl"><label>${label}</label><div class="sl big" data-slider="${id}" data-min="${min}" data-max="${max}" data-step="${step}" ${bip?'data-bip':''} role="slider" tabindex="0" aria-label="${label}"><div class="tr"></div><div class="fl"></div><div class="th"></div></div><output data-out="${id}"></output></div>`;
const tgRow=(path,label,sub,val)=>`<div class="tgrow"><div>${label}${sub?`<small>${sub}</small>`:''}</div><button class="tg" role="switch" aria-checked="${!!val}" aria-label="${esc(label)}" data-tg="${path}"></button></div>`;
function vStudio(){
  return`<div class="lh"><div class="grow"><h1>Audio Studio</h1><p>Every change is applied to the sound you hear right now.</p></div></div>
  <div class="studio"><section class="pnl glass"><h3>Equalizer</h3><div class="hint">Nine bands, plus or minus 12 dB</div>
    <div class="eq-stage"><div class="eq-h"><canvas class="eq-an"></canvas><svg viewBox="0 0 900 210" preserveAspectRatio="none"><defs><linearGradient id="eqf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c-glow);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--c-glow);stop-opacity:0"/></linearGradient></defs><line x1="0" x2="900" y1="105" y2="105" stroke="rgba(255,255,255,.14)" stroke-dasharray="3 6" vector-effect="non-scaling-stroke"/><path id="eq-fill" fill="url(#eqf)"/><path id="eq-line" fill="none" style="stroke:var(--c-accent)" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg><div class="eq-cols">${eqCols()}</div></div>
    <div class="eq-lab">${EQ_LABELS.map((l,i)=>`<div><b data-bv="${i}"></b><span>${l} Hz</span></div>`).join('')}</div></div>
    <div class="presets" id="presets"></div></section>
  <section class="pnl glass"><h3>Tone and space</h3><div class="hint">Shape the whole mix</div><div style="margin-top:10px">
    ${ctl('vol','Volume',0,1,.01)}${ctl('preamp','Preamp',-12,12,.5,true)}${ctl('bass','Bass boost',0,100,1)}${ctl('treble','Treble',0,100,1)}${ctl('balance','Balance',-1,1,.05,true)}
    ${tgRow('eq.loudness','Loudness','Lifts lows and highs at low volume',st.eq.loudness)}</div></section></div>`;
}
function vSettings(){
  const th=st.theme,u=st.ui,p=st.play;
  return`<div class="lh"><div class="grow"><h1>Settings</h1><p>Appearance, playback and library</p></div></div>
  <div class="set"><div class="col">
  <section class="pnl glass"><h3>Dynamic theme</h3><div class="hint">How the app takes its colors from the song that is playing</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:16px"><div class="seg" role="group" aria-label="Theme mode">${[['auto','Automatic'],['manual','Manual'],['hybrid','Hybrid']].map(([v,l])=>`<button data-seg="theme.mode" data-v="${v}" class="${th.mode===v?'on':''}">${l}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Color format">${['hex','rgb','hsl'].map(v=>`<button data-seg="theme.fmt" data-v="${v}" class="${th.fmt===v?'on':''}">${v.toUpperCase()}</button>`).join('')}</div></div>
    <p class="hint" id="mode-note" style="margin-top:12px"></p>
    <div id="palrows" style="margin-top:8px"></div>
    <div class="ctl" style="grid-template-columns:150px 1fr 70px;margin-top:6px"><label>Change speed</label><div class="sl big" data-slider="tdur" data-min="500" data-max="1500" data-step="50" role="slider" tabindex="0" aria-label="Change speed"><div class="tr"></div><div class="fl"></div><div class="th"></div></div><output data-out="tdur"></output></div>
    ${tgRow('theme.locked','Lock theme','Keep these colors when the song changes',th.locked)}
    <div id="song-theme"></div></section>
  <section class="pnl glass"><h3>Saved themes</h3><div class="hint">Your own palettes, ready to apply</div><div class="lst" id="customs" style="margin-top:10px"></div><div style="margin-top:14px"><button class="btn gh sm" data-act="save-theme">${icon('plus')}Save current colors</button></div></section>
  <section class="pnl glass"><h3>Look and feel</h3><div style="margin-top:8px">
    ${ctl('glass','Glass opacity',.25,.9,.01)}${ctl('blur','Blur strength',4,60,1)}
    <div class="tgrow"><div>Animation<small>Off removes all motion</small></div><div class="seg">${[[0,'Off'],[1,'Subtle'],[2,'Full']].map(([v,l])=>`<button data-seg="ui.anim" data-v="${v}" class="${u.anim===v?'on':''}">${l}</button>`).join('')}</div></div>
    ${tgRow('ui.viz','Visualizer','Ring and spectrum in the full player',u.viz)}${tgRow('ui.dynbg','Dynamic artwork background','Large blurred cover behind everything',u.dynbg)}
    ${tgRow('ui.reduceGlow','Reduce glow','Softer ambient light and edges',u.reduceGlow)}${tgRow('ui.reduceTrans','Reduce transparency','Solid panels, less blur',u.reduceTrans)}${tgRow('ui.contrast','Increase contrast','Brighter text and clearer borders',u.contrast)}</div></section>
  <section class="pnl glass"><h3>Playback</h3><div style="margin-top:8px">${tgRow('play.autoplay','Autoplay','Continue with the queue when a song ends',p.autoplay)}${tgRow('play.shuffle','Shuffle','',p.shuffle)}
    <div class="tgrow"><div>Repeat</div><div class="seg">${[['off','Off'],['all','All'],['one','One']].map(([v,l])=>`<button data-seg="play.repeat" data-v="${v}" class="${p.repeat===v?'on':''}">${l}</button>`).join('')}</div></div>
    </div></section>
  <section class="pnl glass"><h3>Library</h3><div class="lst" style="margin-top:10px">${visibleFolders().map(f=>`<div class="lit"><span style="color:var(--tx2)">${icon('folder')}</span><span class="nm">${esc(f)}</span><span style="color:var(--tx3);font-size:13px">${plural(TRACKS.filter(t=>t.f===f).length,'song')}</span><button class="ib" data-act="remove-folder" data-f="${esc(f)}" aria-label="Remove ${esc(f)} from library">${icon('trash')}</button></div>`).join('')||'<div class="empty" style="padding:24px">No folders yet.</div>'}</div>
    <div style="display:flex;gap:10px;margin:14px 0 4px;flex-wrap:wrap"><button class="btn gh sm" data-act="add-folder">${icon('addfolder')}Add folder</button><button class="btn gh sm" data-act="rescan">Rescan library</button></div>
    ${tgRow('play.scanStart','Scan on startup','Pick up new files each time NOVA opens',p.scanStart)}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${['MP3','WAV','FLAC','M4A','AAC','OGG','WMA'].map(x=>`<span class="chip" style="height:26px;display:inline-grid;place-items:center${x==='WMA'?';opacity:.55':''}">${x}</span>`).join('')}</div><p class="hint" style="margin-top:10px">WMA files are found and listed, but this version can’t play them yet.</p></section>
  </div>
  <aside class="col"><div class="sticky"><section class="pv glass"><div class="pipe"><img id="pv-art" alt=""><span>${icon('arrow')}</span><div class="mood" style="margin:0;flex:1"><span id="pv-mood"></span><small>Colors are softened so text stays readable</small></div></div>
    <div class="sws">${PKEYS.map(k=>`<div style="--c:var(--c-${k})"><span>${k==='bg'?'Background':k==='viz'?'Visualizer':k[0].toUpperCase()+k.slice(1)}</span></div>`).join('')}</div>
    <div class="demo"><div class="sl" style="--p:.62;--s:0;--w:.62;pointer-events:none"><div class="tr"></div><div class="fl"></div><div class="th" style="transform:scale(1)"></div></div><div style="display:flex;gap:10px;align-items:center"><span class="btn pri sm">${icon('play')}Play</span><span class="chip on">Accent chip</span><span style="color:var(--c-accent-t);font-weight:550">Accent text</span></div></div></section></div></aside></div>`;
}

/* ---------- theme controls ---------- */
const PLAB={primary:'Primary',secondary:'Secondary',accent:'Accent',glow:'Glow',bg:'Background',viz:'Visualizer'};
const toFmt=(hex,f)=>{if(f==='rgb')return hexToRgb(hex).join(', ');if(f==='hsl'){const[h,s,l]=hexToHsl(hex);return`${Math.round(h)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%`}return hex.toUpperCase()};
function parseColor(s){
  s=s.trim();let m=s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);if(m)return'#'+(m[1].length===3?[...m[1]].map(c=>c+c).join(''):m[1]).toLowerCase();
  const n=s.match(/-?\d+(\.\d+)?/g);if(!n||n.length<3)return null;const v=n.slice(0,3).map(Number);
  if(/hsl/i.test(s)||st.theme.fmt==='hsl')return hslToHex(v[0],clamp(v[1],0,100)/100,clamp(v[2],0,100)/100);
  return v.every(x=>x>=0&&x<=255)?rgbToHex(...v):null;
}
const editable=()=>st.theme.mode!=='auto'||!!(P.cur&&st.theme.perSong[P.cur.id]);
function renderPal(){
  const box=$('#palrows');if(!box)return;const pal=Theme.current||Theme.resolve(P.cur),ed=editable(),th=st.theme;
  box.innerHTML=PKEYS.map(k=>`<div class="prow"><label class="sw ${ed?'':'ro'}" style="--c:${pal[k]}" data-sw="${k}"><input type="color" value="${pal[k]}" data-color="${k}" ${ed?'':'disabled'} aria-label="${PLAB[k]} color"></label><span>${PLAB[k]}</span><input class="ci" data-cin="${k}" value="${toFmt(pal[k],th.fmt)}" ${ed?'':'disabled'} spellcheck="false" aria-label="${PLAB[k]} value"><button class="ib" data-act="reset-color" data-k="${k}" aria-label="Reset ${PLAB[k]} to artwork" style="${th.mode==='hybrid'&&th.overrides[k]&&!th.perSong[P.cur.id]?'':'visibility:hidden'}">${icon('x')}</button></div>`).join('');
  const note={auto:'Colors are read from the artwork. Switch to Manual or Hybrid to change them.',manual:'You choose every color. The artwork is ignored.',hybrid:'Colors come from the artwork. Change any one and it stays until you reset it.'}[th.mode];
  const ps=th.perSong[P.cur.id];
  $('#mode-note').textContent=ps?'This song has its own saved theme. Edits here change that theme.':note;
  $('#song-theme').innerHTML=`<div class="tgrow"><div>Theme for this song<small>${esc(P.cur.t)}${ps?' has a saved theme':' uses the current theme'}</small></div>${ps?`<button class="btn gh sm" data-act="song-theme-clear">Remove</button>`:`<button class="btn gh sm" data-act="song-theme">Save for this song</button>`}</div>`;
  $('#pv-art').src=art(P.cur.ak);$('#pv-mood').textContent=pal.mood?(pal.mood.includes(' ')?pal.mood:pal.mood+' palette'):'Palette';
}
function renderCustoms(){
  const b=$('#customs');if(!b)return;
  b.innerHTML=st.theme.customs.map(c=>`<div class="lit"><span class="dots">${PKEYS.slice(0,4).map(k=>`<i style="--c:${c.pal[k]}"></i>`).join('')}</span><span class="nm">${esc(c.name)}</span><button class="btn gh sm" data-act="apply-theme" data-id="${c.id}">Apply</button><button class="ib" data-act="rename-theme" data-id="${c.id}" aria-label="Rename">${icon('edit')}</button><button class="ib" data-act="del-theme" data-id="${c.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')||'<div class="empty" style="padding:22px">No saved themes yet.</div>';
}
function setColor(k,hex){
  const th=st.theme,ps=P.cur&&th.perSong[P.cur.id];
  if(ps)ps[k]=hex;else if(th.mode==='manual')th.manual[k]=hex;else if(th.mode==='hybrid')th.overrides[k]=hex;else return;
  persist();Theme.live();
}
function liveSettings(){
  if(V.route!=='settings')return;const pal=Theme.current;if(!pal)return;
  $$('[data-sw]').forEach(sw=>{const k=sw.dataset.sw;sw.style.setProperty('--c',pal[k]);const ci=$(`[data-cin="${k}"]`);if(ci&&document.activeElement!==ci){ci.value=toFmt(pal[k],st.theme.fmt);ci.classList.remove('bad')}const cp=$('input',sw);if(cp&&document.activeElement!==cp)cp.value=pal[k]});
  $('#pv-art').src=art(P.cur.ak);const m=pal.mood;$('#pv-mood').textContent=m?(m.includes(' ')?m:m+' palette'):'Palette';
}
document.addEventListener('themechange',()=>{liveSettings()});

/* ---------- studio helpers ---------- */
function curveD(v){
  const pts=v.map((g,i)=>[(i+.5)*100,(1-(g+12)/24)*210]);let d=`M0 ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;d+=` C${p1[0]+(p2[0]-p0[0])/6} ${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6} ${p2[1]-(p3[1]-p1[1])/6} ${p2[0]} ${p2[1]}`}
  return d+` L900 ${pts[8][1]}`;
}
function updStudio(){
  const l=$('#eq-line');if(l){const d=curveD(st.eq.bands);l.setAttribute('d',d);$('#eq-fill').setAttribute('d',d+' L900 210 L0 210 Z')}
  $$('[data-bv]').forEach(e=>{const v=st.eq.bands[+e.dataset.bv];e.textContent=(v>0?'+':'')+(+v.toFixed(1))});
  const pr=$('#presets');if(pr)pr.innerHTML=[...Object.keys(PRESETS),'Custom'].map(n=>`<button class="chip ${st.eq.preset===n?'on':''}" data-preset="${n}" ${n==='Custom'?'aria-disabled="true"':''}>${n}</button>`).join('');
}
function updOut(){
  const e=st.eq,set=(id,t)=>$$(`[data-out="${id}"]`).forEach(o=>o.textContent=t);
  set('vol',Math.round((st.muted?0:st.vol)*100)+'%');set('preamp',(e.preamp>0?'+':'')+e.preamp+' dB');set('bass',Math.round(e.bass)+'%');set('treble',Math.round(e.treble)+'%');
  set('balance',Math.abs(e.balance)<.03?'Center':(e.balance<0?'L ':'R ')+Math.round(Math.abs(e.balance)*100));set('tdur',st.theme.dur+' ms');
}
function eqChanged(){Engine.applyEQ();persist();drawAll('band');updStudio();updOut()}

/* ---------- router ---------- */
const NAVMAP={home:'home',songs:'songs',albums:'albums',artists:'artists',playlists:'playlists',folders:'folders',favorites:'favorites',recent:'recent',studio:'studio',settings:'settings',list:null};
function go(route,arg){
  if(route!=='search'&&V.route!=='search')V.prev=route;
  V.route=route;V.arg=arg||null;if(route!=='search'&&$('#q').value){$('#q').value='';V.q=''}
  if(route==='songs')V.folder='all';
  render();
}
const vWelcome=()=>`<div class="welcome"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="url(#gb)" stroke-width=".9"/><ellipse cx="12" cy="12" rx="9.2" ry="3.6" fill="none" stroke="url(#gb)" stroke-width=".7" transform="rotate(-28 12 12)" opacity=".7"/><circle cx="12" cy="12" r="2.6" fill="url(#gb)"/></svg><h1>Your music, lit by its own covers</h1><p>Add a folder and NOVA builds your library from it: subfolders, tags and cover art included. Everything stays on this computer.</p><div class="btns"><button class="btn pri" data-act="add-folder">${icon('addfolder')}Add music folder</button></div><small>MP3, WAV, FLAC, M4A, AAC and OGG. You can also drop a folder onto this window.</small></div>`;
function render(){
  const m=$('#main');let h='';
  if(!TRACKS.length){m.innerHTML=`<div class="view">${vWelcome()}</div>`;$$('.nav').forEach(n=>n.classList.toggle('on',n.dataset.nav==='home'));$('#libstat').textContent='No folders yet';return}
  switch(V.route){
    case'home':h=vHome();break;case'songs':h=vSongs();break;case'favorites':h=vFavs();break;case'recent':h=vRecent();break;
    case'albums':h=vAlbums();break;case'artists':h=vArtists();break;case'folders':h=vFolders();break;case'playlists':h=vPlaylists();break;
    case'studio':h=vStudio();break;case'settings':h=vSettings();break;case'list':case'search':h=vDetail();break;
  }
  m.innerHTML=`<div class="view">${h}</div>`;m.scrollTop=0;
  bindSliders(m);
  if(V.route==='studio'){updStudio();updOut()}
  if(V.route==='settings'){renderPal();renderCustoms();updOut();$$('[data-tg]',m).forEach(b=>b.setAttribute('aria-checked',String(!!getPath(b.dataset.tg))))}
  const navKey=V.route==='list'?({album:'albums',artist:'artists',folder:'folders',playlist:'playlists'}[V.arg.k]):V.route==='search'?null:V.route;
  $$('.nav').forEach(n=>n.classList.toggle('on',n.dataset.nav===navKey));
  syncRows();syncFavs();syncPlay();
  $('#libstat').textContent=`${plural(visibleTracks().length,'song')} in ${plural(visibleFolders().length,'folder')}`;
}
const getPath=p=>p.split('.').reduce((o,k)=>o[k],st);
function setPath(p,v){const ks=p.split('.'),l=ks.pop();ks.reduce((o,k)=>o[k],st)[l]=v}
