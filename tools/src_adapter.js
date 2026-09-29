/* ---------- Base de données (Supabase + fichiers du dépôt) ---------- */
const CFG=window.GEOPROMPT_CONFIG||{};
const FILE_COLS=["prompts","veille","marche","meta"];
const USER_COLS=["projets","taches","agenda","prospects","mails","bp","besoins","risques","ao","factures","portfolio","usages","reglages"];
let SB=null,USER=null,ROWS={},BASE=null,DAILY=[];
function fmtErr(e){return (e&&(e.message||e.code))||"erreur"}

async function put(col,id,data){
  if(col==="prompts")return savePref(id,data);
  if(!USER){toast("Connectez-vous d'abord");return}
  (ROWS[col]=ROWS[col]||{})[id]=data;rebuild();
  const {error}=await SB.from("docs").upsert({user_id:USER.id,col,id,data,updated_at:new Date().toISOString()});
  if(error)toast("Enregistrement impossible ("+fmtErr(error)+")");
}
async function patch(col,id,data){
  if(col==="prompts")return savePref(id,data);
  const cur=(ROWS[col]||{})[id]||{};return put(col,id,{...cur,...data});
}
async function remove(col,id){
  if(!USER)return;if(ROWS[col])delete ROWS[col][id];rebuild();
  const {error}=await SB.from("docs").delete().match({user_id:USER.id,col,id});
  if(error)toast("Suppression impossible ("+fmtErr(error)+")");
}
async function savePref(id,data){
  const cur=(ROWS.prefs||{})[id]||{};const next={...cur};
  if("favori" in data)next.favori=data.favori;if("note" in data)next.note=data.note;
  (ROWS.prefs=ROWS.prefs||{})[id]=next;rebuild();
  if(!USER)return;const {error}=await SB.from("docs").upsert({user_id:USER.id,col:"prefs",id,data:next,updated_at:new Date().toISOString()});
  if(error)toast("Enregistrement impossible");
}
function clean(o){const r={...o};delete r.id;return r}
let renderTimer=null;
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,60)}

/* Reconstruit S.data à partir des fichiers du dépôt et des données personnelles */
function rebuild(){
  const prefs=ROWS.prefs||{};
  const pm=new Map();[...(BASE?.prompts||[]),...DAILY.flatMap(d=>d.prompts||[])].forEach(p=>pm.set(p.id,p));   // une révision remplace la version précédente
  const allPrompts=[...pm.values()];
  S.data.prompts=allPrompts.map(p=>({...p,...(prefs[p.id]||{})}));
  S.data.veille=[...(BASE?.veille||[]),...DAILY.flatMap(d=>d.veille||[])];
  const marche={...Object.fromEntries((BASE?.marche||[]).map(m=>[m.id,m]))};
  DAILY.forEach(d=>(d.marche||[]).forEach(m=>{marche[m.id]=m}));
  S.data.marche=Object.values(marche);
  const lastD=DAILY[DAILY.length-1];
  S.data.meta=[lastD&&lastD.resume?{id:"etat",resume:lastD.resume,derniereVeille:lastD.derniereVeille}:(BASE?.meta||[])[0]].filter(Boolean);
  USER_COLS.forEach(c=>{S.data[c]=Object.entries(ROWS[c]||{}).map(([id,d])=>({id,...d}))});
  scheduleRender();
}

async function loadFiles(){
  const get=async u=>{const r=await fetch(u,{cache:"no-cache"});if(!r.ok)throw new Error(u);return r.json()};
  BASE=await get("data/base.json");
  let idx={dates:[]};try{idx=await get("data/index.json")}catch(e){}
  const dates=[...(idx.dates||[])].sort();
  DAILY=(await Promise.all(dates.map(d=>get("data/daily/"+d+".json").catch(()=>null)))).filter(Boolean);
}
async function loadRows(){
  const out={};let from=0;
  for(;;){const {data,error}=await SB.from("docs").select("col,id,data").range(from,from+999);
    if(error){toast("Lecture impossible ("+fmtErr(error)+")");break}
    data.forEach(r=>{(out[r.col]=out[r.col]||{})[r.id]=r.data});if(data.length<1000)break;from+=1000}
  ROWS=out;
}
/* Importe une seule fois les éléments de départ et ceux apportés par la veille */
async function syncSeeds(){
  const sys=(ROWS.sys||{}).imported||{ids:[],emails:[]};const done=new Set(sys.ids);const doneMail=new Set(sys.emails||[]);
  const ups=[];
  const offer=(col,item)=>{const key=col+"/"+item.id;if(done.has(key))return;done.add(key);if((ROWS[col]||{})[item.id])return;
    const d=clean(item);(ROWS[col]=ROWS[col]||{})[item.id]=d;ups.push({user_id:USER.id,col,id:item.id,data:d})};
  const isOwner=CFG.ownerEmail&&USER.email&&USER.email.toLowerCase()===CFG.ownerEmail.toLowerCase();
  ["prospects","besoins","risques","projets","taches","agenda",...(isOwner?["portfolio"]:[])].forEach(c=>(BASE?.[c]||[]).forEach(x=>offer(c,x)));
  DAILY.forEach(d=>{(d.besoins||[]).forEach(x=>offer("besoins",x));(d.ao||[]).forEach(x=>offer("ao",x));(d.prospects||[]).forEach(x=>offer("prospects",x));
    (d.emails||[]).forEach(m=>{const k=m.id+"|"+m.email;if(doneMail.has(k))return;doneMail.add(k);const p=(ROWS.prospects||{})[m.id];
      if(p&&!p.email){const d2={...p,email:m.email,emailSource:m.emailSource||""};ROWS.prospects[m.id]=d2;ups.push({user_id:USER.id,col:"prospects",id:m.id,data:d2})}})});
  if(!ups.length&&done.size===sys.ids.length)return;
  const imp={ids:[...done],emails:[...doneMail]};(ROWS.sys=ROWS.sys||{}).imported=imp;
  ups.push({user_id:USER.id,col:"sys",id:"imported",data:imp});
  for(let i=0;i<ups.length;i+=200){const {error}=await SB.from("docs").upsert(ups.slice(i,i+200));if(error){toast("Import impossible ("+fmtErr(error)+")");return}}
}
async function loadAll(){
  try{await loadFiles()}catch(e){toast("Contenu du jour indisponible hors connexion")}
  await loadRows();await syncSeeds();S.loaded=true;rebuild();
}

/* Connexion : prénom, nom, email, mot de passe (Supabase), ou Google */
function showLogin(msg,bad){
  const L=$("#login");if(!L.dataset.ready){L.innerHTML=authMarkup();L.dataset.ready="1";document.getElementById("auth-form").addEventListener("submit",supaAuthSubmit);
    let known=false;try{known=localStorage.getItem("gm-account")==="1"}catch(e){}setAuthMode(known?"signin":"signup")}
  L.hidden=false;$("#app").hidden=true;if(msg)authMsg(msg,bad);
}
const allowed=email=>{const a=(CFG.allowedEmails||[]).map(x=>x.toLowerCase());return !a.length||a.includes(email)};
async function supaAuthSubmit(e){
  e.preventDefault();const v=authValues(),m=S.authMode,here=location.origin+location.pathname;
  if(["signup","signin","reset-req"].includes(m)&&!emailOK(v.email)){authMsg("Adresse email invalide.",true);return}
  if(["signup","signin"].includes(m)&&!allowed(v.email)){authMsg("Cette adresse n'est pas autorisée sur cet espace.",true);return}
  if(m==="signup"){
    const err=checkNew(v,true);if(err){authMsg(err,true);return}
    authMsg("Création du compte…");
    const {data,error}=await SB.auth.signUp({email:v.email,password:v.pass,options:{data:{first_name:v.prenom,last_name:v.nom},emailRedirectTo:here}});
    if(error){authMsg(/registered|exists/i.test(error.message)?"Un compte existe déjà avec cet email : connectez-vous.":"Création impossible : "+fmtErr(error),true);return}
    try{localStorage.setItem("gm-account","1")}catch(x){}
    if(data.session){USER=data.user;S.userEmail=USER.email;start();return}
    setAuthMode("signin");document.getElementById("au-email").value=v.email;
    authMsg("Compte créé. Ouvrez l'email de confirmation que nous venons de vous envoyer, puis connectez-vous ici.");return;
  }
  if(m==="signin"){
    if(!v.pass){authMsg("Saisissez votre mot de passe.",true);return}
    authMsg("Connexion…");
    const {data,error}=await SB.auth.signInWithPassword({email:v.email,password:v.pass});
    if(error){authMsg(/confirm/i.test(error.message)?"Confirmez d'abord votre adresse avec l'email reçu.":"Email ou mot de passe incorrect.",true);return}
    try{localStorage.setItem("gm-account","1")}catch(x){}
    USER=data.user;S.userEmail=USER.email;start();return;
  }
  if(m==="reset-req"){
    const {error}=await SB.auth.resetPasswordForEmail(v.email,{redirectTo:here});
    authMsg(error?"Envoi impossible : "+fmtErr(error):"Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",!!error);return;
  }
  if(m==="reset-new"){
    const err=checkNew(v,false);if(err){authMsg(err,true);return}
    const {data,error}=await SB.auth.updateUser({password:v.pass});
    if(error){authMsg("Modification impossible : "+fmtErr(error),true);return}
    USER=data.user;S.userEmail=USER.email;toast("Mot de passe modifié");start();
  }
}
document.addEventListener("click",async e=>{if(!e.target.closest("[data-google]"))return;
  const {error}=await SB.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
  if(error)authMsg("Connexion Google impossible : "+fmtErr(error)+". Utilisez votre email et votre mot de passe.",true)});
async function logout(){await SB.auth.signOut();try{sessionStorage.removeItem("gm-splash")}catch(e){}location.reload()}

async function boot(){
  renderTabs();
  if(!window.supabase||!CFG.supabaseUrl){showLogin("Configuration manquante : renseignez config.js (voir README).",true);return}
  SB=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,detectSessionInUrl:true}});
  SB.auth.onAuthStateChange((ev,s)=>{
    if(ev==="PASSWORD_RECOVERY"){showLogin();setAuthMode("reset-new");return}
    if(s&&!USER&&ev!=="PASSWORD_RECOVERY"){USER=s.user;S.userEmail=USER.email;start()}
  });
  const {data:{session}}=await SB.auth.getSession();
  if(!session){showLogin();return}
  if(/type=recovery/.test(location.hash))return;
  USER=session.user;S.userEmail=USER.email;start();
}
async function start(){
  if(S.started)return;S.started=true;
  $("#login").hidden=true;$("#app").hidden=false;render();
  await loadAll();
  if(!profil().nom){const md=USER.user_metadata||{};const nom=[md.first_name,md.last_name].filter(Boolean).join(" ")||md.full_name||md.name||"";
    await put("reglages","profil",{...clean(profil()),nom,email:USER.email,onboarded:true})}
  handleHashAdd();
  document.addEventListener("visibilitychange",async()=>{if(document.visibilityState==="visible"&&USER){await loadRows();rebuild()}});
}
/* Raccourci Siri : #ajout=texte dicté */
function handleHashAdd(){
  const m=(location.hash||"").match(/^#ajout=(.+)$/);if(!m)return;
  let txt="";try{txt=decodeURIComponent(m[1].replace(/\+/g," "))}catch(e){txt=m[1]}
  history.replaceState(null,"",location.pathname+"#aujourdhui");S.tab="aujourdhui";renderTabs();render();
  openAdd(txt);setTimeout(()=>$("#quick-form").requestSubmit(),50);
}
