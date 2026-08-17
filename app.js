/* v1.1 - 2026-08-17 */
const CONFIG = window.OOC_ARCHIVE_CONFIG || {};
const API_URL = String(CONFIG.API_URL || "").trim().replace(/\/$/, "");

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
  deleteError: document.querySelector("#delete-error"),
  template: document.querySelector("#archive-card-template"),
};

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
  if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
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
    password: elements.password.value,
  };
  try {
    await apiRequest(id ? `/${encodeURIComponent(id)}` : "", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    closeEditor();
    await loadItems();
  } catch (error) {
    elements.formError.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
}

function openDelete(id) {
  state.deleteId = id;
  elements.deleteForm.reset();
  elements.deleteError.textContent = "";
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
      body: JSON.stringify({ password: elements.deletePassword.value }),
    });
    closeDelete();
    await loadItems();
  } catch (error) {
    elements.deleteError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

document.querySelector("#open-create").addEventListener("click", () => openEditor());
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeEditor));
document.querySelectorAll("[data-delete-close]").forEach((button) => button.addEventListener("click", closeDelete));
elements.editorForm.addEventListener("submit", saveItem);
elements.deleteForm.addEventListener("submit", deleteItem);
elements.search.addEventListener("input", (event) => { state.query = event.target.value.trim(); renderItems(); });
elements.editorDialog.addEventListener("click", (event) => { if (event.target === elements.editorDialog) closeEditor(); });
elements.deleteDialog.addEventListener("click", (event) => { if (event.target === elements.deleteDialog) closeDelete(); });

loadItems();
