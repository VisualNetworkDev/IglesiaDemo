(function (window, document) {
  "use strict";

  const state = {
    activeView: "home",
    publicConfig: {
      churchName: "Iglesia Nueva Esperanza",
      liveUrl: "",
      liveIsActive: false,
      mission: "Existimos para guiar a personas y familias a conocer a Cristo, crecer en una fe viva y servir con compasion a nuestra ciudad.",
      vision: "Ser una iglesia cercana, saludable y activa, donde cada persona encuentre cuidado espiritual, comunidad y oportunidades reales para servir.",
      history: "Nacimos como una comunidad local de fe con puertas abiertas para adorar, escuchar, acompañar y responder a las necesidades de la ciudad.",
      pastorName: "El equipo pastoral acompaña a la iglesia con enseñanza biblica, cuidado espiritual y seguimiento cercano a las familias.",
      serviceTimes: "Domingo 10:00 AM - 12:00 PM; Miércoles 7:30 PM - 9:00 PM",
      address: "Dirección por configurar",
      phone: "",
      email: "",
      cashAppInstructions: "Consulta las instrucciones vigentes con el equipo de tesoreria.",
      zelleInstructions: "Consulta las instrucciones vigentes con el equipo de tesoreria.",
      cashAppQrUrl: "",
      zelleQrUrl: "",
      cashInstructions: "Entrega directa al equipo autorizado y solicita confirmacion.",
      checkInstructions: "Consulta con tesoreria antes de enviar un check u otro metodo."
    },
    ministries: [],
    events: []
  };

  const fallbackPhotos = [
    "https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80"
  ];

  document.addEventListener("DOMContentLoaded", function () {
    initAppNavigation();
    initRequestTabs();
    initMinistrySliderControls();
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

  function initMinistrySliderControls() {
    const prev = document.querySelector("[data-ministry-prev]");
    const next = document.querySelector("[data-ministry-next]");
    if (prev) prev.addEventListener("click", function () { moveMinistrySlider(-1); });
    if (next) next.addEventListener("click", function () { moveMinistrySlider(1); });
    const slider = document.getElementById("ministriesGrid");
    if (slider) slider.addEventListener("scroll", updateMinistryDots);
  }

  function moveMinistrySlider(direction) {
    const slider = document.getElementById("ministriesGrid");
    const card = slider && slider.querySelector(".ministry-slide");
    if (!slider || !card) return;
    const amount = card.getBoundingClientRect().width + 14;
    slider.scrollBy({ left: amount * direction, behavior: "smooth" });
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
    setQrImage("cashAppQrImage", state.publicConfig.cashAppQrUrl);
    setQrImage("zelleQrImage", state.publicConfig.zelleQrUrl);
    setText("cashInstructions", state.publicConfig.cashInstructions);
    setText("checkInstructions", state.publicConfig.checkInstructions);
    setText("footerAddress", state.publicConfig.address);
    setText("footerContact", [state.publicConfig.email, state.publicConfig.phone].filter(Boolean).join(" · ") || "Email y teléfono por configurar");
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
    const dots = document.getElementById("ministryDots");
    if (!grid) return;
    const ministries = state.ministries.filter(function (item) { return item.visible !== false && item.visible !== "false"; });
    if (!ministries.length) {
      grid.innerHTML = '<div class="empty-state">Los ministerios apareceran aqui cuando esten disponibles.</div>';
      if (dots) dots.innerHTML = "";
      return;
    }
    grid.innerHTML = ministries.map(function (item, index) {
      return '<article class="ministry-slide">' +
        '<img src="' + escapeAttr(item.photoUrl || fallbackPhotos[index % fallbackPhotos.length]) + '" alt="">' +
        '<div><h3>' + escapeHtml(item.name || "Ministerio") + '</h3>' +
        '<p>' + escapeHtml(item.description || "") + '</p></div>' +
        '</article>';
    }).join("");
    if (dots) {
      dots.innerHTML = ministries.map(function (_, index) {
        return '<button type="button" data-ministry-dot="' + index + '" aria-label="Ver ministerio ' + (index + 1) + '"></button>';
      }).join("");
      dots.querySelectorAll("[data-ministry-dot]").forEach(function (button) {
        button.addEventListener("click", function () {
          const target = grid.querySelectorAll(".ministry-slide")[Number(button.dataset.ministryDot)];
          if (target) target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
        });
      });
    }
    updateMinistryDots();
  }

  function updateMinistryDots() {
    const slider = document.getElementById("ministriesGrid");
    const dots = document.getElementById("ministryDots");
    if (!slider || !dots) return;
    const slides = Array.from(slider.querySelectorAll(".ministry-slide"));
    if (!slides.length) return;
    const index = slides.reduce(function (best, slide, current) {
      const distance = Math.abs(slide.offsetLeft - slider.scrollLeft);
      return distance < best.distance ? { index: current, distance: distance } : best;
    }, { index: 0, distance: Infinity }).index;
    dots.querySelectorAll("button").forEach(function (button, current) {
      button.classList.toggle("active", current === index);
    });
  }

  function renderEvents() {
    const grid = document.getElementById("eventsGrid");
    if (!grid) return;
    const events = state.events.filter(function (item) { return item.active !== false && item.active !== "false"; });
    if (!events.length) {
      grid.innerHTML = '<div class="empty-state">Los eventos apareceran aqui cuando esten disponibles.</div>';
      return;
    }
    grid.innerHTML = events.map(function (item, index) {
      return '<article class="event-card">' +
        '<img src="' + escapeAttr(item.photoUrl || fallbackPhotos[index % fallbackPhotos.length]) + '" alt="">' +
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

  function setQrImage(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    if (!value) {
      element.hidden = true;
      element.removeAttribute("src");
      return;
    }
    element.src = value;
    element.hidden = false;
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
