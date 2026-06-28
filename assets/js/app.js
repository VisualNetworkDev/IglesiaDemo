(function (window, document) {
  "use strict";

  const state = {
    activeView: "home",
    publicConfig: {
      churchName: "Iglesia Nueva Esperanza",
      logoUrl: "assets/img/placeholder-logo.png",
      liveUrl: "",
      liveIsActive: false,
      mission: "Guiar a las personas a conocer a Cristo, fortalecer familias y servir con compasion.",
      vision: "Ser una iglesia saludable, cercana y comprometida con transformar vidas por medio del evangelio.",
      history: "Nacimos como una comunidad de fe local con el deseo de abrir puertas, escuchar necesidades y caminar junto a cada persona.",
      pastorName: "Informacion pastoral disponible proximamente.",
      serviceTimes: "Domingo 10:00 AM · Miercoles 7:30 PM",
      address: "Direccion por configurar",
      phone: "",
      email: "",
      cashAppInstructions: "Consulta las instrucciones vigentes con el equipo de tesoreria.",
      zelleInstructions: "Consulta las instrucciones vigentes con el equipo de tesoreria.",
      cashInstructions: "Entrega directa al equipo autorizado y solicita confirmacion.",
      checkInstructions: "Consulta con tesoreria antes de enviar un check u otro metodo."
    },
    ministries: [],
    events: []
  };

  document.addEventListener("DOMContentLoaded", function () {
    initAppNavigation();
    initRequestTabs();
    bindLiveButtons();
    ChurchFlowForms.init();
    loadPublicConfig();
  });

  function initAppNavigation() {
    document.querySelectorAll("[data-view-link]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        setActiveView(button.getAttribute("data-view-link"));
      });
    });
    document.querySelectorAll("[data-open-request]").forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveView("requests");
        setActiveRequest(button.getAttribute("data-open-request"));
      });
    });
  }

  function initRequestTabs() {
    document.querySelectorAll("[data-request-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveRequest(button.getAttribute("data-request-tab"));
      });
    });
  }

  function setActiveView(viewName) {
    state.activeView = viewName || "home";
    document.querySelectorAll("[data-screen]").forEach(function (screen) {
      screen.classList.toggle("active", screen.getAttribute("data-screen") === state.activeView);
    });
    document.querySelectorAll("[data-view-link]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-view-link") === state.activeView);
    });
  }

  function setActiveRequest(requestName) {
    const target = requestName || "newVisitor";
    document.querySelectorAll("[data-request-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-request-tab") === target);
    });
    document.querySelectorAll("[data-request-form]").forEach(function (form) {
      form.classList.toggle("active", form.getAttribute("data-request-form") === target);
    });
  }

  function bindLiveButtons() {
    document.querySelectorAll("[data-open-live]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!isLiveAvailable()) return;
        window.open(state.publicConfig.liveUrl, "_blank", "noopener");
      });
    });
  }

  function loadPublicConfig() {
    if (!ChurchFlowAPI.isConfigured()) {
      renderPublicData();
      return;
    }
    ChurchFlowAPI.request("getPublicConfig", {})
      .then(function (result) {
        state.publicConfig = Object.assign(state.publicConfig, result.data && result.data.config ? result.data.config : {});
        state.ministries = Array.isArray(result.data && result.data.ministries) ? result.data.ministries : [];
        state.events = Array.isArray(result.data && result.data.events) ? result.data.events : [];
        renderPublicData();
      })
      .catch(function () {
        renderPublicData();
      });
  }

  function renderPublicData() {
    setText("churchName", state.publicConfig.churchName);
    setText("heroTitle", state.publicConfig.churchName);
    setText("heroMessage", state.publicConfig.heroMessage || "Un lugar para adorar, recibir apoyo, crecer en la fe y servir a nuestra ciudad con amor.");
    setText("missionText", state.publicConfig.mission);
    setText("visionText", state.publicConfig.vision);
    setText("historyText", state.publicConfig.history);
    setText("pastorText", state.publicConfig.pastorName);
    setText("serviceTimes", state.publicConfig.serviceTimes);
    setText("cashAppInstructions", state.publicConfig.cashAppInstructions);
    setText("zelleInstructions", state.publicConfig.zelleInstructions);
    setText("cashInstructions", state.publicConfig.cashInstructions);
    setText("checkInstructions", state.publicConfig.checkInstructions);
    setText("footerAddress", state.publicConfig.address);
    setText("footerContact", [state.publicConfig.email, state.publicConfig.phone].filter(Boolean).join(" · ") || "Email y telefono por configurar");
    setImage("churchLogo", state.publicConfig.logoUrl);
    renderLiveState();
    renderMinistries();
    renderEvents();
  }

  function renderLiveState() {
    const active = isLiveAvailable();
    document.querySelectorAll(".live-only").forEach(function (element) {
      element.hidden = !active;
    });
  }

  function isLiveAvailable() {
    const activeValue = state.publicConfig.liveIsActive;
    const active = activeValue === true || activeValue === "true" || activeValue === "TRUE";
    return Boolean(active && state.publicConfig.liveUrl);
  }

  function renderMinistries() {
    const grid = document.getElementById("ministriesGrid");
    if (!grid) return;
    const ministries = state.ministries.filter(function (item) { return item.visible !== false && item.visible !== "false"; });
    if (!ministries.length) {
      grid.innerHTML = '<div class="empty-state">Los ministerios apareceran aqui cuando esten disponibles.</div>';
      return;
    }
    grid.innerHTML = ministries.map(function (item) {
      return '<article class="card">' +
        '<img src="' + escapeAttr(item.photoUrl || "assets/img/placeholder-logo.png") + '" alt="">' +
        '<h3>' + escapeHtml(item.name || "Ministerio") + '</h3>' +
        '<p>' + escapeHtml(item.description || "") + '</p>' +
        '</article>';
    }).join("");
  }

  function renderEvents() {
    const grid = document.getElementById("eventsGrid");
    if (!grid) return;
    const events = state.events.filter(function (item) { return item.active !== false && item.active !== "false"; });
    if (!events.length) {
      grid.innerHTML = '<div class="empty-state">Los eventos apareceran aqui cuando esten disponibles.</div>';
      return;
    }
    grid.innerHTML = events.map(function (item) {
      return '<article class="event-card">' +
        (item.photoUrl ? '<img src="' + escapeAttr(item.photoUrl) + '" alt="">' : "") +
        '<h3>' + escapeHtml(item.title || "Evento") + '</h3>' +
        '<div class="event-meta"><span>' + escapeHtml(item.date || "") + '</span><span>' + escapeHtml(item.time || "") + '</span><span>' + escapeHtml(item.location || "") + '</span></div>' +
        '<p>' + escapeHtml(item.description || "") + '</p>' +
        '</article>';
    }).join("");
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) element.textContent = value;
  }

  function setImage(id, value) {
    const element = document.getElementById(id);
    if (element && value) element.src = value;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})(window, document);
