const { _electron: electron } = require('playwright-core');
const fs=require('fs');
(async()=>{
  fs.rmSync('/tmp/novatest2',{recursive:true,force:true});
  const launch=()=>electron.launch({executablePath:'../node_modules/electron/dist/electron',args:['--no-sandbox','--disable-gpu','--user-data-dir=/tmp/novatest2','..']});
  let app=await launch(), pg=await app.firstWindow();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.setViewportSize({width:1400,height:880});await pg.waitForTimeout(1200);
  await pg.evaluate(async()=>{const x=await window.nova.addPath('/tmp/music');applyLibrary(x.library)});
  await pg.evaluate(()=>go('songs'));await pg.waitForTimeout(800);
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:['/tmp/music/art/b.jpg']})});
  // edit the "no tags here" wav (Unknown artist / Unknown album)
  const id=await pg.evaluate(()=>__nova.TRACKS().find(t=>t.t==='no tags here').id);
  await pg.evaluate(i=>editTrack(i),id);await pg.waitForTimeout(400);
  await pg.screenshot({path:'e-modal.png'});
  await pg.fill('#ed-t','My Custom Title');await pg.fill('#ed-a','Test Artist');await pg.fill('#ed-b','Test Album');
  await pg.click('#ed-pick');await pg.waitForTimeout(600);
  await pg.click('#ed-save');await pg.waitForTimeout(900);
  const r=await pg.evaluate(i=>{const t=T(i);return {t:t.t,artist:t.artist,album:t.album,ak:t.ak,al:t.al,edits:JSON.stringify(st.edits),imgOk:new Promise(r=>{const im=new Image();im.onload=()=>r(im.naturalWidth);im.onerror=()=>r(0);im.src=art(t.ak)}),title:document.querySelector(`.row[data-play="${i}"] .r-name`)&&document.querySelector(`.row[data-play="${i}"] .r-name`).textContent}},id);
  r.imgOk=await r.imgOk;console.log('EDITED',JSON.stringify(r));
  await pg.screenshot({path:'e-songs.png'});
  await app.close();
  app=await launch();pg=await app.firstWindow();await pg.waitForTimeout(2000);
  const again=await pg.evaluate(i=>{const t=T(i);return {t:t.t,artist:t.artist,ak:t.ak}},id);console.log('AFTER RESTART',JSON.stringify(again));
  await pg.evaluate(i=>editTrack(i),id);await pg.waitForTimeout(300);await pg.click('#ed-reset');await pg.waitForTimeout(600);
  console.log('RESET',JSON.stringify(await pg.evaluate(i=>({t:T(i).t,edits:st.edits}),id)),'ERRS',JSON.stringify(errs));
  await app.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
