(function (window, document) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  const moduleMeta = {
    dashboard: ["Dashboard", "Resumen operativo"],
    records: ["Registro de Miembros", "Personas, hogares y estado espiritual"],
    requests: ["Formularios / Solicitudes", "Seguimiento pastoral y administrativo"],
    finance: ["Finanzas", "Contribuciones, ayudas y verificaciones"],
    reports: ["Reportes", "PDF y CSV bajo demanda"],
    files: ["Archivos / Drive", "Gestion de archivos auditada"],
    events: ["Eventos", "Agenda publica"],
    ministries: ["Ministerios", "Areas de servicio"],
    settings: ["Configuracion", "Datos de iglesia y sistema"],
    users: ["Usuarios y roles", "Acceso y permisos"],
    audit: ["Auditoria", "Historial no editable"]
  };

  app.escapeHtml = function (value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char];
    });
  };

  app.escapeAttr = function (value) {
    return app.escapeHtml(value).replace(/`/g, "&#096;");
  };

  app.badge = function (value) {
    return '<span class="badge">' + app.escapeHtml(value) + '</span>';
  };

  app.setContent = function (html) {
    document.getElementById("moduleContent").innerHTML = html;
    if (app.state.initialAdminLoad && String(html).indexOf("Cargando") === -1) {
      app.state.initialAdminLoad = false;
      hideAdminLoading();
    }
  };

  app.openModal = function (options) {
    const config = options || {};
    const root = ensureModalRoot();
    if (root._closeModal) root._closeModal(null);
    const hasPrimary = Boolean(config.primaryText);
    const cardClass = "modal-card" + (config.size === "wide" ? " wide" : "");
    root.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop>' +
        '<section class="' + cardClass + '" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle">' +
          '<header class="modal-header">' +
            '<h2 id="adminModalTitle">' + app.escapeHtml(config.title || "Detalle") + '</h2>' +
            '<button type="button" class="alert-close" data-modal-action="cancel" aria-label="Cerrar">x</button>' +
          '</header>' +
          '<div class="modal-body">' + (config.body || "") + '</div>' +
          '<footer class="modal-actions">' +
            '<button type="button" class="button" data-modal-action="cancel">' + app.escapeHtml(config.cancelText || "Cerrar") + '</button>' +
            (hasPrimary ? '<button type="button" class="button ' + (config.danger ? "danger" : "primary") + '" data-modal-action="primary">' + app.escapeHtml(config.primaryText) + '</button>' : '') +
          '</footer>' +
        '</section>' +
      '</div>';

    const firstField = root.querySelector("input, select, textarea, button[data-modal-action='primary']");
    if (firstField) window.setTimeout(function () { firstField.focus(); }, 20);

    return new Promise(function (resolve) {
      function close(value) {
        root.innerHTML = "";
        root._closeModal = null;
        document.removeEventListener("keydown", onKeydown);
        resolve(value);
      }

      function submitPrimary() {
        const form = root.querySelector("form");
        if (form && !form.reportValidity()) return;
        close({ values: form ? ChurchFlowAPI.formToPayload(form) : {} });
      }

      function onKeydown(event) {
        if (event.key === "Escape") close(null);
      }

      root.onclick = function (event) {
        const actionButton = event.target.closest("[data-modal-action]");
        if (!actionButton) return;
        if (actionButton.dataset.modalAction === "primary") submitPrimary();
        if (actionButton.dataset.modalAction === "cancel") close(null);
      };
      root._closeModal = close;
      root.querySelectorAll("form").forEach(function (form) {
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          if (hasPrimary) submitPrimary();
        });
      });
      document.addEventListener("keydown", onKeydown);
    });
  };

  app.prompt = function (options) {
    const config = options || {};
    const inputHtml = config.multiline ?
      '<textarea name="value" rows="' + (config.rows || 4) + '"' + (config.required ? " required" : "") + '>' + app.escapeHtml(config.value || "") + '</textarea>' :
      '<input name="value" type="' + app.escapeAttr(config.type || "text") + '" value="' + app.escapeAttr(config.value || "") + '"' + (config.required ? " required" : "") + '>';
    return app.openModal({
      title: config.title || "Completar",
      body: '<form class="modal-form"><label>' + app.escapeHtml(config.label || "Valor") + inputHtml + '</label></form>',
      primaryText: config.primaryText || "Guardar",
      cancelText: config.cancelText || "Cancelar"
    }).then(function (result) {
      return result ? result.values.value : null;
    });
  };

  app.selectModal = function (options) {
    const config = options || {};
    const optionsHtml = (config.options || []).map(function (item) {
      const selected = String(item) === String(config.value || "") ? " selected" : "";
      return '<option' + selected + '>' + app.escapeHtml(item) + '</option>';
    }).join("");
    return app.openModal({
      title: config.title || "Seleccionar",
      body: '<form class="modal-form"><label>' + app.escapeHtml(config.label || "Opcion") + '<select name="value" required>' + optionsHtml + '</select></label></form>',
      primaryText: config.primaryText || "Guardar",
      cancelText: config.cancelText || "Cancelar"
    }).then(function (result) {
      return result ? result.values.value : null;
    });
  };

  app.confirm = function (options) {
    const config = options || {};
    return app.openModal({
      title: config.title || "Confirmar",
      body: '<p>' + app.escapeHtml(config.message || "Confirma esta accion.") + '</p>',
      primaryText: config.confirmText || "Confirmar",
      cancelText: config.cancelText || "Cancelar",
      danger: config.danger === true
    }).then(function (result) {
      return Boolean(result);
    });
  };

  app.renderTable = function (rows, columns, actionBuilder) {
    if (!rows || !rows.length) return '<div class="empty">No hay datos para mostrar.</div>';
    const header = columns.map(function (column) { return '<th>' + app.escapeHtml(column[1]) + '</th>'; }).join("") + (actionBuilder ? "<th>Acciones</th>" : "");
    const body = rows.map(function (row, index) {
      const cells = columns.map(function (column) {
        const value = row[column[0]];
        const formatted = column[2] ? column[2](value, row) : app.escapeHtml(value);
        return "<td>" + formatted + "</td>";
      }).join("");
      const actions = actionBuilder ? '<td><div class="row-actions">' + actionBuilder(row, index) + '</div></td>' : "";
      return "<tr>" + cells + actions + "</tr>";
    }).join("");
    return '<div class="table-wrap"><table><thead><tr>' + header + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  };

  app.showError = function (error) {
    if (app.state.initialAdminLoad) {
      app.state.initialAdminLoad = false;
      hideAdminLoading();
    }
    showAlert(error && error.message ? error.message : String(error), "error");
  };

  app.showSuccess = function (message) {
    showAlert(message, "success");
  };

  app.registerModule("dashboard", {
    title: "Dashboard",
    subtitle: "Resumen operativo",
    render: function () {
      app.setContent('<section class="panel"><p class="status">Cargando dashboard...</p></section>');
      app.api("getDashboardData", {}).then(function (result) {
        const data = result.data || {};
        app.state.dashboardData = data;
        app.state.dashboardAlerts = normalizeDashboardAlerts(data);
        app.setContent(
          '<div class="stats-grid">' +
            stat("Solicitudes nuevas", data.newRequests || 0) +
            stat("Solicitudes pendientes", data.pendingRequests || 0) +
            stat("Total verificado", money(data.verifiedContributionTotal || 0)) +
            stat("Por verificar", data.pendingContributions || 0) +
            stat("Miembros activos", data.activeRecords || 0) +
            stat("Proximos eventos", data.upcomingEvents || 0) +
            stat("Alertas", (data.alerts || []).length) +
            stat("Año activo", data.activeYear || "") +
          '</div>' +
          '<section class="panel"><h2>Accesos rapidos</h2><div class="form-actions">' +
            quick("requests", "Ver solicitudes") +
            quick("finance", "Ver finanzas") +
            quick("records", "Buscar miembro") +
            quick("reports", "Generar reportes") +
          '</div></section>' +
          '<section class="panel"><h2>Alertas importantes</h2>' +
            (app.state.dashboardAlerts.length ?
              '<button type="button" class="button primary" data-open-dashboard-alerts>Ver alertas (' + app.escapeHtml(app.state.dashboardAlerts.length) + ')</button>' +
              '<ul class="alert-summary">' + app.state.dashboardAlerts.map(function (item, index) {
                return '<li><button type="button" data-alert-index="' + index + '"><span>' + app.escapeHtml(item.label) + '</span><strong>' + app.escapeHtml(item.count || "") + '</strong></button></li>';
              }).join("") + '</ul>' :
              '<div class="empty">No hay alertas pendientes.</div>') +
          '</section>'
        );
      }).catch(app.showError);
    }
  });

  app.registerModule("requests", {
    title: "Formularios / Solicitudes",
    subtitle: "Categorias, estados, asignacion y notas privadas",
    render: function () {
      app.requireAccess("forms", "read");
      app.setContent(
        '<section class="panel">' +
          '<div class="toolbar">' +
            '<label>Categoria<select id="requestCategory"><option value="">Todas</option><option>Oracion</option><option>Asistencia</option><option>Consejeria</option><option>Visitas</option><option>Contacto</option><option>Documentos</option><option>NuevosVisitantes</option></select></label>' +
            '<label>Estado<select id="requestStatus"><option value="">Todos</option><option>Nuevo</option><option>En revision</option><option>Asignado</option><option>Contactado</option><option>Resuelto</option><option>Archivado</option></select></label>' +
            '<button type="button" class="button" id="loadRequests">Buscar</button>' +
          '</div>' +
          '<div id="requestsTable"></div>' +
        '</section>'
      );
      document.getElementById("loadRequests").addEventListener("click", loadRequests);
      document.getElementById("requestsTable").addEventListener("click", requestAction);
      if (app.state.pendingRequestOpen) {
        document.getElementById("requestCategory").value = app.state.pendingRequestOpen.category || "";
        document.getElementById("requestStatus").value = "";
      }
      loadRequests();
    }
  });

  app.registerModule("audit", {
    title: "Auditoria",
    subtitle: "Historial de acciones no editable",
    render: function () {
      app.requireAccess("audit", "read");
      const cleanButton = canCleanAudit() ? '<button type="button" class="button danger" id="clearAudit">Borrar auditoria</button>' : "";
      app.setContent(
        '<section class="panel">' +
          '<div class="toolbar">' +
            '<label>Usuario<input id="auditUser"></label>' +
            '<label>Modulo<input id="auditModule"></label>' +
            '<label>Accion<input id="auditAction"></label>' +
            '<label>Desde<input id="auditFrom" type="date"></label>' +
            '<label>Hasta<input id="auditTo" type="date"></label>' +
            '<button type="button" class="button" id="loadAudit">Buscar</button>' +
            cleanButton +
          '</div>' +
          '<div id="auditTable"></div>' +
        '</section>'
      );
      document.getElementById("loadAudit").addEventListener("click", loadAudit);
      if (document.getElementById("clearAudit")) document.getElementById("clearAudit").addEventListener("click", clearAuditLogs);
      loadAudit();
    }
  });

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindShell();
    app.loadSession();
    if (!app.state.session) {
      showLogin();
      return;
    }
    app.validateSession().then(showAdmin).catch(function () {
      app.clearSession();
      showLogin();
    });
  }

  function bindShell() {
    document.getElementById("loginForm").addEventListener("submit", function (event) {
      event.preventDefault();
      const status = document.getElementById("loginStatus");
      ChurchFlowAPI.setStatus(status, "Validando acceso...", "");
      showAdminLoading();
      app.login(event.currentTarget.elements.username.value, event.currentTarget.elements.password.value)
        .then(showAdmin)
        .catch(function (error) {
          hideAdminLoading();
          ChurchFlowAPI.setStatus(status, error.message, "error");
        });
    });
    document.getElementById("logoutButton").addEventListener("click", function () {
      app.logout().then(showLogin);
    });
    document.getElementById("refreshButton").addEventListener("click", function () {
      app.clearCache();
      renderCurrentModule();
    });
    document.getElementById("mobileMenuButton").addEventListener("click", function () {
      document.querySelector(".sidebar").classList.toggle("open");
    });
    document.getElementById("adminNav").addEventListener("click", function (event) {
      const button = event.target.closest("button[data-module]");
      if (!button) return;
      setModule(button.dataset.module);
      document.querySelector(".sidebar").classList.remove("open");
    });
    document.getElementById("moduleContent").addEventListener("click", function (event) {
      const quickButton = event.target.closest("[data-quick-module]");
      if (quickButton) setModule(quickButton.dataset.quickModule);
      const alertsButton = event.target.closest("[data-open-dashboard-alerts]");
      if (alertsButton) showDashboardAlerts();
      const alertSummary = event.target.closest("[data-alert-index]");
      if (alertSummary) showDashboardAlertItems(Number(alertSummary.dataset.alertIndex));
    });
    document.getElementById("alertArea").addEventListener("click", function (event) {
      if (event.target.closest("[data-dismiss-alert]")) clearAlert();
    });
    document.addEventListener("click", function (event) {
      const button = event.target.closest("[data-toggle-password]");
      if (!button) return;
      const wrapper = button.closest(".password-field");
      const input = wrapper && wrapper.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Ocultar" : "Ver";
      button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  }

  function showLogin() {
    app.state.initialAdminLoad = false;
    hideAdminLoading();
    document.getElementById("loginView").classList.remove("hidden");
    document.getElementById("adminShell").classList.add("hidden");
  }

  function showAdmin() {
    app.state.initialAdminLoad = true;
    showAdminLoading();
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("adminShell").classList.remove("hidden");
    const session = app.state.session || {};
    const user = session.user || {};
    document.getElementById("adminUserLabel").textContent = [user.name || user.username, user.roleName].filter(Boolean).join(" · ");
    applyNavPermissions();
    setModule(app.state.currentModule || "dashboard");
    preloadAdminData();
  }

  function showAdminLoading() {
    document.getElementById("adminLoadingView").classList.remove("hidden");
  }

  function hideAdminLoading() {
    document.getElementById("adminLoadingView").classList.add("hidden");
  }

  function applyNavPermissions() {
    document.querySelectorAll("#adminNav button").forEach(function (button) {
      const module = button.dataset.module;
      const permissionModule = module === "requests" ? "forms" : module;
      const visible = module === "dashboard" || app.can(permissionModule, "read");
      button.classList.toggle("hidden", !visible);
    });
  }

  function setModule(name) {
    app.state.currentModule = name;
    renderCurrentModule();
  }

  app.openModule = setModule;

  function renderCurrentModule() {
    clearAlert();
    const name = app.state.currentModule || "dashboard";
    const meta = moduleMeta[name] || [name, ""];
    document.getElementById("moduleTitle").textContent = meta[0];
    document.getElementById("moduleSubtitle").textContent = meta[1];
    document.querySelectorAll("#adminNav button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.module === name);
    });
    try {
      if (!app.modules[name]) throw new Error("Modulo no disponible.");
      app.modules[name].render();
    } catch (error) {
      app.setContent('<section class="panel"><p class="status error">' + app.escapeHtml(error.message) + '</p></section>');
    }
  }

  function preloadAdminData() {
    window.setTimeout(function () {
      const jobs = [];
      if (app.can("forms", "read")) jobs.push(["getRequests", { category: "", status: "" }]);
      if (app.can("records", "read")) jobs.push(["getRecords", { query: "", status: "" }]);
      if (app.can("finance", "read")) jobs.push(["getFinanceRecords", { query: "", type: "", status: "", from: "", to: "" }]);
      if (app.can("events", "read")) jobs.push(["getEvents", { includeInactive: true }]);
      if (app.can("ministries", "read")) jobs.push(["getMinistries", { includeHidden: true }]);
      if (app.can("settings", "read")) jobs.push(["getSettings", {}]);
      if (app.can("files", "read") || app.can("files", "write")) jobs.push(["getDriveFiles", { fileType: "" }]);
      jobs.forEach(function (job) {
        app.api(job[0], job[1]).catch(function () {});
      });
    }, 700);
  }

  function loadRequests() {
    app.api("getRequests", {
      category: value("requestCategory"),
      status: value("requestStatus")
    }).then(function (result) {
      app.state.requestRows = result.data.requests || [];
      document.getElementById("requestsTable").innerHTML = app.renderTable(app.state.requestRows, [
        ["id", "ID"],
        ["category", "Categoria"],
        ["name", "Nombre"],
        ["phone", "Telefono"],
        ["email", "Email"],
        ["status", "Estado", app.badge],
        ["assignedTo", "Responsable"],
        ["createdAt", "Creado"]
      ], function (_, index) {
        return '<button type="button" class="button primary" data-view="' + index + '">Ver</button>' +
          '<button type="button" class="button" data-status="' + index + '">Estado</button>' +
          '<button type="button" class="button" data-assign="' + index + '">Asignar</button>' +
          '<button type="button" class="button" data-note="' + index + '">Nota privada</button>';
      });
      if (app.state.pendingRequestOpen) {
        const pending = app.state.pendingRequestOpen;
        const row = app.state.requestRows.filter(function (item) { return String(item.id) === String(pending.id); })[0];
        app.state.pendingRequestOpen = null;
        if (row) showRequestDetails(row);
      }
    }).catch(app.showError);
  }

  function requestAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.requestRows || [];
    const index = Number(button.dataset.view || button.dataset.status || button.dataset.assign || button.dataset.note);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.view !== undefined) {
      showRequestDetails(row);
    }
    if (button.dataset.status !== undefined) {
      app.selectModal({
        title: "Cambiar estado",
        label: "Estado de la solicitud",
        value: row.status || "Nuevo",
        options: ["Nuevo", "En revision", "Asignado", "Contactado", "Resuelto", "Archivado"],
        primaryText: "Guardar estado"
      }).then(function (status) {
        if (status) updateRequest({ id: row.id, category: row.category, status: status });
      });
    }
    if (button.dataset.assign !== undefined) {
      app.prompt({
        title: "Asignar responsable",
        label: "Responsable asignado",
        value: row.assignedTo || "",
        primaryText: "Asignar"
      }).then(function (assignedTo) {
        if (assignedTo !== null) updateRequest({ id: row.id, category: row.category, assignedTo: assignedTo, status: "Asignado" });
      });
    }
    if (button.dataset.note !== undefined) {
      app.prompt({
        title: "Nota privada",
        label: "Nota para seguimiento interno",
        multiline: true,
        required: true,
        primaryText: "Guardar nota"
      }).then(function (note) {
        if (note) updateRequest({ id: row.id, category: row.category, privateNote: note });
      });
    }
  }

  function updateRequest(payload) {
    app.api("updateRequestStatus", payload).then(function (result) {
      app.showSuccess(result.message || "Solicitud actualizada.");
      loadRequests();
    }).catch(app.showError);
  }

  function loadAudit() {
    app.api("getAuditLogs", {
      user: value("auditUser"),
      module: value("auditModule"),
      action: value("auditAction"),
      from: value("auditFrom"),
      to: value("auditTo")
    }).then(function (result) {
      document.getElementById("auditTable").innerHTML = app.renderTable(result.data.logs || [], [
        ["id", "ID"],
        ["timestamp", "Fecha"],
        ["user", "Usuario"],
        ["role", "Rol"],
        ["module", "Modulo"],
        ["action", "Accion"],
        ["affectedId", "ID afectado"],
        ["result", "Resultado", app.badge],
        ["reason", "Motivo"]
      ]);
    }).catch(app.showError);
  }

  function clearAuditLogs() {
    app.confirm({
      title: "Borrar auditoria",
      message: "Esto limpiara el historial de auditoria visible del ano activo. La accion queda registrada como limpieza de entrega.",
      confirmText: "Borrar auditoria",
      danger: true
    }).then(function (confirmed) {
      if (!confirmed) return;
      app.api("clearAuditLogs", {}).then(function (result) {
        app.showSuccess(result.message || "Auditoria borrada.");
        loadAudit();
      }).catch(app.showError);
    });
  }

  function ensureModalRoot() {
    let root = document.getElementById("adminModalRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "adminModalRoot";
      root.className = "modal-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function normalizeDashboardAlerts(data) {
    if (Array.isArray(data.alertDetails) && data.alertDetails.length) return data.alertDetails;
    return (data.alerts || []).map(function (label, index) {
      return { type: "message", label: label, count: index + 1, items: [] };
    });
  }

  function showDashboardAlerts() {
    const alerts = app.state.dashboardAlerts || [];
    if (!alerts.length) {
      app.openModal({ title: "Alertas importantes", body: '<div class="empty">No hay alertas pendientes.</div>' });
      return;
    }
    app.openModal({
      title: "Alertas importantes",
      body: '<ul class="alert-summary">' + alerts.map(function (item, index) {
        return '<li><button type="button" data-dashboard-alert="' + index + '"><span>' + app.escapeHtml(item.label) + '</span><strong>' + app.escapeHtml(item.count || "") + '</strong></button></li>';
      }).join("") + '</ul>'
    }).then(function () {});
    window.setTimeout(function () {
      const root = document.getElementById("adminModalRoot");
      if (!root) return;
      root.querySelectorAll("[data-dashboard-alert]").forEach(function (button) {
        button.addEventListener("click", function () {
          showDashboardAlertItems(Number(button.dataset.dashboardAlert));
        });
      });
    }, 0);
  }

  function showDashboardAlertItems(index) {
    const alert = (app.state.dashboardAlerts || [])[index];
    if (!alert) return;
    const items = alert.items || [];
    if (!items.length) {
      openAlertTarget(alert);
      return;
    }
    app.openModal({
      title: alert.label,
      body: '<div class="alert-item-list">' + items.map(function (item, itemIndex) {
        return '<button type="button" data-alert-item="' + itemIndex + '">' +
          '<span class="alert-item-main"><strong>' + app.escapeHtml(item.title || item.name || item.id || "Detalle") + '</strong>' +
          '<span>' + app.escapeHtml(item.subtitle || item.message || item.createdAt || "") + '</span></span>' +
          '<span>' + app.escapeHtml(item.status || "") + '</span>' +
        '</button>';
      }).join("") + '</div>',
      size: "wide"
    }).then(function () {});
    window.setTimeout(function () {
      const root = document.getElementById("adminModalRoot");
      if (!root) return;
      root.querySelectorAll("[data-alert-item]").forEach(function (button) {
        button.addEventListener("click", function () {
          openAlertTarget(alert, items[Number(button.dataset.alertItem)]);
        });
      });
    }, 0);
  }

  function openAlertTarget(alert, item) {
    closeCurrentModal();
    if (alert.type === "requests") {
      app.state.pendingRequestOpen = item ? { id: item.id, category: item.category } : null;
      app.state.currentModule = "requests";
      renderCurrentModule();
      return;
    }
    if (alert.type === "finance") {
      app.state.pendingFinanceOpen = item ? { id: item.id } : null;
      app.state.currentModule = "finance";
      renderCurrentModule();
      return;
    }
    app.openModal({ title: "Alerta", body: '<p>' + app.escapeHtml(alert.label || "Alerta pendiente.") + '</p>' });
  }

  function closeCurrentModal() {
    const root = ensureModalRoot();
    if (root._closeModal) root._closeModal(null);
    else root.innerHTML = "";
  }

  function showRequestDetails(row) {
    const fields = [
      ["id", "ID"],
      ["category", "Categoria"],
      ["status", "Estado"],
      ["assignedTo", "Responsable"],
      ["name", "Nombre"],
      ["phone", "Telefono"],
      ["email", "Email"],
      ["address", "Direccion"],
      ["subject", "Asunto"],
      ["assistanceType", "Tipo de asistencia"],
      ["documentType", "Documento"],
      ["interest", "Interes"],
      ["availability", "Disponibilidad"],
      ["message", "Mensaje", true],
      ["privateNotes", "Notas privadas", true],
      ["createdAt", "Creado"],
      ["updatedAt", "Actualizado"]
    ];
    app.openModal({
      title: "Solicitud " + (row.id || ""),
      size: "wide",
      body: '<div class="detail-grid">' + fields.map(function (field) {
        return detailItem(field[1], row[field[0]], field[2]);
      }).join("") + '</div>'
    });
  }

  function canCleanAudit() {
    const session = app.state.session || {};
    const user = session.user || {};
    return user.roleId === "ROLE_SUPER_ADMIN" || user.roleId === "ROLE_PASTOR_OWNER";
  }

  function detailItem(label, value, full) {
    const text = value === undefined || value === null || value === "" ? "Sin dato" : value;
    const body = full ? '<p>' + app.escapeHtml(text).replace(/\n/g, "<br>") + '</p>' : '<strong>' + app.escapeHtml(text) + '</strong>';
    return '<div class="detail-item' + (full ? " full" : "") + '"><span>' + app.escapeHtml(label) + '</span>' + body + '</div>';
  }

  function stat(label, value) {
    return '<article class="stat-card"><strong>' + app.escapeHtml(value) + '</strong><span>' + app.escapeHtml(label) + '</span></article>';
  }

  function money(value) {
    return "$" + Number(value || 0).toFixed(2);
  }

  function quick(module, label) {
    return '<button type="button" class="button" data-quick-module="' + module + '">' + label + '</button>';
  }

  function value(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function showAlert(message, kind) {
    const area = document.getElementById("alertArea");
    const title = kind === "error" ? "Revisa esto" : "Listo";
    area.innerHTML = '<div class="alert ' + (kind || "") + '"><div><strong>' + title + '</strong><span>' + app.escapeHtml(message) + '</span></div><button type="button" class="alert-close" data-dismiss-alert aria-label="Cerrar">x</button></div>';
    setTimeout(clearAlert, 7000);
  }

  function clearAlert() {
    const area = document.getElementById("alertArea");
    if (area) area.innerHTML = "";
  }
})(window, document);
