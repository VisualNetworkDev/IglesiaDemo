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
      facebookUrl: "",
      cashAppInstructions: "Consulta las instrucciones vigentes con el equipo de tesoreria.",
      cashAppLink: "",
      zelleInstructions: "Consulta las instrucciones vigentes con el equipo de tesoreria.",
      cashAppQrUrl: "",
      zelleQrUrl: "",
      cashInstructions: "Entrega directa al equipo autorizado y solicita confirmacion.",
      checkInstructions: "Consulta con tesoreria antes de enviar un check u otro metodo."
    },
    ministries: [],
    events: []
  };

  const PUBLIC_CACHE_KEY = "churchflow_public_config_v2";
  const PUBLIC_CACHE_TTL_MS = 10 * 60 * 1000;

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
    initDetailModal();
    bindLiveButtons();
    bindFacebookButtons();
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
        const target = button.getAttribute("data-open-request");
        if (target === "contribution" || target === "giving") {
          setActiveView("giving");
          const form = document.getElementById("givingReportForm");
          if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        setActiveView("requests");
        setActiveRequest(target);
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
    if (slider) {
      slider.addEventListener("scroll", scheduleMinistrySliderUpdate, { passive: true });
      window.addEventListener("resize", scheduleMinistrySliderUpdate);
      initMinistryDrag(slider);
      slider.addEventListener("click", function (event) {
        const card = event.target.closest("[data-ministry-detail]");
        if (card) openMinistryDetail(Number(card.getAttribute("data-ministry-detail")));
      });
      slider.addEventListener("keydown", function (event) {
        const card = event.target.closest("[data-ministry-detail]");
        if (!card || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        openMinistryDetail(Number(card.getAttribute("data-ministry-detail")));
      });
    }
  }

  function initDetailModal() {
    const eventsGrid = document.getElementById("eventsGrid");
    if (eventsGrid) {
      eventsGrid.addEventListener("click", function (event) {
        const card = event.target.closest("[data-event-detail]");
        if (card) openEventDetail(Number(card.getAttribute("data-event-detail")));
      });
      eventsGrid.addEventListener("keydown", function (event) {
        const card = event.target.closest("[data-event-detail]");
        if (!card || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        openEventDetail(Number(card.getAttribute("data-event-detail")));
      });
    }
    document.querySelectorAll("[data-close-detail]").forEach(function (button) {
      button.addEventListener("click", closeDetail);
    });
    const gallery = document.getElementById("detailGallery");
    if (gallery) {
      gallery.addEventListener("click", function (event) {
        const button = event.target.closest("[data-detail-photo]");
        if (!button) return;
        showDetailPhoto(Number(button.getAttribute("data-detail-photo")), true);
      });
    }
    const media = document.getElementById("detailMedia");
    if (media) {
      media.addEventListener("click", function (event) {
        const directionButton = event.target.closest("[data-detail-direction]");
        if (!directionButton) return;
        const direction = Number(directionButton.getAttribute("data-detail-direction"));
        showDetailPhoto((state.detailPhotoIndex || 0) + direction, true);
      });
      media.addEventListener("mouseenter", stopDetailSlideshow);
      media.addEventListener("mouseleave", startDetailSlideshow);
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDetail();
      if (document.getElementById("detailModal").classList.contains("hidden")) return;
      if (event.key === "ArrowLeft") showDetailPhoto((state.detailPhotoIndex || 0) - 1, true);
      if (event.key === "ArrowRight") showDetailPhoto((state.detailPhotoIndex || 0) + 1, true);
    });
  }

  function initMinistryDrag(slider) {
    const drag = { active: false, locked: false, startX: 0, startY: 0, startLeft: 0, moved: false };
    slider.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      drag.active = true;
      drag.locked = false;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.startLeft = slider.scrollLeft;
      drag.moved = false;
    });
    slider.addEventListener("pointermove", function (event) {
      if (!drag.active) return;
      const delta = event.clientX - drag.startX;
      const verticalDelta = event.clientY - drag.startY;
      if (!drag.locked) {
        if (Math.abs(delta) < 7 && Math.abs(verticalDelta) < 7) return;
        if (Math.abs(verticalDelta) >= Math.abs(delta)) {
          drag.active = false;
          return;
        }
        drag.locked = true;
        slider.classList.add("is-dragging");
        slider.setPointerCapture(event.pointerId);
      }
      if (Math.abs(delta) > 5) drag.moved = true;
      slider.scrollLeft = drag.startLeft - delta;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (eventName) {
      slider.addEventListener(eventName, function (event) {
        if (!drag.active) return;
        drag.active = false;
        slider.classList.remove("is-dragging");
        if (event.pointerId !== undefined && slider.hasPointerCapture(event.pointerId)) {
          slider.releasePointerCapture(event.pointerId);
        }
        if (drag.moved) {
          state.suppressMinistryClick = true;
          window.setTimeout(function () { state.suppressMinistryClick = false; }, 80);
        }
      });
    });
    slider.addEventListener("click", function (event) {
      if (!state.suppressMinistryClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
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
    if (state.activeView === "church") {
      window.setTimeout(updateMinistryDots, 0);
    }
    const activeScroll = document.querySelector('[data-screen="' + state.activeView + '"] .screen-scroll');
    if (activeScroll) activeScroll.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setActiveRequest(requestName) {
    const target = requestName || "newVisitor";
    document.querySelectorAll("[data-request-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-request-tab") === target);
    });
    document.querySelectorAll("[data-request-form]").forEach(function (form) {
      form.classList.toggle("active", form.getAttribute("data-request-form") === target);
    });
    const requestContent = document.querySelector(".request-content");
    if (requestContent) requestContent.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindLiveButtons() {
    document.querySelectorAll("[data-open-live]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!isLiveAvailable()) return;
        window.open(state.publicConfig.liveUrl || state.publicConfig.facebookUrl, "_blank", "noopener");
      });
    });
  }

  function bindFacebookButtons() {
    document.querySelectorAll("[data-open-facebook]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!state.publicConfig.facebookUrl) return;
        window.open(state.publicConfig.facebookUrl, "_blank", "noopener");
      });
    });
  }

  function loadPublicConfig() {
    const cached = readPublicCache();
    if (cached) applyPublicPayload(cached, true);
    if (!ChurchFlowAPI.isConfigured()) {
      if (!cached) renderPublicData();
      return;
    }
    ChurchFlowAPI.request("getPublicConfig", {})
      .then(function (result) {
        const data = result.data || {};
        writePublicCache(data);
        applyPublicPayload(data, false);
      })
      .catch(function () {
        if (!cached) renderPublicData();
      });
  }

  function applyPublicPayload(data) {
    state.publicConfig = Object.assign(state.publicConfig, data && data.config ? data.config : {});
    state.ministries = Array.isArray(data && data.ministries) ? data.ministries : [];
    state.events = Array.isArray(data && data.events) ? data.events : [];
    renderPublicData();
  }

  function readPublicCache() {
    try {
      const raw = localStorage.getItem(PUBLIC_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !cached.time || Date.now() - cached.time > PUBLIC_CACHE_TTL_MS) return null;
      return cached.data || null;
    } catch (error) {
      return null;
    }
  }

  function writePublicCache(data) {
    try {
      localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify({ time: Date.now(), data: data }));
    } catch (error) {}
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
    setLink("cashAppLinkButton", state.publicConfig.cashAppLink);
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
    document.querySelectorAll(".facebook-only").forEach(function (element) {
      element.hidden = !state.publicConfig.facebookUrl || active;
    });
  }

  function isLiveAvailable() {
    const activeValue = state.publicConfig.liveIsActive;
    const active = activeValue === true || activeValue === "true" || activeValue === "TRUE";
    return Boolean(active && (state.publicConfig.liveUrl || state.publicConfig.facebookUrl));
  }

  function renderMinistries() {
    const grid = document.getElementById("ministriesGrid");
    const dots = document.getElementById("ministryDots");
    if (!grid) return;
    const ministries = state.ministries.filter(function (item) { return item.visible !== false && item.visible !== "false"; });
    state.visibleMinistries = ministries;
    if (!ministries.length) {
      grid.innerHTML = '<div class="empty-state">Los ministerios apareceran aqui cuando esten disponibles.</div>';
      if (dots) dots.innerHTML = "";
      window.setTimeout(updateMinistryDots, 0);
      return;
    }
    grid.innerHTML = ministries.map(function (item, index) {
      return '<article class="ministry-slide" role="button" tabindex="0" data-ministry-detail="' + index + '">' +
        '<img loading="lazy" src="' + escapeAttr(item.photoUrl || fallbackPhotos[index % fallbackPhotos.length]) + '" alt="">' +
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
          scrollToMinistrySlide(Number(button.dataset.ministryDot));
        });
      });
    }
    window.setTimeout(updateMinistryDots, 0);
  }

  function scheduleMinistrySliderUpdate() {
    if (state.ministryUpdatePending) return;
    state.ministryUpdatePending = true;
    window.requestAnimationFrame(function () {
      state.ministryUpdatePending = false;
      updateMinistryDots();
    });
  }

  function scrollToMinistrySlide(index) {
    const slider = document.getElementById("ministriesGrid");
    const slides = slider ? Array.from(slider.querySelectorAll(".ministry-slide")) : [];
    const target = slides[index];
    if (!slider || !target) return;
    const maxScroll = Math.max(0, slider.scrollWidth - slider.clientWidth);
    const left = Math.min(maxScroll, Math.max(0, target.offsetLeft - ((slider.clientWidth - target.offsetWidth) / 2)));
    slider.scrollTo({ left: left, behavior: "smooth" });
  }

  function updateMinistryDots() {
    const slider = document.getElementById("ministriesGrid");
    const dots = document.getElementById("ministryDots");
    const prev = document.querySelector("[data-ministry-prev]");
    const next = document.querySelector("[data-ministry-next]");
    if (!slider || !dots) return;
    if (slider.clientWidth <= 0) return;
    const slides = Array.from(slider.querySelectorAll(".ministry-slide"));
    if (!slides.length) {
      dots.hidden = true;
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }
    const maxScroll = Math.max(0, slider.scrollWidth - slider.clientWidth);
    const canScroll = maxScroll > 3;
    const index = getActiveMinistryIndex(slider, slides, maxScroll);
    dots.hidden = !canScroll;
    if (prev) prev.disabled = !canScroll || slider.scrollLeft <= 3;
    if (next) next.disabled = !canScroll || slider.scrollLeft >= maxScroll - 3;
    dots.querySelectorAll("button").forEach(function (button, current) {
      button.classList.toggle("active", current === index);
    });
  }

  function getActiveMinistryIndex(slider, slides, maxScroll) {
    if (slider.scrollLeft <= 3) return 0;
    if (slider.scrollLeft >= maxScroll - 3) return slides.length - 1;
    const center = slider.scrollLeft + (slider.clientWidth / 2);
    return slides.reduce(function (best, slide, current) {
      const slideCenter = slide.offsetLeft + (slide.offsetWidth / 2);
      const distance = Math.abs(slideCenter - center);
      return distance < best.distance ? { index: current, distance: distance } : best;
    }, { index: 0, distance: Infinity }).index;
  }

  function renderEvents() {
    const grid = document.getElementById("eventsGrid");
    if (!grid) return;
    const events = state.events.filter(function (item) { return item.active !== false && item.active !== "false"; });
    state.visibleEvents = events;
    if (!events.length) {
      grid.innerHTML = '<div class="empty-state">Los eventos apareceran aqui cuando esten disponibles.</div>';
      return;
    }
    grid.innerHTML = events.map(function (item, index) {
      return '<article class="event-card" role="button" tabindex="0" data-event-detail="' + index + '">' +
        '<img loading="lazy" src="' + escapeAttr(item.photoUrl || fallbackPhotos[index % fallbackPhotos.length]) + '" alt="">' +
        '<h3>' + escapeHtml(item.title || "Evento") + '</h3>' +
        '<div class="event-meta"><span>' + escapeHtml(item.date || "") + '</span><span>' + escapeHtml(item.time || "") + '</span><span>' + escapeHtml(item.location || "") + '</span></div>' +
        '<p>' + escapeHtml(item.description || "") + '</p>' +
        '</article>';
    }).join("");
  }

  function openMinistryDetail(index) {
    const item = (state.visibleMinistries || [])[index];
    if (!item) return;
    const photos = normalizeGallery(item.photoUrl, item.galleryUrls, index);
    openDetail({
      kicker: "Ministerio",
      title: item.name || "Ministerio",
      description: item.description || "Informacion del ministerio disponible proximamente.",
      meta: item.leader ? ["Lider: " + item.leader] : [],
      photos: photos
    });
  }

  function openEventDetail(index) {
    const item = (state.visibleEvents || [])[index];
    if (!item) return;
    const photos = normalizeGallery(item.photoUrl, item.galleryUrls, index);
    openDetail({
      kicker: "Evento",
      title: item.title || "Evento",
      description: item.description || "Informacion del evento disponible proximamente.",
      meta: [item.date, item.time, item.location].filter(Boolean),
      photos: photos,
      autoplay: true
    });
  }

  function openDetail(detail) {
    const modal = document.getElementById("detailModal");
    if (!modal) return;
    const photos = detail.photos && detail.photos.length ? detail.photos : [fallbackPhotos[0]];
    stopDetailSlideshow();
    state.detailPhotos = photos;
    state.detailPhotoIndex = 0;
    state.detailAutoplay = detail.autoplay === true && photos.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("detailKicker").textContent = detail.kicker || "";
    document.getElementById("detailTitle").textContent = detail.title || "";
    document.getElementById("detailDescription").textContent = detail.description || "";
    document.getElementById("detailMeta").innerHTML = (detail.meta || []).map(function (item) {
      return '<span>' + escapeHtml(item) + '</span>';
    }).join("");
    document.getElementById("detailMedia").innerHTML =
      '<img id="detailMainPhoto" class="detail-main-photo is-visible" src="' + escapeAttr(photos[0]) + '" alt="">' +
      (photos.length > 1 ?
        '<div class="detail-media-controls">' +
          '<button type="button" data-detail-direction="-1" aria-label="Foto anterior">&lsaquo;</button>' +
          '<span id="detailPhotoCounter">1 / ' + photos.length + '</span>' +
          '<button type="button" data-detail-direction="1" aria-label="Foto siguiente">&rsaquo;</button>' +
        '</div>' : '');
    document.getElementById("detailGallery").innerHTML = photos.map(function (url, photoIndex) {
      return '<button type="button" class="detail-thumb' + (photoIndex === 0 ? " active" : "") + '" data-detail-photo="' + photoIndex + '" aria-label="Ver foto ' + (photoIndex + 1) + '">' +
        '<img loading="lazy" src="' + escapeAttr(url) + '" alt="">' +
      '</button>';
    }).join("");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    startDetailSlideshow();
  }

  function closeDetail() {
    const modal = document.getElementById("detailModal");
    if (!modal || modal.classList.contains("hidden")) return;
    stopDetailSlideshow();
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function showDetailPhoto(index, manual) {
    const photos = state.detailPhotos || [];
    const image = document.getElementById("detailMainPhoto");
    if (!photos.length || !image) return;
    const nextIndex = (index + photos.length) % photos.length;
    state.detailPhotoIndex = nextIndex;
    image.classList.remove("is-visible");
    window.setTimeout(function () {
      image.src = photos[nextIndex];
      image.classList.add("is-visible");
    }, 140);
    document.querySelectorAll("[data-detail-photo]").forEach(function (button, current) {
      button.classList.toggle("active", current === nextIndex);
    });
    const counter = document.getElementById("detailPhotoCounter");
    if (counter) counter.textContent = (nextIndex + 1) + " / " + photos.length;
    if (manual) {
      stopDetailSlideshow();
      startDetailSlideshow();
    }
  }

  function startDetailSlideshow() {
    stopDetailSlideshow();
    if (!state.detailAutoplay || !state.detailPhotos || state.detailPhotos.length < 2) return;
    state.detailSlideshowTimer = window.setInterval(function () {
      showDetailPhoto((state.detailPhotoIndex || 0) + 1, false);
    }, 4200);
  }

  function stopDetailSlideshow() {
    if (!state.detailSlideshowTimer) return;
    window.clearInterval(state.detailSlideshowTimer);
    state.detailSlideshowTimer = null;
  }

  function normalizeGallery(primaryUrl, value, index) {
    const urls = [];
    if (primaryUrl) urls.push(primaryUrl);
    parseGalleryUrls(value).forEach(function (url) { urls.push(url); });
    if (uniqueUrls(urls).length) return uniqueUrls(urls);
    let fallbackIndex = index;
    while (uniqueUrls(urls).length < 3 && fallbackIndex < index + fallbackPhotos.length) {
      urls.push(fallbackPhotos[fallbackIndex % fallbackPhotos.length]);
      fallbackIndex += 1;
    }
    return uniqueUrls(urls);
  }

  function uniqueUrls(urls) {
    return urls.filter(function (url, current, list) {
      return url && list.indexOf(url) === current;
    });
  }

  function parseGalleryUrls(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    const text = String(value || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (error) {
      return text.split(/\s*[\n,|]\s*/).filter(Boolean);
    }
    return [];
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

  function setLink(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    if (!value) {
      element.hidden = true;
      element.removeAttribute("href");
      return;
    }
    element.href = value;
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
