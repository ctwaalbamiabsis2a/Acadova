
(() => {
  "use strict";

  // ==========================================
  // 1. DOM HELPERS AND STORAGE
  // ==========================================

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = "Acadova_data_v1";
  const SESSION_KEY = "Acadova_session_v1";

  // ==========================================
  // 2. DATE HELPERS
  // ==========================================

  const localDate = (date = new Date()) => {
    const d = new Date(date);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const addDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return localDate(d);
  };

  // ==========================================
  // 3. EMPTY STARTER DATA
  // ==========================================

  // No sample account and no sample tasks.
  function starterData() {
    return {
      users: [],
      tasks: []
    };
  }

  // ==========================================
  // 4. LOAD AND SAVE DATA
  // ==========================================

  function readData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (
        saved &&
        Array.isArray(saved.users) &&
        Array.isArray(saved.tasks)
      ) {
        saved.users = saved.users.filter((user) =>
          user &&
          typeof user.name === "string" &&
          typeof user.email === "string" &&
          typeof user.password === "string"
        );

        saved.tasks = saved.tasks.filter((task) =>
          task &&
          typeof task.id === "string" &&
          typeof task.title === "string"
        );

        return saved;
      }
    } catch (error) {
      console.warn("Could not read saved Acadova data.", error);
    }

    const freshData = starterData();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(freshData)
    );

    return freshData;
  }

  let data = readData();
  let currentUser = null;
  let activeScreen = "loginScreen";
  let activeStatus = "all";
  let pendingDeleteId = null;
  let toastTimer = null;

  function saveData() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  }

  // Each account sees only its own tasks.
  function userTasks() {
    if (!currentUser) return [];

    return data.tasks.filter((task) =>
      task.userEmail === currentUser.email.toLowerCase()
    );
  }

  // ==========================================
  // 5. GENERAL UTILITIES
  // ==========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function prettyDate(dateString) {
    if (!dateString) return "No due date";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "No due date";
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  }

  function relativeDue(dateString) {
    if (!dateString) return "No due date";

    const dueDate = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(dueDate.getTime())) {
      return "No due date";
    }

    const diff = Math.round(
      (
        dueDate -
        new Date(`${localDate()}T00:00:00`)
      ) / 86400000
    );

    if (diff < 0) {
      return `Overdue · ${prettyDate(dateString)}`;
    }

    if (diff === 0) {
      return "Due today";
    }

    if (diff === 1) {
      return "Due tomorrow";
    }

    return `Due ${prettyDate(dateString)}`;
  }

  function showToast(message) {
    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function setError(selector, message = "") {
    const element = $(selector);

    if (element) {
      element.textContent = message;
    }
  }

  // ==========================================
  // 6. SCREEN NAVIGATION AND SESSION
  // ==========================================

  function showScreen(screenId) {
    const target = document.getElementById(screenId);

    if (!target) return;

    activeScreen = screenId;

    $$(".screen").forEach((screen) => {
      screen.classList.toggle(
        "active",
        screen.id === screenId
      );
    });

    $("#bottomNav").classList.toggle(
      "hidden",
      !currentUser
    );

    $$(".nav-item").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.screen === screenId
      );
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    if (!currentUser) return;

    if (screenId === "dashboardScreen") {
      renderDashboard();
    }

    if (screenId === "tasksScreen") {
      renderTasks();
    }

    if (screenId === "profileScreen") {
      renderProfile();
    }
  }

  function setSession(user) {
    currentUser = user || null;

    if (currentUser) {
      localStorage.setItem(
        SESSION_KEY,
        currentUser.email.toLowerCase()
      );
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    $("#headerAvatar").textContent = currentUser
      ? currentUser.name.trim().charAt(0).toUpperCase()
      : "S";
  }

  function enterApp(user) {
    setSession(user);

    setError("#loginError");
    setError("#registerError");

    showScreen("dashboardScreen");

    showToast(
      `Welcome, ${user.name.split(" ")[0]}!`
    );
  }

  // ==========================================
  // 7. TASK CARDS AND EMPTY STATES
  // ==========================================

  function taskCard(task) {
    const priority = String(
      task.priority || "Medium"
    ).toLowerCase();

    return `
      <article class="task-card ${task.completed ? "is-complete" : ""}">

        <button
          type="button"
          class="task-check ${task.completed ? "checked" : ""}"
          data-action="toggle"
          data-id="${escapeHTML(task.id)}"
          aria-label="${task.completed ? "Mark as pending" : "Mark as completed"}"
        >${task.completed ? "✓" : ""}</button>

        <div class="task-main">

          <p class="task-title">
            ${escapeHTML(task.title)}
          </p>

          <div class="task-meta">

            <span class="pill">
              ${escapeHTML(task.subject || "Other")}
            </span>

            <span class="pill ${priority}">
              ${escapeHTML(task.priority || "Medium")}
            </span>

            <span class="due-text">
              ${escapeHTML(relativeDue(task.dueDate))}
            </span>

          </div>

          ${
            task.description
              ? `<p class="muted task-description">${escapeHTML(task.description)}</p>`
              : ""
          }

        </div>

        <div class="task-actions">

          <button
            type="button"
            class="mini-action"
            data-action="edit"
            data-id="${escapeHTML(task.id)}"
            aria-label="Edit ${escapeHTML(task.title)}"
            title="Edit"
          >✎</button>

          <button
            type="button"
            class="mini-action delete"
            data-action="delete"
            data-id="${escapeHTML(task.id)}"
            aria-label="Delete ${escapeHTML(task.title)}"
            title="Delete"
          >×</button>

        </div>
      </article>
    `;
  }

  function emptyState(title, message, showAdd = false) {
    return `
      <div class="empty-state">

        <div class="empty-icon" aria-hidden="true">✦</div>

        <h3>${escapeHTML(title)}</h3>

        <p>${escapeHTML(message)}</p>

        ${
          showAdd
            ? '<button type="button" class="button primary" data-action="new">＋ Add a task</button>'
            : ""
        }

      </div>
    `;
  }

  // ==========================================
  // 8. DASHBOARD
  // ==========================================

  function renderDashboard() {
    if (!currentUser) return;

    const tasks = userTasks();

    const pending = tasks.filter(
      (task) => !task.completed
    );

    const completed = tasks.filter(
      (task) => task.completed
    );

    const percent = tasks.length
      ? Math.round(
          completed.length / tasks.length * 100
        )
      : 0;

    $("#todayLabel").textContent = new Date()
      .toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
      })
      .toUpperCase();

    $("#greeting").textContent =
      `Hello, ${currentUser.name.split(" ")[0]}!`;

    $("#totalCount").textContent = tasks.length;
    $("#pendingCount").textContent = pending.length;
    $("#completedCount").textContent = completed.length;

    $("#progressPercent").textContent = `${percent}%`;
    $("#progressBar").style.width = `${percent}%`;

    if (pending.length) {
      $("#welcomeSummary").textContent =
        `You have ${pending.length} task${pending.length === 1 ? "" : "s"} waiting for you.`;
    } else if (tasks.length) {
      $("#welcomeSummary").textContent =
        "Everything is caught up. Great work!";
    } else {
      $("#welcomeSummary").textContent =
        "Your planner is ready. Add your first task to get started.";
    }

    const upcoming = pending
      .slice()
      .sort((a, b) =>
        (a.dueDate || "").localeCompare(b.dueDate || "")
      )
      .slice(0, 3);

    $("#upcomingList").innerHTML = upcoming.length
      ? upcoming.map(taskCard).join("")
      : emptyState(
          "No upcoming tasks",
          "Your tasks will appear here when you add them.",
          true
        );
  }

  // ==========================================
  // 9. TASK SEARCH, FILTERS, AND SORTING
  // ==========================================

  function getFilteredTasks() {
    const query = $("#searchInput")
      .value.trim().toLowerCase();

    const subject = $("#subjectFilter").value;
    const sort = $("#sortSelect").value;

    const tasks = userTasks().filter((task) => {
      const matchesStatus =
        activeStatus === "all" ||
        (
          activeStatus === "pending" &&
          !task.completed
        ) ||
        (
          activeStatus === "completed" &&
          task.completed
        );

      const matchesSubject =
        subject === "all" ||
        task.subject === subject;

      const searchable =
        `${task.title} ${task.subject || ""} ${task.description || ""}`
          .toLowerCase();

      const matchesQuery =
        !query || searchable.includes(query);

      return (
        matchesStatus &&
        matchesSubject &&
        matchesQuery
      );
    });

    if (sort === "date") {
      tasks.sort((a, b) =>
        (a.dueDate || "").localeCompare(b.dueDate || "")
      );
    } else if (sort === "priority") {
      const rank = {
        High: 0,
        Medium: 1,
        Low: 2
      };

      tasks.sort((a, b) =>
        (rank[a.priority] ?? 1) -
        (rank[b.priority] ?? 1)
      );
    } else if (sort === "newest") {
      tasks.sort((a, b) =>
        (b.createdAt || 0) -
        (a.createdAt || 0)
      );
    }

    return tasks;
  }

  function renderTasks() {
    const tasks = getFilteredTasks();

    $("#taskResultCount").textContent =
      `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

    $("#allTasksList").innerHTML = tasks.length
      ? tasks.map(taskCard).join("")
      : emptyState(
          "No tasks yet",
          "Add your own school tasks, and they will appear here.",
          true
        );

    $("#clearSearch").style.display =
      $("#searchInput").value ? "block" : "none";
  }

  // ==========================================
  // 10. PROFILE DISPLAY
  // ==========================================

  function renderProfile() {
    if (!currentUser) return;

    const initial = currentUser.name
      .trim()
      .charAt(0)
      .toUpperCase();

    $("#profileName").textContent = currentUser.name;
    $("#profileEmail").textContent = currentUser.email;
    $("#profileAvatar").textContent = initial;

    $("#profileNameInput").value = currentUser.name;
    $("#profileEmailInput").value = currentUser.email;

    $("#headerAvatar").textContent = initial;
  }

  // ==========================================
  // 11. ADDING AND EDITING TASKS
  // ==========================================

  function openNewTask() {
    if (!currentUser) {
      showScreen("loginScreen");
      return;
    }

    $("#taskForm").reset();

    $("#taskId").value = "";
    $("#taskFormTitle").textContent = "Add a task";

    $("#saveTaskBtn").innerHTML =
      'Save task <span>→</span>';

    $("#taskDue").value = addDays(1);
    $("#taskPriority").value = "Medium";

    showScreen("taskFormScreen");
  }

  function openEditTask(id) {
    const task = userTasks().find(
      (item) => item.id === id
    );

    if (!task) return;

    $("#taskId").value = task.id;
    $("#taskTitle").value = task.title;
    $("#taskSubject").value = task.subject || "";
    $("#taskDue").value = task.dueDate || "";
    $("#taskPriority").value = task.priority || "Medium";
    $("#taskDescription").value = task.description || "";

    $("#taskFormTitle").textContent = "Edit task";

    $("#saveTaskBtn").innerHTML =
      'Save changes <span>→</span>';

    showScreen("taskFormScreen");
  }

  // ==========================================
  // 12. TASK ACTIONS
  // ==========================================

  function handleTaskAction(action, id) {
    if (action === "new") {
      openNewTask();
      return;
    }

    const task = userTasks().find(
      (item) => item.id === id
    );

    if (!task) return;

    if (action === "toggle") {
      task.completed = !task.completed;

      saveData();
      renderDashboard();

      if (activeScreen === "tasksScreen") {
        renderTasks();
      }

      showToast(
        task.completed
          ? "Task marked as completed ✓"
          : "Task moved back to pending"
      );

    } else if (action === "edit") {
      openEditTask(id);

    } else if (action === "delete") {
      pendingDeleteId = id;

      $("#deleteModal").classList.remove("hidden");
      $("#keepTaskBtn").focus();
    }
  }

  // ==========================================
  // 13. LOGIN
  // ==========================================

  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const email = $("#loginEmail")
      .value.trim().toLowerCase();

    const password = $("#loginPassword").value;

    const user = data.users.find((item) =>
      item.email.toLowerCase() === email &&
      item.password === password
    );

    if (!user) {
      setError(
        "#loginError",
        "Account not found. Check your details or create an account."
      );
      return;
    }

    enterApp(user);
  });

  // ==========================================
  // 14. REGISTRATION
  // ==========================================

  $("#registerForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#registerName").value.trim();

    const email = $("#registerEmail")
      .value.trim().toLowerCase();

    const password = $("#registerPassword").value;

    setError("#registerError");

    if (name.length < 2) {
      setError(
        "#registerError",
        "Please enter a name with at least 2 characters."
      );
      return;
    }

    if (
      data.users.some(
        (user) => user.email.toLowerCase() === email
      )
    ) {
      setError(
        "#registerError",
        "An account with this email already exists. Please log in."
      );
      return;
    }

    const user = {
      name,
      email,
      password
    };

    data.users.push(user);

    saveData();

    event.target.reset();

    enterApp(user);

    showToast("Account created successfully!");
  });

  // ==========================================
  // 15. NAVIGATION BUTTONS
  // ==========================================

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      setError("#loginError");
      setError("#registerError");

      showScreen(button.dataset.go);
    });
  });

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.screen);
    });
  });

  $$("[data-screen]")
    .filter((button) =>
      !button.classList.contains("nav-item")
    )
    .forEach((button) => {
      button.addEventListener("click", () => {
        showScreen(button.dataset.screen);
      });
    });

  $("#brandHome").addEventListener("click", (event) => {
    event.preventDefault();

    if (currentUser) {
      showScreen("dashboardScreen");
    }
  });

  $("#headerAvatar").addEventListener("click", () => {
    if (currentUser) {
      showScreen("profileScreen");
    }
  });

  $("#quickAddBtn").addEventListener("click", openNewTask);
  $("#tasksAddBtn").addEventListener("click", openNewTask);
  $("#navAddBtn").addEventListener("click", openNewTask);

  $("#cancelTaskBtn").addEventListener("click", () => {
    showScreen("tasksScreen");
  });

  $("#discardTaskBtn").addEventListener("click", () => {
    showScreen("tasksScreen");
  });

  // ==========================================
  // 16. SAVE TASK FORM
  // ==========================================

  $("#taskForm").addEventListener("submit", (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const id = $("#taskId").value;
    const title = $("#taskTitle").value.trim();
    const subject = $("#taskSubject").value;
    const dueDate = $("#taskDue").value;

    if (!title || !subject || !dueDate) {
      showToast("Please complete all required fields.");
      return;
    }

    if (
      dueDate < localDate() &&
      !confirm(
        "This due date is in the past. Save this task anyway?"
      )
    ) {
      return;
    }

    const existing = id
      ? userTasks().find((task) => task.id === id)
      : null;

    const task = {
      id: id ||
        `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,

      userEmail: currentUser.email.toLowerCase(),
      title,
      subject,
      dueDate,

      priority: $("#taskPriority").value || "Medium",

      description: $("#taskDescription").value.trim(),

      completed: existing
        ? existing.completed
        : false,

      createdAt: existing
        ? existing.createdAt
        : Date.now()
    };

    if (existing) {
      Object.assign(existing, task);
    } else {
      data.tasks.push(task);
    }

    saveData();

    renderDashboard();
    renderTasks();

    showScreen("tasksScreen");

    showToast(
      existing
        ? "Changes saved successfully ✓"
        : "Task added successfully ✓"
    );
  });

  // ==========================================
  // 17. FILTERS AND SEARCH
  // ==========================================

  $("#statusFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");

    if (!button) return;

    activeStatus = button.dataset.status;

    $$("#statusFilters .filter-chip").forEach((chip) => {
      chip.classList.toggle(
        "selected",
        chip === button
      );
    });

    renderTasks();
  });

  $("#searchInput").addEventListener("input", renderTasks);
  $("#subjectFilter").addEventListener("change", renderTasks);
  $("#sortSelect").addEventListener("change", renderTasks);

  $("#clearSearch").addEventListener("click", () => {
    $("#searchInput").value = "";

    renderTasks();

    $("#searchInput").focus();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (button) {
      handleTaskAction(
        button.dataset.action,
        button.dataset.id
      );
    }
  });

  // ==========================================
  // 18. DELETE TASK MODAL
  // ==========================================

  function closeDeleteModal() {
    pendingDeleteId = null;
    $("#deleteModal").classList.add("hidden");
  }

  $("#keepTaskBtn").addEventListener(
    "click",
    closeDeleteModal
  );

  $("#confirmDeleteBtn").addEventListener("click", () => {
    if (!pendingDeleteId || !currentUser) return;

    const email = currentUser.email.toLowerCase();

    data.tasks = data.tasks.filter((task) =>
      !(
        task.id === pendingDeleteId &&
        task.userEmail === email
      )
    );

    saveData();

    closeDeleteModal();

    renderDashboard();
    renderTasks();

    showToast("Task deleted.");
  });

  $("#deleteModal").addEventListener("click", (event) => {
    if (event.target.id === "deleteModal") {
      closeDeleteModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDeleteModal();
    }
  });

  // ==========================================
  // 19. PROFILE UPDATES
  // ==========================================

  $("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const newName = $("#profileNameInput")
      .value.trim();

    if (newName.length < 2) {
      showToast(
        "Please enter a name with at least 2 characters."
      );
      return;
    }

    const user = data.users.find((item) =>
      item.email.toLowerCase() ===
      currentUser.email.toLowerCase()
    );

    if (user) {
      user.name = newName;
    }

    currentUser.name = newName;

    saveData();

    renderProfile();
    renderDashboard();

    showToast("Profile updated successfully ✓");
  });

  // ==========================================
  // 20. LOGOUT
  // ==========================================

  $("#logoutBtn").addEventListener("click", () => {
    setSession(null);

    $("#loginForm").reset();

    setError("#loginError");

    showScreen("loginScreen");

    showToast("You have logged out.");
  });

  // ==========================================
  // 21. RESTORE SESSION AFTER REFRESH
  // ==========================================

  const savedEmail = localStorage.getItem(SESSION_KEY);

  if (savedEmail) {
    const savedUser = data.users.find((user) =>
      user.email.toLowerCase() ===
      savedEmail.toLowerCase()
    );

    if (savedUser) {
      setSession(savedUser);
      showScreen("dashboardScreen");
    } else {
      localStorage.removeItem(SESSION_KEY);
      showScreen("loginScreen");
    }
  } else {
    showScreen("loginScreen");
  }

})();
