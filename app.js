// Firebase استيراد مكتبات
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
  limit
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-auth.js";

/* ======================
   إعدادات Firebase
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
   شاشة البداية
====================== */
const APP_ENTERED_STORAGE_KEY = "besmella_app_entered_once";

function hasEnteredAppBefore() {
  return localStorage.getItem(APP_ENTERED_STORAGE_KEY) === "1";
}

function markAppAsEntered() {
  localStorage.setItem(APP_ENTERED_STORAGE_KEY, "1");
}

function showWelcomeScreen() {
  const welcomeScreen = document.getElementById("welcomeScreen");
  const appShell = document.getElementById("appShell");

  document.body.classList.add("welcome-mode");
  if (welcomeScreen) welcomeScreen.classList.add("is-visible");
  if (appShell) appShell.classList.add("is-hidden");
}

function showAppShell() {
  const welcomeScreen = document.getElementById("welcomeScreen");
  const appShell = document.getElementById("appShell");

  document.body.classList.remove("welcome-mode");
  if (welcomeScreen) welcomeScreen.classList.remove("is-visible");
  if (appShell) appShell.classList.remove("is-hidden");
}

function initWelcomeScreen() {
  const enterBtn = document.getElementById("enterAppBtn");

  if (hasEnteredAppBefore()) {
    showAppShell();
  } else {
    showWelcomeScreen();
  }

  enterBtn?.addEventListener("click", () => {
    markAppAsEntered();
    showAppShell();
  });
}

/* ======================
   بريد الأدمن
====================== */
const ADMIN_EMAIL = "hussein-admin@g.tech.com";

/* ======================
   WhatsApp (رقم المطعم متغير)
====================== */
const WHATSAPP_NUMBER_STORAGE_KEY = "besmella_restaurant_whatsapp_number";

function normalizeWhatsAppNumber(raw) {
  const v = String(raw || "").trim().replace(/[^\d]/g, "");
  return v;
}

function getRestaurantWhatsAppNumber() {
  return localStorage.getItem(WHATSAPP_NUMBER_STORAGE_KEY) || "";
}

function setRestaurantWhatsAppNumber(num) {
  localStorage.setItem(WHATSAPP_NUMBER_STORAGE_KEY, normalizeWhatsAppNumber(num));
}

/* ======================
   Helpers عامة
====================== */
function formatNumber(num) {
  if (Number.isInteger(num)) return num;
  return Number(num).toFixed(2).replace(/\.?0+$/, "");
}

function getEgyptDateString() {
  const now = new Date();
  const egyptOffset = 2 * 60;
  const egyptTime = new Date(now.getTime() + (egyptOffset - now.getTimezoneOffset()) * 60000);
  return egyptTime.toISOString().split("T")[0];
}

/* ======================
   Categories (Dynamic from Firestore)
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

/* ======================
   فلاتر الأقسام (Chips)
====================== */
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
    btn.innerHTML = `<i class="fa-solid ${c.icon}" style="margin-left:8px;"></i>${c.label}`;

    btn.onclick = () => {
      activeCategory = c.id;
      chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");

      renderItemsGrid();
      showCurrentOrder();

      if (document.getElementById("orderSummary")?.style.display === "block") showSummary();
    };

    chips.appendChild(btn);
  });
}

/* ======================
   إدارة وقت إغلاق الطلبات
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

  let cutoffHours = 8,
    cutoffMinutes = 30;
  if (typeof currentCutoffTime === "string") {
    const parts = currentCutoffTime.split(":").map(x => Number(x));
    cutoffHours = parts[0];
    cutoffMinutes = parts[1] || 0;
  } else if (typeof currentCutoffTime === "object" && currentCutoffTime.hour != null) {
    cutoffHours = Number(currentCutoffTime.hour);
    cutoffMinutes = Number(currentCutoffTime.minute || 0);
  }

  const cutoffToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoffHours, cutoffMinutes, 0, 0);
  let diffMs = cutoffToday - now;
  let isOpen = true;

  if (diffMs <= 0) {
    const cutoffTomorrow = new Date(cutoffToday);
    cutoffTomorrow.setDate(cutoffTomorrow.getDate() + 1);
    diffMs = cutoffTomorrow - now;
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
  const ordersClosedMsg = document.getElementById("ordersClosedMessage");
  const orderSection = document.querySelector(".order-section");

  const timeInfo = getTimeUntilCutoff();
  ordersOpen = timeInfo.isOpen;

  if (timeInfo.isOpen) {
    if (ordersClosedMsg) ordersClosedMsg.style.display = "none";
    if (orderSection) orderSection.style.display = "block";
  } else {
    if (ordersClosedMsg) ordersClosedMsg.style.display = "block";
    if (orderSection) orderSection.style.display = "none";
  }
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
   قائمة الأصناف الافتراضية
====================== */
const fallbackItems = [
  { name: "بطاطس سلطه وطحينه", id: "potato_salata_tahina", price: 14 },
  { name: "بطاطس توابل سادة", id: "potato_tawabel_plain", price: 14 },
  { name: "بطاطس توابل وطحينه", id: "potato_tawabel_tahina", price: 14 },
  { name: "بطاطس رومي", id: "potato_romi", price: 25 },
  { name: "فول حار", id: "foul_hot", price: 12 },
  { name: "فول ساده", id: "foul_plain", price: 10 },
  { name: "فول سلطه", id: "foul_salata", price: 10 },
  { name: "فول اسكندراني", id: "foul_iskandrani", price: 12 },
  { name: "طعميه", id: "ta3miya", price: 10 },
  { name: "طعميه محشيه", id: "ta3miya_ma7shya", price: 12 },
  { name: "قرص طعمية محشيه", id: "koras_ma7shya", price: 5 },
  { name: "بابا غنوج", id: "baba_ganoug", price: 12 },
  { name: "خدمة توصيل", id: "delivery", price: 22, disabled: true }
].map(i => ({ ...i, category: guessCategory(i) }));

/* ======================
   UUID للمستخدم
====================== */
function getOrCreateUserUUID() {
  let uuid = localStorage.getItem("fattarney_order_uuid");
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem("fattarney_order_uuid", uuid);
  }
  return uuid;
}

function toggleNameInput(disable) {
  const nameInput = document.getElementById("nameInput");
  if (!nameInput) return;
  nameInput.disabled = disable;
  nameInput.style.opacity = disable ? ".75" : "1";
}

let userOrderDocId = null;
let currentOrder = [];
let itemsList = [];

/* ======================
   Helpers فلترة
====================== */
function getFilteredItems() {
  if (activeCategory === "all") return itemsList;
  return itemsList.filter(x => (x.category || guessCategory(x)) === activeCategory);
}

function getItemCategoryById(itemId) {
  const fromItems = itemsList?.find(x => x.id === itemId);
  if (fromItems?.category) return fromItems.category;
  if (fromItems) return guessCategory(fromItems);
  return guessCategory({ id: itemId, name: "" });
}

function getFilteredCurrentOrder() {
  if (activeCategory === "all") return currentOrder;
  return currentOrder.filter(o => getItemCategoryById(o.id) === activeCategory);
}

/* ======================
   Validation الاسم
====================== */
function isNameValid() {
  const nameInput = document.getElementById("nameInput");
  const nameMsg = document.getElementById("nameRequiredMsg");
  if (!nameInput || !nameMsg) return true;

  if (!nameInput.value.trim()) {
    nameMsg.style.display = "block";
    nameInput.focus();
    return false;
  }

  nameMsg.style.display = "none";
  const heroUserName = document.getElementById("heroUserName");
  if (heroUserName) heroUserName.textContent = nameInput.value.trim();
  return true;
}

/* ======================
   تحميل طلب المستخدم
====================== */
async function loadUserOrderFromDB() {
  const uuid = getOrCreateUserUUID();
  const querySnapshot = await getDocs(collection(db, "orders"));
  let foundDoc = null;

  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.uuid === uuid && !data.archived) foundDoc = { id: docSnap.id, data };
  });

  if (foundDoc) {
    userOrderDocId = foundDoc.id;
    currentOrder = [];

    itemsList.forEach(item => {
      const qty = foundDoc.data[item.id];
      const price = foundDoc.data[`${item.id}_price`] || item.price;
      if (qty && qty > 0) currentOrder.push({ id: item.id, name: item.name, quantity: qty, price });
    });

    const nameInput = document.getElementById("nameInput");
    if (nameInput) nameInput.value = foundDoc.data.name;

    const heroUserName = document.getElementById("heroUserName");
    if (heroUserName) heroUserName.textContent = foundDoc.data.name || "مستخدم";

    toggleNameInput(true);
    showCurrentOrder();
  } else {
    userOrderDocId = null;
    currentOrder = [];
    toggleNameInput(false);
    showCurrentOrder();
  }
}

/* ======================
   إلغاء فكرة الأرشفة/الحذف التلقائي
====================== */
async function autoArchiveOldOrders() {
  // intentionally disabled
}

/* ======================
   تحميل الأصن��ف
====================== */
async function loadItems() {
  try {
    const q = query(collection(db, "items"), orderBy("name"));
    const itemsSnapshot = await getDocs(q);
    itemsList = [];

    itemsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = { id: docSnap.id, ...data };
      if (typeof item.price === "undefined") item.price = 0;
      item.category = item.category || guessCategory(item);
      itemsList.push(item);
    });

    if (itemsList.length === 0) itemsList = fallbackItems;
  } catch {
    itemsList = fallbackItems;
  }

  renderItemsGrid();
}

/* ======================
   صور الأصناف
====================== */
const ITEM_IMAGES = {
  potato: "fast 8.png",
  foul: "breadfast 1.png",
  ta3miya: "breadfast 2.png",
  salad: "fast 9.png",
  extras: "breadfast 3.png",
  all: "fast 7.png"
};

function getImageForItem(item) {
  if (item?.imageUrl) return item.imageUrl;
  const cat = item.category || guessCategory(item);
  return ITEM_IMAGES[cat] || ITEM_IMAGES.all;
}

/* ======================
   عرض الأصناف ككروت + عداد + إضافة
====================== */
function clampQty(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function renderItemsGrid() {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;

  const filtered = getFilteredItems().filter(x => !(x.id === "delivery" || x.disabled));
  grid.innerHTML = "";

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:12px;text-align:center;color:#64748b;font-weight:900;">لا توجد أصناف في هذا القسم</div>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";

    const imgSrc = getImageForItem(item);

    card.innerHTML = `
      <div class="item-top">
        <img class="item-img" src="${imgSrc}" alt="${item.name}">
        <div class="item-meta">
          <div class="item-name">${item.name}</div>
          <div class="item-price">${formatNumber(item.price)} جنيه</div>
        </div>
      </div>

      <div class="item-controls">
        <div class="qty-stepper" aria-label="عداد الكمية">
          <button class="qty-btn" type="button" data-act="minus">-</button>
          <input class="qty-input" type="number" min="1" value="1" inputmode="numeric" aria-label="الكمية">
          <button class="qty-btn" type="button" data-act="plus">+</button>
        </div>

        <button class="btn btn-primary" type="button" data-act="add">
          <i class="fa-solid fa-plus"></i> إضافة
        </button>
      </div>
    `;

    const qtyInput = card.querySelector(".qty-input");
    const minusBtn = card.querySelector('[data-act="minus"]');
    const plusBtn = card.querySelector('[data-act="plus"]');
    const addBtn = card.querySelector('[data-act="add"]');

    minusBtn.addEventListener("click", () => {
      qtyInput.value = String(Math.max(1, clampQty(qtyInput.value) - 1));
    });

    plusBtn.addEventListener("click", () => {
      qtyInput.value = String(clampQty(qtyInput.value) + 1);
    });

    qtyInput.addEventListener("input", () => {
      qtyInput.value = String(clampQty(qtyInput.value || 1));
    });

    addBtn.addEventListener("click", async () => {
      if (!canSubmitOrder()) {
        alert("عذراً، لقد انتهى وقت استقبال الطلبات لليوم. يرجى المحاولة غداً.");
        return;
      }
      if (!isNameValid()) return;

      const qty = clampQty(qtyInput.value || 1);
      qtyInput.value = String(qty);

      const existing = currentOrder.find(x => x.id === item.id);
      if (existing) existing.quantity += qty;
      else currentOrder.push({ id: item.id, name: item.name, quantity: qty, price: Number(item.price) || 0 });

      showCurrentOrder();

      if (userOrderDocId) await saveOrderToFirestore(false);
    });

    grid.appendChild(card);
  });
}

/* ======================
   عرض الطلب الحالي (كروت)
====================== */
function renderCurrentOrderCards() {
  const cardsWrap = document.getElementById("orderCards");
  if (!cardsWrap) return;

  const filteredOrder = getFilteredCurrentOrder();
  cardsWrap.innerHTML = "";

  if (filteredOrder.length === 0) {
    cardsWrap.innerHTML = `
      <div style="padding:12px;border-radius:16px;background:rgba(2,6,23,.06);font-weight:1000;color:#475569;text-align:center;">
        لا توجد أصناف في هذا القسم داخل طلبك.
      </div>
    `;
    return;
  }

  filteredOrder.forEach(item => {
    const total = item.quantity * item.price;
    const realIndex = currentOrder.findIndex(x => x.id === item.id);
    const catLabel = getCategoryLabelById(getItemCategoryById(item.id));

    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <div class="meta">
        <div class="title">${item.name}</div>
        <div class="sub">
          <span class="badge"><i class="fa-solid fa-tag"></i> ${catLabel}</span>
          <span class="badge qty"><i class="fa-solid fa-hashtag"></i> الكمية: ${item.quantity}</span>
          <span class="badge price"><i class="fa-solid fa-coins"></i> ${formatNumber(total)} جنيه</span>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="order-action" data-a="inc">+1</button>
        <button type="button" class="order-action" data-a="dec">-1</button>
        <button type="button" class="order-action danger" data-a="del">حذف</button>
      </div>
    `;

    card.querySelector('[data-a="inc"]').addEventListener("click", async () => {
      currentOrder[realIndex].quantity += 1;
      showCurrentOrder();
      if (userOrderDocId) await saveOrderToFirestore(false);
    });

    card.querySelector('[data-a="dec"]').addEventListener("click", async () => {
      currentOrder[realIndex].quantity = Math.max(1, currentOrder[realIndex].quantity - 1);
      showCurrentOrder();
      if (userOrderDocId) await saveOrderToFirestore(false);
    });

    card.querySelector('[data-a="del"]').addEventListener("click", async () => {
      if (!confirm("حذف الصنف من الطلب؟")) return;
      const removed = currentOrder.splice(realIndex, 1)[0];
      showCurrentOrder();

      if (userOrderDocId) {
        const docRef = doc(db, "orders", userOrderDocId);
        const updateObj = {};
        updateObj[removed.id] = 0;
        updateObj[`${removed.id}_price`] = removed.price;
        await updateDoc(docRef, updateObj);
      }
    });

    cardsWrap.appendChild(card);
  });
}

function showCurrentOrder() {
  const section = document.getElementById("currentOrder");
  if (!section) return;

  if (currentOrder.length > 0) {
    section.style.display = "block";
    renderCurrentOrderCards();
  } else {
    section.style.display = "none";
  }
}

/* ======================
   ملخص/تأكيد
====================== */
document.getElementById("submitOrderButton")?.addEventListener("click", () => {
  if (!canSubmitOrder()) return alert("عذراً، لقد انتهى وقت استقبال الطلبات لليوم. يرجى المحاولة غداً.");
  if (!isNameValid()) return;
  if (currentOrder.length === 0) return alert("يرجى إضافة صنف واحد على الأقل.");
  showSummary();
});

function showSummary() {
  const summarySection = document.getElementById("orderSummary");
  const summaryList = document.getElementById("summaryList");
  const totalEl = document.getElementById("orderTotal");
  if (!summarySection || !summaryList || !totalEl) return;

  summaryList.innerHTML = "";
  const filteredOrder = getFilteredCurrentOrder();

  if (filteredOrder.length === 0) {
    summaryList.innerHTML = `
      <tr>
        <td colspan="4" style="font-weight:1000;color:#475569;">
          لا توجد أصناف في هذا القسم داخل طلبك.
        </td>
      </tr>
    `;
    totalEl.textContent = "0";
    summarySection.style.display = "block";
    document.getElementById("currentOrder").style.display = "none";
    return;
  }

  let total = 0;
  filteredOrder.forEach(item => {
    const row = document.createElement("tr");
    const rowTotal = item.quantity * item.price;
    total += rowTotal;
    row.innerHTML = `<td>${item.name}</td><td>${item.quantity}</td><td>${formatNumber(item.price)}</td><td>${formatNumber(rowTotal)}</td>`;
    summaryList.appendChild(row);
  });

  totalEl.textContent = String(formatNumber(total));
  summarySection.style.display = "block";
  document.getElementById("currentOrder").style.display = "none";
}

document.getElementById("editSummaryButton")?.addEventListener("click", () => {
  document.getElementById("orderSummary").style.display = "none";
  showCurrentOrder();
});

document.getElementById("confirmOrderButton")?.addEventListener("click", submitOrder);

async function submitOrder() {
  if (!canSubmitOrder()) return alert("عذراً، لقد انتهى وقت استقبال الطلبات لليوم. يرجى المحاولة غداً.");
  if (!isNameValid()) return;
  if (currentOrder.length === 0) return alert("الطلب فارغ. أضف أصناف أولاً.");
  await saveOrderToFirestore(true);
}

async function saveOrderToFirestore(showAlertAfter = false) {
  if (!canSubmitOrder()) return alert("عذراً، لقد انتهى وقت استقبال الطلبات لليوم. يرجى المحاولة غداً.");

  const name = document.getElementById("nameInput")?.value?.trim() || "";
  const uuid = getOrCreateUserUUID();
  const orderObj = { name };

  currentOrder.forEach(item => {
    orderObj[item.id] = item.quantity;
    orderObj[`${item.id}_price`] = item.price;
  });

  orderObj.orderTotal = currentOrder.reduce((acc, item) => acc + item.price * item.quantity, 0);
  orderObj.createdAt = new Date().toISOString();
  orderObj.uuid = uuid;

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

    toggleNameInput(true);
    await loadUserOrderFromDB();

    const summary = document.getElementById("orderSummary");
    if (summary) summary.style.display = "none";
  } catch {
    alert("حدث خطأ أثناء إرسال الطلب.");
  }
}

/* ======================
   عرض الطلبات + زر واتساب + Excel + الطلبات الفردية
====================== */
async function displayOrders() {
  const ordersTableBody = document.getElementById("ordersTableBody");
  if (!ordersTableBody) return;

  ordersTableBody.innerHTML = "";
  let totalQuantities = {};
  let totalValues = {};
  let totalSum = 0;
  let totalSandwiches = 0;
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
    if (order.archived) return;
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    found = true;
    customersCount++;

    itemsList.forEach(item => {
      const q = parseInt(order[item.id] || 0);
      if (!isNaN(q) && q > 0) {
        totalQuantities[item.id] += q;
        totalValues[item.id] += q * (order[`${item.id}_price`] || item.price || 0);
        if (item.id !== "delivery") totalSandwiches += q;
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
      if (item.id !== "delivery") totalSum += totalValues[item.id];
    }
  });

  const deliveryItem = itemsList.find(x => x.id === "delivery");
  if (deliveryItem && Number(deliveryItem.price || 0) > 0 && totalSandwiches > 0) {
    totalSum += Number(deliveryItem.price || 0);
    const deliveryRow = document.createElement("tr");
    deliveryRow.innerHTML = `<td>خدمة توصيل</td><td colspan="2"></td><td>${formatNumber(deliveryItem.price)} جنيه</td>`;
    ordersTableBody.appendChild(deliveryRow);
  }

  const usersOutput = document.getElementById("usersOutput");
  if (usersOutput) {
    usersOutput.innerHTML = "";
    querySnapshot.forEach(docSnap => {
      const order = docSnap.data();
      if (order.archived) return;
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

async function getTodaysAggregatedOrdersData() {
  const querySnapshot = await getDocs(collection(db, "orders"));
  const today = getEgyptDateString();

  let totalQuantities = {};
  let totalValues = {};
  let totalSum = 0;
  let totalSandwiches = 0;
  let customersCount = 0;

  itemsList.forEach(item => {
    totalQuantities[item.id] = 0;
    totalValues[item.id] = 0;
  });

  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (order.archived) return;
    if (!order.createdAt) return;

    const d = new Date(order.createdAt);
    const egyptOffset = 2 * 60;
    const egyptTime = new Date(d.getTime() + (egyptOffset - d.getTimezoneOffset()) * 60000);
    const orderDate = egyptTime.toISOString().split("T")[0];
    if (orderDate !== today) return;

    customersCount++;

    itemsList.forEach(item => {
      const q = parseInt(order[item.id] || 0);
      if (!isNaN(q) && q > 0) {
        totalQuantities[item.id] += q;
        totalValues[item.id] += q * (order[`${item.id}_price`] || item.price || 0);
        if (item.id !== "delivery") totalSandwiches += q;
      }
    });
  });

  itemsList.forEach(item => {
    if (Number(totalQuantities[item.id] || 0) > 0 && item.id !== "delivery") {
      totalSum += Number(totalValues[item.id] || 0);
    }
  });

  const deliveryItem = itemsList.find(x => x.id === "delivery");
  if (deliveryItem && Number(deliveryItem.price || 0) > 0 && totalSandwiches > 0) {
    totalSum += Number(deliveryItem.price || 0);
  }

  return {
    today,
    customersCount,
    totalQuantities,
    totalValues,
    totalSum,
    totalSandwiches,
    deliveryItem
  };
}

function buildWhatsAppAggregatedMessage(data) {
  const lines = [];

  itemsList.forEach(item => {
    const q = Number(data.totalQuantities[item.id] || 0);
    if (q > 0 && item.id !== "delivery") {
      lines.push(`• ${item.name}: ${formatNumber(q)}`);
    }
  });

  if (lines.length === 0) return "لا توجد أصناف اليوم.";
  return lines.join("\n");
}

async function sendAggregatedOrdersToWhatsApp() {
  const number = normalizeWhatsAppNumber(getRestaurantWhatsAppNumber());
  if (!number) {
    openWhatsAppModal(true);
    return;
  }

  try {
    const data = await getTodaysAggregatedOrdersData();
    if (!data.customersCount) {
      alert("لا توجد طلبات اليوم لإرسالها.");
      return;
    }

    const msg = buildWhatsAppAggregatedMessage(data);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  } catch (e) {
    console.error(e);
    alert("حدث خطأ أثناء تجهيز رسالة واتساب.");
  }
}

/* ======================
   WhatsApp Modal UI
====================== */
function openWhatsAppModal(fromSend = false) {
  const modal = document.getElementById("whatsAppModal");
  const input = document.getElementById("whatsAppNumberInput");
  const msg = document.getElementById("whatsAppMsg");

  if (!modal || !input || !msg) return;

  msg.style.color = "";
  msg.textContent = fromSend ? "اكتب رقم واتساب المطعم ثم اضغط إرسال." : "";

  input.value = getRestaurantWhatsAppNumber() || "";
  modal.style.display = "flex";
}

function closeWhatsAppModal() {
  const modal = document.getElementById("whatsAppModal");
  if (modal) modal.style.display = "none";
}

document.getElementById("openWhatsAppModalBtn")?.addEventListener("click", () => openWhatsAppModal(false));
document.getElementById("closeWhatsAppModalBtn")?.addEventListener("click", closeWhatsAppModal);

document.getElementById("sendWhatsAppBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("whatsAppNumberInput");
  const msg = document.getElementById("whatsAppMsg");
  const number = normalizeWhatsAppNumber(input?.value || "");

  msg.textContent = "";
  msg.style.color = "";

  if (!number || number.length < 8) {
    msg.textContent = "اكتب رقم صحيح بصيغة دولية بدون + (مثال: 2010xxxxxxx).";
    return;
  }

  setRestaurantWhatsAppNumber(number);
  msg.style.color = "#166534";
  msg.textContent = "تم حفظ الرقم. جاري تجهيز الرسالة...";

  setTimeout(closeWhatsAppModal, 200);
  await sendAggregatedOrdersToWhatsApp();
});

/* ======================
   الطلبات الفردية
====================== */
async function displayIndividualOrders() {
  const out = document.getElementById("individualOrdersOutput");
  if (!out) return;

  const querySnapshot = await getDocs(collection(db, "orders"));
  const today = getEgyptDateString();

  const todaysOrders = [];
  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (order.archived) return;
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

  out.innerHTML = todaysOrders
    .map(o => {
      const lines = [];
      itemsList.forEach(item => {
        const q = Number(o[item.id] || 0);
        if (q > 0) {
          const price = Number(o[`${item.id}_price`] || item.price || 0);
          lines.push(`${item.name}: ${q} × ${price} = ${q * price}`);
        }
      });

      return `
      <div class="glass" style="padding:12px;border-radius:16px;margin-bottom:10px;">
        <div style="font-weight:1000;margin-bottom:6px;">${o.name || "بدون اسم"}</div>
        <pre style="white-space:pre-wrap;margin:0;color:#334155;font-weight:800;font-size:13px;">${lines.join("\n")}</pre>
      </div>
    `;
    })
    .join("");
}

function toggleSections(sectionToShow) {
  const sections = ["ordersSection", "individualOrdersSection"];
  sections.forEach(section => {
    const el = document.getElementById(section);
    if (!el) return;
    el.style.display = section === sectionToShow ? "block" : "none";
  });
}

document.getElementById("viewOrdersButton")?.addEventListener("click", () => {
  toggleSections("ordersSection");
  displayOrders();
});

document.getElementById("viewIndividualOrdersButton")?.addEventListener("click", () => {
  toggleSections("individualOrdersSection");
  displayIndividualOrders();
});

document.getElementById("exportExcelButton")?.addEventListener("click", async () => {
  const XLSX = window.XLSX;
  if (!XLSX) return alert("مكتبة التصدير غير محملة");

  const querySnapshot = await getDocs(collection(db, "orders"));
  let userOrders = {};
  let users = [];
  const today = getEgyptDateString();

  querySnapshot.forEach(docSnap => {
    const order = docSnap.data();
    if (order.archived) return;
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
        if (["name", "createdAt", "archived", "orderTotal", "uuid"].includes(key)) continue;
        if (key.endsWith("_price")) merged[key] = order[key];
        else merged[key] = (merged[key] || 0) + Number(order[key] || 0);
      }
    });
    mergedUserOrders[name] = merged;
  });

  let rows = [];
  rows.push(["الاسم", "تفاصيل الطلب", "عدد السندوتشات", "الإجمالي"]);

  users.forEach(name => {
    const merged = mergedUserOrders[name];
    let orderDetails = "";
    let orderTotal = 0;
    let sandwichCount = 0;

    itemsList.forEach(item => {
      if (Number(merged[item.id] || 0) > 0) {
        let price = Number(merged[`${item.id}_price`] || item.price || 0);
        let quantity = Number(merged[item.id] || 0);
        orderTotal += price * quantity;
        if (item.id !== "delivery") sandwichCount += quantity;
        orderDetails += `${item.name}: ${quantity} × ${price} = ${quantity * price} جنيه\n`;
      }
    });

    rows.push([name, orderDetails.trim(), sandwichCount, orderTotal]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الطلبيات");

  XLSX.writeFile(wb, "orders.xlsx", { bookType: "xlsx", type: "binary", bom: true });
});

/* ======================
   Admin: helpers + UI
====================== */
function isAdminUser() {
  return !!(auth.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
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

  const isAdmin = !!(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

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

onAuthStateChanged(auth, (user) => updateAdminUI(user));

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
      msg.textContent = "ليس لديك صلاحية الأدمن!";
    } else {
      document.getElementById("adminLoginModal").style.display = "none";
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

document.getElementById("adminLogoutBtn")?.addEventListener("click", () => signOut(auth));

/* ======================
   Admin: Cutoff Time
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
   Admin: Items (Professional)
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

  wrap.innerHTML = pageItems
    .map(item => {
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
        <button class="btn btn-primary" type="button" data-edit-item="${item.id}" style="white-space:nowrap;">
          تعديل
        </button>
      </div>
    `;
    })
    .join("");

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
  if (price) price.value = String(Number(item.price || 0));

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
      const newPrice = Number(document.getElementById("singleEditPrice")?.value || 0);
      const newCat = (document.getElementById("singleEditCategory")?.value || "").trim();

      msgEl.style.color = "";
      msgEl.textContent = "";

      if (!newName) return (msgEl.textContent = "الاسم لا يمكن أن يكون فارغ.");
      if (!Number.isFinite(newPrice) || newPrice < 0) return (msgEl.textContent = "السعر غير صحيح.");
      if (!newCat) return (msgEl.textContent = "اختر قسم.");

      try {
        await updateDoc(doc(db, "items", currentEditingItemId), { name: newName, price: newPrice, category: newCat });

        msgEl.style.color = "#166534";
        msgEl.textContent = "تم الحفظ.";

        await loadItems();
        renderAdminItemsList();

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
   Admin: Add Item (with category)
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
  const price = Number(priceEl?.value || 0);
  const category = (catEl?.value || "").trim();

  if (!msgEl) return;

  msgEl.textContent = "";
  if (!name) return (msgEl.textContent = "اكتب اسم الصنف أولاً.");
  if (!Number.isFinite(price) || price <= 0) return (msgEl.textContent = "اكتب سعر صحيح أكبر من صفر.");
  if (!category) return (msgEl.textContent = "اختر قسم.");

  try {
    await addDoc(collection(db, "items"), { name, price, category });
    await loadItems();
    closeAddItemModal();
  } catch (e) {
    console.error(e);
    msgEl.textContent = "حدث خطأ أثناء إضافة الصنف.";
  }
}

document.getElementById("confirmAddItem")?.addEventListener("click", confirmAddItem);

/* ======================
   Admin: Manage Categories
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
  } catch (e) {
    console.error(e);
    msgEl.textContent = "فشل إضافة القسم.";
  }
}

function renderCategoriesList() {
  const wrap = document.getElementById("catsList");
  if (!wrap) return;

  const list = categories.filter(c => c.id !== "all");

  wrap.innerHTML = list
    .map(
      c => `
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
  `
    )
    .join("");

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
  } catch (e) {
    console.error(e);
    alert("فشل حذف القسم.");
  }
}

// PWA Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

/* ======================
   بدء التشغيل
====================== */
window.addEventListener("load", async () => {
  initWelcomeScreen();
  renderCategoryChips();

  await autoArchiveOldOrders();
  await loadCategories();
  await loadItems();
  await loadUserOrderFromDB();
  await loadCutoffTime();
  startCountdown();
});
