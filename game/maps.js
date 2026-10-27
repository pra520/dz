// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Level layouts
//  Every map is built from axis-aligned blocks {x,y,w,h,ht,k}:
//    x,y,w,h : footprint in world units (map is B×B, y = "north/south")
//    ht      : height (players can see / shoot over low blocks)
//    k       : visual kind (see gfx.js KINDS)
//  Generators use a seeded RNG so host and clients build the
//  exact same map in multiplayer.
// ═══════════════════════════════════════════════════════
(function(global){
'use strict';

function rng(seed){
  let a=seed>>>0;
  const f=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  f.range=(lo,hi)=>lo+f()*(hi-lo);
  f.int=(lo,hi)=>Math.floor(lo+f()*(hi-lo+1));
  f.pick=a=>a[Math.floor(f()*a.length)];
  return f;
}

function Builder(B,seed,wallHt,borderKind){
  const b={B,walls:[],decor:[],hazards:[],R:rng(seed)};
  b.add=(x,y,w,h,ht,k,extra)=>{const o=Object.assign({x,y,w,h,ht,k},extra||{});b.walls.push(o);return o;};
  // try to place a block without overlapping anything (margin = free space kept around it)
  b.overlaps=(x,y,w,h,m)=>{
    if(x<30+m||y<30+m||x+w>B-30-m||y+h>B-30-m)return true;
    for(const o of b.walls){if(o.k==='border')continue;if(x-m<o.x+o.w&&x+w+m>o.x&&y-m<o.y+o.h&&y+h+m>o.y)return true;}
    return false;
  };
  b.place=(x,y,w,h,ht,k,m,extra)=>b.overlaps(x,y,w,h,m)?null:b.add(x,y,w,h,ht,k,extra);
  b.clearOf=(x,y,w,h,cx,cy,r)=>{const nx=Math.max(x,Math.min(cx,x+w)),ny=Math.max(y,Math.min(cy,y+h));return Math.hypot(nx-cx,ny-cy)>=r;};
  // scatter n blocks at random, keeping a clear circle (cx,cy,cr) around the player spawn
  b.scatter=(n,fn,cx,cy,cr,m,tries=40)=>{
    let placed=0;
    for(let i=0;i<n;i++){
      for(let t=0;t<tries;t++){
        const s=fn();
        if(!b.clearOf(s.x,s.y,s.w,s.h,cx,cy,cr))continue;
        if(b.place(s.x,s.y,s.w,s.h,s.ht,s.k,m,s.extra)){placed++;break;}
      }
    }
    return placed;
  };
  // a horizontal or vertical wall run with door gaps [{at,len}]
  b.run=(x,y,len,thick,horiz,ht,k,gaps)=>{
    const g=(gaps||[]).slice().sort((p,q)=>p.at-q.at);let cur=0;
    for(const gp of g){if(gp.at>cur){horiz?b.add(x+cur,y,gp.at-cur,thick,ht,k):b.add(x,y+cur,thick,gp.at-cur,ht,k);}cur=gp.at+gp.len;}
    if(cur<len)horiz?b.add(x+cur,y,len-cur,thick,ht,k):b.add(x,y+cur,thick,len-cur,ht,k);
  };
  const bh=wallHt||320,bk=borderKind||'border';
  b.add(0,0,B,30,bh,'border',{v:bk});b.add(0,B-30,B,30,bh,'border',{v:bk});
  b.add(0,0,30,B,bh,'border',{v:bk});b.add(B-30,0,30,B,bh,'border',{v:bk});
  return b;
}

// ── 1. CITY (original layout) ──
function city(){
  const b=Builder(3200,101,360,'building');const R=b.R;
  const blds=[[200,200,200,200],[600,200,180,160],[1000,150,220,220],[1500,200,200,180],[2000,200,250,200],[2600,200,200,200],
    [200,700,160,200],[700,650,200,200],[1200,680,180,180],[1700,700,200,200],[2200,650,180,180],[2700,680,200,200],
    [200,1200,200,200],[650,1150,180,200],[1100,1200,220,180],[1600,1150,200,200],[2100,1200,200,180],[2650,1150,200,200],
    [200,1700,200,200],[700,1700,180,180],[1200,1650,200,220],[1700,1700,200,200],[2200,1700,180,200],[2700,1700,200,200],
    [200,2200,200,200],[650,2200,180,180],[1100,2200,220,200],[1600,2200,200,180],[2100,2200,200,200],[2650,2200,200,180],
    [200,2700,180,200],[700,2700,200,180],[1200,2700,180,200],[1700,2700,200,200],[2200,2700,180,180],[2700,2700,200,200]];
  for(const[x,y,w,h]of blds)b.add(x,y,w,h,R.range(200,440)|0,'building',{v:R.int(0,4)});
  const cars=[[450,450,60,30],[900,420,30,60],[1400,460,60,30],[1900,440,30,60],[2450,450,60,30],
    [450,950,60,30],[950,930,30,60],[1450,950,60,30],[1950,940,30,60],[2450,950,60,30],
    [450,1450,60,30],[950,1430,30,60],[1450,1450,60,30],[1950,1440,30,60],[2450,1450,60,30],
    [450,1950,60,30],[950,1930,30,60],[1450,1950,60,30],[1950,1940,30,60],[2450,1950,60,30]];
  for(const[x,y,w,h]of cars)b.add(x,y,w,h,40,'car',{v:R.int(0,5)});
  b.scatter(14,()=>({x:R.range(100,3000),y:R.range(100,3000),w:40,h:40,ht:40,k:'crate'}),1600,1600,250,30);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 2. MILITARY BASE (original layout) ──
function military(){
  const b=Builder(3200,202,300,'concrete');const R=b.R;
  const bunk=[[100,100,300,80],[100,260,80,300],[100,650,300,80],[2800,100,300,80],[3020,260,80,300],[2800,650,300,80],
    [100,2450,300,80],[100,2160,80,300],[100,2760,300,80],[2800,2450,300,80],[3020,2160,80,300],[2800,2760,300,80]];
  for(const[x,y,w,h]of bunk)b.add(x,y,w,h,110,'bunker');
  const fort=[[600,600,400,80],[600,600,80,400],[2200,600,400,80],[2520,600,80,400],[600,2520,400,80],[600,2120,80,400],[2200,2520,400,80],[2520,2120,80,400]];
  for(const[x,y,w,h]of fort)b.add(x,y,w,h,90,'wall');
  for(const[x,y]of[[1300,1300],[1700,1300],[1300,1700],[1700,1700]])b.add(x,y,200,200,180,'hangar');
  const bar=[[200,1100,350,60],[200,1500,350,60],[200,1900,350,60],[2650,1100,350,60],[2650,1500,350,60],[2650,1900,350,60],
    [1100,200,60,350],[1500,200,60,350],[1900,200,60,350],[1100,2650,60,350],[1500,2650,60,350],[1900,2650,60,350]];
  for(const[x,y,w,h]of bar)b.add(x,y,w,h,100,'barracks');
  const sand=[[850,1580,80,40],[1050,1380,40,80],[2200,1580,80,40],[2100,1380,40,80],[1580,850,40,80],[1380,1050,80,40],[1580,2200,40,80],[1380,2100,80,40]];
  for(const[x,y,w,h]of sand)b.add(x,y,w,h,34,'sandbag');
  b.scatter(20,()=>({x:R.range(100,3000),y:R.range(100,3000),w:R.pick([40,50,60]),h:R.pick([40,50]),ht:R.pick([40,55,70]),k:'crate'}),1600,1600,260,40);
  b.add(2900,1300,60,60,320,'tower');b.add(240,1300,60,60,320,'tower');
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 3. LAB (original layout, now indoor) ──
function lab(){
  const H=200;const b=Builder(3200,303,H,'labpanel');
  const w=[[100,100,800,50],[100,100,50,800],[100,850,360,50],[600,850,300,50],[850,100,50,360],[850,600,50,250],
    [1350,100,800,50],[2100,100,50,800],[1350,100,50,360],[1350,600,50,250],[1350,850,360,50],[1850,850,300,50],
    [100,1350,50,800],[850,1350,50,800],[100,2100,360,50],[600,2100,300,50],[100,1350,360,50],[600,1350,300,50],
    [1100,1100,1000,50],[1100,2050,1000,50],[1100,1100,50,500],[1100,1750,50,300],[2050,1100,50,500],[2050,1750,50,300],
    [2350,1350,800,50],[3100,1350,50,800],[2350,2100,800,50],[2350,1350,50,360],[2350,1860,50,240],
    [100,2600,800,50],[100,2600,50,570],[850,2600,50,570],[100,3120,800,50],
    [1350,2600,800,50],[1350,2600,50,570],[2100,2600,50,570],[1350,3120,800,50]];
  for(const[x,y,ww,hh]of w)b.add(x,y,ww,hh,H,'wall');
  // the bottom rooms were sealed in the original; open a door in each so zombies can't get trapped
  const fix=b.walls.filter(o=>o.k==='wall'&&o.y===2600&&o.h===50&&o.w===800);
  for(const o of fix){b.walls.splice(b.walls.indexOf(o),1);b.add(o.x,o.y,330,50,H,'wall');b.add(o.x+470,o.y,330,50,H,'wall');}
  const eq=[[280,280],[580,280],[280,580],[580,580],[1500,280],[1800,280],[1500,580],[1800,580],[1300,1300],[1700,1300],[1300,1700],[1700,1700],
    [280,1500],[580,1500],[280,1800],[580,1800],[2500,1500],[2800,1500],[2500,1800],[2800,1800]];
  for(const[x,y]of eq)b.add(x,y,80,80,100,'machine');
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 4. GRAVEYARD ──
function graveyard(){
  const b=Builder(3200,404,240,'stone');const R=b.R;
  b.add(1420,320,360,240,220,'crypt');
  for(const[x,y]of[[480,480],[2560,480],[480,2560],[2560,2560],[900,1540],[2140,1540]])b.add(x,y,170,140,160,'crypt');
  for(let gx=200;gx<3000;gx+=110)for(let gy=200;gy<3000;gy+=150){
    if(Math.abs(gx-1600)<170||Math.abs(gy-1600)<170||Math.abs(gx-800)<70||Math.abs(gy-2400)<70)continue;
    if(Math.hypot(gx-1600,gy-1600)<480||R()<.42)continue;
    b.place(gx+R.range(-14,14),gy+R.range(-14,14),34,12,R.range(38,56)|0,'tomb',30);
  }
  b.scatter(34,()=>({x:R.range(100,3000),y:R.range(100,3000),w:20,h:20,ht:230,k:'deadtree'}),1600,1600,400,60);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 5. DEAD MALL (indoor) ──
function mall(){
  const H=260;const b=Builder(3200,505,H,'store');const R=b.R;
  for(const x0 of[180,800,1980,2600])for(const y0 of[180,800,1980,2600])b.add(x0,y0,420,420,H,'store',{v:R.int(0,5)});
  for(const[x,y]of[[1300,1300],[1800,1300],[1300,1800],[1800,1800]])b.add(x,y,100,100,50,'planter');
  for(const[x,y]of[[660,1000],[660,2200],[2460,1000],[2460,2200],[1000,660],[2200,660],[1000,2460],[2200,2460]])b.add(x,y,80,80,100,'kiosk',{v:R.int(0,5)});
  b.add(1300,1460,100,280,120,'escalator');b.add(1800,1460,100,280,120,'escalator');
  b.scatter(18,()=>{const h=R()<.5;return{x:R.range(100,3000),y:R.range(100,3000),w:h?120:30,h:h?30:120,ht:26,k:'bench'};},1600,1600,300,50);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 6. DESERT OUTPOST ──
function desert(){
  const b=Builder(3200,606,200,'adobe');const R=b.R;
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2+R.range(-.15,.15),d=R.range(480,640);b.place(1600+Math.cos(a)*d-70,1600+Math.sin(a)*d-70,140,140,R.range(100,140)|0,'hut',60);}
  b.add(2400,780,60,60,300,'tower');
  b.scatter(42,()=>{const w=R.range(60,220),h=R.range(60,200);return{x:R.range(80,3100),y:R.range(80,3100),w,h,ht:R.range(50,200)|0,k:'rock'};},1600,1600,850,110);
  b.scatter(22,()=>({x:R.range(100,3080),y:R.range(100,3080),w:18,h:18,ht:260,k:'palm'}),1600,1600,380,100);
  b.scatter(7,()=>{const h=R()<.5;return{x:R.range(200,2900),y:R.range(200,2900),w:h?62:30,h:h?30:62,ht:40,k:'car',extra:{v:5}};},1600,1600,500,80);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 7. FROZEN STATION ──
function arctic(){
  const b=Builder(3200,707,220,'ice');const R=b.R;
  const mods=[[900,1000,1],[2000,980,1],[960,2050,0],[2050,2040,0],[1500,600,1],[1520,2500,1],[500,1500,0],[2600,1500,0],[500,600,1],[2550,2600,1]];
  for(const[x,y,h]of mods)b.place(x,y,h?240:110,h?110:240,120,'module',60);
  b.scatter(6,()=>({x:R.range(150,3000),y:R.range(150,3000),w:90,h:90,ht:130,k:'tank'}),1600,1600,450,80);
  b.scatter(32,()=>{const w=R.range(60,170),h=R.range(60,170);return{x:R.range(80,3100),y:R.range(80,3100),w,h,ht:R.range(60,190)|0,k:'ice'};},1600,1600,520,110);
  b.scatter(16,()=>{const h=R()<.5;return{x:R.range(80,3000),y:R.range(80,3000),w:h?200:60,h:h?60:200,ht:34,k:'drift'};},1600,1600,420,80);
  b.add(2800,350,60,60,340,'tower');
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 8. SUBWAY TUNNELS (indoor) ──
function subway(){
  const H=200;const b=Builder(3200,808,H,'tunnel');const R=b.R;
  const gaps=[];for(let x=230;x<3100;x+=520)gaps.push({at:x,len:190});
  b.run(30,1000,3140,60,true,H,'wall',gaps);
  b.run(30,2140,3140,60,true,H,'wall',gaps.map(g=>({at:g.at+260>3000?g.at-260:g.at+260,len:g.len})));
  for(let x=150;x<3100;x+=260){if(Math.abs(x-1600)<120)continue;b.add(x,1290,40,40,H,'pillar');b.add(x,1850,40,40,H,'pillar');}
  for(const x of[150,880,1700,2440])b.add(x,450,600,100,130,'train',{v:R.int(0,2)});
  for(const x of[420,1180,1960,2560])if(x+600<3170)b.add(x,2640,560,100,130,'train',{v:R.int(0,2)});
  b.add(1580,30,60,520,H,'wall');
  b.add(1580,2640+140,60,390,H,'wall');
  b.scatter(16,()=>({x:R.range(100,3000),y:R.range(100,3000),w:R.pick([40,50]),h:R.pick([40,50]),ht:R.pick([45,60]),k:'crate'}),1600,1600,260,45);
  b.scatter(10,()=>({x:R.range(100,3000),y:R.range(1100,2050),w:120,h:30,ht:26,k:'bench'}),1600,1600,260,60);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 9. HOSPITAL (indoor) ──
function hospital(){
  const H=200;const b=Builder(3200,909,H,'hospital');const R=b.R;
  const skip=new Set();while(skip.size<2){const i=R.int(0,3),j=R.int(0,3);if((i===1||i===2)&&(j===1||j===2))skip.add(i+','+j);}
  const S=560,T=20,D=150;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    if(skip.has(i+','+j))continue;
    const x0=150+i*750,y0=150+j*750;
    // pick 2-3 sides that get a doorway
    const sides=['n','s','w','e'].sort(()=>R()-.5).slice(0,R.int(2,3));
    const door=s=>sides.includes(s)?[{at:R.range(80,S-80-D)|0,len:D}]:[];
    b.run(x0,y0,S,T,true,H,'wall',door('n'));b.run(x0,y0+S-T,S,T,true,H,'wall',door('s'));
    b.run(x0,y0+T,S-2*T,T,false,H,'wall',door('w').map(g=>({at:Math.min(g.at,S-2*T-D-10),len:D})));
    b.run(x0+S-T,y0+T,S-2*T,T,false,H,'wall',door('e').map(g=>({at:Math.min(g.at,S-2*T-D-10),len:D})));
    for(let k=0;k<3;k++){const bx=x0+50+k*150;if(R()<.8)b.place(bx,y0+40,55,105,30,'bed',8);}
    if(R()<.7)b.place(x0+S-110,y0+S-70,70,30,90,'cabinet',8);
  }
  b.add(1500,1480,200,40,45,'desk');
  return Object.assign(b,{pSpawn:{x:1550,y:1600}});
}

// ── 10. FOREST ──
function forest(){
  const b=Builder(3200,1010,260,'wood');const R=b.R;
  for(const[x,y]of[[420,420],[2520,560],[560,2520],[2500,2500]])b.add(x,y,240,180,150,'cabin');
  b.add(1570,1420,60,60,18,'campfire');
  b.scatter(150,()=>({x:R.range(70,3110),y:R.range(70,3110),w:28,h:28,ht:300,k:'tree',extra:{v:R.int(0,2)}}),1600,1600,360,64);
  b.scatter(14,()=>{const h=R()<.5;return{x:R.range(100,3000),y:R.range(100,3000),w:h?170:26,h:h?26:170,ht:26,k:'log'};},1600,1600,380,70);
  b.scatter(14,()=>{const s=R.range(50,120);return{x:R.range(100,3000),y:R.range(100,3000),w:s,h:s*R.range(.7,1.2),ht:R.range(40,110)|0,k:'rock'};},1600,1600,420,80);
  return Object.assign(b,{pSpawn:{x:1600,y:1640},campfire:{x:1600,y:1450}});
}

// ── 11. HARBOR DOCKS ──
function docks(){
  const b=Builder(3200,1111,260,'metal');const R=b.R;
  b.add(30,30,3140,300,6,'water');
  b.add(2420,2700,560,330,220,'warehouse');b.add(250,2750,460,300,200,'warehouse');
  for(const cx of[700,2200])for(const[dx,dy]of[[0,0],[220,0],[0,220],[220,220]])b.add(cx+dx,360+dy,30,30,420,'crane');
  for(const cx of[700,2200])b.decor.push({k:'cranebeam',x:cx-40,y:360,w:330,h:250,ht:420});
  for(let i=0;i<9;i++)for(let j=0;j<10;j++){
    const x0=250+i*330,y0=700+j*240;
    if(i===4||j===4)continue;
    if(x0>1250&&x0<1950&&y0>1250&&y0<1950)continue;
    if(R()<.38)continue;
    b.place(x0,y0,240,90,R()<.35?220:110,'container',4,{v:R.int(0,5)});
  }
  b.scatter(10,()=>({x:R.range(100,3000),y:R.range(400,3000),w:20,h:20,ht:30,k:'bollard'}),1600,1600,300,40);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 12. PRISON ──
function prison(){
  const b=Builder(3200,1212,280,'prisonbrick');const R=b.R;
  for(const[x,y]of[[300,420],[1800,420],[300,2460],[1800,2460]])b.add(x,y,1100,320,200,'cellblock');
  for(const[x,y]of[[60,60],[3050,60],[60,3050],[3050,3050]])b.add(x,y,90,90,320,'tower');
  b.add(2520,1300,440,500,180,'building',{v:4});b.add(240,1300,440,500,180,'building',{v:4});
  const L=1000,T=1150,Wd=1200,Ht=900,G=220;
  b.run(L,T,Wd,10,true,110,'fence',[{at:Wd/2-G/2,len:G}]);b.run(L,T+Ht,Wd,10,true,110,'fence',[{at:Wd/2-G/2,len:G}]);
  b.run(L,T,Ht,10,false,110,'fence',[{at:Ht/2-G/2,len:G}]);b.run(L+Wd-10,T,Ht,10,false,110,'fence',[{at:Ht/2-G/2,len:G}]);
  b.scatter(16,()=>{const h=R()<.5;return{x:R.range(100,3000),y:R.range(100,3000),w:h?110:36,h:h?36:110,ht:42,k:'barrier'};},1600,1600,300,70);
  b.scatter(8,()=>({x:R.range(1050,2150),y:R.range(1200,2000),w:110,h:30,ht:26,k:'bench'}),1600,1600,220,60);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 13. VOLCANO ──
function volcano(){
  const b=Builder(3200,1313,300,'basalt');const R=b.R;
  b.hazards.push({x:30,y:900,w:1250,h:130,dps:22},{x:1930,y:900,w:1240,h:130,dps:22},{x:2200,y:1500,w:120,h:700,dps:22},{x:2200,y:2450,w:120,h:720,dps:22},
    {x:500,y:2300,w:380,h:300,dps:22},{x:2600,y:400,w:300,h:260,dps:22});
  // ruined temple ring around the spawn
  for(let i=0;i<12;i++){if(i%3===0)continue;const a=i/12*Math.PI*2,d=520;b.add(1600+Math.cos(a)*d-50,1600+Math.sin(a)*d-50,100,100,R.range(80,170)|0,'ruin');}
  b.scatter(14,()=>({x:R.range(100,3050),y:R.range(100,3050),w:46,h:46,ht:R.range(220,340)|0,k:'obsidian'}),1600,1600,700,90);
  b.scatter(40,()=>{const w=R.range(60,200),h=R.range(60,200);return{x:R.range(80,3100),y:R.range(80,3100),w,h,ht:R.range(50,180)|0,k:'rock'};},1600,1600,750,110);
  // keep rocks out of the lava so the rivers stay readable
  b.walls=b.walls.filter(o=>o.k!=='rock'||!b.hazards.some(h=>o.x<h.x+h.w&&o.x+o.w>h.x&&o.y<h.y+h.h&&o.y+o.h>h.y));
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

// ── 14. HIVE ──
function hive(){
  const b=Builder(3200,1414,300,'flesh');const R=b.R;
  const N=28;
  for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2;
    const gate=[0,7,14,21].some(g=>Math.abs(i-g)<1);
    if(gate)continue;
    b.add(1600+Math.cos(a)*900-70,1600+Math.sin(a)*900-70,140,140,R.range(150,260)|0,'membrane');
  }
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2+Math.PI/4;b.add(1600+Math.cos(a)*430-45,1600+Math.sin(a)*430-45,90,90,320,'fleshpillar');}
  b.scatter(36,()=>{const s=R.range(40,100);return{x:R.range(80,3100),y:R.range(80,3100),w:s,h:s,ht:R.range(150,320)|0,k:'fleshpillar'};},1600,1600,1050,110);
  b.scatter(30,()=>({x:R.range(80,3100),y:R.range(80,3100),w:44,h:44,ht:44,k:'pod'}),1600,1600,1000,60);
  b.scatter(12,()=>({x:R.range(1250,1950),y:R.range(1250,1950),w:40,h:40,ht:40,k:'pod'}),1600,1600,180,60);
  return Object.assign(b,{pSpawn:{x:1600,y:1600}});
}

const GEN={city,military,lab,graveyard,mall,desert,arctic,subway,hospital,forest,docks,prison,volcano,hive};
const cache={};
function buildMap(id){
  if(cache[id])return cache[id];
  const g=GEN[id]||city;const m=g();
  const out={id,B:m.B,walls:m.walls,decor:m.decor,hazards:m.hazards,pSpawn:m.pSpawn,campfire:m.campfire||null};
  cache[id]=out;return out;
}

global.DZMaps={buildMap,rng};
})(window);
