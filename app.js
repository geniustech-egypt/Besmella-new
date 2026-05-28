import { initializeApp } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  getDoc,
  setDoc,
  where,
  limit,
  writeBatch
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-auth.js";

/* ======================
   Firebase
====================== */
const firebaseConfig = {
  apiKey: "AIzaSyCNsSCHV_jQ1mohXlbzvMACujqQ464DFcE",
  authDomain: "besmella-c36ce.firebaseapp.com",
  projectId: "besmella-c36ce",
  storageBucket: "besmella-c36ce.firebasestorage.app",
  messagingSenderId: "757717901211",
  appId: "1:757717901211:web:4fb0b09794e00183a14b3e",
  measurementId: "G-GDS0RTMCZT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.db = db;
window.auth = auth;

/* ======================
   Storage Keys
====================== */
const APP_ENTERED_STORAGE_KEY = "besmella_app_entered_once";
const USER_NAME_STORAGE_KEY = "besmella_user_name";
const WHATSAPP_NUMBER_STORAGE_KEY = "besmella_restaurant_whatsapp_number";
const ADMIN_EMAIL = "hussein-admin@g.tech.com";

/* ======================
   WhatsApp State
   نص الرسالة المعلق بين فتح المودال والإرسال
====================== */
let pendingWhatsAppText = "";

/* ======================
   Helpers عامة
====================== */
function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function formatNumber(num) {
  return String(toInt(num));
}

function normalizeWhatsAppNumber(raw) {
  return String(raw || "").trim().replace(/[^\d]/g, "");
}

function getRestaurantWhatsAppNumber() {
  return localStorage.getItem(WHATSAPP_NUMBER_STORAGE_KEY) || "";
}

function setRestaurantWhatsAppNumber(num) {
  localStorage.setItem(WHATSAPP_NUMBER_STORAGE_KEY, normalizeWhatsAppNumber(num));
}

function getEgyptDateString() {
  const now = new Date();
  const egyptOffset = 2 * 60;
  const egyptTime = new Date(now.getTime() + (egyptOffset - now.getTimezoneOffset()) * 60000);
  return egyptTime.toISOString().split("T")[0];
}

function getTodaySummaryDocId() {
  return getEgyptDateString();
}

function getCurrentDateTimeText() {
  const now = new Date();
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
}

function getShortDateTimeText(iso) {
  if (!iso) return "--";
  return new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short"
  }).format(new Date(iso));
}

/* ======================
   Auth Helpers
====================== */
async function ensureAnonymousAuth() {
  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    console.error("Anonymous auth failed:", error);
    throw error;
  }
}

function getCurrentUid() {
  return auth.currentUser?.uid || null;
}

/* ======================
   App Entry / User Name
====================== */
function hasEnteredAppBefore() {
  return localStorage.getItem(APP_ENTERED_STORAGE_KEY) === "1";
}

function markAppAsEntered() {
  localStorage.setItem(APP_ENTERED_STORAGE_KEY, "1");
}

function getSavedUserName() {
  return localStorage.getItem(USER_NAME_STORAGE_KEY) || "";
}

function saveUserName(name) {
  localStorage.setItem(USER_NAME_STORAGE_KEY, String(name || "").trim());
}

function syncUserNameAcrossUI() {
  const saved = getSavedUserName() || "مستخدم";
  const homeUserName = document.getElementById("homeUserName");
  if (homeUserName) homeUserName.textContent = saved;
}

/* ======================
   Screen Management
====================== */
const SCREEN_IDS = [
  "homeScreen",
  "menuScreen",
  "reviewScreen",
  "successScreen",
  "aggregatedInvoiceScreen",
  "adminDashboardScreen",
  "adminOrdersScreen"
];

function showScreen(screenId) {
  SCREEN_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("active", id === screenId);
  });
}

function showWelcomeScreen() {
  document.body.classList.add("welcome-mode");
  document.getElementById("welcomeScreen")?.classList.add("is-visible");
  document.getElementById("nameSetupScreen")?.classList.remove("is-visible");
  document.getElementById("appShell")?.classList.add("is-hidden");
}

function showNameSetupScreen() {
  document.body.classList.add("welcome-mode");
  document.getElementById("welcomeScreen")?.classList.remove("is-visible");
  document.getElementById("nameSetupScreen")?.classList.add("is-visible");
  document.getElementById("appShell")?.classList.add("is-hidden");
}

function showAppShell() {
  document.body.classList.remove("welcome-mode");
  document.getElementById("welcomeScreen")?.classList.remove("is-visible");
  document.getElementById("nameSetupScreen")?.classList.remove("is-visible");
  document.getElementById("appShell")?.classList.remove("is-hidden");
}

function continueIntoAppFlow() {
  if (!getSavedUserName()) {
    showNameSetupScreen();
    return;
  }

  syncUserNameAcrossUI();
  showAppShell();
  showScreen("homeScreen");
}

/* ======================
   Categories
====================== */
let categories = [
  { id: "all", label: "الكل", icon: "fa-border-all" },
  { id: "potato", label: "بطاطس", icon: "fa-bowl-food" },
  { id: "foul", label: "فول", icon: "fa-seedling" },
  { id: "ta3miya", label: "طعمية", icon: "fa-cookie-bite" },
  { id: "salad", label: "سلطات", icon: "fa-leaf" },
  { id: "extras", label: "إضافات", icon: "fa-plus" }
];

function getCategoryLabelById(catId) {
  return categories.find(c => c.id === catId)?.label || "أخرى";
}

function guessCategory(item) {
  const id = String(item.id || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();

  if (id.includes("potato") || name.includes("بطاطس")) return "potato";
  if (id.includes("foul") || name.includes("فول")) return "foul";
  if (id.includes("ta3miya") || name.includes("طعميه") || name.includes("طعمية")) return "ta3miya";
  if (name.includes("سلطه") || name.includes("سلطة") || id.includes("salata") || id.includes("salad")) return "salad";
  if (id.includes("delivery") || name.includes("توصيل")) return "extras";
  return "extras";
}

async function loadCategories() {
  try {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("sort")));
    const fromDb = [];

    snap.forEach(d => {
      const data = d.data() || {};
      fromDb.push({
        id: d.id,
        label: data.label || d.id,
        icon: data.icon || "fa-tag",
        sort: Number(data.sort || 0)
      });
    });

    if (fromDb.length === 0) {
      const seed = categories
        .filter(c => c.id !== "all")
        .map((c, idx) => ({ id: c.id, label: c.label, icon: c.icon, sort: (idx + 1) * 10 }));

      for (const c of seed) {
        await setDoc(doc(db, "categories", c.id), { label: c.label, icon: c.icon, sort: c.sort }, { merge: true });
      }
      return await loadCategories();
    }

    categories = [{ id: "all", label: "الكل", icon: "fa-border-all" }, ...fromDb];
  } catch (e) {
    console.error("loadCategories failed:", e);
  } finally {
    renderCategoryChips();
    refreshAdminCategoryDropdowns();
  }
}

function refreshAdminCategoryDropdowns() {
  const addSel = document.getElementById("modalItemCategory");
  if (addSel) {
    addSel.innerHTML = categories
      .filter(c => c.id !== "all")
      .map(c => `<option value="${c.id}">${c.label}</option>`)
      .join("");
  }

  const editSel = document.getElementById("singleEditCategory");
  if (editSel) {
    const current = editSel.value;
    editSel.innerHTML = categories
      .filter(c => c.id !== "all")
      .map(c => `<option value="${c.id}" ${c.id === current ? "selected" : ""}>${c.label}</option>`)
      .join("");
  }

  const manageSel = document.getElementById("adminItemCategoryFilter");
  if (manageSel) {
    manageSel.innerHTML = categories.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
  }
}

let activeCategory = "all";

function renderCategoryChips() {
  const chips = document.getElementById("categoryChips");
  if (!chips) return;

  chips.innerHTML = "";
  categories.forEach(c => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.setAttribute("aria-pressed", String(activeCategory === c.id));
    btn.dataset.category = c.id;
    btn.textContent = c.label;

    btn.onclick = () => {
      activeCategory = c.id;
      chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      renderItemsGrid();
    };

    chips.appendChild(btn);
  });
}

/* ======================
   Orders Cutoff
====================== */
const DEFAULT_CUTOFF_TIME = "08:30";
let currentCutoffTime = DEFAULT_CUTOFF_TIME;
let ordersOpen = true;
let countdownInterval = null;

function getEgyptTime(baseDate = new Date()) {
  const egyptOffset = 2 * 60;
  const adjustMinutes = (baseDate.getTimezoneOffset() * 1) + egyptOffset;
  return new Date(baseDate.getTime() + adjustMinutes * 60000);
}

function getTimeUntilCutoff() {
  const nowLocal = new Date();
  const now = getEgyptTime(nowLocal);

  let cutoffHours = 8;
  let cutoffMinutes = 30;

  if (typeof currentCutoffTime === "string") {
    const parts = currentCutoffTime.split(":").map(x => Number(x));
    cutoffHours = parts[0];
    cutoffMinutes = parts[1] || 0;
  } else if (typeof currentCutoffTime === "object" && currentCutoffTime.hour != null) {
    cutoffHours = Number(currentCutoffTime.hour);
    cutoffMinutes = Number(currentCutoffTime.minute || 0);
  }

  const cutoffToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoffHours, cutoffMinutes, 0, 0);
  let isOpen = true;

  if (cutoffToday - now <= 0) {
    isOpen = false;
  }

  return { isOpen };
}

async function loadCutoffTime() {
  try {
    const settingsDocRef = doc(db, "settings", "closingTime");
    const snap1 = await getDoc(settingsDocRef);

    if (snap1.exists()) {
      const data = snap1.data();
      if (typeof data.hour === "number" && typeof data.minute === "number") {
        currentCutoffTime = { hour: data.hour, minute: data.minute };
      } else if (typeof data.time === "string") {
        currentCutoffTime = data.time;
      } else {
        currentCutoffTime = DEFAULT_CUTOFF_TIME;
      }
      return;
    }

    await setDoc(
      settingsDocRef,
      {
        hour: Number(DEFAULT_CUTOFF_TIME.split(":")[0]),
        minute: Number(DEFAULT_CUTOFF_TIME.split(":")[1]),
        time: DEFAULT_CUTOFF_TIME
      },
      { merge: true }
    );

    currentCutoffTime = DEFAULT_CUTOFF_TIME;
  } catch {
    currentCutoffTime = DEFAULT_CUTOFF_TIME;
  } finally {
    updateCountdown();
  }
}

function updateCountdown() {
  const timeInfo = getTimeUntilCutoff();
  ordersOpen = timeInfo.isOpen;
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function canSubmitOrder() {
  return ordersOpen;
}

/* ======================
   Items
====================== */
const fallbackItems = [
  { name: "فول عادي", id: "foul_regular", price: 13 },
  { name: "فول سادة", id: "foul_plain", price: 13 },
  { name: "طعمية", id: "ta3miya", price: 13 },
  { name: "طعمية محشية", id: "ta3miya_ma7shya", price: 15 },
  { name: "بطاطس", id: "potato", price: 20 },
  { name: "سلطة", id: "salad", price: 18 }
].map(i => ({ ...i, category: guessCategory(i) }));

let itemsList = [];
let currentOrder = [];
let userOrderDocId = null;
let lastSubmittedOrderSnapshot = [];

async function loadItems() {
  try {
    const q = query(collection(db, "items"), orderBy("name"));
    const itemsSnapshot = await getDocs(q);
    itemsList = [];

    itemsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = { id: docSnap.id, ...data };
      item.price = toInt(item.price);
      item.category = item.category || guessCategory(item);
      itemsList.push(item);
    });

    if (itemsList.length === 0) itemsList = fallbackItems;
  } catch {
    itemsList = fallbackItems;
  }

  renderItemsGrid();
  renderStickyOrderSummary();
}

function getFilteredItems() {
  if (activeCategory === "all") return itemsList;
  return itemsList.filter(x => (x.category || guessCategory(x)) === activeCategory);
}

function getCurrentOrderItem(itemId) {
  return currentOrder.find(x => x.id === itemId);
}

function setItemQuantity(item, qty) {
  const existing = currentOrder.find(x => x.id === item.id);
  const safeQty = toInt(qty);

  if (safeQty <= 0) {
    currentOrder = currentOrder.filter(x => x.id !== item.id);
    return;
  }

  if (existing) {
    existing.quantity = safeQty;
  } else {
    currentOrder.push({
      id: item.id,
      name: item.name,
      quantity: safeQty,
      price: toInt(item.price),
      category: item.category || guessCategory(item)
    });
  }
}

function getOrderTotal() {
  return currentOrder.reduce((acc, item) => acc + toInt(item.price) * toInt(item.quantity), 0);
}

function getOrderCount() {
  return currentOrder.reduce((acc, item) => acc + toInt(item.quantity), 0);
}

function renderItemsGrid() {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;

  const filtered = getFilteredItems();
  grid.innerHTML = "";

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="padding:20px;text-align:center;color:#777;font-weight:900;">لا توجد أصناف في هذا القسم</div>`;
    return;
  }

  filtered.forEach(item => {
    const current = getCurrentOrderItem(item.id);
    const qty = current ? current.quantity : 0;

    const row = document.createElement("div");
    row.className = "menu-item-row";

    row.innerHTML = `
      <div class="menu-item-info">
        <div class="menu-item-name">${item.name}</div>
        <div class="menu-item-sub">${getCategoryLabelById(item.category || guessCategory(item))}</div>
        <div class="menu-item-price">${formatNumber(item.price)} ج</div>
      </div>

      <div class="menu-item-actions">
        <button class="circle-action-btn circle-plus" type="button">+</button>
        ${qty > 0 ? `<div class="qty-number">${qty}</div><button class="circle-action-btn circle-minus" type="button">−</button>` : ""}
      </div>
    `;

    const plusBtn = row.querySelector(".circle-plus");
    const minusBtn = row.querySelector(".circle-minus");

    plusBtn?.addEventListener("click", () => {
      if (!canSubmitOrder()) {
        alert("عذراً، لقد انتهى وقت استقبال الطلبات لليوم. يرجى المحاولة غداً.");
        return;
      }

      setItemQuantity(item, qty + 1);
      renderItemsGrid();
      renderStickyOrderSummary();
    });

    minusBtn?.addEventListener("click", () => {
      setItemQuantity(item, qty - 1);
      renderItemsGrid();
      renderStickyOrderSummary();
    });

    grid.appendChild(row);
  });
}

function renderStickyOrderSummary() {
  const bar = document.getElementById("stickyOrderSummaryBar");
  const list = document.getElementById("selectedItemsMiniList");
  const total = document.getElementById("stickyOrderTotal");
  const cartBadge = document.getElementById("cartCountBadge");

  if (!bar || !list || !total || !cartBadge) return;

  const count = getOrderCount();
  const totalValue = getOrderTotal();

  if (count <= 0) {
    bar.style.display = "none";
    cartBadge.style.display = "none";
    cartBadge.textContent = "0";
    return;
  }

  bar.style.display = "block";
  cartBadge.style.display = "flex";
  cartBadge.textContent = String(count);

  list.innerHTML = currentOrder
    .map(item => `
      <div class="selected-mini-item">
        <button class="delete" type="button" data-delete-item="${item.id}">
          <i class="fa-regular fa-trash-can"></i>
        </button>
        <div class="price">${formatNumber(item.price * item.quantity)} ج</div>
        <div>${item.quantity} × ${item.name}</div>
      </div>
    `)
    .join("");

  total.textContent = formatNumber(totalValue);

  list.querySelectorAll("[data-delete-item]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentOrder = currentOrder.filter(x => x.id !== btn.getAttribute("data-delete-item"));
      renderItemsGrid();
      renderStickyOrderSummary();
    });
  });
}

function renderReviewScreen() {
  const list = document.getElementById("reviewOrderList");
  const total = document.getElementById("reviewOrderTotal");
  if (!list || !total) return;

  list.innerHTML = currentOrder
    .map(item => `
      <div class="review-item">
        <div>${item.quantity} × ${item.name}</div>
        <div>${formatNumber(item.price * item.quantity)} ج</div>
      </div>
    `)
    .join("");

  total.textContent = formatNumber(getOrderTotal());
}

function renderSuccessScreen() {
  const list = document.getElementById("successOrderList");
  const total = document.getElementById("successOrderTotal");
  if (!list || !total) return;

  list.innerHTML = lastSubmittedOrderSnapshot
    .map(item => `
      <div class="success-item">
        <div>${item.quantity} × ${item.name}</div>
        <div>${formatNumber(item.price * item.quantity)} ج</div>
      </div>
    `)
    .join("");

  total.textContent = formatNumber(
    lastSubmittedOrderSnapshot.reduce((acc, item) => acc + item.price * item.quantity, 0)
  );
}

/* ======================
   User Order DB
====================== */
function isNameValid() {
  const savedName = getSavedUserName().trim();
  if (!savedName) {
    alert("من فضلك اكتب اسمك أولاً.");
    showNameSetupScreen();
    return false;
  }
  return true;
}

async function loadUserOrderFromDB() {
  const uid = getCurrentUid();
  if (!uid) {
    userOrderDocId = null;
    return;
  }

  const querySnapshot = await getDocs(collection(db, "orders"));
  let foundDoc = null;

  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.ownerUid === uid) foundDoc = { id: docSnap.id, data };
  });

  userOrderDocId = foundDoc ? foundDoc.id : null;
}

async function saveOrderToFirestore(showAlertAfter = false) {
  if (!canSubmitOrder()) {
    alert("عذراً، لقد انتهى وقت استقبال الطلبات لليوم. يرجى المحاولة غداً.");
    return false;
  }

  let user;
  try {
    user = await ensureAnonymousAuth();
  } catch (e) {
    alert("فشل تسجيل الدخول المؤقت للمستخدم. تأكد من تفعيل Anonymous Authentication في Firebase.");
    return false;
  }

  if (!user?.uid) {
    alert("تعذر الحصول على هوية المستخدم المؤقتة.");
    return false;
  }

  const name = getSavedUserName().trim();
  const orderObj = {
    name,
    ownerUid: user.uid
  };

  currentOrder.forEach(item => {
    orderObj[item.id] = toInt(item.quantity);
    orderObj[`${item.id}_price`] = toInt(item.price);
  });

  orderObj.orderTotal = toInt(getOrderTotal());
  orderObj.createdAt = new Date().toISOString();

  try {
    if (userOrderDocId) {
      const docRef = doc(db, "orders", userOrderDocId);
      await updateDoc(docRef, orderObj);
      if (showAlertAfter) alert("تم تحديث الطلب بنجاح!");
    } else {
      const docRef = await addDoc(collection(db, "orders"), orderObj);
      userOrderDocId = docRef.id;
      if (showAlertAfter) alert("تم إرسال الطلب بنجاح!");
    }

    return true;
  } catch (e) {
    console.error(e);
    alert("حدث خطأ أثناء إرسال الطلب.");
    return false;
  }
}

/* ======================
   Aggregated Invoice بدون كسور
====================== */
function distributeDeliveryWithoutFractions(users, totalDelivery) {
  const safeDelivery = toInt(totalDelivery);
  const totalUnits = users.reduce((acc, user) => acc + toInt(user.units), 0);

  if (safeDelivery <= 0 || totalUnits <= 0) {
    return users.map(user => ({ ...user, deliveryShare: 0, finalTotal: toInt(user.itemsTotal) }));
  }

  const baseShares = users.map(user => {
    const units = toInt(user.units);
    const rawNumerator = units * safeDelivery;
    const share = Math.floor(rawNumerator / totalUnits);
    const remainder = rawNumerator % totalUnits;
    return { share, remainder };
  });

  let distributed = baseShares.reduce((acc, x) => acc + x.share, 0);
  let remaining = safeDelivery - distributed;

  const indexed = baseShares
    .map((x, idx) => ({ ...x, idx }))
    .sort((a, b) => b.remainder - a.remainder || b.idx - a.idx);

  for (let i = 0; i < indexed.length && remaining > 0; i += 1) {
    baseShares[indexed[i].idx].share += 1;
    remaining -= 1;
  }

  return users.map((user, idx) => {
    const deliveryShare = toInt(baseShares[idx].share);
    return {
      ...user,
      deliveryShare,
      finalTotal: toInt(toInt(user.itemsTotal) + deliveryShare)
    };
  });
}

async function buildTodaySummaryFromOrders(deliveryCost = 0) {
  const querySnapshot = await getDocs(collection(db, "orders"));
  const today = getEgyptDateString();

  const totalQuantities = {};
  const totalValues = {};
  const usersDetailed = [];
  let itemsGrandTotal = 0;
  let usersCount = 0;
  let totalUnits = 0;

  itemsList.forEach(item => {
    totalQuantities[item.id] = 0;
    totalValues[item.id] = 0;
  });

  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    const userItems = [];
    let userItemsTotal = 0;
    let userUnits = 0;

    itemsList.forEach(item => {
      const q = toInt(order[item.id] || 0);
      if (q > 0) {
        const price = toInt(order[`${item.id}_price`] || item.price || 0);
        const lineTotal = q * price;

        userItems.push({
          id: item.id,
          name: item.name,
          quantity: q,
          price,
          total: lineTotal
        });

        totalQuantities[item.id] += q;
        totalValues[item.id] += lineTotal;
        userItemsTotal += lineTotal;
        userUnits += q;
        totalUnits += q;
      }
    });

    if (userItems.length > 0) {
      usersCount++;
      usersDetailed.push({
        id: docSnap.id,
        name: order.name || "بدون اسم",
        createdAt: order.createdAt,
        items: userItems,
        itemsTotal: toInt(userItemsTotal),
        units: toInt(userUnits)
      });
    }
  });

  itemsList.forEach(item => {
    if (toInt(totalQuantities[item.id] || 0) > 0) {
      itemsGrandTotal += toInt(totalValues[item.id] || 0);
    }
  });

  const normalizedDeliveryCost = toInt(deliveryCost);
  const usersWithDelivery = distributeDeliveryWithoutFractions(usersDetailed, normalizedDeliveryCost);
  const distributedDeliveryTotal = usersWithDelivery.reduce((acc, user) => acc + toInt(user.deliveryShare), 0);
  const grandTotal = toInt(itemsGrandTotal + distributedDeliveryTotal);

  const summaryItems = itemsList
    .map(item => ({
      id: item.id,
      name: item.name,
      price: toInt(item.price || 0),
      quantity: toInt(totalQuantities[item.id] || 0),
      total: toInt(totalValues[item.id] || 0)
    }))
    .filter(item => item.quantity > 0);

  const whatsAppText = [
    "ملخص الفاتورة المجمعة:",
    "",
    ...summaryItems.map(item => `• ${item.name}: ${item.quantity}`),
    "",
    `تكلفة التوصيل: ${normalizedDeliveryCost} ج`,
    `الإجمالي شامل التوصيل: ${grandTotal} ج`
  ].join("\n");

  return {
    date: today,
    dateTimeText: getCurrentDateTimeText(),
    usersCount,
    totalUnits: toInt(totalUnits),
    totalDifferentItems: summaryItems.length,
    itemsGrandTotal: toInt(itemsGrandTotal),
    deliveryCost: normalizedDeliveryCost,
    distributedDeliveryTotal: toInt(distributedDeliveryTotal),
    grandTotal: toInt(grandTotal),
    summaryItems,
    usersDetailed: usersWithDelivery,
    whatsAppText,
    updatedAt: new Date().toISOString()
  };
}

async function refreshPublicSummary(deliveryCost = null, silent = false) {
  try {
    await ensureAnonymousAuth();

    const ref = doc(db, "public_summaries", getTodaySummaryDocId());
    const snap = await getDoc(ref);

    let finalDeliveryCost = 0;
    if (deliveryCost != null) {
      finalDeliveryCost = toInt(deliveryCost);
    } else if (snap.exists()) {
      finalDeliveryCost = toInt(snap.data()?.deliveryCost || 0);
    }

    const summary = await buildTodaySummaryFromOrders(finalDeliveryCost);
    await setDoc(ref, summary, { merge: true });

    if (!silent) alert("تم تحديث الفاتورة المجمعة بنجاح.");
    return true;
  } catch (e) {
    console.error(e);
    if (!silent) alert("فشل تحديث الفاتورة المجمعة.");
    return false;
  }
}

async function getPublicSummary() {
  const ref = doc(db, "public_summaries", getTodaySummaryDocId());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function renderAggregatedInvoiceScreen() {
  const deliveryInput = document.getElementById("aggregatedDeliveryCostInput");

  const usersCountEl = document.getElementById("aggregatedUsersCount");
  const unitsCountEl = document.getElementById("aggregatedUnitsCount");
  const dateTextEl = document.getElementById("aggregatedDateTimeText");
  const summaryBody = document.getElementById("aggregatedSummaryTableBody");
  const summaryFoot = document.getElementById("aggregatedSummaryTableFoot");
  const usersList = document.getElementById("aggregatedUsersDetailsList");
  const grandTotalEl = document.getElementById("aggregatedGrandTotal");
  const grandUsersCountEl = document.getElementById("aggregatedGrandUsersCount");
  const grandItemsCountEl = document.getElementById("aggregatedGrandItemsCount");
  const grandDeliveryEl = document.getElementById("aggregatedGrandDeliveryValue");

  const data = await getPublicSummary();

  if (!data) {
    if (deliveryInput) {
      deliveryInput.value = "0";
      deliveryInput.disabled = false;
    }

    if (usersCountEl) usersCountEl.textContent = "0";
    if (unitsCountEl) unitsCountEl.textContent = "0";
    if (dateTextEl) dateTextEl.textContent = "لم يتم تحديث الفاتورة المجمعة بعد";
    if (summaryBody) summaryBody.innerHTML = `<tr><td colspan="4" style="text-align:center;font-weight:900;color:#777;">لم يتم إنشاء الفاتورة المجمعة بعد. اضغط تحديث الفاتورة المجمعة.</td></tr>`;
    if (summaryFoot) summaryFoot.innerHTML = "";
    if (usersList) usersList.innerHTML = `<div class="user-order-detail-card" style="padding:16px;text-align:center;font-weight:1000;color:#777;">لا توجد بيانات متاحة بعد.</div>`;
    if (grandTotalEl) grandTotalEl.textContent = "0";
    if (grandUsersCountEl) grandUsersCountEl.textContent = "0";
    if (grandItemsCountEl) grandItemsCountEl.textContent = "0";
    if (grandDeliveryEl) grandDeliveryEl.textContent = "0";
    return;
  }

  if (deliveryInput) {
    deliveryInput.value = String(toInt(data.deliveryCost || 0));
    deliveryInput.disabled = false;
  }

  if (usersCountEl) usersCountEl.textContent = String(toInt(data.usersCount || 0));
  if (unitsCountEl) unitsCountEl.textContent = String(toInt(data.totalUnits || 0));
  if (dateTextEl) dateTextEl.textContent = data.dateTimeText || "--";

  if (summaryBody) {
    const rows = (data.summaryItems || []).map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${toInt(item.price)} ج</td>
        <td class="aggregated-highlight">${toInt(item.quantity)}</td>
        <td>${toInt(item.total)} ج</td>
      </tr>
    `);

    summaryBody.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="4" style="text-align:center;font-weight:900;color:#777;">لا توجد طلبات اليوم.</td></tr>`;
  }

  if (summaryFoot) {
    summaryFoot.innerHTML = `
      <tr>
        <td colspan="3" style="font-weight:1000;">الإجمالي الكلي</td>
        <td class="aggregated-highlight">${toInt(data.itemsGrandTotal || 0)} ج</td>
      </tr>
      <tr>
        <td colspan="3" style="font-weight:1000;">تكلفة التوصيل</td>
        <td class="aggregated-highlight">${toInt(data.distributedDeliveryTotal || 0)} ج</td>
      </tr>
      <tr>
        <td colspan="3" style="font-weight:1000;">الإجمالي شامل التوصيل</td>
        <td class="aggregated-highlight">${toInt(data.grandTotal || 0)} ج</td>
      </tr>
    `;
  }

  if (usersList) {
    const users = data.usersDetailed || [];
    if (!users.length) {
      usersList.innerHTML = `<div class="user-order-detail-card" style="padding:16px;text-align:center;font-weight:1000;color:#777;">لا توجد طلبات اليوم.</div>`;
    } else {
      usersList.innerHTML = users.map(user => {
        const firstLetter = String(user.name || "م").trim().charAt(0) || "م";
        const createdAtText = getShortDateTimeText(user.createdAt);

        return `
          <div class="user-order-detail-card">
            <div class="user-order-header">
              <div>
                <div class="user-order-total">${toInt(user.finalTotal)} ج
                  <small>شامل التوصيل</small>
                </div>
              </div>

              <div class="user-order-name-wrap">
                <div class="user-order-name">${user.name}</div>
                <div class="user-order-meta">${toInt(user.units)} وحدة • ${createdAtText}</div>
              </div>

              <div class="user-order-avatar">${firstLetter}</div>
            </div>

            <table class="user-order-table">
              <tbody>
                ${(user.items || []).map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${toInt(item.price)} ج</td>
                    <td class="aggregated-highlight">${toInt(item.quantity)} ×</td>
                    <td>${toInt(item.total)} ج</td>
                  </tr>
                `).join("")}

                <tr class="user-order-footer-row">
                  <td colspan="3">نصيب التوصيل</td>
                  <td>${toInt(user.deliveryShare)} ج</td>
                </tr>

                <tr class="user-order-final-row">
                  <td colspan="3">الإجمالي النهائي</td>
                  <td>${toInt(user.finalTotal)} ج</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }).join("");
    }
  }

  if (grandTotalEl) grandTotalEl.textContent = String(toInt(data.grandTotal || 0));
  if (grandUsersCountEl) grandUsersCountEl.textContent = String(toInt(data.usersCount || 0));
  if (grandItemsCountEl) grandItemsCountEl.textContent = String(toInt(data.totalDifferentItems || 0));
  if (grandDeliveryEl) grandDeliveryEl.textContent = String(toInt(data.distributedDeliveryTotal || 0));
}

async function openAggregatedInvoiceScreen() {
  await renderAggregatedInvoiceScreen();
  showScreen("aggregatedInvoiceScreen");
}

/* ======================
   Admin Orders Management
====================== */
function getOrderItemsFromOrderData(order) {
  const items = [];

  itemsList.forEach(item => {
    const qty = toInt(order[item.id] || 0);
    if (qty > 0) {
      const price = toInt(order[`${item.id}_price`] || item.price || 0);
      items.push({
        id: item.id,
        name: item.name,
        quantity: qty,
        price,
        total: qty * price
      });
    }
  });

  return items;
}

async function getTodayOrdersForAdmin() {
  const querySnapshot = await getDocs(collection(db, "orders"));
  const today = getEgyptDateString();
  const result = [];

  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    const items = getOrderItemsFromOrderData(order);
    const total = items.reduce((acc, item) => acc + item.total, 0);

    result.push({
      id: docSnap.id,
      name: order.name || "بدون اسم",
      createdAt: order.createdAt,
      ownerUid: order.ownerUid || "",
      items,
      total
    });
  });

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return result;
}

async function saveAdminEditedOrder(orderId, items) {
  const orderRef = doc(db, "orders", orderId);
  const currentSnap = await getDoc(orderRef);
  if (!currentSnap.exists()) {
    alert("الطلب غير موجود.");
    return false;
  }

  const currentData = currentSnap.data();
  const updatePayload = {
    name: currentData.name || "بدون اسم",
    ownerUid: currentData.ownerUid || "",
    createdAt: currentData.createdAt || new Date().toISOString()
  };

  itemsList.forEach(item => {
    updatePayload[item.id] = 0;
    updatePayload[`${item.id}_price`] = toInt(item.price || 0);
  });

  items.forEach(item => {
    updatePayload[item.id] = toInt(item.quantity);
    updatePayload[`${item.id}_price`] = toInt(item.price);
  });

  updatePayload.orderTotal = items.reduce((acc, item) => acc + toInt(item.quantity) * toInt(item.price), 0);

  try {
    await updateDoc(orderRef, updatePayload);
    return true;
  } catch (e) {
    console.error(e);
    alert("فشل تحديث الطلب.");
    return false;
  }
}

async function deleteOrderCompletely(orderId) {
  if (!confirm("هل أنت متأكد من حذف الطلب بالكامل نهائيًا؟")) return false;

  try {
    await deleteDoc(doc(db, "orders", orderId));
    return true;
  } catch (e) {
    console.error(e);
    alert("فشل حذف الطلب.");
    return false;
  }
}

async function deleteAllOrdersForever() {
  if (!confirm("سيتم حذف جميع الطلبات لكل الأيام نهائيًا من Firestore. هل أنت متأكد؟")) return;
  if (!confirm("تأكيد أخير: هذا الإجراء لا يمكن التراجع عنه. متابعة؟")) return;

  try {
    const snap = await getDocs(collection(db, "orders"));
    if (snap.empty) {
      alert("لا توجد طلبات للحذف.");
      return;
    }

    let batch = writeBatch(db);
    let count = 0;
    let processed = 0;

    for (const docSnap of snap.docs) {
      batch.delete(doc(db, "orders", docSnap.id));
      count += 1;
      processed += 1;

      if (count === 450) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    alert(`تم حذف ${processed} طلب نهائيًا.`);
    await renderAdminOrdersScreen();
    await renderAggregatedInvoiceScreen();
  } catch (e) {
    console.error(e);
    alert("حدث خطأ أثناء حذف جميع الطلبات.");
  }
}

async function renderAdminOrdersScreen() {
  const list = document.getElementById("adminOrdersList");
  if (!list) return;

  const orders = await getTodayOrdersForAdmin();

  if (orders.length === 0) {
    list.innerHTML = `<div class="admin-orders-item" style="text-align:center;font-weight:1000;color:#777;">لا توجد طلبات اليوم.</div>`;
    return;
  }

  list.innerHTML = orders.map(order => `
    <div class="admin-orders-item" data-order-id="${order.id}">
      <div class="admin-orders-item-head">
        <div>
          <div class="admin-orders-item-name">${order.name}</div>
          <div class="admin-orders-item-meta">${getShortDateTimeText(order.createdAt)} • ${order.items.length} صنف</div>
        </div>
        <div style="font-weight:1000;color:#d83000;">${order.total} ج</div>
      </div>

      <div class="admin-order-lines">
        ${order.items.map(item => `
          <div class="admin-order-line" data-item-id="${item.id}">
            <div>
              <div class="admin-order-line-name">${item.name}</div>
              <div style="color:#777;font-size:12px;font-weight:800;">${item.price} ج للوحدة</div>
            </div>

            <div class="admin-order-line-actions">
              <button class="admin-mini-btn plus" type="button" data-act="inc">+</button>
              <div class="admin-order-line-qty">${item.quantity}</div>
              <button class="admin-mini-btn minus" type="button" data-act="dec">−</button>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="admin-order-danger-row">
        <button class="btn admin-dash-secondary" type="button" data-save-order="${order.id}" style="flex:1;">حفظ التعديل</button>
        <button class="btn admin-dash-danger" type="button" data-delete-order="${order.id}" style="flex:1;">حذف الطلب بالكامل</button>
      </div>
    </div>
  `).join("");

  orders.forEach(order => {
    const card = list.querySelector(`[data-order-id="${order.id}"]`);
    if (!card) return;

    const workingItems = order.items.map(item => ({ ...item }));

    card.querySelectorAll(".admin-order-line").forEach(line => {
      const itemId = line.getAttribute("data-item-id");
      const qtyEl = line.querySelector(".admin-order-line-qty");
      const plusBtn = line.querySelector('[data-act="inc"]');
      const minusBtn = line.querySelector('[data-act="dec"]');

      plusBtn?.addEventListener("click", () => {
        const item = workingItems.find(x => x.id === itemId);
        if (!item) return;
        item.quantity = toInt(item.quantity + 1);
        item.total = toInt(item.quantity * item.price);
        qtyEl.textContent = String(item.quantity);
      });

      minusBtn?.addEventListener("click", () => {
        const idx = workingItems.findIndex(x => x.id === itemId);
        if (idx < 0) return;
        const item = workingItems[idx];
        item.quantity = toInt(item.quantity - 1);

        if (item.quantity <= 0) {
          workingItems.splice(idx, 1);
          line.remove();
          return;
        }

        item.total = toInt(item.quantity * item.price);
        qtyEl.textContent = String(item.quantity);
      });
    });

    card.querySelector(`[data-save-order="${order.id}"]`)?.addEventListener("click", async () => {
      if (!workingItems.length) {
        alert("لا يمكن حفظ طلب بدون أصناف. استخدم زر حذف الطلب بالكامل.");
        return;
      }

      const ok = await saveAdminEditedOrder(order.id, workingItems);
      if (!ok) return;

      alert("تم تعديل الطلب بنجاح.");
      await renderAdminOrdersScreen();
      await renderAggregatedInvoiceScreen();
    });

    card.querySelector(`[data-delete-order="${order.id}"]`)?.addEventListener("click", async () => {
      const ok = await deleteOrderCompletely(order.id);
      if (!ok) return;

      alert("تم حذف الطلب نهائيًا.");
      await renderAdminOrdersScreen();
      await renderAggregatedInvoiceScreen();
    });
  });
}

/* ======================
   Legacy helpers
====================== */
async function displayOrders() {
  const ordersTableBody = document.getElementById("ordersTableBody");
  if (!ordersTableBody) return;

  ordersTableBody.innerHTML = "";
  let totalQuantities = {};
  let totalValues = {};
  let totalSum = 0;
  let customersCount = 0;

  itemsList.forEach(item => {
    totalQuantities[item.id] = 0;
    totalValues[item.id] = 0;
  });

  const querySnapshot = await getDocs(collection(db, "orders"));
  let found = false;
  const today = getEgyptDateString();

  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    found = true;
    customersCount++;

    itemsList.forEach(item => {
      const q = toInt(order[item.id] || 0);
      if (q > 0) {
        totalQuantities[item.id] += q;
        totalValues[item.id] += q * toInt(order[`${item.id}_price`] || item.price || 0);
      }
    });
  });

  if (!found) {
    ordersTableBody.innerHTML = '<tr><td colspan="4">لا توجد طلبات حالياً.</td></tr>';
    return;
  }

  itemsList.forEach(item => {
    if (totalQuantities[item.id] > 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${item.name}</td><td>${totalQuantities[item.id]}</td><td>${formatNumber(item.price)} جنيه</td><td>${formatNumber(totalValues[item.id])} جنيه</td>`;
      ordersTableBody.appendChild(row);
      totalSum += totalValues[item.id];
    }
  });

  const usersOutput = document.getElementById("usersOutput");
  if (usersOutput) {
    usersOutput.innerHTML = "";
    querySnapshot.forEach(docSnap => {
      const order = docSnap.data();
      if (!order.createdAt) return;

      const d = new Date(order.createdAt);
      const egyptOffset = 2 * 60;
      const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
      const orderDate = egyptTime.toISOString().split("T")[0];
      if (orderDate !== today) return;

      const userDiv = document.createElement("div");
      userDiv.textContent = order.name || "بدون اسم";
      usersOutput.appendChild(userDiv);
    });
  }

  const tr = document.createElement("tr");
  tr.innerHTML = `<td colspan="3" style="text-align:right;font-weight:900;">الإجمالي الكلي (${customersCount} عملاء):</td><td style="font-weight:900;color:#166534;">${formatNumber(totalSum)} جنيه</td>`;
  ordersTableBody.appendChild(tr);
}

async function displayIndividualOrders() {
  const out = document.getElementById("individualOrdersOutput");
  if (!out) return;

  const querySnapshot = await getDocs(collection(db, "orders"));
  const today = getEgyptDateString();

  const todaysOrders = [];
  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    todaysOrders.push({ id: docSnap.id, ...order });
  });

  if (todaysOrders.length === 0) {
    out.innerHTML = `<p style="font-weight:900;color:#64748b;">لا توجد طلبات فردية اليوم.</p>`;
    return;
  }

  out.innerHTML = todaysOrders.map(o => {
    const lines = [];
    itemsList.forEach(item => {
      const q = toInt(o[item.id] || 0);
      if (q > 0) {
        const price = toInt(o[`${item.id}_price`] || item.price || 0);
        lines.push(`${item.name}: ${q} × ${price} = ${q * price}`);
      }
    });

    return `
      <div class="glass" style="padding:12px;border-radius:16px;margin-bottom:10px;">
        <div style="font-weight:1000;margin-bottom:6px;">${o.name || "بدون اسم"}</div>
        <pre style="white-space:pre-wrap;margin:0;color:#334155;font-weight:800;font-size:13px;">${lines.join("\n")}</pre>
      </div>
    `;
  }).join("");
}

/* ======================
   Admin UI
====================== */
function isAdminUser() {
  return !!(
    auth.currentUser &&
    !auth.currentUser.isAnonymous &&
    auth.currentUser.email &&
    auth.currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function requireAdminOrAlert() {
  if (!isAdminUser()) {
    alert("هذه العملية متاحة للأدمن فقط.");
    return false;
  }
  return true;
}

function updateAdminUI(user) {
  const addBtn = document.getElementById("openAddItemModal");
  const loginBtn = document.getElementById("adminLoginBtn");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const editItemsBtn = document.getElementById("editItemsBtn");
  const editCutoffBtn = document.getElementById("editCutoffTimeBtn");
  const manageCatsBtn = document.getElementById("manageCategoriesBtn");
  const adminSection = document.getElementById("adminSection");

  const isAdmin = !!(
    user &&
    !user.isAnonymous &&
    user.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  if (adminSection) adminSection.style.display = "block";

  if (isAdmin) {
    if (addBtn) addBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (loginBtn) loginBtn.style.display = "none";
    if (editItemsBtn) editItemsBtn.style.display = "inline-block";
    if (editCutoffBtn) editCutoffBtn.style.display = "inline-block";
    if (manageCatsBtn) manageCatsBtn.style.display = "inline-block";
  } else {
    if (addBtn) addBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (editItemsBtn) editItemsBtn.style.display = "none";
    if (editCutoffBtn) editCutoffBtn.style.display = "none";
    if (manageCatsBtn) manageCatsBtn.style.display = "none";
  }
}

onAuthStateChanged(auth, async (user) => {
  updateAdminUI(user);

  if (!user) {
    await ensureAnonymousAuth();
    return;
  }

  if (user.isAnonymous) {
    await loadUserOrderFromDB();
  }
});

document.getElementById("adminLoginBtn")?.addEventListener("click", () => {
  document.getElementById("adminEmail").value = "";
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminLoginMsg").textContent = "";
  document.getElementById("adminLoginModal").style.display = "flex";
});

document.getElementById("adminLoginCancelBtn")?.addEventListener("click", () => {
  document.getElementById("adminLoginModal").style.display = "none";
});

document.getElementById("adminLoginConfirmBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const msg = document.getElementById("adminLoginMsg");
  msg.textContent = "";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    if (cred.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      await ensureAnonymousAuth();
      msg.textContent = "ليس لديك صلاحية الأدمن!";
    } else {
      document.getElementById("adminLoginModal").style.display = "none";
      showScreen("adminDashboardScreen");
    }
  } catch (e) {
    console.error("Admin login failed:", e);
    const code = e?.code || "";
    if (code === "auth/user-not-found") msg.textContent = "هذا الإيميل غير موجود في Firebase Authentication.";
    else if (code === "auth/wrong-password") msg.textContent = "كلمة السر غير صحيحة.";
    else if (code === "auth/invalid-email") msg.textContent = "الإيميل غير صحيح.";
    else if (code === "auth/too-many-requests") msg.textContent = "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.";
    else if (code === "auth/operation-not-allowed") msg.textContent = "تسجيل الدخول بالإيميل/كلمة السر غير مُفعّل في Firebase.";
    else msg.textContent = `فشل الدخول: ${code || "Unknown error"}`;
  }
});

document.getElementById("adminLogoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  await ensureAnonymousAuth();
});

/* ======================
   Admin Cutoff
====================== */
function openCutoffTimeModal() {
  if (!requireAdminOrAlert()) return;

  const modal = document.getElementById("cutoffTimeModal");
  const input = document.getElementById("cutoffTimeInput");
  const msg = document.getElementById("cutoffTimeMsg");

  if (msg) {
    msg.style.color = "";
    msg.textContent = "";
  }

  if (input) {
    if (typeof currentCutoffTime === "string") input.value = currentCutoffTime;
    else if (typeof currentCutoffTime === "object" && currentCutoffTime.hour != null) {
      const hh = String(currentCutoffTime.hour).padStart(2, "0");
      const mm = String(currentCutoffTime.minute || 0).padStart(2, "0");
      input.value = `${hh}:${mm}`;
    } else input.value = DEFAULT_CUTOFF_TIME;
  }

  if (modal) modal.style.display = "flex";
}

function closeCutoffTimeModal() {
  const modal = document.getElementById("cutoffTimeModal");
  if (modal) modal.style.display = "none";
}

async function saveCutoffTime() {
  if (!requireAdminOrAlert()) return;

  const input = document.getElementById("cutoffTimeInput");
  const msg = document.getElementById("cutoffTimeMsg");
  const time = (input?.value || "").trim();

  if (!/^\d{2}:\d{2}$/.test(time)) {
    if (msg) msg.textContent = "اختر وقت صحيح.";
    return;
  }

  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  try {
    await setDoc(doc(db, "settings", "closingTime"), { hour, minute, time }, { merge: true });
    currentCutoffTime = time;
    updateCountdown();
    startCountdown();

    if (msg) {
      msg.style.color = "#166534";
      msg.textContent = "تم حفظ وقت الإغلاق.";
    }
    setTimeout(closeCutoffTimeModal, 350);
  } catch (e) {
    console.error(e);
    if (msg) msg.textContent = "فشل حفظ الوقت.";
  }
}

document.getElementById("editCutoffTimeBtn")?.addEventListener("click", openCutoffTimeModal);
document.getElementById("closeCutoffTimeModal")?.addEventListener("click", closeCutoffTimeModal);
document.getElementById("saveCutoffTimeBtn")?.addEventListener("click", saveCutoffTime);

/* ======================
   Admin Items
====================== */
function ensureAdminItemsModals() {
  if (!document.getElementById("itemsManageModal")) {
    const div = document.createElement("div");
    div.id = "itemsManageModal";
    div.className = "modal";
    div.innerHTML = `
      <div class="modal-card" style="width:min(520px,96vw);max-height:86vh;overflow:auto;">
        <h3 class="modal-title">إدارة الأصناف</h3>

        <div style="display:flex;gap:8px;align-items:center;">
          <input id="adminItemSearch" class="modal-input" placeholder="ابحث بالاسم أو ID..." style="margin-bottom:0;">
          <select id="adminItemCategoryFilter" class="modal-input" style="margin-bottom:0;max-width:170px;"></select>
        </div>

        <div id="adminItemsList" style="margin-top:10px;"></div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;">
          <button id="adminItemsPrev" class="btn btn-outline" type="button">السابق</button>
          <div id="adminItemsPageInfo" style="font-weight:900;color:#64748b;"></div>
          <button id="adminItemsNext" class="btn btn-outline" type="button">التالي</button>
        </div>

        <button id="closeItemsManageModal" class="btn btn-soft" style="width:100%;margin-top:10px;">إغلاق</button>
      </div>
    `;
    document.body.appendChild(div);
  }

  if (!document.getElementById("itemEditSingleModal")) {
    const div = document.createElement("div");
    div.id = "itemEditSingleModal";
    div.className = "modal";
    div.innerHTML = `
      <div class="modal-card" style="width:min(420px,96vw);">
        <h3 class="modal-title">تعديل صنف</h3>
        <div id="singleEditMeta" style="text-align:center;color:#64748b;font-weight:900;margin-bottom:10px;"></div>

        <label style="display:block;font-weight:900;margin-bottom:6px;">الاسم</label>
        <input id="singleEditName" class="modal-input" />

        <label style="display:block;font-weight:900;margin-bottom:6px;">السعر</label>
        <input id="singleEditPrice" type="number" min="0" step="1" class="modal-input" />

        <label style="display:block;font-weight:900;margin-bottom:6px;">القسم</label>
        <select id="singleEditCategory" class="modal-input"></select>

        <div id="singleEditMsg" class="modal-msg"></div>

        <div style="display:flex;gap:8px;">
          <button id="singleEditSaveBtn" class="btn btn-primary" type="button" style="flex:1;">حفظ</button>
          <button id="singleEditDeleteBtn" class="btn btn-soft" type="button" style="flex:1;background:rgba(239,68,68,.12);color:#991b1b;">حذف</button>
        </div>

        <button id="singleEditCloseBtn" class="btn btn-soft" type="button" style="width:100%;margin-top:10px;">إغلاق</button>
      </div>
    `;
    document.body.appendChild(div);
  }
}

let adminItemsState = { page: 1, pageSize: 10, search: "", category: "all" };
let currentEditingItemId = null;

function getAdminFilteredItems() {
  let list = [...itemsList];

  if (adminItemsState.category && adminItemsState.category !== "all") {
    list = list.filter(i => (i.category || guessCategory(i)) === adminItemsState.category);
  }

  const s = adminItemsState.search.trim().toLowerCase();
  if (s) {
    list = list.filter(i => String(i.name || "").toLowerCase().includes(s) || String(i.id || "").toLowerCase().includes(s));
  }

  list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  return list;
}

function renderAdminItemsList() {
  const wrap = document.getElementById("adminItemsList");
  const info = document.getElementById("adminItemsPageInfo");
  const prev = document.getElementById("adminItemsPrev");
  const next = document.getElementById("adminItemsNext");
  if (!wrap || !info || !prev || !next) return;

  const list = getAdminFilteredItems();
  const total = list.length;

  const pageSize = adminItemsState.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  adminItemsState.page = Math.min(adminItemsState.page, totalPages);

  const start = (adminItemsState.page - 1) * pageSize;
  const pageItems = list.slice(start, start + pageSize);

  info.textContent = `صفحة ${adminItemsState.page} من ${totalPages} • ${total} صنف`;

  prev.disabled = adminItemsState.page <= 1;
  next.disabled = adminItemsState.page >= totalPages;

  if (pageItems.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;color:#64748b;font-weight:900;padding:10px;">لا توجد نتائج.</div>`;
    return;
  }

  wrap.innerHTML = pageItems.map(item => {
    const cat = item.category || guessCategory(item);
    const catLabel = getCategoryLabelById(cat);
    return `
      <div class="glass" style="padding:12px;border-radius:16px;margin-bottom:10px;display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:1000;">${item.name}</div>
          <div style="color:#64748b;font-weight:900;font-size:12px;margin-top:4px;">
            ${formatNumber(item.price)} جنيه • ${catLabel} • ID: ${item.id}
          </div>
        </div>
        <button class="btn btn-primary" type="button" data-edit-item="${item.id}" style="white-space:nowrap;">تعديل</button>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-edit-item]").forEach(btn => {
    btn.addEventListener("click", () => openSingleEditModal(btn.getAttribute("data-edit-item")));
  });
}

function openItemsManageModal() {
  if (!requireAdminOrAlert()) return;

  ensureAdminItemsModals();

  const modal = document.getElementById("itemsManageModal");
  const search = document.getElementById("adminItemSearch");
  const cat = document.getElementById("adminItemCategoryFilter");

  refreshAdminCategoryDropdowns();
  if (cat) cat.value = adminItemsState.category;
  if (search) search.value = adminItemsState.search;

  if (!modal.dataset.wired) {
    modal.dataset.wired = "1";

    document.getElementById("closeItemsManageModal")?.addEventListener("click", () => {
      modal.style.display = "none";
    });

    document.getElementById("adminItemsPrev")?.addEventListener("click", () => {
      adminItemsState.page = Math.max(1, adminItemsState.page - 1);
      renderAdminItemsList();
    });

    document.getElementById("adminItemsNext")?.addEventListener("click", () => {
      adminItemsState.page += 1;
      renderAdminItemsList();
    });

    document.getElementById("adminItemSearch")?.addEventListener("input", e => {
      adminItemsState.search = String(e.target.value || "");
      adminItemsState.page = 1;
      renderAdminItemsList();
    });

    document.getElementById("adminItemCategoryFilter")?.addEventListener("change", e => {
      adminItemsState.category = String(e.target.value || "all");
      adminItemsState.page = 1;
      renderAdminItemsList();
    });
  }

  renderAdminItemsList();
  modal.style.display = "flex";
}

function closeSingleEditModal() {
  const m = document.getElementById("itemEditSingleModal");
  if (m) m.style.display = "none";
}

function openSingleEditModal(itemId) {
  ensureAdminItemsModals();
  const item = itemsList.find(x => x.id === itemId);
  if (!item) return;

  currentEditingItemId = itemId;

  const m = document.getElementById("itemEditSingleModal");
  const meta = document.getElementById("singleEditMeta");
  const name = document.getElementById("singleEditName");
  const price = document.getElementById("singleEditPrice");
  const cat = document.getElementById("singleEditCategory");
  const msg = document.getElementById("singleEditMsg");

  if (meta) meta.textContent = `ID: ${item.id}`;
  if (name) name.value = item.name || "";
  if (price) price.value = String(toInt(item.price || 0));

  refreshAdminCategoryDropdowns();
  if (cat) cat.value = item.category || guessCategory(item);

  if (msg) {
    msg.style.color = "";
    msg.textContent = "";
  }

  if (!m.dataset.wired) {
    m.dataset.wired = "1";

    document.getElementById("singleEditCloseBtn")?.addEventListener("click", closeSingleEditModal);

    document.getElementById("singleEditSaveBtn")?.addEventListener("click", async () => {
      if (!requireAdminOrAlert()) return;
      if (!currentEditingItemId) return;

      const msgEl = document.getElementById("singleEditMsg");
      const newName = (document.getElementById("singleEditName")?.value || "").trim();
      const newPrice = toInt(document.getElementById("singleEditPrice")?.value || 0);
      const newCat = (document.getElementById("singleEditCategory")?.value || "").trim();

      msgEl.style.color = "";
      msgEl.textContent = "";

      if (!newName) return (msgEl.textContent = "الاسم لا يمكن أن يكون فارغ.");
      if (newPrice < 0) return (msgEl.textContent = "السعر غير صحيح.");
      if (!newCat) return (msgEl.textContent = "اختر قسم.");

      try {
        await updateDoc(doc(db, "items", currentEditingItemId), { name: newName, price: newPrice, category: newCat });
        msgEl.style.color = "#166534";
        msgEl.textContent = "تم الحفظ.";
        await loadItems();
        renderAdminItemsList();
        renderItemsGrid();
        setTimeout(closeSingleEditModal, 250);
      } catch (e) {
        console.error(e);
        msgEl.textContent = "فشل الحفظ.";
      }
    });

    document.getElementById("singleEditDeleteBtn")?.addEventListener("click", async () => {
      if (!requireAdminOrAlert()) return;
      if (!currentEditingItemId) return;

      const item = itemsList.find(x => x.id === currentEditingItemId);
      const itemName = item?.name || currentEditingItemId;

      if (!confirm(`هل أنت متأكد من حذف الصنف: "${itemName}" ؟`)) return;

      try {
        await deleteDoc(doc(db, "items", currentEditingItemId));
        await loadItems();
        renderAdminItemsList();
        renderItemsGrid();
        closeSingleEditModal();
      } catch (e) {
        console.error(e);
        alert("فشل حذف الصنف.");
      }
    });
  }

  m.style.display = "flex";
}

document.getElementById("editItemsBtn")?.addEventListener("click", openItemsManageModal);

/* ======================
   Admin Add Item
====================== */
function openAddItemModal() {
  if (!requireAdminOrAlert()) return;

  const modal = document.getElementById("addItemModal");
  if (!modal) return;

  refreshAdminCategoryDropdowns();

  const nameEl = document.getElementById("modalItemName");
  const priceEl = document.getElementById("modalItemPrice");
  const msgEl = document.getElementById("modalAddItemMsg");

  if (nameEl) nameEl.value = "";
  if (priceEl) priceEl.value = "";
  if (msgEl) msgEl.textContent = "";

  modal.style.display = "flex";
}

function closeAddItemModal() {
  const modal = document.getElementById("addItemModal");
  if (modal) modal.style.display = "none";
}

document.getElementById("openAddItemModal")?.addEventListener("click", openAddItemModal);
document.getElementById("closeAddItemModal")?.addEventListener("click", closeAddItemModal);

async function confirmAddItem() {
  if (!requireAdminOrAlert()) return;

  const nameEl = document.getElementById("modalItemName");
  const priceEl = document.getElementById("modalItemPrice");
  const catEl = document.getElementById("modalItemCategory");
  const msgEl = document.getElementById("modalAddItemMsg");

  const name = (nameEl?.value || "").trim();
  const price = toInt(priceEl?.value || 0);
  const category = (catEl?.value || "").trim();

  if (!msgEl) return;

  msgEl.textContent = "";
  if (!name) return (msgEl.textContent = "اكتب اسم الصنف أولاً.");
  if (price <= 0) return (msgEl.textContent = "اكتب سعر صحيح أكبر من صفر.");
  if (!category) return (msgEl.textContent = "اختر قسم.");

  try {
    await addDoc(collection(db, "items"), { name, price, category });
    await loadItems();
    renderItemsGrid();
    closeAddItemModal();
  } catch (e) {
    console.error(e);
    msgEl.textContent = "حدث خطأ أثناء إضافة الصنف.";
  }
}

document.getElementById("confirmAddItem")?.addEventListener("click", confirmAddItem);

/* ======================
   Categories Admin
====================== */
function ensureCategoriesModal() {
  if (document.getElementById("categoriesModal")) return;

  const div = document.createElement("div");
  div.id = "categoriesModal";
  div.className = "modal";
  div.innerHTML = `
    <div class="modal-card" style="width:min(520px,96vw);max-height:86vh;overflow:auto;">
      <h3 class="modal-title">إدارة الأقسام</h3>

      <div class="glass" style="padding:12px;border-radius:16px;">
        <label style="font-weight:900;display:block;margin-bottom:6px;">ID القسم (بالإنجليزي - بدون مسافات)</label>
        <input id="catNewId" class="modal-input" placeholder="مثال: drinks" />

        <label style="font-weight:900;display:block;margin-bottom:6px;">اسم القسم</label>
        <input id="catNewLabel" class="modal-input" placeholder="مثال: مشروبات" />

        <label style="font-weight:900;display:block;margin-bottom:6px;">أيقونة FontAwesome (اختياري)</label>
        <input id="catNewIcon" class="modal-input" placeholder="مثال: fa-mug-hot" />

        <div id="catNewMsg" class="modal-msg"></div>
        <button id="catAddBtn" class="btn btn-primary" type="button" style="width:100%;">إضافة القسم</button>
      </div>

      <div style="height:10px;"></div>
      <div id="catsList"></div>

      <button id="catCloseBtn" class="btn btn-soft" type="button" style="width:100%;margin-top:10px;">إغلاق</button>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById("catCloseBtn").addEventListener("click", () => {
    div.style.display = "none";
  });

  document.getElementById("catAddBtn").addEventListener("click", addCategoryFromModal);
}

function openCategoriesModal() {
  if (!requireAdminOrAlert()) return;
  ensureCategoriesModal();
  renderCategoriesList();
  document.getElementById("categoriesModal").style.display = "flex";
}

document.getElementById("manageCategoriesBtn")?.addEventListener("click", openCategoriesModal);

async function addCategoryFromModal() {
  if (!requireAdminOrAlert()) return;

  const idEl = document.getElementById("catNewId");
  const labelEl = document.getElementById("catNewLabel");
  const iconEl = document.getElementById("catNewIcon");
  const msgEl = document.getElementById("catNewMsg");

  const id = String(idEl.value || "").trim().toLowerCase();
  const label = String(labelEl.value || "").trim();
  const icon = String(iconEl.value || "").trim() || "fa-tag";

  msgEl.textContent = "";
  msgEl.style.color = "";

  if (id === "all") return (msgEl.textContent = "لا يمكن إنشاء قسم باسم all.");
  if (!/^[a-z0-9_-]+$/.test(id)) return (msgEl.textContent = "ID غير صحيح. استخدم حروف/أرقام/_/- فقط.");
  if (!label) return (msgEl.textContent = "اكتب اسم القسم.");

  try {
    await setDoc(doc(db, "categories", id), { label, icon, sort: Date.now() }, { merge: true });
    idEl.value = "";
    labelEl.value = "";
    iconEl.value = "";
    msgEl.textContent = "";
    await loadCategories();
    renderCategoriesList();
    renderCategoryChips();
  } catch (e) {
    console.error(e);
    msgEl.textContent = "فشل إضافة القسم.";
  }
}

function renderCategoriesList() {
  const wrap = document.getElementById("catsList");
  if (!wrap) return;

  const list = categories.filter(c => c.id !== "all");

  wrap.innerHTML = list.map(c => `
    <div class="glass" style="padding:12px;border-radius:16px;margin-bottom:10px;">
      <div style="font-weight:1000;margin-bottom:8px;">
        ${c.label} <span style="color:#64748b;font-weight:900;">(ID: ${c.id})</span>
      </div>

      <label style="font-weight:900;display:block;margin-bottom:6px;">اسم القسم</label>
      <input class="modal-input" id="catLabel_${c.id}" value="${String(c.label).replace(/"/g, "&quot;")}">

      <label style="font-weight:900;display:block;margin-bottom:6px;">الأيقونة</label>
      <input class="modal-input" id="catIcon_${c.id}" value="${String(c.icon || "fa-tag").replace(/"/g, "&quot;")}">

      <div id="catMsg_${c.id}" class="modal-msg"></div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" type="button" data-cat-save="${c.id}" style="flex:1;">حفظ</button>
        <button class="btn btn-soft" type="button" data-cat-del="${c.id}" style="flex:1;background:rgba(239,68,68,.12);color:#991b1b;">حذف</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-cat-save]").forEach(btn => {
    btn.addEventListener("click", () => saveCategory(btn.getAttribute("data-cat-save")));
  });

  wrap.querySelectorAll("[data-cat-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteCategory(btn.getAttribute("data-cat-del")));
  });
}

async function saveCategory(catId) {
  if (!requireAdminOrAlert()) return;

  const label = (document.getElementById(`catLabel_${catId}`)?.value || "").trim();
  const icon = (document.getElementById(`catIcon_${catId}`)?.value || "").trim() || "fa-tag";
  const msg = document.getElementById(`catMsg_${catId}`);

  msg.textContent = "";
  msg.style.color = "";

  if (!label) return (msg.textContent = "اسم القسم مطلوب.");

  try {
    await setDoc(doc(db, "categories", catId), { label, icon }, { merge: true });
    msg.style.color = "#166534";
    msg.textContent = "تم الحفظ.";
    await loadCategories();
    renderCategoriesList();
    renderCategoryChips();
  } catch (e) {
    console.error(e);
    msg.textContent = "فشل الحفظ.";
  }
}

async function deleteCategory(catId) {
  if (!requireAdminOrAlert()) return;

  try {
    const q = query(collection(db, "items"), where("category", "==", catId), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      alert("لا يمكن حذف هذا القسم لأنه مستخدم في أصناف. غيّر أقسام هذه الأصناف أولاً ثم احذف القسم.");
      return;
    }
  } catch (e) {
    console.error(e);
    alert("تعذر التحقق من الأصناف المرتبطة بالقسم.");
    return;
  }

  if (!confirm(`حذف القسم "${catId}"؟`)) return;

  try {
    await deleteDoc(doc(db, "categories", catId));
    await loadCategories();
    renderCategoriesList();
    renderCategoryChips();
  } catch (e) {
    console.error(e);
    alert("فشل حذف القسم.");
  }
}

/* ======================
   WhatsApp Modal (محدّث بالكامل)
====================== */

/**
 * فتح مودال الواتساب
 * @param {string} text - نص الرسالة الجاهزة للإرسال (اختياري)
 */
function openWhatsAppModal(text = "") {
  const modal   = document.getElementById("whatsAppModal");
  const input   = document.getElementById("whatsAppNumberInput");
  const msgEl   = document.getElementById("whatsAppMsg");
  const pickBtn = document.getElementById("pickContactBtn");
  const preview = document.getElementById("whatsAppPreview");
  const title   = document.getElementById("whatsAppModalTitle");
  const sendBtn = document.getElementById("sendWhatsAppBtn");

  if (!modal || !input || !msgEl) return;

  // حفظ نص الرسالة ليستخدمه زر الإرسال
  pendingWhatsAppText = text;

  // إعادة تعيين حالة المودال
  msgEl.style.color = "";
  msgEl.textContent = "";
  input.value = getRestaurantWhatsAppNumber() || "";

  // تحديث العنوان ونص الزر حسب الوضع
  if (text) {
    if (title) title.textContent = "إرسال الطلب المجمع عبر واتساب";
    if (sendBtn) sendBtn.innerHTML = `<i class="fa-brands fa-whatsapp"></i> إرسال الآن`;
  } else {
    if (title) title.textContent = "حفظ رقم واتساب المطعم";
    if (sendBtn) sendBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> حفظ الرقم`;
  }

  // إظهار معاينة الرسالة فقط إذا كان في رسالة
  if (preview) {
    if (text) {
      preview.textContent = text;
      preview.style.display = "block";
    } else {
      preview.textContent = "";
      preview.style.display = "none";
    }
  }

  // إظهار زر جهات الاتصال فقط على المتصفحات الداعمة (Chrome Android)
  if (pickBtn) {
    const contactsSupported = ("contacts" in navigator && "ContactsManager" in window);
    pickBtn.style.display = contactsSupported ? "block" : "none";
  }

  modal.style.display = "flex";
}

function closeWhatsAppModal() {
  const modal = document.getElementById("whatsAppModal");
  if (modal) modal.style.display = "none";
  pendingWhatsAppText = "";
}

/* ======================
   Screen Events
====================== */
document.getElementById("enterAppBtn")?.addEventListener("click", async () => {
  markAppAsEntered();
  await ensureAnonymousAuth();
  continueIntoAppFlow();
});

document.getElementById("saveFirstUserNameBtn")?.addEventListener("click", () => {
  const input = document.getElementById("firstUserNameInput");
  const msg = document.getElementById("firstUserNameMsg");
  const value = String(input?.value || "").trim();

  if (!value) {
    if (msg) msg.textContent = "من فضلك اكتب اسمك أولاً.";
    return;
  }

  if (msg) msg.textContent = "";
  saveUserName(value);
  syncUserNameAcrossUI();
  showAppShell();
  showScreen("homeScreen");
});

document.getElementById("goToMenuBtn")?.addEventListener("click", () => {
  renderItemsGrid();
  renderStickyOrderSummary();
  showScreen("menuScreen");
});

document.getElementById("backToHomeFromMenu")?.addEventListener("click", () => {
  showScreen("homeScreen");
});

document.getElementById("openReviewScreenBtn")?.addEventListener("click", () => {
  if (!isNameValid()) return;
  if (currentOrder.length === 0) return;
  renderReviewScreen();
  showScreen("reviewScreen");
});

document.getElementById("backToMenuFromReview")?.addEventListener("click", () => {
  showScreen("menuScreen");
});

document.getElementById("confirmOrderButton")?.addEventListener("click", async () => {
  if (!isNameValid()) return;
  if (currentOrder.length === 0) return alert("الطلب فارغ.");

  lastSubmittedOrderSnapshot = currentOrder.map(item => ({
    ...item,
    quantity: toInt(item.quantity),
    price: toInt(item.price)
  }));

  const ok = await saveOrderToFirestore(false);
  if (!ok) return;

  await refreshPublicSummary(null, true);

  renderSuccessScreen();
  currentOrder = [];
  renderItemsGrid();
  renderStickyOrderSummary();
  showScreen("successScreen");
});

document.getElementById("successBackHomeBtn")?.addEventListener("click", () => {
  showScreen("homeScreen");
});

document.getElementById("showAggregatedInvoiceBtn")?.addEventListener("click", openAggregatedInvoiceScreen);
document.getElementById("successShowAggregatedBtn")?.addEventListener("click", openAggregatedInvoiceScreen);

document.getElementById("backFromAggregatedInvoiceBtn")?.addEventListener("click", () => {
  showScreen("homeScreen");
});

document.getElementById("aggregatedAddNewOrderBtn")?.addEventListener("click", () => {
  showScreen("menuScreen");
});

document.getElementById("aggregatedDeliveryCostInput")?.addEventListener("input", async (e) => {
  const deliveryCost = toInt(e.target.value || 0);
  const ok = await refreshPublicSummary(deliveryCost, true);
  if (ok) {
    await renderAggregatedInvoiceScreen();
  }
});

document.getElementById("aggregatedRefreshBtn")?.addEventListener("click", async () => {
  const ok = await refreshPublicSummary();
  if (ok) {
    await renderAggregatedInvoiceScreen();
  }
});

// =============================================
// زر واتساب في الفاتورة المجمعة (محدّث بالكامل)
// دايماً بيفتح المودال — المستخدم يختار/يغير الرقم
// =============================================
document.getElementById("aggregatedWhatsAppBtn")?.addEventListener("click", async () => {
  try {
    const data = await getPublicSummary();

    if (!data) {
      alert("لم يتم تحديث الفاتورة المجمعة بعد. اضغط تحديث أولاً.");
      return;
    }

    const msgText = data.whatsAppText || "";
    if (!msgText) {
      alert("لا توجد رسالة جاهزة للإرسال. تأكد من وجود طلبات اليوم.");
      return;
    }

    // دايماً افتح المودال مع الرسالة جاهزة
    openWhatsAppModal(msgText);

  } catch (e) {
    console.error(e);
    alert("حدث خطأ أثناء تجهيز رسالة واتساب.");
  }
});

document.getElementById("aggregatedExcelBtn")?.addEventListener("click", () => {
  document.getElementById("exportExcelButton")?.click();
});

document.getElementById("openAdminFromHomeBtn")?.addEventListener("click", () => {
  if (isAdminUser()) {
    showScreen("adminDashboardScreen");
    return;
  }

  document.getElementById("adminEmail").value = "";
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminLoginMsg").textContent = "";
  document.getElementById("adminLoginModal").style.display = "flex";
});

document.getElementById("backFromAdminDashboardBtn")?.addEventListener("click", async () => {
  if (!isAdminUser()) {
    await ensureAnonymousAuth();
  }
  showScreen("homeScreen");
});

document.getElementById("adminDashAddItemBtn")?.addEventListener("click", () => {
  openAddItemModal();
});

document.getElementById("adminDashEditItemsBtn")?.addEventListener("click", () => {
  openItemsManageModal();
});

document.getElementById("adminDashEditCutoffBtn")?.addEventListener("click", () => {
  openCutoffTimeModal();
});

document.getElementById("adminDashManageCategoriesBtn")?.addEventListener("click", () => {
  openCategoriesModal();
});

document.getElementById("adminDashManageOrdersBtn")?.addEventListener("click", async () => {
  await renderAdminOrdersScreen();
  showScreen("adminOrdersScreen");
});

document.getElementById("adminDashRefreshSummaryBtn")?.addEventListener("click", async () => {
  await refreshPublicSummary();
});

document.getElementById("adminDashDeleteAllOrdersBtn")?.addEventListener("click", async () => {
  if (!requireAdminOrAlert()) return;
  await deleteAllOrdersForever();
});

document.getElementById("adminDashLogoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  await ensureAnonymousAuth();
  showScreen("homeScreen");
});

document.getElementById("backFromAdminOrdersBtn")?.addEventListener("click", () => {
  showScreen("adminDashboardScreen");
});

document.getElementById("refreshAdminOrdersBtn")?.addEventListener("click", async () => {
  await renderAdminOrdersScreen();
});

// زر واتساب في الـ legacy panel — يفتح المودال بدون رسالة (وضع حفظ الرقم فقط)
document.getElementById("openWhatsAppModalBtn")?.addEventListener("click", () => openWhatsAppModal(""));

document.getElementById("closeWhatsAppModalBtn")?.addEventListener("click", closeWhatsAppModal);

// =============================================
// زر اختيار جهة الاتصال (Contacts API)
// يعمل فقط على Chrome Android + HTTPS
// =============================================
document.getElementById("pickContactBtn")?.addEventListener("click", async () => {
  try {
    const contacts = await navigator.contacts.select(["tel"], { multiple: false });

    // المستخدم ألغى الاختيار — لا نعمل شيء بصمت
    if (!contacts || contacts.length === 0) return;

    const tels = contacts[0]?.tel || [];
    if (tels.length === 0) {
      const msgEl = document.getElementById("whatsAppMsg");
      if (msgEl) {
        msgEl.style.color = "#dc2626";
        msgEl.textContent = "جهة الاتصال دي معندهاش رقم تليفون مسجل.";
      }
      return;
    }

    // نظّف الرقم وضعه في الـ input
    const normalized = normalizeWhatsAppNumber(tels[0]);
    const inputEl = document.getElementById("whatsAppNumberInput");
    if (inputEl) inputEl.value = normalized;

    const msgEl = document.getElementById("whatsAppMsg");
    if (msgEl) {
      msgEl.style.color = "#166534";
      msgEl.textContent = `✓ تم اختيار الرقم: ${normalized}`;
    }

  } catch (e) {
    // DOMException: AbortError = المستخدم ألغى بنفسه → تجاهل بصمت
    if (e?.name === "AbortError") return;

    console.error("Contacts API error:", e);
    const msgEl = document.getElementById("whatsAppMsg");
    if (msgEl) {
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "تعذر فتح جهات الاتصال. تأكد أن المتصفح يدعم هذه الخاصية.";
    }
  }
});

// =============================================
// زر الإرسال (محدّث بالكامل)
// - لو في رسالة معلقة → بيبعت على واتساب مباشرة
// - لو مفيش رسالة (legacy) → بيحفظ الرقم فقط
// =============================================
document.getElementById("sendWhatsAppBtn")?.addEventListener("click", () => {
  const inputEl = document.getElementById("whatsAppNumberInput");
  const msgEl   = document.getElementById("whatsAppMsg");
  const number  = normalizeWhatsAppNumber(inputEl?.value || "");

  msgEl.textContent = "";
  msgEl.style.color = "";

  // التحقق من الرقم — يجب أن يكون 10 أرقام على الأقل (صيغة دولية)
  if (!number || number.length < 10) {
    msgEl.style.color = "#dc2626";
    msgEl.textContent = "اكتب رقم صحيح بصيغة دولية بدون + (مثال: 201012345678).";
    return;
  }

  // احفظ الرقم دايماً للمرة الجاية
  setRestaurantWhatsAppNumber(number);

  if (pendingWhatsAppText) {
    // ── وضع الإرسال: افتح واتساب مباشرة ──
    const url = `https://wa.me/${number}?text=${encodeURIComponent(pendingWhatsAppText)}`;

    // استخدم location.href كـ fallback لو window.open اتبلوك
    const newWin = window.open(url, "_blank");
    if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
      // Popup blocker — افتح في نفس الـ tab كحل أخير
      window.location.href = url;
    }

    closeWhatsAppModal();

  } else {
    // ── وضع حفظ الرقم فقط (legacy) ──
    msgEl.style.color = "#166534";
    msgEl.textContent = "✓ تم حفظ الرقم بنجاح.";
    setTimeout(closeWhatsAppModal, 800);
  }
});

document.getElementById("viewOrdersButton")?.addEventListener("click", displayOrders);
document.getElementById("viewIndividualOrdersButton")?.addEventListener("click", displayIndividualOrders);

document.getElementById("exportExcelButton")?.addEventListener("click", async () => {
  const XLSX = window.XLSX;
  if (!XLSX) return alert("مكتبة التصدير غير محملة");

  const querySnapshot = await getDocs(collection(db, "orders"));
  let userOrders = {};
  let users = [];
  const today = getEgyptDateString();

  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    const name = order.name || "بدون اسم";
    if (!userOrders[name]) {
      userOrders[name] = [];
      users.push(name);
    }
    userOrders[name].push(order);
  });

  let mergedUserOrders = {};
  users.forEach(name => {
    let merged = {};
    userOrders[name].forEach(order => {
      for (let key in order) {
        if (["name", "createdAt", "orderTotal", "uuid", "ownerUid"].includes(key)) continue;
        if (key.endsWith("_price")) merged[key] = toInt(order[key]);
        else merged[key] = toInt(merged[key] || 0) + toInt(order[key] || 0);
      }
    });
    mergedUserOrders[name] = merged;
  });

  let rows = [];
  rows.push(["الاسم", "تفاصيل الطلب", "عدد الوحدات", "الإجمالي"]);

  users.forEach(name => {
    const merged = mergedUserOrders[name];
    let orderDetails = "";
    let orderTotal = 0;
    let unitsCount = 0;

    itemsList.forEach(item => {
      if (toInt(merged[item.id] || 0) > 0) {
        const price = toInt(merged[`${item.id}_price`] || item.price || 0);
        const quantity = toInt(merged[item.id] || 0);
        orderTotal += price * quantity;
        unitsCount += quantity;
        orderDetails += `${item.name}: ${quantity} × ${price} = ${quantity * price} جنيه\n`;
      }
    });

    rows.push([name, orderDetails.trim(), unitsCount, orderTotal]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الطلبيات");
  XLSX.writeFile(wb, "orders.xlsx", { bookType: "xlsx", type: "binary", bom: true });
});

/* ======================
   Service Worker
====================== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

/* ======================
   Startup
====================== */
window.addEventListener("load", async () => {
  console.log("enteredBefore =", hasEnteredAppBefore());
  console.log("savedUserName =", getSavedUserName());

  await ensureAnonymousAuth();

  if (!hasEnteredAppBefore()) {
    showWelcomeScreen();
  } else {
    continueIntoAppFlow();
  }

  await loadCategories();
  await loadItems();
  await loadUserOrderFromDB();
  await loadCutoffTime();
  startCountdown();
  syncUserNameAcrossUI();
});
