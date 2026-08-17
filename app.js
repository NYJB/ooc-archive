/* v1.2 - 2026-08-17 */
const CONFIG = window.OOC_ARCHIVE_CONFIG || {};
const API_URL = String(CONFIG.API_URL || "").trim().replace(/\/$/, "");
const PASSWORD_STORAGE_KEY = "ooc-archive-write-password";

const state = { items: [], category: "전체", query: "", deleteId: null };
const elements = {
  list: document.querySelector("#archive-list"),
  status: document.querySelector("#status"),
  filters: document.querySelector("#category-filter"),
  search: document.querySelector("#search-input"),
  editorDialog: document.querySelector("#editor-dialog"),
  editorForm: document.querySelector("#editor-form"),
  editorTitle: document.querySelector("#editor-title"),
  itemId: document.querySelector("#item-id"),
  title: document.querySelector("#title-input"),
  category: document.querySelector("#category-input"),
  content: document.querySelector("#content-input"),
  password: document.querySelector("#password-input"),
  formError: document.querySelector("#form-error"),
  saveButton: document.querySelector("#save-button"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteForm: document.querySelector("#delete-form"),
  deletePassword: document.querySelector("#delete-password"),
  editorPasswordField: document.querySelector("#editor-password-field"),
  editorUnlocked: document.querySelector("#editor-unlocked"),
  deletePasswordField: document.querySelector("#delete-password-field"),
  deleteUnlocked: document.querySelector("#delete-unlocked"),
  deleteError: document.querySelector("#delete-error"),
  authButton: document.querySelector("#open-auth"),
  authLabel: document.querySelector("#auth-label"),
  authDialog: document.querySelector("#auth-dialog"),
  authForm: document.querySelector("#auth-form"),
  authPassword: document.querySelector("#auth-password"),
  authError: document.querySelector("#auth-error"),
  unlockButton: document.querySelector("#unlock-button"),
  template: document.querySelector("#archive-card-template"),
};

function getSavedPassword() {
  try { return localStorage.getItem(PASSWORD_STORAGE_KEY) || ""; } catch { return ""; }
}

function setSavedPassword(password) {
  try { localStorage.setItem(PASSWORD_STORAGE_KEY, password); } catch { /* private mode may block storage */ }
  updateAuthUI();
}

function clearSavedPassword() {
  try { localStorage.removeItem(PASSWORD_STORAGE_KEY); } catch { /* private mode may block storage */ }
  updateAuthUI();
}

function updateAuthUI() {
  const unlocked = Boolean(getSavedPassword());
  elements.authButton.classList.toggle("unlocked", unlocked);
  elements.authButton.setAttribute("aria-pressed", String(unlocked));
  elements.authButton.setAttribute("aria-label", unlocked ? "글쓰기 잠금 다시 설정" : "글쓰기 잠금 해제");
  elements.authLabel.textContent = unlocked ? "잠금 해제됨" : "잠금 해제";
  elements.editorPasswordField.hidden = unlocked;
  elements.editorUnlocked.hidden = !unlocked;
  elements.password.required = !unlocked;
  elements.deletePasswordField.hidden = unlocked;
  elements.deleteUnlocked.hidden = !unlocked;
  elements.deletePassword.required = !unlocked;
}

function getVisibleItems() {
  const query = state.query.toLocaleLowerCase("ko");
  return state.items.filter((item) => {
    const matchesCategory = state.category === "전체" || item.category === state.category;
    const searchable = `${item.title}\n${item.category}\n${item.content}`.toLocaleLowerCase("ko");
    return matchesCategory && (!query || searchable.includes(query));
  });
}

function renderFilters() {
  const categories = ["전체", ...new Set(state.items.map((item) => item.category).filter(Boolean))];
  elements.filters.replaceChildren(...categories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-button${state.category === category ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      state.category = category;
      renderFilters();
      renderItems();
    });
    return button;
  }));
}

function renderItems() {
  const visibleItems = getVisibleItems();
  elements.status.textContent = `${visibleItems.length}개의 OOC`;
  if (!visibleItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = state.items.length ? "검색 결과가 없습니다." : "아직 등록된 OOC가 없습니다.";
    elements.list.replaceChildren(empty);
    return;
  }

  const cards = visibleItems.map((item, index) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.querySelector(".card-number").textContent = String(index + 1).padStart(3, "0");
    card.querySelector(".card-category").textContent = item.category;
    card.querySelector(".card-title").textContent = item.title;
    card.querySelector(".card-content").textContent = item.content;
    card.querySelector(".copy-button").addEventListener("click", (event) => copyItem(item, event.currentTarget));
    card.querySelector(".edit-button").addEventListener("click", () => openEditor(item));
    card.querySelector(".delete-button").addEventListener("click", () => openDelete(item.id));
    return card;
  });
  elements.list.replaceChildren(...cards);
}

async function apiRequest(path = "", options = {}) {
  if (!API_URL) throw new Error("사이트 연결 설정이 아직 완료되지 않았습니다.");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function loadItems() {
  elements.status.textContent = "불러오는 중...";
  try {
    const payload = await apiRequest();
    state.items = Array.isArray(payload.items) ? payload.items : [];
    renderFilters();
    renderItems();
  } catch (error) {
    elements.status.textContent = error.message;
    elements.list.replaceChildren();
  }
}

async function copyItem(item, button) {
  try {
    await navigator.clipboard.writeText(`${item.title}\n\n${item.content}`);
    const original = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = original; }, 1200);
  } catch {
    window.alert("복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
  }
}

function openEditor(item = null) {
  elements.editorForm.reset();
  elements.formError.textContent = "";
  elements.itemId.value = item?.id || "";
  elements.title.value = item?.title || "";
  elements.category.value = item?.category || "";
  elements.content.value = item?.content || "";
  updateAuthUI();
  elements.editorTitle.textContent = item ? "Edit OOC" : "Add OOC";
  elements.editorDialog.showModal();
  elements.title.focus();
}

function closeEditor() { elements.editorDialog.close(); }

async function saveItem(event) {
  event.preventDefault();
  elements.formError.textContent = "";
  elements.saveButton.disabled = true;
  const id = elements.itemId.value;
  const body = {
    title: elements.title.value.trim(),
    category: elements.category.value.trim(),
    content: elements.content.value.trim(),
    password: getSavedPassword() || elements.password.value,
  };
  try {
    await apiRequest(id ? `/${encodeURIComponent(id)}` : "", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    closeEditor();
    await loadItems();
  } catch (error) {
    if (error.status === 401 && getSavedPassword()) {
      clearSavedPassword();
      elements.formError.textContent = "저장된 비밀번호가 더 이상 맞지 않습니다. 다시 잠금 해제해 주세요.";
      return;
    }
    elements.formError.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
}

function openDelete(id) {
  state.deleteId = id;
  elements.deleteForm.reset();
  elements.deleteError.textContent = "";
  updateAuthUI();
  elements.deleteDialog.showModal();
  elements.deletePassword.focus();
}

function closeDelete() { state.deleteId = null; elements.deleteDialog.close(); }

async function deleteItem(event) {
  event.preventDefault();
  elements.deleteError.textContent = "";
  const submitButton = elements.deleteForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  try {
    await apiRequest(`/${encodeURIComponent(state.deleteId)}`, {
      method: "DELETE",
      body: JSON.stringify({ password: getSavedPassword() || elements.deletePassword.value }),
    });
    closeDelete();
    await loadItems();
  } catch (error) {
    if (error.status === 401 && getSavedPassword()) {
      clearSavedPassword();
      elements.deleteError.textContent = "저장된 비밀번호가 더 이상 맞지 않습니다. 다시 잠금 해제해 주세요.";
      return;
    }
    elements.deleteError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

function openAuth() {
  elements.authForm.reset();
  elements.authError.textContent = "";
  elements.authDialog.showModal();
  elements.authPassword.focus();
}

function closeAuth() { elements.authDialog.close(); }

async function unlockWriting(event) {
  event.preventDefault();
  elements.authError.textContent = "";
  elements.unlockButton.disabled = true;
  const password = elements.authPassword.value;
  try {
    await apiRequest("/auth", { method: "POST", body: JSON.stringify({ password }) });
    setSavedPassword(password);
    closeAuth();
  } catch (error) {
    elements.authError.textContent = error.message;
  } finally {
    elements.unlockButton.disabled = false;
  }
}

function handleAuthButton() {
  if (!getSavedPassword()) {
    openAuth();
    return;
  }
  clearSavedPassword();
}

document.querySelector("#open-create").addEventListener("click", () => openEditor());
elements.authButton.addEventListener("click", handleAuthButton);
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeEditor));
document.querySelectorAll("[data-delete-close]").forEach((button) => button.addEventListener("click", closeDelete));
elements.editorForm.addEventListener("submit", saveItem);
elements.deleteForm.addEventListener("submit", deleteItem);
elements.authForm.addEventListener("submit", unlockWriting);
document.querySelectorAll("[data-auth-close]").forEach((button) => button.addEventListener("click", closeAuth));
elements.search.addEventListener("input", (event) => { state.query = event.target.value.trim(); renderItems(); });
elements.editorDialog.addEventListener("click", (event) => { if (event.target === elements.editorDialog) closeEditor(); });
elements.deleteDialog.addEventListener("click", (event) => { if (event.target === elements.deleteDialog) closeDelete(); });
elements.authDialog.addEventListener("click", (event) => { if (event.target === elements.authDialog) closeAuth(); });

updateAuthUI();
loadItems();
