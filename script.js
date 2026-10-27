(() => {
  "use strict";

  // ==========================================
  // 1. SELECTORS AND STORAGE
  // ==========================================

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = "Acadova_data_v1";
  const SESSION_KEY = "Acadova_session_v1";

  const DEFAULT_SUBJECTS = [
    "ICT",
    "English",
    "Science",
    "Math",
    "Research",
    "Other"
  ];

  const DEMO_USER = {
    name: "Demo Student",
    email: "demo@acadova.com",
    password: "study123",
    subjects: [...DEFAULT_SUBJECTS]
  };

  let currentUser = null;
  let activeStatus = "all";
  let pendingDeleteId = null;
  let toastTimer = null;

  // ==========================================
  // 2. DATE HELPERS
  // ==========================================

  function localDate(date = new Date()) {
    const d = new Date(date);

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function prettyDate(value) {
    if (!value) return "No due date";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "No due date";
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function relativeDue(value) {
    if (!value) return "No due date";

    const due = new Date(`${value}T00:00:00`);
    const today = new Date(`${localDate()}T00:00:00`);

    if (Number.isNaN(due.getTime())) {
      return "No due date";
    }

    const difference = Math.round(
      (due.getTime() - today.getTime()) / 86400000
    );

    if (difference < 0) {
      return `Overdue · ${prettyDate(value)}`;
    }

    if (difference === 0) {
      return "Due today";
    }

    if (difference === 1) {
      return "Due tomorrow";
    }

    return `Due ${prettyDate(value)}`;
  }

  // ==========================================
  // 3. DATABASE
  // ==========================================

  function createStarterData() {
    return {
      users: [{ ...DEMO_USER }],
      tasks: []
    };
  }

  function loadData() {
    let saved;

    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      saved = null;
    }

    if (
      !saved ||
      !Array.isArray(saved.users) ||
      !Array.isArray(saved.tasks)
    ) {
      saved = createStarterData();
    }

    saved.users = saved.users.filter((user) =>
      user &&
      typeof user.name === "string" &&
      typeof user.email === "string" &&
      typeof user.password === "string"
    );

    saved.users = saved.users.map((user) => ({
      ...user,
      email: user.email.trim().toLowerCase(),
      subjects: Array.isArray(user.subjects)
        ? [...new Set(
            user.subjects
              .map((subject) => String(subject).trim())
              .filter(Boolean)
          )]
        : [...DEFAULT_SUBJECTS]
    }));

    const demoExists = saved.users.some(
      (user) => user.email === DEMO_USER.email
    );

    if (!demoExists) {
      saved.users.push({ ...DEMO_USER });
    }

    const knownEmails = new Set(
      saved.users.map((user) => user.email)
    );

    saved.tasks = saved.tasks
      .filter((task) =>
        task &&
        task.id &&
        typeof task.title === "string" &&
        typeof task.userEmail === "string" &&
        knownEmails.has(task.userEmail.toLowerCase())
      )
      .map((task) => ({
        ...task,
        userEmail: task.userEmail.toLowerCase(),
        completed: Boolean(task.completed),
        priority: task.priority || "Medium",
        subject: task.subject || "Other",
        description: task.description || ""
      }));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      console.warn("Could not initialize local storage.", error);
    }

    return saved;
  }

  let data = loadData();

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Could not save data:", error);
      showToast("Unable to save. Your browser storage may be full.");
      return false;
    }
  }

  function userTasks() {
    if (!currentUser) return [];

    return data.tasks.filter(
      (task) => task.userEmail === currentUser.email
    );
  }

  function findCurrentUser() {
    if (!currentUser) return null;

    return data.users.find(
      (user) => user.email === currentUser.email
    ) || null;
  }

  // ==========================================
  // 4. GENERAL HELPERS
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

  function clearAuthErrors() {
    [
      "#loginError",
      "#registerError",
      "#resetError",
      "#passwordError"
    ].forEach((selector) => setError(selector));
  }

  // ==========================================
  // 5. NAVIGATION
  // ==========================================

  function showScreen(screenId) {
    const screen = document.getElementById(screenId);

    if (!screen) return;

    $$(".screen").forEach((item) => {
      item.classList.toggle("active", item.id === screenId);
    });

    const bottomNav = $("#bottomNav");

    if (bottomNav) {
      bottomNav.classList.toggle("hidden", !currentUser);
    }

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
      populateSubjectFilters();
      renderTasks();
    }

    if (screenId === "profileScreen") {
      renderProfile();
    }
  }

  function setSession(user) {
    currentUser = user || null;

    try {
      if (currentUser) {
        localStorage.setItem(SESSION_KEY, currentUser.email);
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      console.warn("Could not save the current session.", error);
    }

    // Optional header avatar, if you add one later.
    const headerAvatar = $("#headerAvatar");

    if (headerAvatar) {
      headerAvatar.textContent = currentUser
        ? currentUser.name.charAt(0).toUpperCase()
        : "S";
    }
  }

  function enterApp(user) {
    setSession(user);
    clearAuthErrors();
    showScreen("dashboardScreen");
    showToast(`Welcome, ${user.name.split(" ")[0]}!`);
  }

  // ==========================================
  // 6. LOGIN
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
      setError("#loginError", "Incorrect email or password.");
      return;
    }

    $("#loginForm").reset();
    enterApp(user);
  });

  // ==========================================
  // 7. REGISTER
  // ==========================================

  $("#registerForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#registerName").value.trim();
    const email = $("#registerEmail").value.trim().toLowerCase();
    const password = $("#registerPassword").value;

    setError("#registerError");

    if (name.length < 2) {
      setError("#registerError", "Please enter your full name.");
      return;
    }

    if (password.length < 4) {
      setError("#registerError", "Password must have at least 4 characters.");
      return;
    }

    const emailExists = data.users.some(
      (user) => user.email.toLowerCase() === email
    );

    if (emailExists) {
      setError("#registerError", "An account with this email already exists.");
      return;
    }

    const newUser = {
      name,
      email,
      password,
      subjects: [...DEFAULT_SUBJECTS]
    };

    data.users.push(newUser);

    if (!saveData()) {
      data.users = data.users.filter(
        (user) => user.email !== email
      );
      return;
    }

    $("#registerForm").reset();

    // New accounts start with no tasks.
    enterApp(newUser);
  });

  // ==========================================
  // 8. FORGOT PASSWORD
  // ==========================================

  $("#forgotPasswordForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const email = $("#resetEmail").value.trim().toLowerCase();
    const newPassword = $("#resetPassword").value;
    const confirmPassword = $("#resetPasswordConfirm").value;

    setError("#resetError");

    const user = data.users.find(
      (item) => item.email.toLowerCase() === email
    );

    if (!user) {
      setError("#resetError", "No account was found with that email.");
      return;
    }

    if (newPassword.length < 4) {
      setError("#resetError", "Password must have at least 4 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("#resetError", "The passwords do not match.");
      return;
    }

    const oldPassword = user.password;
    user.password = newPassword;

    if (!saveData()) {
      user.password = oldPassword;
      return;
    }

    $("#forgotPasswordForm").reset();

    showScreen("loginScreen");

    showToast("Password reset successfully. You can now log in.");
  });

  // ==========================================
  // 9. TASK CARD HTML
  // ==========================================

  function taskCard(task) {
    const priority = String(task.priority || "Medium").toLowerCase();

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
          <p class="task-title">${escapeHTML(task.title)}</p>

          <div class="task-meta">
            <span class="pill">
              ${escapeHTML(task.subject || "Other")}
            </span>

            <span class="pill ${escapeHTML(priority)}">
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
            title="Edit task"
            aria-label="Edit ${escapeHTML(task.title)}"
          >✎</button>

          <button
            type="button"
            class="mini-action delete"
            data-action="delete"
            data-id="${escapeHTML(task.id)}"
            title="Delete task"
            aria-label="Delete ${escapeHTML(task.title)}"
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
            ? `<button type="button" class="button primary" data-empty-add>
                ＋ Add a task
              </button>`
            : ""
        }
      </div>
    `;
  }

  // ==========================================
  // 10. DASHBOARD
  // ==========================================

  function renderDashboard() {
    if (!currentUser) return;

    const tasks = userTasks();

    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;

    const percentage = total
      ? Math.round((completed / total) * 100)
      : 0;

    const greeting = $("#greeting");
    const todayLabel = $("#todayLabel");

    if (greeting) {
      const hour = new Date().getHours();

      let greetingText = "Good evening";

      if (hour < 12) {
        greetingText = "Good morning";
      } else if (hour < 18) {
        greetingText = "Good afternoon";
      }

      greeting.textContent =
        `${greetingText}, ${currentUser.name.split(" ")[0]}!`;
    }

    if (todayLabel) {
      todayLabel.textContent = new Date().toLocaleDateString(
        undefined,
        {
          weekday: "long",
          month: "long",
          day: "numeric"
        }
      ).toUpperCase();
    }

    $("#totalCount").textContent = total;
    $("#pendingCount").textContent = pending;
    $("#completedCount").textContent = completed;
    $("#progressPercent").textContent = `${percentage}%`;
    $("#progressBar").style.width = `${percentage}%`;

    $("#welcomeSummary").textContent = total
      ? `You've completed ${completed} of ${total} task${total === 1 ? "" : "s"}. Keep going!`
      : "Add your first task and start making progress.";

    const upcomingList = $("#upcomingList");

    const upcoming = [...tasks]
      .filter((task) => !task.completed)
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 4);

    if (!upcoming.length) {
      upcomingList.innerHTML = emptyState(
        "Nothing on your list yet",
        "Add a task to keep track of your schoolwork.",
        true
      );
      return;
    }

    upcomingList.innerHTML = upcoming.map(taskCard).join("");
  }

  // ==========================================
  // 11. SUBJECTS
  // ==========================================

  function getSubjects() {
    if (!currentUser) return [...DEFAULT_SUBJECTS];

    const user = findCurrentUser();

    if (!user) return [...DEFAULT_SUBJECTS];

    if (!Array.isArray(user.subjects)) {
      user.subjects = [...DEFAULT_SUBJECTS];
    }

    return user.subjects;
  }

  function populateSubjectOptions(selected = "") {
    const select = $("#taskSubject");
    const subjects = getSubjects();

    select.innerHTML = `
      <option value="">Choose a subject</option>
      ${subjects.map((subject) => `
        <option value="${escapeHTML(subject)}">
          ${escapeHTML(subject)}
        </option>
      `).join("")}
    `;

    if (selected && subjects.includes(selected)) {
      select.value = selected;
    }
  }

  function populateSubjectFilters() {
    const select = $("#subjectFilter");

    if (!select) return;

    const previous = select.value || "all";

    select.innerHTML = `
      <option value="all">All subjects</option>
      ${getSubjects().map((subject) => `
        <option value="${escapeHTML(subject)}">
          ${escapeHTML(subject)}
        </option>
      `).join("")}
    `;

    select.value = getSubjects().includes(previous)
      ? previous
      : "all";
  }

  function addSubject() {
    if (!currentUser) return;

    const input = $("#newSubjectInput");
    const subject = input.value.trim();

    if (!subject) {
      showToast("Please enter a subject name.");
      input.focus();
      return;
    }

    const user = findCurrentUser();

    if (!user) return;

    const exists = user.subjects.some(
      (item) => item.toLowerCase() === subject.toLowerCase()
    );

    if (exists) {
      showToast("That subject already exists.");
      return;
    }

    user.subjects.push(subject);

    if (!saveData()) {
      user.subjects.pop();
      return;
    }

    populateSubjectOptions(subject);
    populateSubjectFilters();

    $("#subjectFilter").value = "all";
    $("#subjectAddPanel").classList.add("hidden");
    input.value = "";

    showToast("Subject added successfully ✓");
  }

  $("#addSubjectBtn").addEventListener("click", () => {
    $("#subjectAddPanel").classList.toggle("hidden");

    if (!$("#subjectAddPanel").classList.contains("hidden")) {
      $("#newSubjectInput").focus();
    }
  });

  $("#saveSubjectBtn").addEventListener("click", addSubject);

  $("#newSubjectInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubject();
    }
  });

  $("#cancelSubjectBtn").addEventListener("click", () => {
    $("#subjectAddPanel").classList.add("hidden");
    $("#newSubjectInput").value = "";
  });

  // ==========================================
  // 12. TASK LIST, SEARCH, FILTERS, AND SORT
  // ==========================================

  function renderTasks() {
    if (!currentUser) return;

    const list = $("#allTasksList");
    const query = $("#searchInput").value.trim().toLowerCase();
    const subject = $("#subjectFilter").value;
    const sort = $("#sortSelect").value;

    let tasks = userTasks();

    if (activeStatus === "pending") {
      tasks = tasks.filter((task) => !task.completed);
    } else if (activeStatus === "completed") {
      tasks = tasks.filter((task) => task.completed);
    }

    if (subject !== "all") {
      tasks = tasks.filter((task) => task.subject === subject);
    }

    if (query) {
      tasks = tasks.filter((task) =>
        task.title.toLowerCase().includes(query) ||
        (task.subject || "").toLowerCase().includes(query) ||
        (task.description || "").toLowerCase().includes(query)
      );
    }

    if (sort === "date") {
      tasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if (sort === "priority") {
      const rank = { high: 1, medium: 2, low: 3 };

      tasks.sort((a, b) =>
        (rank[(a.priority || "Medium").toLowerCase()] || 2) -
        (rank[(b.priority || "Medium").toLowerCase()] || 2)
      );
    } else if (sort === "newest") {
      tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    $("#taskResultCount").textContent =
      `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

    $("#clearSearch").style.display = query ? "block" : "none";

    if (!tasks.length) {
      list.innerHTML = emptyState(
        "No tasks found",
        query || subject !== "all" || activeStatus !== "all"
          ? "Try changing your search or filters."
          : "Add your first task to get started.",
        true
      );
      return;
    }

    list.innerHTML = tasks.map(taskCard).join("");
  }

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

  // ==========================================
  // 13. OPEN NEW TASK FORM
  // ==========================================

  function openNewTask() {
    if (!currentUser) return;

    $("#taskForm").reset();
    $("#taskId").value = "";
    $("#taskFormTitle").textContent = "Add a task";
    $("#saveTaskBtn").innerHTML = "Save task <span>→</span>";
    $("#taskDue").value = localDate();
    $("#taskPriority").value = "Medium";

    $("#subjectAddPanel").classList.add("hidden");
    $("#newSubjectInput").value = "";

    populateSubjectOptions();

    showScreen("taskFormScreen");
  }

  // ==========================================
  // 14. EDIT, COMPLETE, AND DELETE TASKS
  // ==========================================

  function findOwnedTask(id) {
    return userTasks().find((task) => task.id === id);
  }

  function handleTaskAction(action, id) {
    if (!currentUser) return;

    const task = findOwnedTask(id);

    if (!task) return;

    if (action === "toggle") {
      const previous = task.completed;

      task.completed = !task.completed;

      if (!saveData()) {
        task.completed = previous;
        return;
      }

      renderDashboard();
      renderTasks();

      showToast(
        task.completed
          ? "Task completed ✓"
          : "Task marked as pending."
      );
    }

    if (action === "edit") {
      $("#taskId").value = task.id;
      $("#taskTitle").value = task.title;
      $("#taskDue").value = task.dueDate || localDate();
      $("#taskPriority").value = task.priority || "Medium";
      $("#taskDescription").value = task.description || "";

      populateSubjectOptions(task.subject || "");

      $("#taskFormTitle").textContent = "Edit task";
      $("#saveTaskBtn").innerHTML = "Save changes <span>→</span>";

      $("#subjectAddPanel").classList.add("hidden");

      showScreen("taskFormScreen");
    }

    if (action === "delete") {
      pendingDeleteId = task.id;
      $("#deleteModal").classList.remove("hidden");
    }
  }

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      handleTaskAction(
        actionButton.dataset.action,
        actionButton.dataset.id
      );
    }

    if (event.target.closest("[data-empty-add]")) {
      openNewTask();
    }
  });

  // ==========================================
  // 15. SAVE TASK
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

    const existing = id ? findOwnedTask(id) : null;

    if (id && !existing) {
      showToast("This task could not be found.");
      return;
    }

    if (
      dueDate < localDate() &&
      !confirm("This due date is in the past. Save this task anyway?")
    ) {
      return;
    }

    const task = {
      id: existing
        ? existing.id
        : `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

      userEmail: currentUser.email,
      title,
      subject,
      dueDate,
      priority: $("#taskPriority").value || "Medium",
      description: $("#taskDescription").value.trim(),
      completed: existing ? existing.completed : false,
      createdAt: existing ? existing.createdAt : Date.now()
    };

    if (existing) {
      const oldTask = { ...existing };
      Object.assign(existing, task);

      if (!saveData()) {
        Object.assign(existing, oldTask);
        return;
      }
    } else {
      data.tasks.push(task);

      if (!saveData()) {
        data.tasks.pop();
        return;
      }
    }

    renderDashboard();
    populateSubjectFilters();
    renderTasks();

    showScreen("tasksScreen");

    showToast(
      existing
        ? "Changes saved successfully ✓"
        : "Task added successfully ✓"
    );
  });

  // ==========================================
  // 16. DELETE CONFIRMATION
  // ==========================================

  function closeDeleteModal() {
    pendingDeleteId = null;
    $("#deleteModal").classList.add("hidden");
  }

  $("#keepTaskBtn").addEventListener("click", closeDeleteModal);

  $("#confirmDeleteBtn").addEventListener("click", () => {
    if (!pendingDeleteId || !currentUser) return;

    const task = findOwnedTask(pendingDeleteId);

    if (!task) {
      closeDeleteModal();
      return;
    }

    const oldTasks = [...data.tasks];

    data.tasks = data.tasks.filter(
      (item) =>
        !(
          item.id === pendingDeleteId &&
          item.userEmail === currentUser.email
        )
    );

    if (!saveData()) {
      data.tasks = oldTasks;
      return;
    }

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
  // 17. PROFILE
  // ==========================================

  function renderProfile() {
    if (!currentUser) return;

    const user = findCurrentUser();

    if (!user) return;

    $("#profileName").textContent = user.name;
    $("#profileEmail").textContent = user.email;
    $("#profileNameInput").value = user.name;
    $("#profileEmailInput").value = user.email;

    const avatar = $("#profileAvatar");

    if (user.profilePicture) {
      avatar.innerHTML = `
        <img
          src="${user.profilePicture}"
          alt="Profile picture"
        >
      `;
    } else {
      avatar.textContent = user.name.trim().charAt(0).toUpperCase();
    }
  }

  $("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const user = findCurrentUser();
    const newName = $("#profileNameInput").value.trim();

    if (!user || newName.length < 2) {
      showToast("Please enter a valid name.");
      return;
    }

    const oldName = user.name;
    user.name = newName;
    currentUser.name = newName;

    if (!saveData()) {
      user.name = oldName;
      currentUser.name = oldName;
      return;
    }

    renderProfile();
    renderDashboard();

    showToast("Profile updated successfully ✓");
  });

  // ==========================================
  // 18. PROFILE PICTURE UPLOAD
  // ==========================================

  $("#profilePictureInput").addEventListener("change", (event) => {
    if (!currentUser) return;

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast("Choose an image smaller than 8 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSide = 320;

        const scale = Math.min(
          1,
          maxSide / Math.max(image.width, image.height)
        );

        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");

        if (!context) {
          showToast("Could not process that image.");
          return;
        }

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const picture = canvas.toDataURL("image/jpeg", 0.78);
        const user = findCurrentUser();

        if (!user) return;

        const oldPicture = user.profilePicture;

        user.profilePicture = picture;
        currentUser.profilePicture = picture;

        if (!saveData()) {
          if (oldPicture) {
            user.profilePicture = oldPicture;
            currentUser.profilePicture = oldPicture;
          } else {
            delete user.profilePicture;
            delete currentUser.profilePicture;
          }

          return;
        }

        renderProfile();
        showToast("Profile picture updated ✓");
      };

      image.onerror = () => {
        showToast("That image could not be opened.");
      };

      image.src = reader.result;
    };

    reader.onerror = () => {
      showToast("Could not read that image.");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  });

  $("#removeProfilePictureBtn").addEventListener("click", () => {
    if (!currentUser) return;

    const user = findCurrentUser();

    if (!user || !user.profilePicture) {
      showToast("You have no profile picture to remove.");
      return;
    }

    const oldPicture = user.profilePicture;

    delete user.profilePicture;
    delete currentUser.profilePicture;

    if (!saveData()) {
      user.profilePicture = oldPicture;
      currentUser.profilePicture = oldPicture;
      return;
    }

    renderProfile();
    showToast("Profile picture removed.");
  });

  // ==========================================
  // 19. CHANGE PASSWORD
  // ==========================================

  $("#changePasswordForm").addEventListener("submit", (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const user = findCurrentUser();

    if (!user) return;

    const currentPassword = $("#currentPassword").value;
    const newPassword = $("#newPassword").value;
    const confirmPassword = $("#confirmNewPassword").value;

    setError("#passwordError");

    if (currentPassword !== user.password) {
      setError("#passwordError", "Your current password is incorrect.");
      return;
    }

    if (newPassword.length < 4) {
      setError(
        "#passwordError",
        "Your new password must have at least 4 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("#passwordError", "The new passwords do not match.");
      return;
    }

    const oldPassword = user.password;

    user.password = newPassword;
    currentUser.password = newPassword;

    if (!saveData()) {
      user.password = oldPassword;
      currentUser.password = oldPassword;
      return;
    }

    $("#changePasswordForm").reset();

    showToast("Password updated successfully ✓");
  });

  // ==========================================
  // 20. LOGOUT
  // ==========================================

  $("#logoutBtn").addEventListener("click", () => {
    setSession(null);

    $("#loginForm").reset();

    clearAuthErrors();

    activeStatus = "all";

    showScreen("loginScreen");

    showToast("You have logged out.");
  });

  // ==========================================
  // 21. NAVIGATION BUTTONS
  // ==========================================

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      clearAuthErrors();
      showScreen(button.dataset.go);
    });
  });

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.screen);
    });
  });

  $$("[data-screen]")
    .filter((button) => !button.classList.contains("nav-item"))
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

  $("#quickAddBtn").addEventListener("click", openNewTask);
  $("#tasksAddBtn").addEventListener("click", openNewTask);

  $("#cancelTaskBtn").addEventListener("click", () => {
    showScreen("tasksScreen");
  });

  $("#discardTaskBtn").addEventListener("click", () => {
    showScreen("tasksScreen");
  });

  // ==========================================
  // 22. RESTORE SESSION
  // ==========================================

  function restoreSession() {
    let savedEmail = null;

    try {
      savedEmail = localStorage.getItem(SESSION_KEY);
    } catch (error) {
      savedEmail = null;
    }

    if (!savedEmail) {
      showScreen("loginScreen");
      return;
    }

    const user = data.users.find(
      (item) => item.email === savedEmail.toLowerCase()
    );

    if (user) {
      setSession(user);
      showScreen("dashboardScreen");
    } else {
      setSession(null);
      showScreen("loginScreen");
    }
  }

  // ==========================================
  // 23. INITIALIZE APP
  // ==========================================

  function initializeApp() {
    populateSubjectOptions();
    populateSubjectFilters();
    restoreSession();
  }

  initializeApp();

})();