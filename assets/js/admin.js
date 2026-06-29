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
        app.setContent(
          '<div class="stats-grid">' +
            stat("Solicitudes nuevas", data.newRequests || 0) +
            stat("Solicitudes pendientes", data.pendingRequests || 0) +
            stat("Contribuciones reportadas", data.reportedContributions || 0) +
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
            ((data.alerts || []).length ? '<ul>' + data.alerts.map(function (item) { return '<li>' + app.escapeHtml(item) + '</li>'; }).join("") + '</ul>' : '<div class="empty">No hay alertas pendientes.</div>') +
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
      loadRequests();
    }
  });

  app.registerModule("audit", {
    title: "Auditoria",
    subtitle: "Historial de acciones no editable",
    render: function () {
      app.requireAccess("audit", "read");
      app.setContent(
        '<section class="panel">' +
          '<div class="toolbar">' +
            '<label>Usuario<input id="auditUser"></label>' +
            '<label>Modulo<input id="auditModule"></label>' +
            '<label>Accion<input id="auditAction"></label>' +
            '<label>Desde<input id="auditFrom" type="date"></label>' +
            '<label>Hasta<input id="auditTo" type="date"></label>' +
            '<button type="button" class="button" id="loadAudit">Buscar</button>' +
          '</div>' +
          '<div id="auditTable"></div>' +
        '</section>'
      );
      document.getElementById("loadAudit").addEventListener("click", loadAudit);
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
        return '<button type="button" class="button" data-status="' + index + '">Cambiar estado</button>' +
          '<button type="button" class="button" data-assign="' + index + '">Asignar</button>' +
          '<button type="button" class="button" data-note="' + index + '">Nota privada</button>';
      });
    }).catch(app.showError);
  }

  function requestAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.requestRows || [];
    const index = Number(button.dataset.status || button.dataset.assign || button.dataset.note);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.status !== undefined) {
      const status = prompt("Nuevo estado: Nuevo, En revision, Asignado, Contactado, Resuelto, Archivado", row.status || "Nuevo");
      if (status) updateRequest({ id: row.id, category: row.category, status: status });
    }
    if (button.dataset.assign !== undefined) {
      const assignedTo = prompt("Responsable asignado", row.assignedTo || "");
      if (assignedTo !== null) updateRequest({ id: row.id, category: row.category, assignedTo: assignedTo, status: "Asignado" });
    }
    if (button.dataset.note !== undefined) {
      const note = prompt("Nota privada");
      if (note) updateRequest({ id: row.id, category: row.category, privateNote: note });
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

  function stat(label, value) {
    return '<article class="stat-card"><strong>' + app.escapeHtml(value) + '</strong><span>' + app.escapeHtml(label) + '</span></article>';
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
    area.innerHTML = '<div class="alert ' + (kind || "") + '">' + app.escapeHtml(message) + '</div>';
    setTimeout(clearAlert, 7000);
  }

  function clearAlert() {
    const area = document.getElementById("alertArea");
    if (area) area.innerHTML = "";
  }
})(window, document);
