const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.RENDER ? '/tmp/school-data' : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, key) => e ? reject(e) : resolve(`${salt}:${key.toString('hex')}`)));
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return Promise.resolve(false);
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, key) => {
    if (e) return reject(e);
    const a = Buffer.from(hash, 'hex'), b = key;
    resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
  }));
}
function id(prefix='id') { return prefix + '_' + crypto.randomBytes(6).toString('hex'); }
function readData() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return null; } }
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

let db = readData();
const sessions = new Map();

async function init() {
  if (db) return;
  db = {
    users: [],
    grades: [],
    announcements: [
      { id: id('ann'), title: 'به سامانه مدرسه خوش آمدید', body: 'اطلاعیه‌ها و اخبار مهم مدرسه را از این بخش دنبال کنید.', date: new Date().toISOString(), active: true }
    ]
  };
  db.users.push({ id: id('usr'), username: 'admin', password: await hashPassword('Admin@12345'), role: 'admin', name: 'مدیر مدرسه', studentId: null });
  db.users.push({ id: id('usr'), username: 'student1', password: await hashPassword('Student@12345'), role: 'student', name: 'دانش‌آموز نمونه', studentId: 'S001' });
  db.grades.push({ id: id('gr'), studentId: 'S001', subject: 'ریاضی', score: 19, term: 'نوبت اول' });
  db.grades.push({ id: id('gr'), studentId: 'S001', subject: 'علوم', score: 18.5, term: 'نوبت اول' });
  saveData();
}

function esc(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function parseCookies(req) { const out={}; (req.headers.cookie||'').split(';').forEach(x=>{const i=x.indexOf('=');if(i>0)out[x.slice(0,i).trim()]=decodeURIComponent(x.slice(i+1));});return out; }
function userFromReq(req) { const sid=parseCookies(req).school_sid; return sid ? sessions.get(sid) : null; }
function send(res, status, body, type='text/html; charset=utf-8', headers={}) { res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store', ...headers}); res.end(body); }
function redirect(res, location) { res.writeHead(302,{Location:location,'Cache-Control':'no-store'});res.end(); }
function body(req) { return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{resolve(Object.fromEntries(new URLSearchParams(s)))}});req.on('error',reject);}); }

const css = `
*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f4f8ff;color:#132238;direction:rtl}a{text-decoration:none;color:inherit}.top{background:linear-gradient(135deg,#0757c8,#0b8cff);color:white}.nav{max-width:1180px;margin:auto;padding:18px 22px;display:flex;align-items:center;justify-content:space-between}.brand{font-size:22px;font-weight:800}.navlinks{display:flex;gap:10px;align-items:center}.btn{display:inline-block;border:0;border-radius:12px;padding:11px 17px;background:#0b73e0;color:white;font-weight:700;cursor:pointer}.btn.light{background:white;color:#0757c8}.btn.red{background:#e53935}.btn.gray{background:#e8eef7;color:#26364b}.hero{max-width:1180px;margin:auto;padding:70px 22px 90px;display:grid;grid-template-columns:1.3fr .7fr;gap:35px;align-items:center}.hero h1{font-size:48px;margin:0 0 18px}.hero p{font-size:18px;line-height:2;color:#dcecff}.hero-card{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);padding:28px;border-radius:24px;backdrop-filter:blur(8px)}.container{max-width:1180px;margin:auto;padding:35px 22px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{background:white;border:1px solid #e3ebf7;border-radius:20px;padding:22px;box-shadow:0 8px 25px rgba(18,65,120,.06)}.card h3{margin-top:0}.announcement{border-right:4px solid #0b73e0;margin:14px 0;padding:14px;background:#f8fbff;border-radius:12px}.muted{color:#6c7b91}.login-wrap{min-height:100vh;display:grid;place-items:center;padding:25px;background:linear-gradient(135deg,#eef7ff,#f8fbff)}.login{width:min(440px,100%);background:#fff;padding:34px;border-radius:24px;box-shadow:0 20px 55px rgba(15,68,130,.12)}.login h1{text-align:center}.field{margin:15px 0}.field label{display:block;margin-bottom:7px;font-weight:700}.field input,.field select{width:100%;padding:13px;border:1px solid #d6e0ed;border-radius:11px;font-size:15px;outline:none}.field input:focus,.field select:focus{border-color:#0b73e0}.dash-head{background:linear-gradient(135deg,#0757c8,#0b8cff);color:white}.dash-head .nav{padding-bottom:35px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:-15px}.stat{background:white;border-radius:18px;padding:22px;box-shadow:0 8px 25px rgba(18,65,120,.08)}.stat b{font-size:28px;color:#0757c8;display:block;margin-top:8px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:right;padding:13px;border-bottom:1px solid #e7edf5;white-space:nowrap}th{background:#f3f7fc}.section{margin-top:28px}.form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:end}.actions{display:flex;gap:7px;flex-wrap:wrap}.notice{padding:12px 15px;border-radius:12px;background:#edf7ff;color:#0757c8;margin-bottom:15px}.danger{background:#fff0f0;color:#b42318}.footer{text-align:center;padding:35px;color:#738198}.pill{display:inline-block;padding:5px 10px;border-radius:30px;background:#eaf4ff;color:#0757c8;font-size:12px;font-weight:700}@media(max-width:800px){.hero{grid-template-columns:1fr;padding-top:45px}.hero h1{font-size:35px}.grid,.stats{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.grid,.stats,.form-grid{grid-template-columns:1fr}.navlinks .hide-m{display:none}.hero h1{font-size:30px}}
`;

function layout(title, content, user=null) { return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | مدرسه نوین</title><style>${css}</style></head><body>${content}<div class="footer">سامانه مدیریت مدرسه • طراحی مدرن آبی و سفید</div></body></html>`; }
function publicPage() {
  const anns=db.announcements.filter(a=>a.active).sort((a,b)=>b.date.localeCompare(a.date));
  return layout('صفحه اصلی',`<div class="top"><div class="nav"><div class="brand">🎓 مدرسه نوین</div><div class="navlinks"><a class="btn light" href="/login">ورود به پنل</a></div></div><div class="hero"><div><div class="pill">سامانه آموزشی هوشمند</div><h1>مدرسه، جایی برای رشد و موفقیت</h1><p>اطلاعیه‌ها، امکانات آموزشی، نمرات و خدمات مدرسه در یک سامانه سریع و زیبا.</p><a class="btn light" href="/login">ورود به پنل کاربری</a></div><div class="hero-card"><h2>تابلو تبلیغات</h2><p>📚 ثبت و مشاهده نمرات</p><p>📢 اطلاعیه‌های مدرسه</p><p>👥 مدیریت دانش‌آموزان</p><p>🏆 امتیاز و عملکرد آموزشی</p></div></div></div><main class="container"><h2>آخرین اطلاعیه‌ها</h2>${anns.length?anns.map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p><small class="muted">${new Date(a.date).toLocaleDateString('fa-IR')}</small></div>`).join(''):'<div class="card">اطلاعیه‌ای ثبت نشده است.</div>'}<div class="grid section"><div class="card"><h3>🎓 پنل دانش‌آموز</h3><p class="muted">مشاهده نمرات، میانگین و اطلاعیه‌های مدرسه.</p></div><div class="card"><h3>🛠 پنل مدیر</h3><p class="muted">مدیریت کاربران، نمرات و اطلاعیه‌ها.</p></div><div class="card"><h3>🔐 دسترسی امن</h3><p class="muted">ورود جداگانه با سطح دسترسی متفاوت.</p></div></div></main>`);
}
function loginPage(error='') { return layout('ورود',`<div class="login-wrap"><div class="login"><h1>🎓 ورود به سامانه</h1><p class="muted" style="text-align:center">حساب مدیر یا دانش‌آموز خود را وارد کنید.</p>${error?`<div class="notice danger">${esc(error)}</div>`:''}<form method="post" action="/login"><div class="field"><label>نام کاربری</label><input name="username" required autocomplete="username"></div><div class="field"><label>رمز عبور</label><input type="password" name="password" required autocomplete="current-password"></div><button class="btn" style="width:100%">ورود</button></form><p style="text-align:center"><a class="muted" href="/">بازگشت به صفحه اصلی</a></p></div></div>`); }
function adminPage(user) {
 const students=db.users.filter(u=>u.role==='student'); const avg=s=>{const g=db.grades.filter(x=>x.studentId===s.studentId);return g.length?(g.reduce((a,b)=>a+Number(b.score),0)/g.length).toFixed(2):'-'};
 return layout('پنل مدیر',`<div class="dash-head"><div class="nav"><div class="brand">🎓 پنل مدیریت</div><div class="navlinks"><span>${esc(user.name)}</span><form method="post" action="/logout" style="display:inline"><button class="btn light">خروج</button></form></div></div></div><main class="container"><div class="stats"><div class="stat">دانش‌آموزان<b>${students.length}</b></div><div class="stat">نمرات ثبت‌شده<b>${db.grades.length}</b></div><div class="stat">اطلاعیه‌ها<b>${db.announcements.length}</b></div><div class="stat">کاربران<b>${db.users.length}</b></div></div><section class="card section"><h2>افزودن دانش‌آموز</h2><form method="post" action="/admin/users" class="form-grid"><div class="field"><label>نام</label><input name="name" required></div><div class="field"><label>نام کاربری</label><input name="username" required></div><div class="field"><label>رمز عبور</label><input name="password" required></div><div class="field"><label>شناسه دانش‌آموز</label><input name="studentId" required></div><button class="btn">افزودن</button></form></section><section class="card section"><h2>دانش‌آموزان</h2><div class="table-wrap"><table><tr><th>نام</th><th>نام کاربری</th><th>شناسه</th><th>میانگین</th><th>عملیات</th></tr>${students.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.username)}</td><td>${esc(s.studentId)}</td><td>${avg(s)}</td><td><form method="post" action="/admin/users/delete" style="display:inline"><input type="hidden" name="id" value="${esc(s.id)}"><button class="btn red" onclick="return confirm('حذف شود؟')">حذف</button></form></td></tr>`).join('')}</table></div></section><section class="card section"><h2>ثبت نمره</h2><form method="post" action="/admin/grades" class="form-grid"><div class="field"><label>دانش‌آموز</label><select name="studentId" required>${students.map(s=>`<option value="${esc(s.studentId)}">${esc(s.name)} (${esc(s.studentId)})</option>`).join('')}</select></div><div class="field"><label>درس</label><input name="subject" required></div><div class="field"><label>نمره (۰ تا ۲۰)</label><input name="score" type="number" min="0" max="20" step="0.01" required></div><div class="field"><label>نوبت</label><input name="term" value="نوبت اول" required></div><button class="btn">ثبت نمره</button></form></section><section class="card section"><h2>نمرات</h2><div class="table-wrap"><table><tr><th>دانش‌آموز</th><th>درس</th><th>نمره</th><th>نوبت</th><th></th></tr>${db.grades.map(g=>`<tr><td>${esc((students.find(s=>s.studentId===g.studentId)||{}).name||g.studentId)}</td><td>${esc(g.subject)}</td><td>${esc(g.score)}</td><td>${esc(g.term)}</td><td><form method="post" action="/admin/grades/delete"><input type="hidden" name="id" value="${esc(g.id)}"><button class="btn red">حذف</button></form></td></tr>`).join('')}</table></div></section><section class="card section"><h2>اطلاعیه جدید</h2><form method="post" action="/admin/announcements"><div class="field"><label>عنوان</label><input name="title" required></div><div class="field"><label>متن</label><input name="body" required></div><button class="btn">انتشار اطلاعیه</button></form><h3>اطلاعیه‌های فعلی</h3>${db.announcements.map(a=>`<div class="announcement"><b>${esc(a.title)}</b><p>${esc(a.body)}</p><form method="post" action="/admin/announcements/delete"><input type="hidden" name="id" value="${esc(a.id)}"><button class="btn red">حذف</button></form></div>`).join('')}</section></main>`);
}
function studentPage(user) { const grades=db.grades.filter(g=>g.studentId===user.studentId); const avg=grades.length?(grades.reduce((a,b)=>a+Number(b.score),0)/grades.length).toFixed(2):'-'; const anns=db.announcements.filter(a=>a.active); return layout('پنل دانش‌آموز',`<div class="dash-head"><div class="nav"><div class="brand">🎓 پنل دانش‌آموز</div><div class="navlinks"><span>${esc(user.name)}</span><form method="post" action="/logout" style="display:inline"><button class="btn light">خروج</button></form></div></div></div><main class="container"><div class="stats"><div class="stat">نام<b style="font-size:20px">${esc(user.name)}</b></div><div class="stat">شناسه<b>${esc(user.studentId)}</b></div><div class="stat">تعداد نمرات<b>${grades.length}</b></div><div class="stat">میانگین<b>${avg}</b></div></div><section class="card section"><h2>کارنامه من</h2><div class="table-wrap"><table><tr><th>درس</th><th>نمره</th><th>نوبت</th></tr>${grades.map(g=>`<tr><td>${esc(g.subject)}</td><td>${esc(g.score)}</td><td>${esc(g.term)}</td></tr>`).join('')||'<tr><td colspan="3">هنوز نمره‌ای ثبت نشده است.</td></tr>'}</table></div></section><section class="card section"><h2>اطلاعیه‌های مدرسه</h2>${anns.map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></div>`).join('')||'اطلاعیه‌ای وجود ندارد.'}</section></main>`); }

async function handler(req,res){
 const u=new URL(req.url,`http://${req.headers.host||'localhost'}`), p=u.pathname, method=req.method; const user=userFromReq(req);
 if(method==='GET'&&p==='/') return send(res,200,publicPage());
 if(method==='GET'&&p==='/login') return send(res,200,loginPage());
 if(method==='POST'&&p==='/login'){const b=await body(req), found=db.users.find(x=>x.username===String(b.username||'').trim()); if(found&&await verifyPassword(String(b.password||''),found.password)){const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,{id:found.id,username:found.username,role:found.role,name:found.name,studentId:found.studentId});return redirect(res,found.role==='admin'?'/admin':'/student');}return send(res,401,loginPage('نام کاربری یا رمز عبور اشتباه است.'));}
 if(method==='POST'&&p==='/logout'){const sid=parseCookies(req).school_sid;if(sid)sessions.delete(sid);return redirect(res,'/');}
 if(!user) return redirect(res,'/login');
 if(p==='/admin'&&user.role==='admin'&&method==='GET') return send(res,200,adminPage(user));
 if(p==='/student'&&user.role==='student'&&method==='GET') return send(res,200,studentPage(user));
 if(user.role!=='admin') return send(res,403,layout('دسترسی غیرمجاز','<main class="container"><div class="card"><h2>دسترسی غیرمجاز</h2><a class="btn" href="/student">بازگشت</a></div></main>'));
 if(method==='POST'&&p==='/admin/users'){const b=await body(req);if(db.users.some(x=>x.username===String(b.username)))return send(res,400,layout('خطا','<main class="container"><div class="card"><h2>نام کاربری تکراری است.</h2><a class="btn" href="/admin">بازگشت</a></div></main>'));db.users.push({id:id('usr'),username:String(b.username),password:await hashPassword(String(b.password)),role:'student',name:String(b.name),studentId:String(b.studentId)});saveData();return redirect(res,'/admin');}
 if(method==='POST'&&p==='/admin/users/delete'){const b=await body(req);db.users=db.users.filter(x=>x.id!==String(b.id)||x.role==='admin');saveData();return redirect(res,'/admin');}
 if(method==='POST'&&p==='/admin/grades'){const b=await body(req),score=Number(b.score);if(!Number.isFinite(score)||score<0||score>20)return send(res,400,layout('خطا','<main class="container"><div class="card"><h2>نمره باید بین ۰ تا ۲۰ باشد.</h2><a class="btn" href="/admin">بازگشت</a></div></main>'));db.grades.push({id:id('gr'),studentId:String(b.studentId),subject:String(b.subject),score,term:String(b.term)});saveData();return redirect(res,'/admin');}
 if(method==='POST'&&p==='/admin/grades/delete'){const b=await body(req);db.grades=db.grades.filter(x=>x.id!==String(b.id));saveData();return redirect(res,'/admin');}
 if(method==='POST'&&p==='/admin/announcements'){const b=await body(req);db.announcements.push({id:id('ann'),title:String(b.title),body:String(b.body),date:new Date().toISOString(),active:true});saveData();return redirect(res,'/admin');}
 if(method==='POST'&&p==='/admin/announcements/delete'){const b=await body(req);db.announcements=db.announcements.filter(x=>x.id!==String(b.id));saveData();return redirect(res,'/admin');}
 return send(res,404,layout('یافت نشد','<main class="container"><div class="card"><h2>صفحه پیدا نشد.</h2><a class="btn" href="/">صفحه اصلی</a></div></main>'));
}

init().then(()=>http.createServer((req,res)=>handler(req,res).catch(e=>{console.error(e);send(res,500,'Server error');})).listen(PORT,'0.0.0.0',()=>console.log(`School panel running on port ${PORT}`))).catch(e=>{console.error(e);process.exit(1)});
