let config = null;
let tasks = [];
let editingId = null;

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  const el = $("status-message");
  el.textContent = message;
  el.className = isError ? "error" : "ok";
}

async function loadConfig() {
  const res = await fetch("config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load config.json");
  config = await res.json();
}

async function api(query = "", options = {}) {
  const url = `${config.supabaseUrl}/rest/v1/${config.tableName}${query}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadTasks() {
  try {
    tasks = await api("?select=*&order=id.asc");
    renderTasks();
    setStatus(`Loaded ${tasks.length} task(s).`);
  } catch (err) {
    setStatus("Failed to load tasks: " + err.message, true);
  }
}

function renderTasks() {
  const list = $("task-list");
  list.innerHTML = "";
  tasks.forEach((t) => {
    const item = document.createElement("div");
    item.className = "task-item" + (t.completed ? " done" : "");
    item.dataset.id = t.id;

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = t.title;

    const desc = document.createElement("span");
    desc.className = "task-description";
    desc.textContent = t.description || "";

    const status = document.createElement("span");
    status.className = "task-status";
    status.textContent = t.completed ? "Completed" : "Not completed";

    const toggle = document.createElement("button");
    toggle.className = "toggle-task";
    toggle.textContent = t.completed ? "Mark incomplete" : "Mark complete";

    const edit = document.createElement("button");
    edit.className = "edit-task";
    edit.textContent = "Edit";

    const del = document.createElement("button");
    del.className = "delete-task";
    del.textContent = "Delete";

    item.append(title, desc, status, toggle, edit, del);
    list.appendChild(item);
  });
}

function resetForm() {
  editingId = null;
  $("task-form").reset();
  $("task-submit").textContent = "Add task";
  $("task-cancel").hidden = true;
}

async function handleSubmit(e) {
  e.preventDefault();
  const title = $("task-title").value.trim();
  const description = $("task-description").value.trim();
  if (!title) {
    setStatus("Title is required.", true);
    return;
  }
  try {
    if (editingId === null) {
      await api("", {
        method: "POST",
        body: JSON.stringify({ title, description, completed: false }),
      });
      setStatus("Task added.");
    } else {
      await api(`?id=eq.${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description }),
      });
      setStatus("Task updated.");
    }
    resetForm();
    await loadTasks();
  } catch (err) {
    setStatus("Operation failed: " + err.message, true);
  }
}

async function handleListClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  const item = btn.closest(".task-item");
  const id = Number(item.dataset.id);
  const task = tasks.find((t) => t.id === id);

  try {
    if (btn.classList.contains("toggle-task")) {
      await api(`?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.completed }),
      });
      await loadTasks();
    } else if (btn.classList.contains("edit-task")) {
      editingId = id;
      $("task-title").value = task.title;
      $("task-description").value = task.description || "";
      $("task-submit").textContent = "Save changes";
      $("task-cancel").hidden = false;
      $("task-title").focus();
    } else if (btn.classList.contains("delete-task")) {
      if (!confirm("Delete this task?")) return;
      await api(`?id=eq.${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await loadTasks();
      setStatus("Task deleted.");
    }
  } catch (err) {
    setStatus("Operation failed: " + err.message, true);
  }
}

async function init() {
  try {
    await loadConfig();
    $("task-form").addEventListener("submit", handleSubmit);
    $("task-cancel").addEventListener("click", resetForm);
    $("task-list").addEventListener("click", handleListClick);
    await loadTasks();
  } catch (err) {
    setStatus("Initialization failed: " + err.message, true);
  }
}

init();