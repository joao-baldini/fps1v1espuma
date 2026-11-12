// Shared, texture-free character parts. Menu portraits and match actors use this same geometry.
(() => {
  'use strict';
  const styles = {
    finder: { role:'Reconhecimento', line:'Um passo à frente. Dois olhos a mais.', cloth:0x315b68, pants:0x263b48, plate:0x1e3542, accent:0x68d6d4, skin:0xd8ad88, hair:0x27333a, detail:0xc1c7ad },
    doctor: { role:'Suporte', line:'Ninguém fica para trás.', cloth:0xd6d9cc, pants:0x344e47, plate:0x8bad94, accent:0x82c79b, skin:0xb5805d, hair:0x34302d, detail:0xe8e3d2 },
    ghost: { role:'Infiltração', line:'Chegue antes do som.', cloth:0x424457, pants:0x2c3040, plate:0x292e3b, accent:0xa89bc7, skin:0xd5b9a0, hair:0x272c36, detail:0x777b91 },
    brutus: { role:'Linha de frente', line:'Pode deixar a entrada comigo.', cloth:0x625e48, pants:0x3a403a, plate:0x373f42, accent:0xd4b75c, skin:0xb88560, hair:0x493b30, detail:0xc3c4ad },
    detector: { role:'Controle', line:'Quem passa deixa sinal.', cloth:0x996047, pants:0x3f4b4a, plate:0x374b4d, accent:0xe0a165, skin:0xdfb18a, hair:0x4b3930, detail:0xc5bc9c },
  };
  const box=(x,y,z,w,h,d,c)=>[[x-w/2,y-h/2,z-d/2],[x+w/2,y+h/2,z+d/2],c];
  // Eight-sided corners keep the block silhouette, without perfectly square faces everywhere.
  function bevel(x,y,z,w,h,d,c,cut=.025){
    cut=Math.min(cut,w*.22,d*.22);const ring=[[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]],vertices=[],indices=[];
    for(const yy of [-h/2,h/2])for(const [xx,zz]of ring)vertices.push(x+xx,y+yy,z+zz);
    for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(i,j,8+j,i,8+j,8+i);}
    for(let i=1;i<7;i++)indices.push(0,i+1,i,8,8+i,8+i+1);
    for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    return [[x-w/2,y-h/2,z-d/2],[x+w/2,y+h/2,z+d/2],c,{vertices,indices}];
  }
  function limb(a,b,width,c){
    const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),n=d.map(v=>v/length),ref=Math.abs(n[1])>.95?[1,0,0]:[0,1,0];
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],u=cross(n,ref),ul=Math.hypot(...u),v=cross(n,u.map(x=>x/ul)),vertices=[];
    for(const p of [a,b])for(const [sx,sy]of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push(...p.map((x,i)=>x+(u[i]/ul*sx+v[i]*sy)*width/2));
    const indices=[0,2,1,0,3,2,4,5,6,4,6,7];for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(i,j,4+j,i,4+j,4+i);}
    return [[0,0,0],[0,0,0],c,{vertices,indices}];
  }
  const cache=new Map();
  function parts(id){
    if(cache.has(id))return cache.get(id);const s=styles[id];if(!s)throw Error('Unknown agent: '+id);
    const legs=[bevel(0,.79,.005,.4,.14,.27,s.pants)],body=[],head=[],boot=0x252d31,eyes=0x232c32;
    for(const side of [-1,1]){
      legs.push(bevel(side*.115,.43,0,.19,.7,.235,s.pants),bevel(side*.12,.115,-.035,.205,.23,.31,boot),box(side*.12,.025,-.04,.21,.05,.32,0x171f25));
      legs.push(bevel(side*.115,.445,-.128,.125,.16,.04,s.plate));
    }
    body.push(bevel(0,1.15,0,.46,.65,.29,s.cloth),bevel(0,1.285,-.162,.365,.36,.055,s.plate),box(0,.845,0,.47,.065,.3,boot),box(.01,.846,-.166,.082,.055,.025,s.detail));
    for(const side of [-1,1]){
      body.push(box(side*.145,1.15,-.204,.072,.12,.055,s.detail),box(side*.19,1.385,-.163,.038,.18,.03,s.accent));
    }
    body.push(bevel(0,1.51,0,.165,.11,.16,s.skin),bevel(0,1.438,-.015,.245,.07,.24,s.cloth));
    // A relaxed two-handed grip; the weapon keeps the game's existing third-person muzzle position.
    body.push(limb([.235,1.4,0],[.325,1.135,-.015],.145,s.cloth),limb([.325,1.135,-.015],[.18,1.195,-.095],.128,s.cloth));
    body.push(limb([-.235,1.4,0],[-.29,1.145,-.19],.145,s.cloth),limb([-.29,1.145,-.19],[.1,1.25,-.405],.12,s.cloth));
    body.push(bevel(.175,1.195,-.105,.115,.12,.12,s.skin),bevel(.1,1.25,-.415,.115,.11,.125,s.skin),box(.175,1.2,-.101,.12,.07,.13,s.plate));
    head.push(bevel(0,1.64,-.012,.277,.274,.255,s.skin,.042),bevel(0,1.515,-.032,.205,.06,.19,s.skin,.025));
    head.push(box(-.15,1.638,-.005,.035,.072,.06,s.skin),box(.15,1.638,-.005,.035,.072,.06,s.skin));
    head.push(bevel(0,1.623,-.149,.035,.05,.038,s.skin,.006));
    for(const side of [-1,1]){
      head.push(box(side*.063,1.662,-.143,.038,.024,.008,eyes),box(side*.057,1.666,-.149,.01,.01,.004,0xe8e5d9));
      head.push(box(side*.062,1.704,-.14,.058,.016,.009,s.hair));
    }
    head.push(box(0,1.562,-.146,.064,.012,.006,0x825b4a));
    if(id==='finder'){
      head.push(bevel(0,1.782,.005,.298,.105,.27,s.hair),bevel(-.062,1.735,-.11,.15,.075,.1,s.hair),box(.108,1.735,-.025,.045,.12,.23,s.hair));
      head.push(bevel(0,1.665,-.158,.254,.06,.035,0x23474f),box(-.025,1.676,-.179,.17,.012,.008,s.accent));
      for(const side of [-1,1])head.push(bevel(side*.162,1.659,.004,.055,.093,.085,s.plate),box(side*.194,1.662,.002,.012,.042,.052,s.accent));
      head.push(limb([-.18,1.65,-.01],[-.13,1.575,-.16],.016,s.plate),box(-.12,1.575,-.169,.045,.021,.028,s.plate));
      body.push(bevel(.025,1.245,.19,.29,.36,.11,s.plate),box(.11,1.55,.215,.022,.3,.022,s.plate),box(.11,1.71,.215,.032,.04,.032,s.accent),bevel(-.075,1.32,-.206,.115,.072,.03,s.accent));
    }else if(id==='doctor'){
      head.push(bevel(0,1.77,.015,.3,.08,.27,s.hair),bevel(.098,1.702,.065,.09,.16,.19,s.hair),bevel(-.08,1.751,-.113,.165,.085,.075,s.hair),bevel(.025,1.775,.168,.145,.15,.12,s.hair));
      head.push(box(.025,1.776,.121,.14,.034,.028,s.accent),box(0,1.737,-.14,.18,.036,.016,s.detail));
      body.push(box(0,1.21,-.198,.042,.17,.018,s.accent),box(0,1.21,-.201,.13,.04,.018,s.accent));
      body.push(bevel(0,1.16,.215,.31,.34,.16,s.detail),box(0,1.17,.303,.035,.14,.014,s.accent),box(0,1.17,.305,.12,.035,.014,s.accent));
      body.push(bevel(-.263,1.364,-.02,.06,.095,.1,s.accent),box(.215,.97,-.07,.073,.17,.14,s.detail),box(.215,1.035,-.144,.063,.025,.025,s.accent));
    }else if(id==='ghost'){
      head.push(bevel(0,1.79,.012,.335,.09,.31,s.plate),bevel(0,1.661,.125,.323,.22,.08,s.plate));
      for(const side of [-1,1])head.push(bevel(side*.147,1.68,-.01,.06,.235,.29,s.cloth));
      head.push(bevel(0,1.573,-.144,.26,.112,.045,s.cloth),box(0,1.603,-.171,.19,.018,.01,s.accent),box(.055,1.555,-.17,.03,.035,.008,s.detail));
      body.push(bevel(0,1.405,.155,.42,.14,.11,s.cloth),box(-.084,1.36,-.2,.025,.13,.024,s.accent),box(-.123,1.36,-.2,.025,.13,.024,s.accent),bevel(.25,1.4,.013,.08,.1,.24,s.cloth));
      legs.push(box(.218,.64,.025,.06,.19,.14,s.plate),box(.218,.74,.025,.063,.03,.15,s.accent));
    }else if(id==='brutus'){
      head.push(bevel(0,1.786,.014,.29,.075,.265,s.hair),box(0,1.728,-.139,.29,.04,.027,s.accent),bevel(0,1.535,-.076,.235,.083,.17,s.hair));
      head.push(box(0,1.57,-.171,.095,.013,.01,s.detail),box(-.075,1.718,-.151,.065,.021,.014,s.hair),box(.075,1.718,-.151,.065,.021,.014,s.hair));
      for(const side of [-1,1])body.push(bevel(side*.266,1.421,.01,.18,.145,.33,s.accent),bevel(side*.262,1.36,.012,.18,.043,.335,s.plate));
      body.push(bevel(0,1.212,-.199,.39,.39,.068,s.plate),box(0,1.299,-.239,.2,.035,.022,s.accent),box(0,1.25,-.239,.12,.026,.022,s.accent),bevel(0,1.17,.19,.37,.35,.12,s.plate));
      legs.push(bevel(-.115,.442,-.142,.16,.19,.05,s.plate),bevel(.115,.442,-.142,.16,.19,.05,s.plate));
    }else if(id==='detector'){
      head.push(bevel(0,1.785,.012,.305,.09,.285,s.accent),box(0,1.742,-.006,.312,.045,.288,s.cloth));
      for(const side of [-1,1])head.push(bevel(side*.066,1.76,-.15,.1,.065,.038,s.plate),box(side*.066,1.764,-.173,.071,.035,.012,0x8dbab6));
      head.push(box(0,1.76,-.164,.035,.02,.02,s.plate),box(0,1.573,-.153,.09,.019,.012,s.hair));
      body.push(bevel(0,1.19,.233,.31,.37,.17,s.plate),bevel(0,1.373,.24,.28,.055,.17,s.accent),box(-.075,1.19,.329,.055,.14,.023,s.accent),box(.075,1.19,.329,.055,.14,.023,s.accent));
      body.push(box(.135,1.46,.245,.018,.2,.018,s.plate),box(.135,1.565,.245,.032,.035,.032,0xc57155),bevel(-.08,1.335,-.213,.13,.065,.04,s.accent),box(.255,1.12,-.01,.07,.18,.13,s.plate));
    }
    const result={legs,body,head};cache.set(id,result);return result;
  }
  globalThis.AgentModels={styles,parts};
})();
