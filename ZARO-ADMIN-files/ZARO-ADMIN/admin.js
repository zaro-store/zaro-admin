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

// ZARO CUSTOMER ACCOUNT REVIEW
let customerAccounts = [];
const customerStatusLabel = status => ({pending:"بانتظار التفعيل",active:"مفعّل",rejected:"مرفوض",suspended:"موقوف"}[status] || status);
async function loadCustomerAccounts() {
  const body = $("customerAccountsTable");
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty">جاري تحميل الحسابات...</td></tr>';
  const {data,error} = await supabase.from("customer_profiles").select("user_id,full_name,email,zaro_id,status,created_at").order("created_at",{ascending:false});
  if(error) {
    body.innerHTML = '<tr><td colspan="6" class="table-empty">تعذر تحميل الحسابات: '+safe(error.message)+'</td></tr>';
    $("customerAccountsFeedback").textContent = "شغّل ملف customer_accounts_setup.sql في Supabase أولاً.";
    return;
  }
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
