// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Multiplayer (peer-to-peer over WebRTC)
//  Uses PeerJS and its free public broker only to introduce
//  the players; game data then flows directly browser to
//  browser. The host's browser runs the world; friends join
//  with the invite link (…zombie_fps.html?join=CODE) or by
//  typing the room code.
// ═══════════════════════════════════════════════════════
const PEERJS_URL='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const ROOM_PREFIX='deadzone2-';
const MAX_PLAYERS=4;

const Net={
  role:'solo',peer:null,myId:'H',code:'',conns:new Map(),host:null,roster:[],nextPid:2,
  loadLib(){
    if(window.Peer)return Promise.resolve();
    return new Promise((res,rej)=>{
      const s=document.createElement('script');s.src=PEERJS_URL;s.onload=()=>res();
      s.onerror=()=>rej(new Error('Could not load the multiplayer library. Check your internet connection.'));
      document.head.appendChild(s);
    });
  },
  opts(){return{debug:1,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}};},
  _open(id){
    return new Promise((res,rej)=>{
      const p=id?new Peer(id,this.opts()):new Peer(this.opts());let done=false;
      const t=setTimeout(()=>{if(!done){done=true;try{p.destroy();}catch(e){}rej(new Error('Timed out reaching the matchmaking server.'));}},12000);
      p.on('open',()=>{if(done)return;done=true;clearTimeout(t);this.peer=p;res(p);});
      p.on('error',e=>{if(!done){done=true;clearTimeout(t);try{p.destroy();}catch(_){}rej(e);}else onNetError(e);});
      p.on('disconnected',()=>{if(this.peer===p&&!p.destroyed)try{p.reconnect();}catch(e){}});
    });
  },
  async host(){
    await this.loadLib();this.leave();
    let last;
    for(let i=0;i<4;i++){
      const code=makeRoomCode();
      try{await this._open(ROOM_PREFIX+code);this.code=code;last=null;break;}
      catch(e){last=e;if(e.type!=='unavailable-id')break;}
    }
    if(last)throw last;
    this.role='host';this.myId='H';this.nextPid=2;
    this.roster=[{pid:'H',name:CFG.name,color:PLAYER_COLORS[0]}];
    this.peer.on('connection',c=>this._accept(c));
  },
  _accept(conn){
    conn.on('data',d=>{
      if(!d||typeof d!=='object')return;
      if(d.t==='hello'){
        if(this.roster.length>=MAX_PLAYERS){conn.send({t:'reject',why:'That game is full (4 players max).'});setTimeout(()=>conn.close(),300);return;}
        if(d.v!==VERSION){conn.send({t:'reject',why:'Version mismatch: update both copies of the game.'});setTimeout(()=>conn.close(),300);return;}
        const pid='P'+(this.nextPid++);conn.pid=pid;this.conns.set(pid,conn);
        const used=new Set(this.roster.map(r=>r.color));
        const color=PLAYER_COLORS.find(c=>!used.has(c))||'#ffffff';
        const name=String(d.name||'Survivor').slice(0,16);
        this.roster.push({pid,name,color});
        onNetJoin(pid,name,color);
        return;
      }
      if(conn.pid)onNetMsg(conn.pid,d);
    });
    conn.on('close',()=>this._drop(conn));
    conn.on('error',()=>this._drop(conn));
  },
  _drop(conn){
    if(!conn.pid||!this.conns.has(conn.pid)&&!this.roster.some(r=>r.pid===conn.pid))return;
    this.conns.delete(conn.pid);this.roster=this.roster.filter(r=>r.pid!==conn.pid);
    onNetLeave(conn.pid);
  },
  async join(input){
    const code=parseRoomCode(input);
    if(!code)throw new Error('Paste the invite link or the 6-letter room code.');
    await this.loadLib();this.leave();
    await this._open(null);
    return new Promise((res,rej)=>{
      let done=false;
      const fail=msg=>{if(done)return;done=true;clearTimeout(t);this.leave();rej(new Error(msg));};
      const t=setTimeout(()=>fail('Could not reach that game. Check the code and make sure the host is still in their lobby.'),15000);
      this.peer.on('error',e=>{if(e.type==='peer-unavailable')fail('No game found with code '+code+'.');});
      const conn=this.peer.connect(ROOM_PREFIX+code,{reliable:true});
      conn.on('open',()=>conn.send({t:'hello',name:CFG.name,v:VERSION}));
      conn.on('data',d=>{
        if(!d||typeof d!=='object')return;
        if(!done){
          if(d.t==='reject'){fail(d.why||'The host refused the connection.');return;}
          if(d.t==='welcome'){done=true;clearTimeout(t);this.role='client';this.myId=d.pid;this.host=conn;this.code=code;this.roster=d.roster||[];res(d);}
        }
        onNetMsg('H',d);
      });
      conn.on('close',()=>{if(this.role==='client'&&this.host===conn)onNetLeave('H');});
    });
  },
  send(m){if(this.host&&this.host.open)try{this.host.send(m);}catch(e){}},
  sendTo(pid,m){const c=this.conns.get(pid);if(c&&c.open)try{c.send(m);}catch(e){}},
  broadcast(m,except){for(const[pid,c]of this.conns)if(pid!==except&&c.open)try{c.send(m);}catch(e){}},
  leave(){
    try{for(const c of this.conns.values())c.close();if(this.host)this.host.close();if(this.peer)this.peer.destroy();}catch(e){}
    this.peer=null;this.conns.clear();this.host=null;this.role='solo';this.myId='H';this.roster=[];this.code='';
  },
  link(){return location.href.split('#')[0].split('?')[0]+'?join='+this.code;},
};
function makeRoomCode(){const a='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}
function parseRoomCode(v){
  v=String(v||'').trim();const m=v.match(/[?&]join=([A-Za-z0-9]+)/);if(m)v=m[1];
  v=v.replace(/^deadzone2-/i,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  return v.length===6?v:null;
}
