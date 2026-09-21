const { _electron: electron } = require('playwright-core');
const fs=require('fs');
(async()=>{
  fs.rmSync('/tmp/novatest',{recursive:true,force:true});
  const launch=()=>electron.launch({executablePath:'../node_modules/electron/dist/electron',args:['--no-sandbox','--disable-gpu','--user-data-dir=/tmp/novatest','..'],env:{...process.env}});
  let app=await launch(), pg=await app.firstWindow();
  const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
  await pg.setViewportSize({width:1400,height:880});
  await pg.waitForTimeout(1500);
  await pg.screenshot({path:'t-welcome.png'});
  const r=await pg.evaluate(async()=>{const x=await window.nova.addPath('/tmp/music');return {err:x.error,added:x.added,name:x.name,n:x.library&&x.library.tracks.length,tracks:x.library&&x.library.tracks.map(t=>[t.id,t.t,t.artist,t.album,t.dur,!!t.art,t.ext,t.f])}});
  console.log('SCAN',JSON.stringify(r));
  await pg.evaluate(()=>{applyLibrary(window.__lib)}).catch(()=>{});
  // apply via app function
  await pg.evaluate(async()=>{const x=await window.nova.rescan();applyLibrary(x.library)});
  await pg.waitForTimeout(1500);
  await pg.screenshot({path:'t-home.png'});
  await pg.evaluate(()=>go('songs'));await pg.waitForTimeout(800);await pg.screenshot({path:'t-songs.png'});
  // play first row
  await pg.click('.row >> nth=0');await pg.waitForTimeout(2500);
  const s1=await pg.evaluate(()=>({playing:__nova.P.playing,pos:__nova.P.pos,title:__nova.P.cur.t,ctx:__nova.Engine.running(),theme:getComputedStyle(document.documentElement).getPropertyValue('--c-primary')}));
  console.log('PLAY',JSON.stringify(s1));
  await pg.click('.mi');await pg.waitForTimeout(2200);
  const bands=await pg.evaluate(()=>{const o=new Float32Array(72);__nova.Engine.bands(o);return Math.max(...o)});
  console.log('BANDS max',bands);
  await pg.screenshot({path:'t-np.png'});
  // seek test
  const sk=await pg.evaluate(async()=>{__nova.Engine.seek(10);await new Promise(r=>setTimeout(r,800));return __nova.Engine.pos()});
  console.log('SEEK ->',sk);
  await pg.click('[data-act=np-close]');await pg.waitForTimeout(600);
  // next through all formats
  const seq=[];
  for(let i=0;i<7;i++){await pg.evaluate(()=>next(false));await pg.waitForTimeout(1600);seq.push(await pg.evaluate(()=>[__nova.P.cur.t,__nova.P.cur.ext,__nova.P.playing,Math.round(__nova.Engine.pos()*10)/10]));}
  console.log('SEQ',JSON.stringify(seq));
  await pg.evaluate(()=>go('albums'));await pg.waitForTimeout(800);await pg.screenshot({path:'t-albums.png'});
  // change eq & persistence
  await pg.evaluate(()=>{st.eq.bands=[7,6,4,1.5,0,0,0,0,0];st.eq.preset='Bass Boost';eqChanged();setVolume(.5);toggleFav(__nova.P.cur.id);persist()});
  await pg.waitForTimeout(700);
  const last=await pg.evaluate(()=>({id:__nova.P.cur.id,pos:__nova.P.pos}));
  await app.close();
  console.log('ERRS',JSON.stringify(errs));
  app=await launch();pg=await app.firstWindow();await pg.waitForTimeout(2200);
  const re=await pg.evaluate(()=>({tracks:__nova.TRACKS().length,vol:st.vol,eq:st.eq.preset,favs:st.favs,cur:__nova.P.cur&&__nova.P.cur.id,pos:__nova.P.pos}));
  console.log('RESTART',JSON.stringify(re),'expected last',JSON.stringify(last));
  await pg.screenshot({path:'t-restart.png'});
  await app.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
