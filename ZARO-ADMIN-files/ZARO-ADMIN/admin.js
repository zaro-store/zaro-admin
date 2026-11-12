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
  } catch (error) {
    showMessage(error.message || "تعذر تسجيل الدخول");
  } finally {
    setLoading(false);
  }
});
$("logoutButton").addEventListener("click", async () => {
  await supabase.auth.signOut();
  orders = [];
  showLogin();
});
$("refreshButton").addEventListener("click", loadOrders);
$("ordersRefresh").addEventListener("click", loadOrders);
$("orderSearch").addEventListener("input", event => renderAllOrders(event.target.value));

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    document.querySelectorAll(".dashboard-page").forEach(section => section.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === page));
    $(`page-${page}`)?.classList.add("active");
    const names = { overview:"نظرة عامة", orders:"الطلبات", products:"المنتجات", customers:"العملاء", settings:"الإعدادات" };
    $("pageTitle").textContent = names[page] || "لوحة التحكم";
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
  } else {
    if (session) await supabase.auth.signOut();
    showLogin();
  }
}
restoreSession();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("ZARO Admin PWA registered");
    } catch (error) {
      console.error("PWA registration failed:", error);
    }
  });
}
