(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;
  const days = [
    ["sunday", "Domingo"],
    ["monday", "Lunes"],
    ["tuesday", "Martes"],
    ["wednesday", "Miercoles"],
    ["thursday", "Jueves"],
    ["friday", "Viernes"],
    ["saturday", "Sabado"]
  ];

  app.registerModule("settings", {
    title: "Configuracion",
    subtitle: "Datos publicos, horarios, transmision y contribuciones",
    render: function () {
      app.requireAccess("settings", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Configuracion general</h2>' +
          '<form id="settingsForm">' +
            '<input type="hidden" name="cashAppQrUrl">' +
            '<input type="hidden" name="zelleQrUrl">' +
            '<input type="hidden" name="serviceScheduleJson">' +
            '<input type="hidden" name="serviceTimes">' +
            '<div class="form-grid">' +
              field("churchName", "Nombre de iglesia", "text") +
              field("address", "Direccion", "text") +
              field("phone", "Telefono", "text") +
              field("email", "Email publico", "email") +
              field("adminEmail", "Correo de notificaciones", "email") +
              field("liveUrl", "Enlace directo de transmision", "url") +
              '<label>Transmision en vivo<select name="liveIsActive"><option value="false">No activa</option><option value="true">Ahora en vivo</option></select></label>' +
              field("activeYear", "Año activo", "number") +
              field("receiptLegalText", "Texto legal de recibos", "text") +
              '<label>Mostrar ministerios<select name="showMinistries"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label>Mostrar eventos<select name="showEvents"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label>Mostrar contribuciones<select name="showGiving"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label class="full">Mision<textarea name="mission" rows="3"></textarea></label>' +
              '<label class="full">Vision<textarea name="vision" rows="3"></textarea></label>' +
              '<label class="full">Historia<textarea name="history" rows="4"></textarea></label>' +
              '<label class="full">Pastor principal / equipo pastoral<textarea name="pastorName" rows="3"></textarea></label>' +
            '</div>' +
            '<section class="subpanel">' +
              '<h3>Horarios de servicios</h3>' +
              '<div class="schedule-editor" id="scheduleEditor">' + days.map(scheduleRow).join("") + '</div>' +
            '</section>' +
            '<section class="subpanel">' +
              '<h3>Diezmos y donaciones</h3>' +
              '<div class="form-grid">' +
                '<label class="full">Instrucciones Cash App<textarea name="cashAppInstructions" rows="3"></textarea></label>' +
                '<label>Foto del QR Cash App (opcional)<input id="cashAppQrFile" type="file" accept="image/*"></label>' +
                '<label>Foto configurada Cash App<input name="cashAppQrPreview" disabled></label>' +
                '<label class="full">Instrucciones Zelle<textarea name="zelleInstructions" rows="3"></textarea></label>' +
                '<label>Foto del QR Zelle (opcional)<input id="zelleQrFile" type="file" accept="image/*"></label>' +
                '<label>Foto configurada Zelle<input name="zelleQrPreview" disabled></label>' +
                '<label class="full">Instrucciones Cash<textarea name="cashInstructions" rows="3"></textarea></label>' +
                '<label class="full">Instrucciones Check u otro metodo<textarea name="checkInstructions" rows="3"></textarea></label>' +
              '</div>' +
            '</section>' +
            '<div class="form-actions"><button type="submit" class="button primary">Guardar configuracion</button></div>' +
            '<p class="status" id="settingsStatus" role="status"></p>' +
          '</form>' +
        '</section>'
      );
      document.getElementById("settingsForm").addEventListener("submit", saveSettings);
      loadSettings();
    }
  });

  app.registerModule("users", {
    title: "Usuarios y roles",
    subtitle: "Usuarios demo, roles y acceso",
    render: function () {
      app.requireAccess("users", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Usuario</h2>' +
          '<form id="userForm">' +
            '<input type="hidden" name="id">' +
            '<div class="form-grid">' +
              field("name", "Nombre", "text") +
              field("email", "Email", "email") +
              field("username", "Usuario", "text") +
              '<label>Rol<select name="roleId" id="userRoleSelect"></select></label>' +
              '<label>Contrasena<input name="password" type="text" placeholder="Solo para crear o resetear"></label>' +
              '<label>Activo<select name="active"><option value="true">Si</option><option value="false">No</option></select></label>' +
            '</div>' +
            '<div class="form-actions">' +
              '<button type="submit" class="button primary">Guardar usuario</button>' +
              '<button type="button" class="button" id="clearUserForm">Nuevo</button>' +
            '</div>' +
            '<p class="status" id="userStatus" role="status"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<h2>Usuarios demo</h2>' +
          '<p class="muted-copy">Puedes editar, resetear contrasena, desactivar o borrar usuarios demo antes de entregar el sistema.</p>' +
          '<div id="usersTable"></div>' +
        '</section>'
      );
      document.getElementById("userForm").addEventListener("submit", saveUser);
      document.getElementById("clearUserForm").addEventListener("click", clearUserForm);
      document.getElementById("usersTable").addEventListener("click", userAction);
      loadUsers();
    }
  });

  function loadSettings() {
    app.api("getSettings", {}).then(function (result) {
      const form = document.getElementById("settingsForm");
      const settings = result.data.settings || {};
      Object.keys(settings).forEach(function (key) {
        if (form.elements[key]) form.elements[key].value = settings[key];
      });
      form.elements.cashAppQrPreview.value = settings.cashAppQrUrl || "Sin foto de QR";
      form.elements.zelleQrPreview.value = settings.zelleQrUrl || "Sin foto de QR";
      renderSchedule(settings.serviceScheduleJson, settings.serviceTimes);
    }).catch(app.showError);
  }

  function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("settingsStatus");
    ChurchFlowAPI.setStatus(status, "Preparando configuracion...", "");
    Promise.all([
      uploadOptionalQr("cashAppQrFile", "Cash App QR"),
      uploadOptionalQr("zelleQrFile", "Zelle QR")
    ]).then(function (results) {
      if (results[0]) form.elements.cashAppQrUrl.value = results[0].fileUrl;
      if (results[1]) form.elements.zelleQrUrl.value = results[1].fileUrl;
      const schedule = collectSchedule();
      form.elements.serviceScheduleJson.value = JSON.stringify(schedule);
      form.elements.serviceTimes.value = schedule.map(function (item) {
        return item.dayLabel + " " + item.startTime + (item.endTime ? " - " + item.endTime : "");
      }).join("; ");
      ChurchFlowAPI.setStatus(status, "Guardando...", "");
      return app.api("updateSettings", { settings: ChurchFlowAPI.formToPayload(form) });
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Configuracion guardada.", "success");
      loadSettings();
    }).catch(function (error) {
      ChurchFlowAPI.setStatus(status, error.message, "error");
    });
  }

  function uploadOptionalQr(inputId, title) {
    const input = document.getElementById(inputId);
    const file = input && input.files && input.files[0];
    if (!file) return Promise.resolve(null);
    return ChurchFlowAPI.prepareUploadFile(file, "Fotos").then(function (prepared) {
      return ChurchFlowAPI.fileToBase64(prepared).then(function (base64) {
        return app.api("uploadDriveFile", {
          fileType: "Fotos",
          title: title,
          description: "QR de contribuciones",
          fileName: prepared.name,
          mimeType: prepared.type || "image/jpeg",
          publicAccess: true,
          base64: base64
        }, { transport: "iframe", timeoutMs: 120000 }).then(function (result) { return result.data; });
      });
    });
  }

  function scheduleRow(day) {
    const key = day[0];
    const label = day[1];
    return '<div class="schedule-row" data-day="' + key + '" data-label="' + label + '">' +
      '<label class="schedule-day"><input type="checkbox" data-schedule-enabled> ' + label + '</label>' +
      timeSelect("start", "Inicio") +
      timeSelect("end", "Fin") +
      '</div>';
  }

  function timeSelect(prefix, label) {
    return '<label>' + label + '<span class="time-parts">' +
      '<select data-time-' + prefix + '-hour>' + range(1, 12).map(option).join("") + '</select>' +
      '<select data-time-' + prefix + '-minute><option>00</option><option>15</option><option>30</option><option>45</option></select>' +
      '<select data-time-' + prefix + '-ampm><option>AM</option><option>PM</option></select>' +
      '</span></label>';
  }

  function renderSchedule(json, fallbackText) {
    let schedule = [];
    try { schedule = JSON.parse(json || "[]"); } catch (error) { schedule = []; }
    if (!schedule.length && fallbackText) {
      schedule = [{ day: "sunday", dayLabel: "Domingo", startTime: "10:00 AM", endTime: "" }, { day: "wednesday", dayLabel: "Miercoles", startTime: "7:30 PM", endTime: "" }];
    }
    schedule.forEach(function (item) {
      const row = document.querySelector('[data-day="' + item.day + '"]');
      if (!row) return;
      row.querySelector("[data-schedule-enabled]").checked = true;
      setTime(row, "start", item.startTime || "10:00 AM");
      setTime(row, "end", item.endTime || item.startTime || "10:00 AM");
    });
  }

  function collectSchedule() {
    return Array.from(document.querySelectorAll(".schedule-row")).filter(function (row) {
      return row.querySelector("[data-schedule-enabled]").checked;
    }).map(function (row) {
      return {
        day: row.getAttribute("data-day"),
        dayLabel: row.getAttribute("data-label"),
        startTime: getTime(row, "start"),
        endTime: getTime(row, "end")
      };
    });
  }

  function setTime(row, prefix, value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return;
    row.querySelector("[data-time-" + prefix + "-hour]").value = String(Number(match[1]));
    row.querySelector("[data-time-" + prefix + "-minute]").value = match[2];
    row.querySelector("[data-time-" + prefix + "-ampm]").value = match[3].toUpperCase();
  }

  function getTime(row, prefix) {
    return row.querySelector("[data-time-" + prefix + "-hour]").value + ":" +
      row.querySelector("[data-time-" + prefix + "-minute]").value + " " +
      row.querySelector("[data-time-" + prefix + "-ampm]").value;
  }

  function loadUsers() {
    app.api("getSettings", { includeUsers: true }).then(function (result) {
      const roles = result.data.roles || [];
      const users = result.data.users || [];
      app.state.rolesById = {};
      roles.forEach(function (role) { app.state.rolesById[role.id] = role.name; });
      const select = document.getElementById("userRoleSelect");
      select.innerHTML = roles.map(function (role) {
        return '<option value="' + app.escapeAttr(role.id) + '">' + app.escapeHtml(role.name) + '</option>';
      }).join("");
      app.state.usersRows = users;
      document.getElementById("usersTable").innerHTML = app.renderTable(users, [
        ["name", "Nombre"],
        ["username", "Usuario"],
        ["email", "Email"],
        ["roleId", "Rol", function (value) { return app.escapeHtml(app.state.rolesById[value] || value); }],
        ["active", "Activo", app.badge]
      ], function (_, index) {
        return '<button type="button" class="button" data-edit="' + index + '">Editar</button>' +
          '<button type="button" class="button" data-reset="' + index + '">Resetear</button>' +
          '<button type="button" class="button warning" data-toggle="' + index + '">Activar/desactivar</button>' +
          '<button type="button" class="button danger" data-remove="' + index + '">Borrar</button>';
      });
    }).catch(app.showError);
  }

  function saveUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const user = ChurchFlowAPI.formToPayload(form);
    const status = document.getElementById("userStatus");
    const action = user.id ? "updateAdminUser" : "createAdminUser";
    if (!user.id && !user.password) {
      ChurchFlowAPI.setStatus(status, "Indica una contrasena para crear el usuario.", "error");
      return;
    }
    ChurchFlowAPI.setStatus(status, "Guardando usuario...", "");
    app.api(action, { user: user })
      .then(function (result) {
        ChurchFlowAPI.setStatus(status, result.message || "Usuario guardado.", "success");
        clearUserForm();
        loadUsers();
      })
      .catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function userAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.usersRows || [];
    const index = Number(button.dataset.edit || button.dataset.reset || button.dataset.toggle || button.dataset.remove);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.edit !== undefined) return fillUserForm(row);
    if (button.dataset.reset !== undefined) {
      const password = prompt("Nueva contrasena corta para demo", "1234");
      if (password) return runUserAction("resetAdminPassword", { userId: row.id, password: password });
    }
    if (button.dataset.toggle !== undefined) {
      return runUserAction("deactivateAdminUser", { userId: row.id, active: !(row.active === true || row.active === "true") });
    }
    if (button.dataset.remove !== undefined) {
      if (confirm("Borrar este usuario del listado?")) runUserAction("deleteAdminUser", { userId: row.id });
    }
  }

  function fillUserForm(row) {
    const form = document.getElementById("userForm");
    Object.keys(row).forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = row[key] || "";
    });
    form.elements.password.value = "";
    document.getElementById("userStatus").textContent = "Editando " + (row.name || row.username);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearUserForm() {
    document.getElementById("userForm").reset();
    document.querySelector('#userForm [name="id"]').value = "";
    document.getElementById("userStatus").textContent = "";
  }

  function runUserAction(action, payload) {
    app.api(action, payload).then(function (result) {
      app.showSuccess(result.message || "Usuario actualizado.");
      clearUserForm();
      loadUsers();
    }).catch(app.showError);
  }

  function field(name, label, type) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"></label>';
  }

  function range(start, end) {
    const values = [];
    for (let i = start; i <= end; i += 1) values.push(i);
    return values;
  }

  function option(value) {
    return '<option value="' + value + '">' + value + '</option>';
  }
})(window);
