import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// إعدادات مشروع Supabase الحالي. المفتاح هنا Publishable فقط، وليس Secret.
const SUPABASE_URL = "https://rtqdcbkttrxbmglzllmv.supabase.co";
const SUPABASE_KEY = "sb_publishable_iqwtKiJMmx9QEO4l1Zo7iQ_kHvZZH0c";
const ADMIN_UID = "1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const loginSection = $("loginSection");
const dashboardSection = $("dashboardSection");
const loginForm = $("loginForm");
const loginButton = $("loginButton");
const loginMessage = $("loginMessage");
const sidebar = $("sidebar");
let orders = [];

function showMessage(message, type = "error") {
  loginMessage.textContent = message;
  loginMessage.className = `form-message ${type}`;
}
function setLoading(loading) {
  loginButton.disabled = loading;
  loginButton.querySelector("span").textContent = loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول";
}
function showLogin() {
  dashboardSection.hidden = true;
  loginSection.hidden = false;
}
function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  const now = new Date();
  $("todayDate").textContent = now.toLocaleDateString("ar-EG", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}
function safe(value) {
  return String(value ?? "—").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function getField(order, keys) {
  for (const key of keys) if (order[key] !== undefined && order[key] !== null && order[key] !== "") return order[key];
  return "—";
}
function getStatus(status) {
  const s = String(status ?? "pending").toLowerCase();
  const map = {
    completed: ["مكتمل","completed"], complete: ["مكتمل","completed"], delivered: ["مكتمل","completed"],
    processing: ["قيد التنفيذ","processing"], pending: ["قيد الانتظار","pending"],
    demo: ["طلب تجريبي","demo"], cancelled: ["ملغي","cancelled"], canceled: ["ملغي","cancelled"],
    failed: ["فشل","cancelled"]
  };
  return map[s] || [safe(status || "قيد الانتظار"), "pending"];
}
function formatDate(value) {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safe(value) : date.toLocaleString("ar-EG", { dateStyle:"medium", timeStyle:"short" });
}
function orderCells(order, includeAction = false) {
  const id = getField(order, ["id","order_id"]);
  const game = getField(order, ["game","game_name"]);
  const pack = getField(order, ["package","package_name"]);
  const player = getField(order, ["player_id","playerId","uid","character_id"]);
  const status = getStatus(order.status);
  const date = formatDate(getField(order, ["created_at","createdAt","date"]));
  return `<td><span class="order-id">#${safe(String(id).slice(0,8))}</span></td>
    <td>${safe(game)}</td><td>${safe(pack)}</td><td>${safe(player)}</td>
    <td><span class="status-pill ${status[1]}">${status[0]}</span></td><td>${date}</td>
    ${includeAction ? `<td><select class="row-action status-select" data-order-id="${safe(id)}" aria-label="تغيير حالة الطلب">
      <option value="">تغيير الحالة</option><option value="pending">قيد الانتظار</option><option value="processing">قيد التنفيذ</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option>
    </select></td>` : ""}`;
}

/* ZARO DASHBOARD ANALYTICS */
let salesTrendChart=null, ordersStatusChart=null, topGamesChart=null;
const chartPalette={orange:"#ff8138",green:"#43d6a0",blue:"#65aaff",purple:"#a78bfa",red:"#ff7373",muted:"#7f8796"};
const isCompletedOrder=o=>["completed","complete","delivered"].includes(String(o.status||"").toLowerCase());
const analyticsDate=o=>{const d=new Date(o.created_at||o.createdAt||o.date);return Number.isNaN(d.getTime())?null:d;};
const moneyEGP=n=>Number(n||0).toLocaleString("ar-EG",{maximumFractionDigits:2})+" ج.م";
function destroyAnalyticsCharts(){
  [salesTrendChart,ordersStatusChart,topGamesChart].forEach(c=>{if(c)c.destroy();});
  salesTrendChart=ordersStatusChart=topGamesChart=null;
}
function renderDashboardAnalytics(){
  if(typeof Chart==="undefined"){$("analyticsNote").textContent="مكتبة الرسوم لم يتم تحميلها. حدّث الصفحة وتأكد من الاتصال بالإنترنت.";return;}
  const range=$("analyticsRange")?.value||"30";
  const now=new Date(); const start=new Date(now); start.setHours(0,0,0,0);
  if(range!=="all") start.setDate(start.getDate()-Number(range)+1);
  const scoped=orders.filter(o=>{const d=analyticsDate(o);return d&&(range==="all"||d>=start)&&d<=now;});
  const completed=scoped.filter(isCompletedOrder);
  const revenue=completed.reduce((sum,o)=>sum+(Number(o.amount)||0),0);
  $("analyticsRevenue").textContent=moneyEGP(revenue);
  $("analyticsCompleted").textContent=completed.length.toLocaleString("ar-EG");
  $("analyticsAverage").textContent=moneyEGP(completed.length?revenue/completed.length:0);
  $("analyticsNote").textContent=scoped.length?"تم تحليل "+scoped.length.toLocaleString("ar-EG")+" طلبًا مسجلًا. قيمة المبيعات محسوبة من الطلبات المكتملة فقط.":"لا توجد طلبات بتاريخ صالح في الفترة المحددة.";
  const days=range==="all"?Math.min(30,Math.max(7,Math.ceil((now-Math.min(...scoped.map(o=>analyticsDate(o).getTime()),now.getTime()))/86400000)+1)):Number(range);
  const labels=[],values=[];
  for(let i=days-1;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);labels.push(d.toLocaleDateString("ar-EG",{day:"numeric",month:"short"}));const key=d.toDateString();values.push(completed.filter(o=>analyticsDate(o)?.toDateString()===key).reduce((sum,o)=>sum+(Number(o.amount)||0),0));}
  const baseOptions={responsive:true,maintainAspectRatio:false,animation:{duration:1100,easing:"easeOutQuart"},plugins:{legend:{labels:{color:"#b8bec9",font:{family:"Cairo",size:10},usePointStyle:true,boxWidth:8}},tooltip:{backgroundColor:"#171a22",titleFont:{family:"Cairo"},bodyFont:{family:"Cairo"},padding:11,cornerRadius:9}}};
  destroyAnalyticsCharts();
  salesTrendChart=new Chart($("salesTrendChart"),{type:"line",data:{labels,datasets:[{label:"المبيعات المكتملة",data:values,borderColor:chartPalette.orange,backgroundColor:"rgba(255,129,56,.14)",fill:true,tension:.38,borderWidth:2.5,pointRadius:2.5,pointHoverRadius:6,pointBackgroundColor:chartPalette.orange}]},options:{...baseOptions,plugins:{...baseOptions.plugins,legend:{display:false}},scales:{x:{ticks:{color:"#858d9b",maxTicksLimit:8,font:{family:"Cairo",size:9}},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#858d9b",font:{family:"Cairo",size:9},callback:v=>Number(v).toLocaleString("ar-EG")},grid:{color:"rgba(255,255,255,.055)"}}}}});
  const counts=[scoped.length,scoped.filter(o=>["pending","processing","demo",null,""].includes(o.status)).length,scoped.filter(o=>["cancelled","canceled","failed"].includes(String(o.status||"").toLowerCase())).length];
  ordersStatusChart=new Chart($("ordersStatusChart"),{type:"doughnut",data:{labels:["مكتمل","قيد الانتظار / التنفيذ","ملغي / فاشل"],datasets:[{data:[completed.length,counts[1],counts[2]],backgroundColor:[chartPalette.green,chartPalette.blue,chartPalette.red],borderColor:"#151820",borderWidth:4,hoverOffset:10}]},options:{...baseOptions,cutout:"70%",plugins:{...baseOptions.plugins,legend:{position:"bottom",labels:{...baseOptions.plugins.legend.labels,padding:15}}}}});
  const gameMap={};scoped.forEach(o=>{const name=String(o.game||o.game_name||"غير محدد");gameMap[name]=(gameMap[name]||0)+1;});
  const top=Object.entries(gameMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  topGamesChart=new Chart($("topGamesChart"),{type:"bar",data:{labels:top.map(x=>x[0]),datasets:[{label:"عدد الطلبات",data:top.map(x=>x[1]),backgroundColor:["#ff8138","#65aaff","#43d6a0","#a78bfa","#ffb65c","#ff7373"],borderRadius:7,maxBarThickness:28}]},options:{...baseOptions,indexAxis:"y",plugins:{...baseOptions.plugins,legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:"#858d9b"},grid:{color:"rgba(255,255,255,.055)"}},y:{ticks:{color:"#c2c7d0",font:{family:"Cairo",size:10}},grid:{display:false}}}}});
}
function renderOrders() {
  $("totalOrders").textContent = orders.length;
  $("completedOrders").textContent = orders.filter(o => ["completed","complete","delivered"].includes(String(o.status).toLowerCase())).length;
  $("pendingOrders").textContent = orders.filter(o => ["pending","processing","demo",null,""].includes(o.status)).length;
  const sales = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  $("totalSales").textContent = `${sales.toLocaleString("ar-EG")} ج.م`;
  $("sidebarOrderCount").textContent = orders.length;
  $("recentOrders").innerHTML = orders.length
    ? orders.slice(0,5).map(o => `<tr>${orderCells(o)}</tr>`).join("")
    : `<tr><td colspan="6" class="table-empty">لا توجد طلبات حتى الآن</td></tr>`;
  renderAllOrders($("orderSearch").value);
  renderDashboardAnalytics();
}
function renderAllOrders(query = "") {
  const q = query.trim().toLowerCase();
  const filtered = orders.filter(o => [o.id,o.game,o.package,o.player_id,o.playerId,o.status].some(v => String(v ?? "").toLowerCase().includes(q)));
  $("allOrders").innerHTML = filtered.length
    ? filtered.map(o => `<tr>${orderCells(o,true)}</tr>`).join("")
    : `<tr><td colspan="7" class="table-empty">${orders.length ? "لا توجد نتائج مطابقة" : "لا توجد طلبات مسجلة"}</td></tr>`;
  document.querySelectorAll(".status-select").forEach(select => {
    select.addEventListener("change", () => updateOrderStatus(select.dataset.orderId, select.value, select));
  });
}
async function loadOrders() {
  $("recentOrders").innerHTML = `<tr><td colspan="6" class="table-empty">جاري تحميل البيانات...</td></tr>`;
  $("allOrders").innerHTML = `<tr><td colspan="7" class="table-empty">جاري تحميل البيانات...</td></tr>`;
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending:false });
  if (error) {
    console.error("Load orders error:", error);
    $("recentOrders").innerHTML = `<tr><td colspan="6" class="table-empty">تعذر تحميل الطلبات: ${safe(error.message)}</td></tr>`;
    $("allOrders").innerHTML = `<tr><td colspan="7" class="table-empty">تعذر تحميل الطلبات: ${safe(error.message)}</td></tr>`;
    return;
  }
  orders = data || [];
  renderOrders();
}
async function updateOrderStatus(id, status, select) {
  if (!id || !status) return;
  select.disabled = true;
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  select.disabled = false;
  if (error) {
    console.error("Update status error:", error);
    alert("لم يتم تحديث الحالة: " + error.message);
    select.value = "";
    return;
  }
  await loadOrders();
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  setLoading(true);
  const email = $("email").value.trim();
  const password = $("password").value;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user?.id !== ADMIN_UID) {
      await supabase.auth.signOut();
      throw new Error("هذا الحساب لا يملك صلاحية دخول لوحة الإدارة.");
    }
    showMessage("تم تسجيل الدخول بنجاح", "success");
    showDashboard();
    await loadOrders();
    await loadSupportTickets();
    await loadCatalog();
    startSupportRealtime();
  } catch (error) {
    showMessage(error.message || "تعذر تسجيل الدخول");
  } finally {
    setLoading(false);
  }
});
$("logoutButton").addEventListener("click", async () => {
  await supabase.auth.signOut();
  stopSupportRealtime();
  orders = [];
  showLogin();
});
$("refreshButton").addEventListener("click", loadOrders);
$("ordersRefresh").addEventListener("click", loadOrders);
$("orderSearch").addEventListener("input", event => renderAllOrders(event.target.value));
$("analyticsRange").addEventListener("change",renderDashboardAnalytics);

// ZARO CUSTOMER ACCOUNT REVIEW
let customerAccounts = [];
const customerStatusLabel = status => ({pending:"بانتظار التفعيل",active:"مفعّل",rejected:"مرفوض",suspended:"موقوف"}[status] || status);
async function loadCustomerAccounts() {
  const body = $("customerAccountsTable");
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty">جاري تحميل الحسابات...</td></tr>';
  const {data,error} = await supabase.from("customer_profiles").select("user_id,full_name,email,zaro_id,status,created_at").order("created_at",{ascending:false});
  if(error) {
    console.error("Load customer accounts error:", error);
    const detail = [error.message, error.code, error.details, error.hint].filter(Boolean).join(" | ");
    body.innerHTML = '<tr><td colspan="6" class="table-empty">تعذر تحميل الحسابات: '+safe(error.message || "خطأ غير معروف")+'</td></tr>';
    const missingTable = error.code === "42P01" || error.code === "PGRST205";
    $("customerAccountsFeedback").textContent = missingTable
      ? "جدول customer_profiles غير ظاهر لـ Supabase. لا تعِد تشغيل SQL الآن؛ راجع اسم الجدول وتحديث مخطط API."
      : "فشل الاتصال بحسابات العملاء: " + detail;
    return;
  }
  $("customerAccountsFeedback").textContent = "تم تحميل حسابات العملاء بنجاح.";
  customerAccounts = data || [];
  $("customerCountAll").textContent = customerAccounts.length;
  $("customerCountPending").textContent = customerAccounts.filter(x=>x.status==="pending").length;
  $("customerCountActive").textContent = customerAccounts.filter(x=>x.status==="active").length;
  $("customerCountOther").textContent = customerAccounts.filter(x=>["rejected","suspended"].includes(x.status)).length;
  renderCustomerAccounts($("customerSearch").value);
}
function renderCustomerAccounts(query="") {
  const q=query.trim().toLowerCase();
  const rows=customerAccounts.filter(x=>[x.full_name,x.email,x.zaro_id,x.status].some(v=>String(v||"").toLowerCase().includes(q)));
  $("customerAccountsTable").innerHTML=rows.length?rows.map(x=>{
    const actions=x.status==="pending"
      ? '<button class="primary-button customer-action" data-user="'+safe(x.user_id)+'" data-decision="active">تفعيل</button> <button class="secondary-button customer-action" data-user="'+safe(x.user_id)+'" data-decision="rejected">رفض</button>'
      : x.status==="active"
        ? '<button class="secondary-button customer-action" data-user="'+safe(x.user_id)+'" data-decision="suspended">إيقاف</button>'
        : '<button class="primary-button customer-action" data-user="'+safe(x.user_id)+'" data-decision="active">تفعيل</button>';
    return '<tr><td>'+safe(x.full_name||"—")+'</td><td>'+safe(x.email)+'</td><td><span class="order-id">'+safe(x.zaro_id||"—")+'</span></td><td><span class="status-pill '+(x.status==="active"?"completed":x.status==="pending"?"pending":"cancelled")+'">'+safe(customerStatusLabel(x.status))+'</span></td><td>'+formatDate(x.created_at)+'</td><td>'+actions+'</td></tr>';
  }).join(""):'<tr><td colspan="6" class="table-empty">لا توجد حسابات مطابقة</td></tr>';
  document.querySelectorAll(".customer-action").forEach(button=>button.addEventListener("click",()=>reviewCustomer(button.dataset.user,button.dataset.decision,button)));
}
async function reviewCustomer(userId,decision,button) {
  const labels={active:"تفعيل الحساب",rejected:"رفض الحساب",suspended:"إيقاف الحساب"};
  if(!confirm("هل تريد تنفيذ: "+labels[decision]+"؟")) return;
  button.disabled=true;
  $("customerAccountsFeedback").textContent="جاري تحديث الحساب...";
  const {data,error}=await supabase.rpc("zaro_review_customer",{p_user_id:userId,p_decision:decision});
  button.disabled=false;
  if(error){$("customerAccountsFeedback").textContent="تعذر تحديث الحساب: "+error.message;return;}
  $("customerAccountsFeedback").textContent=decision==="active"?"تم تفعيل الحساب. ZARO ID: "+data:"تم تحديث حالة الحساب.";
  await loadCustomerAccounts();
}
$("customersRefresh")?.addEventListener("click",loadCustomerAccounts);
$("customerSearch")?.addEventListener("input",e=>renderCustomerAccounts(e.target.value));

// ZARO CUSTOMER SUPPORT INBOX
let supportTickets = [];
let activeSupportTicket = null;
const supportState = status => ({open:["مفتوحة","open"],answered:["تم الرد","answered"],closed:["مغلقة","closed"]}[status] || ["مفتوحة","open"]);

async function loadSupportTickets() {
  const list = $("supportTicketList");
  if (!list) return;
  list.innerHTML = '<div class="table-empty">جاري تحميل الرسائل...</div>';
  const {data,error} = await supabase.from("support_tickets")
    .select("id,customer_name,customer_email,subject,status,created_at,updated_at")
    .order("updated_at",{ascending:false});
  if(error) {
    list.innerHTML = '<div class="table-empty">تعذر تحميل الرسائل: '+safe(error.message)+'</div>';
    console.error(error); return;
  }
  supportTickets = data || [];
  $("supportTotal").textContent = supportTickets.length;
  $("sidebarSupportCount").textContent = supportTickets.filter(t=>t.status==="open").length;
  if(!supportTickets.length) {
    list.innerHTML = '<div class="table-empty">لا توجد رسائل حتى الآن</div>';
    $("supportMessages").innerHTML = '<div class="table-empty">لا توجد محادثات</div>';
    activeSupportTicket=null; return;
  }
  list.innerHTML = supportTickets.map(t=>{
    const st=supportState(t.status);
    return '<button type="button" class="support-ticket-item '+(activeSupportTicket?.id===t.id?'selected':'')+'" data-ticket-id="'+safe(t.id)+'"><span class="support-ticket-top"><b>'+safe(t.customer_name)+'</b><i class="support-state '+st[1]+'">'+st[0]+'</i></span><span class="support-ticket-subject">'+safe(t.subject)+'</span><span class="support-ticket-meta">'+safe(t.customer_email)+' · '+formatDate(t.updated_at)+'</span></button>';
  }).join("");
  list.querySelectorAll("[data-ticket-id]").forEach(b=>b.addEventListener("click",()=>openSupportTicket(b.dataset.ticketId)));
  if(activeSupportTicket && supportTickets.some(t=>t.id===activeSupportTicket.id)) await openSupportTicket(activeSupportTicket.id,false);
}
async function openSupportTicket(id, paint=true) {
  const ticket=supportTickets.find(t=>t.id===id); if(!ticket) return;
  activeSupportTicket=ticket;
  if(paint) document.querySelectorAll(".support-ticket-item").forEach(b=>b.classList.toggle("selected",b.dataset.ticketId===id));
  $("supportChatName").textContent=ticket.customer_name;
  $("supportChatInfo").textContent=ticket.subject+" · "+ticket.customer_email;
  const st=supportState(ticket.status);
  $("supportChatStatus").className="support-state "+st[1];
  $("supportChatStatus").textContent=st[0];
  $("supportReplyText").disabled=ticket.status==="closed";
  $("supportReplyForm").querySelector("button").disabled=ticket.status==="closed";
  $("supportMessages").innerHTML='<div class="table-empty">جاري تحميل المحادثة...</div>';
  const {data,error}=await supabase.from("support_messages").select("id,sender_role,body,created_at").eq("ticket_id",id).order("created_at",{ascending:true});
  if(error){$("supportMessages").innerHTML='<div class="table-empty">تعذر تحميل المحادثة: '+safe(error.message)+'</div>';return;}
  $("supportMessages").innerHTML=(data||[]).map(m=>'<article class="support-message '+(m.sender_role==="admin"?"admin":"customer")+'"><div class="support-message-meta"><b>'+(m.sender_role==="admin"?"ZARO Support":safe(ticket.customer_name))+'</b><time>'+formatDate(m.created_at)+'</time></div><p>'+safe(m.body).replace(/\\n/g,"<br>")+'</p></article>').join("")||'<div class="table-empty">المحادثة فارغة</div>';
  $("supportMessages").scrollTop=$("supportMessages").scrollHeight;
}
$("supportReplyForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!activeSupportTicket || activeSupportTicket.status==="closed") return;
  const body=$("supportReplyText").value.trim(); if(!body) return;
  const button=$("supportReplyForm").querySelector("button");
  button.disabled=true; $("supportReplyFeedback").textContent="جاري إرسال الرد...";
  const {error}=await supabase.from("support_messages").insert({ticket_id:activeSupportTicket.id,sender_role:"admin",body});
  if(error){$("supportReplyFeedback").textContent="فشل إرسال الرد: "+error.message;button.disabled=false;return;}
  const {error:updateError}=await supabase.from("support_tickets").update({status:"answered",updated_at:new Date().toISOString()}).eq("id",activeSupportTicket.id);
  if(updateError) console.error(updateError);
  $("supportReplyText").value=""; $("supportReplyFeedback").textContent="تم إرسال الرد بنجاح.";
  await loadSupportTickets();
});
$("supportRefresh")?.addEventListener("click",loadSupportTickets);

// Live updates for the admin inbox.
let supportRealtimeChannel = null;
function startSupportRealtime() {
  if (supportRealtimeChannel) return;
  supportRealtimeChannel = supabase.channel("zaro-admin-support-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => loadSupportTickets())
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, payload => {
      if (activeSupportTicket && payload.new?.ticket_id === activeSupportTicket.id) {
        openSupportTicket(activeSupportTicket.id, false);
      }
    })
    .subscribe(status => console.log("ZARO support realtime:", status));
}
function stopSupportRealtime() {
  if (!supportRealtimeChannel) return;
  supabase.removeChannel(supportRealtimeChannel);
  supportRealtimeChannel = null;
}


/* ZARO PRODUCT CATALOG */
let catalogGames = [];
let catalogPackages = [];
let selectedCatalogGameId = "";
const catalogFeedback = (id, message, isError=false) => {
  const node=$(id); if(!node) return;
  node.textContent=message;
  node.classList.toggle("error",isError);
};
function resetGameForm(){
  $("catalogGameForm").reset(); $("catalogGameId").value="";
  $("catalogGameActive").checked=false;
  $("gameFormTitle").textContent="إضافة لعبة جديدة";
  $("catalogGameSave").textContent="حفظ اللعبة";
  $("catalogGameCancel").hidden=true;
}
function resetPackageForm(){
  $("catalogPackageForm").reset(); $("catalogPackageId").value="";
  $("catalogPackageActive").checked=false;
  $("packageFormTitle").textContent="إضافة باقة";
  $("catalogPackageSave").textContent="حفظ الباقة";
  $("catalogPackageCancel").hidden=true;
}
function renderCatalogStats(){
  $("catalogGameCount").textContent=catalogGames.length;
  $("catalogActiveGameCount").textContent=catalogGames.filter(g=>g.is_active).length;
  $("catalogPackageCount").textContent=catalogPackages.length;
  $("catalogActivePackageCount").textContent=catalogPackages.filter(p=>p.is_active).length;
}
function renderCatalogGameOptions(){
  const select=$("catalogPackageGame"), previous=select.value || selectedCatalogGameId;
  select.innerHTML='<option value="">اختر اللعبة</option>'+catalogGames.map(g=>'<option value="'+safe(g.id)+'">'+safe(g.name_ar)+' · '+safe(g.name_en)+'</option>').join("");
  if(catalogGames.some(g=>g.id===previous)) select.value=previous;
  else if(catalogGames.length) select.value=catalogGames[0].id;
}
function renderCatalogGames(){
  const body=$("catalogGamesTable");
  body.innerHTML=catalogGames.length?catalogGames.map(g=>{
    const count=catalogPackages.filter(p=>p.game_id===g.id).length;
    return '<tr><td><b>'+safe(g.name_ar)+'</b><br><small>'+safe(g.name_en)+'</small></td><td dir="ltr">'+safe(g.slug)+'</td><td>'+safe(g.currency_label||"—")+'</td><td>'+count+'</td><td><span class="catalog-state '+(g.is_active?"active":"inactive")+'">'+(g.is_active?"مفعّلة":"متوقفة")+'</span></td><td><div class="catalog-row-actions"><button class="catalog-action" data-catalog-game-edit="'+safe(g.id)+'">تعديل</button><button class="catalog-action" data-catalog-game-select="'+safe(g.id)+'">الباقات</button><button class="catalog-action danger" data-catalog-game-delete="'+safe(g.id)+'">حذف</button></div></td></tr>';
  }).join(""):'<tr><td colspan="6" class="table-empty">لا توجد ألعاب بعد. أضف أول لعبة من النموذج بالأعلى.</td></tr>';
}
function renderCatalogPackages(){
  const game=catalogGames.find(g=>g.id===selectedCatalogGameId);
  $("catalogSelectedGame").textContent=game?game.name_ar:"لم يتم اختيار لعبة";
  $("catalogPackagesSubtitle").textContent=game?"باقات "+game.name_ar:"اختار لعبة من القائمة لعرض باقاتها.";
  const rows=catalogPackages.filter(p=>p.game_id===selectedCatalogGameId);
  $("catalogPackagesTable").innerHTML=game?(rows.length?rows.map(p=>'<tr><td><b>'+safe(p.package_name)+'</b><br><small dir="ltr">'+safe(p.supplier_sku||"بدون SKU")+'</small></td><td>'+safe(p.amount_label||"—")+'</td><td>'+(p.supplier_cost===null?"غير محدد":Number(p.supplier_cost).toFixed(2)+" ج.م")+'</td><td>'+(p.selling_price===null?"غير محدد":Number(p.selling_price).toFixed(2)+" ج.م")+'</td><td><span class="catalog-state '+(p.is_active?"active":"inactive")+'">'+(p.is_active?"مفعّلة":"متوقفة")+'</span></td><td><div class="catalog-row-actions"><button class="catalog-action" data-catalog-package-edit="'+safe(p.id)+'">تعديل</button><button class="catalog-action danger" data-catalog-package-delete="'+safe(p.id)+'">حذف</button></div></td></tr>').join(""):'<tr><td colspan="6" class="table-empty">لا توجد باقات لهذه اللعبة.</td></tr>'):'<tr><td colspan="6" class="table-empty">اختر لعبة أولاً.</td></tr>';
}
async function loadCatalog(){
  $("catalogGamesTable").innerHTML='<tr><td colspan="6" class="table-empty">جاري تحميل الألعاب...</td></tr>';
  const [gamesResult,packagesResult]=await Promise.all([
    supabase.from("catalog_games").select("*").order("sort_order").order("name_en"),
    supabase.from("catalog_packages").select("*").order("sort_order").order("package_name")
  ]);
  if(gamesResult.error||packagesResult.error){
    const error=gamesResult.error||packagesResult.error;
    console.error("Catalog load error:",error);
    $("catalogGamesTable").innerHTML='<tr><td colspan="6" class="table-empty">تعذر تحميل الكتالوج: '+safe(error.message)+'</td></tr>';
    catalogFeedback("catalogGameFeedback","راجع صلاحيات قاعدة البيانات: "+error.message,true);
    return;
  }
  catalogGames=gamesResult.data||[];
  catalogPackages=packagesResult.data||[];
  if(!catalogGames.some(g=>g.id===selectedCatalogGameId)) selectedCatalogGameId=catalogGames[0]?.id||"";
  renderCatalogGameOptions(); renderCatalogStats(); renderCatalogGames(); renderCatalogPackages();
}
$("catalogGameForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const id=$("catalogGameId").value;
  const payload={
    name_ar:$("catalogGameAr").value.trim(),
    name_en:$("catalogGameEn").value.trim(),
    slug:$("catalogGameSlug").value.trim().toLowerCase(),
    currency_label:$("catalogCurrency").value.trim(),
    image_url:$("catalogGameImage").value.trim(),
    is_active:$("catalogGameActive").checked
  };
  if(!/^[a-z0-9-]+$/.test(payload.slug)){catalogFeedback("catalogGameFeedback","اكتب المعرّف بحروف إنجليزية صغيرة وأرقام وشرطة فقط.",true);return;}
  const button=$("catalogGameSave");button.disabled=true;
  const result=id?await supabase.from("catalog_games").update(payload).eq("id",id):await supabase.from("catalog_games").insert(payload);
  button.disabled=false;
  if(result.error){catalogFeedback("catalogGameFeedback","فشل حفظ اللعبة: "+result.error.message,true);return;}
  catalogFeedback("catalogGameFeedback","تم حفظ بيانات اللعبة.");
  resetGameForm(); await loadCatalog();
});
$("catalogPackageForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const id=$("catalogPackageId").value;
  const supplier=$("catalogSupplierCost").value;
  const selling=$("catalogSellingPrice").value;
  const payload={
    game_id:$("catalogPackageGame").value,
    package_name:$("catalogPackageName").value.trim(),
    amount_label:$("catalogPackageAmount").value.trim(),
    supplier_sku:$("catalogSupplierSku").value.trim()||null,
    supplier_cost:supplier===""?null:Number(supplier),
    selling_price:selling===""?null:Number(selling),
    is_active:$("catalogPackageActive").checked
  };
  if(!payload.game_id){catalogFeedback("catalogPackageFeedback","اختار اللعبة أولاً.",true);return;}
  if((payload.supplier_cost!==null&&payload.supplier_cost<0)||(payload.selling_price!==null&&payload.selling_price<0)){catalogFeedback("catalogPackageFeedback","الأسعار لا يمكن أن تكون سالبة.",true);return;}
  const button=$("catalogPackageSave");button.disabled=true;
  const result=id?await supabase.from("catalog_packages").update(payload).eq("id",id):await supabase.from("catalog_packages").insert(payload);
  button.disabled=false;
  if(result.error){catalogFeedback("catalogPackageFeedback","فشل حفظ الباقة: "+result.error.message,true);return;}
  selectedCatalogGameId=payload.game_id;
  catalogFeedback("catalogPackageFeedback","تم حفظ بيانات الباقة.");
  resetPackageForm(); await loadCatalog();
});
$("catalogGamesTable").addEventListener("click",async event=>{
  const edit=event.target.closest("[data-catalog-game-edit]");
  const choose=event.target.closest("[data-catalog-game-select]");
  const remove=event.target.closest("[data-catalog-game-delete]");
  if(choose){selectedCatalogGameId=choose.dataset.catalogGameSelect;$("catalogPackageGame").value=selectedCatalogGameId;renderCatalogPackages();return;}
  if(edit){
    const g=catalogGames.find(x=>x.id===edit.dataset.catalogGameEdit);if(!g)return;
    $("catalogGameId").value=g.id;$("catalogGameAr").value=g.name_ar;$("catalogGameEn").value=g.name_en;$("catalogGameSlug").value=g.slug;$("catalogCurrency").value=g.currency_label||"";$("catalogGameImage").value=g.image_url||"";$("catalogGameActive").checked=!!g.is_active;
    $("gameFormTitle").textContent="تعديل بيانات اللعبة";$("catalogGameSave").textContent="حفظ التعديلات";$("catalogGameCancel").hidden=false;
    $("catalogGameForm").scrollIntoView({behavior:"smooth",block:"center"});return;
  }
  if(remove){
    const g=catalogGames.find(x=>x.id===remove.dataset.catalogGameDelete);if(!g)return;
    if(!confirm("حذف لعبة "+g.name_ar+"؟ سيتم حذف باقاتها المرتبطة أيضًا."))return;
    const {error}=await supabase.from("catalog_games").delete().eq("id",g.id);
    if(error){catalogFeedback("catalogGameFeedback","فشل الحذف: "+error.message,true);return;}
    if(selectedCatalogGameId===g.id)selectedCatalogGameId="";
    await loadCatalog();
  }
});
$("catalogPackagesTable").addEventListener("click",async event=>{
  const edit=event.target.closest("[data-catalog-package-edit]");
  const remove=event.target.closest("[data-catalog-package-delete]");
  if(edit){
    const p=catalogPackages.find(x=>x.id===edit.dataset.catalogPackageEdit);if(!p)return;
    $("catalogPackageId").value=p.id;$("catalogPackageGame").value=p.game_id;$("catalogPackageName").value=p.package_name;$("catalogPackageAmount").value=p.amount_label||"";$("catalogSupplierSku").value=p.supplier_sku||"";$("catalogSupplierCost").value=p.supplier_cost??"";$("catalogSellingPrice").value=p.selling_price??"";$("catalogPackageActive").checked=!!p.is_active;
    $("packageFormTitle").textContent="تعديل الباقة";$("catalogPackageSave").textContent="حفظ التعديلات";$("catalogPackageCancel").hidden=false;
    $("catalogPackageForm").scrollIntoView({behavior:"smooth",block:"center"});return;
  }
  if(remove){
    const p=catalogPackages.find(x=>x.id===remove.dataset.catalogPackageDelete);if(!p)return;
    if(!confirm("تأكيد حذف الباقة "+p.package_name+"؟"))return;
    const {error}=await supabase.from("catalog_packages").delete().eq("id",p.id);
    if(error){catalogFeedback("catalogPackageFeedback","فشل الحذف: "+error.message,true);return;}
    await loadCatalog();
  }
});
$("catalogGameCancel").addEventListener("click",resetGameForm);
$("catalogPackageCancel").addEventListener("click",resetPackageForm);
$("catalogPackageGame").addEventListener("change",event=>{selectedCatalogGameId=event.target.value;renderCatalogPackages();});
$("productsRefresh").addEventListener("click",loadCatalog);

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    document.querySelectorAll(".dashboard-page").forEach(section => section.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === page));
    $(`page-${page}`)?.classList.add("active");
    const names = { overview:"نظرة عامة", orders:"الطلبات", support:"خدمة العملاء", products:"المنتجات", customers:"العملاء", settings:"الإعدادات" };
    $("pageTitle").textContent = names[page] || "لوحة التحكم";
    if (page === "support") loadSupportTickets();
    if (page === "customers") loadCustomerAccounts();
    if (page === "products") loadCatalog();
    closeSidebar();
  });
});

function closeSidebar() {
  sidebar?.classList.remove("sidebar-open");
  $("sidebarBackdrop")?.classList.remove("show");
}
$("mobileMenu").addEventListener("click", () => {
  sidebar.classList.toggle("sidebar-open");
  $("sidebarBackdrop").classList.toggle("show");
});
$("sidebarClose").addEventListener("click", closeSidebar);
$("sidebarBackdrop").addEventListener("click", closeSidebar);
$("passwordToggle").addEventListener("click", () => {
  const input = $("password");
  input.type = input.type === "password" ? "text" : "password";
});

async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id === ADMIN_UID) {
    showDashboard();
    await loadOrders();
    await loadSupportTickets();
    startSupportRealtime();
  } else {
    if (session) await supabase.auth.signOut();
    showLogin();
  }
}
restoreSession();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      await registration.update();
      console.log("ZARO Admin PWA registered and update checked");
    } catch (error) {
      console.error("PWA registration failed:", error);
    }
  });
}
