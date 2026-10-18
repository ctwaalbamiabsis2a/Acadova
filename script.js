
(() => {
  "use strict";

  // ==========================================
  // 1. DOM HELPERS AND STORAGE KEYS
  // ==========================================

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = "studyflow_data_v1";
  const SESSION_KEY = "studyflow_session_v1";


  // ==========================================
  // 2. DATE HELPERS
  // ==========================================

  const today = new Date();

  const localDate = (date) => {
    const d = new Date(date);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const addDays = (n) => {
    const d = new Date();

    d.setDate(d.getDate() + n);

    return localDate(d);
  };


  // ==========================================
  // 3. STARTER DATA
  // ==========================================

  const starterData = () => ({
    users: [
      {
        name: "Demo Student",
        email: "demo@studyflow.com",
        password: "study123"
      }
    ],

    tasks: [
      {
        id: "sample-1",
        title: "Finish research introduction",
        subject: "Research",
        dueDate: addDays(1),
        priority: "High",
        description: "Complete the first draft and review the objectives.",
        completed: false,
        createdAt: Date.now() - 3000
      },
      {
        id: "sample-2",
        title: "Review HTML and CSS notes",
        subject: "ICT",
        dueDate: addDays(2),
        priority: "Medium",
        description: "Go over semantic tags, selectors, and responsive design.",
        completed: false,
        createdAt: Date.now() - 2000
      },
      {
        id: "sample-3",
        title: "Read English lesson",
        subject: "English",
        dueDate: addDays(3),
        priority: "Low",
        description: "Read the assigned selection and take notes.",
        completed: true,
        createdAt: Date.now() - 1000
      }
    ]
  });


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
        return saved;
      }
    } catch (error) {
      console.warn("Could not read saved StudyFlow data.", error);
    }

    const data = starterData();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    return data;
  }

  let data = readData();
  let currentUser = null;
  let activeScreen = "loginScreen";
  let activeStatus = "all";
  let pendingDeleteId = null;
  let toastTimer = null;

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function userTasks() {
    // This classroom prototype stores all demo tasks in one browser.
    return data.tasks;
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

    const d = new Date(`${dateString}T00:00:00`);

    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  }

  function relativeDue(dateString) {
    if (!dateString) return "No due date";

    const diff = Math.round(
      (
        new Date(`${dateString}T00:00:00`) -
        new Date(`${localDate(today)}T00:00:00`)
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

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }


  // ==========================================
  // 6. SCREEN NAVIGATION AND SESSION
  // ==========================================

  function showScreen(screenId) {
    const target = document.getElementById(screenId);

    if (!target) return;

    activeScreen = screenId;

    $$(".screen").forEach((screen) => {
      screen.classList.toggle("active", screen.id === screenId);
    });

    const loggedIn = Boolean(currentUser);

    $("#bottomNav").classList.toggle("hidden", !loggedIn);

    $$(".nav-item").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.screen === screenId
      );
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    if (loggedIn) {
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
  }

  function setSession(user) {
    currentUser = user;

    if (user) {
      localStorage.setItem(SESSION_KEY, user.email);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    $("#headerAvatar").textContent = user
      ? user.name.trim().charAt(0).toUpperCase()
      : "S";
  }

  function enterApp(user) {
    setSession(user);

    $("#loginError").textContent = "";

    renderDashboard();
    showScreen("dashboardScreen");

    showToast(
      `Welcome${user.name ? ", " + user.name.split(" ")[0] : ""}!`
    );
  }


  // ==========================================
  // 7. TASK CARD AND EMPTY STATE
  // ==========================================

  function taskCard(task) {
    const priorityClass = task.priority.toLowerCase();
    const completedClass = task.completed ? "is-complete" : "";

    return `
      <article class="task-card ${completedClass}">
        <button
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
              ${escapeHTML(task.subject)}
            </span>

            <span class="pill ${priorityClass}">
              ${escapeHTML(task.priority)}
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
            class="mini-action"
            data-action="edit"
            data-id="${escapeHTML(task.id)}"
            aria-label="Edit ${escapeHTML(task.title)}"
            title="Edit"
          >✎</button>

          <button
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
        <div class="empty-icon">✦</div>

        <h3>${escapeHTML(title)}</h3>

        <p>${escapeHTML(message)}</p>

        ${
          showAdd
            ? '<button class="button primary" data-action="new">＋ Add a task</button>'
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

    const pending = tasks.filter((t) => !t.completed);
    const completed = tasks.filter((t) => t.completed);

    const pct = tasks.length
      ? Math.round((completed.length / tasks.length) * 100)
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

    $("#progressPercent").textContent = `${pct}%`;
    $("#progressBar").style.width = `${pct}%`;

    $("#welcomeSummary").textContent = pending.length
      ? `You have ${pending.length} task${pending.length === 1 ? "" : "s"} waiting for you.`
      : "Everything is caught up. Great work!";

    const upcoming = pending
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);

    $("#upcomingList").innerHTML = upcoming.length
      ? upcoming.map(taskCard).join("")
      : emptyState(
          "All caught up!",
          "Add a task when you have something new to work on.",
          true
        );
  }


  // ==========================================
  // 9. TASK SEARCH, FILTERING, AND SORTING
  // ==========================================

  function getFilteredTasks() {
    const query = $("#searchInput").value.trim().toLowerCase();
    const subject = $("#subjectFilter").value;
    const sort = $("#sortSelect").value;

    let tasks = userTasks().filter((task) => {
      const matchesStatus =
        activeStatus === "all" ||
        (activeStatus === "pending" && !task.completed) ||
        (activeStatus === "completed" && task.completed);

      const matchesSubject =
        subject === "all" || task.subject === subject;

      const matchesQuery =
        !query ||
        `${task.title} ${task.subject} ${task.description}`
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSubject && matchesQuery;
    });

    if (sort === "date") {
      tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }

    if (sort === "priority") {
      const rank = {
        High: 0,
        Medium: 1,
        Low: 2
      };

      tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);
    }

    if (sort === "newest") {
      tasks.sort((a, b) => b.createdAt - a.createdAt);
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
          "No tasks found",
          "Try changing your search or filters, or add a new task.",
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

    $("#profileName").textContent = currentUser.name;
    $("#profileEmail").textContent = currentUser.email;

    $("#profileAvatar").textContent =
      currentUser.name.trim().charAt(0).toUpperCase();

    $("#profileNameInput").value = currentUser.name;
    $("#profileEmailInput").value = currentUser.email;

    $("#headerAvatar").textContent =
      currentUser.name.trim().charAt(0).toUpperCase();
  }


  // ==========================================
  // 11. ADDING AND EDITING TASKS
  // ==========================================

  function openNewTask() {
    $("#taskForm").reset();

    $("#taskId").value = "";
    $("#taskFormTitle").textContent = "Add a task";

    $("#saveTaskBtn").innerHTML = 'Save task <span>→</span>';

    $("#taskDue").value = addDays(1);
    $("#taskPriority").value = "Medium";

    showScreen("taskFormScreen");
  }

  function openEditTask(id) {
    const task = userTasks().find((item) => item.id === id);

    if (!task) return;

    $("#taskId").value = task.id;
    $("#taskTitle").value = task.title;
    $("#taskSubject").value = task.subject;
    $("#taskDue").value = task.dueDate;
    $("#taskPriority").value = task.priority;
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
    const task = userTasks().find((item) => item.id === id);

    if (action === "new") {
      openNewTask();
      return;
    }

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
  // 13. LOGIN AND REGISTRATION
  // ==========================================

  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const email = $("#loginEmail").value.trim().toLowerCase();
    const password = $("#loginPassword").value;

    const user = data.users.find(
      (item) =>
        item.email.toLowerCase() === email &&
        item.password === password
    );

    if (!user) {
      $("#loginError").textContent =
        "We couldn't find that account. Check your details or create an account.";

      return;
    }

    enterApp(user);
  });

  $("#registerForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#registerName").value.trim();
    const email = $("#registerEmail").value.trim().toLowerCase();
    const password = $("#registerPassword").value;

    $("#registerError").textContent = "";

    if (
      data.users.some(
        (item) => item.email.toLowerCase() === email
      )
    ) {
      $("#registerError").textContent =
        "An account with this email already exists. Please log in.";

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
  // 14. NAVIGATION BUTTONS
  // ==========================================

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#loginError").textContent = "";
      $("#registerError").textContent = "";

      showScreen(button.dataset.go);
    });
  });

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.screen);
    });
  });

  $$("[data-screen]").forEach((button) => {
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
  // 15. SAVE TASK FORM
  // ==========================================

  $("#taskForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const id = $("#taskId").value;
    const title = $("#taskTitle").value.trim();
    const subject = $("#taskSubject").value;
    const dueDate = $("#taskDue").value;

    if (!title || !subject || !dueDate) {
      showToast("Please complete all required fields.");
      return;
    }

    if (dueDate < localDate(new Date())) {
      const proceed = confirm(
        "This due date is in the past. Save this task anyway?"
      );

      if (!proceed) return;
    }

    const existing = id
      ? userTasks().find((item) => item.id === id)
      : null;

    const task = {
      id: id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      subject,
      dueDate,
      priority: $("#taskPriority").value,
      description: $("#taskDescription").value.trim(),
      completed: existing ? existing.completed : false,
      createdAt: existing ? existing.createdAt : Date.now()
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
  // 16. FILTERS, SEARCH, AND DELETE MODAL
  // ==========================================

  $("#statusFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");

    if (!button) return;

    activeStatus = button.dataset.status;

    $$("#statusFilters .filter-chip").forEach((chip) => {
      chip.classList.toggle("selected", chip === button);
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
    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      handleTaskAction(
        actionButton.dataset.action,
        actionButton.dataset.id
      );
    }
  });

  $("#keepTaskBtn").addEventListener("click", () => {
    pendingDeleteId = null;

    $("#deleteModal").classList.add("hidden");
  });

  $("#confirmDeleteBtn").addEventListener("click", () => {
    if (!pendingDeleteId) return;

    data.tasks = data.tasks.filter(
      (task) => task.id !== pendingDeleteId
    );

    saveData();

    pendingDeleteId = null;

    $("#deleteModal").classList.add("hidden");

    renderDashboard();
    renderTasks();

    showToast("Task deleted.");
  });

  $("#deleteModal").addEventListener("click", (event) => {
    if (event.target.id === "deleteModal") {
      pendingDeleteId = null;

      $("#deleteModal").classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("#deleteModal").classList.add("hidden");

      pendingDeleteId = null;
    }
  });


  // ==========================================
  // 17. PROFILE UPDATES AND LOGOUT
  // ==========================================

  $("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const newName = $("#profileNameInput").value.trim();

    if (newName.length < 2) {
      showToast("Please enter a name with at least 2 characters.");
      return;
    }

    const user = data.users.find(
      (item) =>
        item.email.toLowerCase() === currentUser.email.toLowerCase()
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

  $("#logoutBtn").addEventListener("click", () => {
    setSession(null);

    $("#loginForm").reset();
    $("#loginError").textContent = "";

    showScreen("loginScreen");

    showToast("You have logged out.");
  });


  // ==========================================
  // 18. RESTORE SESSION AFTER REFRESH
  // ==========================================

  const savedEmail = localStorage.getItem(SESSION_KEY);

  if (savedEmail) {
    const savedUser = data.users.find(
      (item) =>
        item.email.toLowerCase() === savedEmail.toLowerCase()
    );

    if (savedUser) {
      currentUser = savedUser;

      $("#headerAvatar").textContent =
        savedUser.name.trim().charAt(0).toUpperCase();

      renderDashboard();

      showScreen("dashboardScreen");

    } else {
      localStorage.removeItem(SESSION_KEY);

      showScreen("loginScreen");
    }

  } else {
    showScreen("loginScreen");
  }

})();
