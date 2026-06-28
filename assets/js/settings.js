(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("settings", {
    title: "Configuracion",
    subtitle: "Identidad, datos publicos, donaciones y ano activo",
    render: function () {
      app.requireAccess("settings", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Configuracion general</h2>' +
          '<form id="settingsForm">' +
            '<div class="form-grid">' +
              field("churchName", "Nombre de iglesia", "text") +
              field("logoUrl", "Logo URL", "url") +
              field("primaryColor", "Color principal", "text") +
              field("secondaryColor", "Color secundario", "text") +
              field("address", "Direccion", "text") +
              field("phone", "Telefono", "text") +
              field("email", "Email", "email") +
              field("serviceTimes", "Horarios", "text") +
              field("liveUrl", "Enlace de transmision", "url") +
              '<label>Transmision activa<select name="liveIsActive"><option value="false">No</option><option value="true">Si</option></select></label>' +
              field("cashAppInstructions", "Cash App", "text") +
              field("zelleInstructions", "Zelle", "text") +
              field("cashInstructions", "Instrucciones cash", "text") +
              field("checkInstructions", "Check u otro metodo", "text") +
              field("activeYear", "Ano activo", "number") +
              field("adminEmail", "Correo principal de notificaciones", "email") +
              field("receiptLegalText", "Texto legal de recibos", "text") +
              '<label class="full">Mision<textarea name="mission" rows="2"></textarea></label>' +
              '<label class="full">Vision<textarea name="vision" rows="2"></textarea></label>' +
              '<label class="full">Historia corta<textarea name="history" rows="3"></textarea></label>' +
              '<label>Pastor principal<input name="pastorName"></label>' +
              '<label>Mostrar ministerios<select name="showMinistries"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label>Mostrar eventos<select name="showEvents"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label>Mostrar donaciones<select name="showGiving"><option value="true">Si</option><option value="false">No</option></select></label>' +
            '</div>' +
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
    subtitle: "Cuentas administrativas, roles y permisos por modulo",
    render: function () {
      app.requireAccess("users", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Crear usuario</h2>' +
          '<form id="userForm">' +
            '<div class="form-grid">' +
              field("name", "Nombre", "text") +
              field("email", "Email", "email") +
              field("username", "Usuario", "text") +
              '<label>Rol<select name="roleId" id="userRoleSelect"></select></label>' +
              '<label>Contrasena temporal<input name="password" type="password" required></label>' +
              '<label>Activo<select name="active"><option value="true">Si</option><option value="false">No</option></select></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button primary">Crear usuario</button></div>' +
            '<p class="status" id="userStatus" role="status"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel"><div id="usersTable"></div></section>'
      );
      document.getElementById("userForm").addEventListener("submit", createUser);
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
    }).catch(app.showError);
  }

  function saveSettings(event) {
    event.preventDefault();
    const status = document.getElementById("settingsStatus");
    ChurchFlowAPI.setStatus(status, "Guardando...", "");
    app.api("updateSettings", { settings: ChurchFlowAPI.formToPayload(event.currentTarget) })
      .then(function (result) { ChurchFlowAPI.setStatus(status, result.message || "Configuracion guardada.", "success"); })
      .catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function loadUsers() {
    app.api("getSettings", { includeUsers: true }).then(function (result) {
      const roles = result.data.roles || [];
      const users = result.data.users || [];
      const select = document.getElementById("userRoleSelect");
      select.innerHTML = roles.map(function (role) {
        return '<option value="' + app.escapeAttr(role.id) + '">' + app.escapeHtml(role.name) + '</option>';
      }).join("");
      app.state.usersRows = users;
      document.getElementById("usersTable").innerHTML = app.renderTable(users, [
        ["id", "ID"],
        ["name", "Nombre"],
        ["email", "Email"],
        ["username", "Usuario"],
        ["roleId", "Rol"],
        ["active", "Activo", app.badge],
        ["lastLogin", "Ultimo acceso"]
      ], function (_, index) {
        return '<button type="button" class="button" data-reset="' + index + '">Resetear contrasena</button>' +
          '<button type="button" class="button warning" data-toggle="' + index + '">Activar/desactivar</button>';
      });
    }).catch(app.showError);
  }

  function createUser(event) {
    event.preventDefault();
    const status = document.getElementById("userStatus");
    ChurchFlowAPI.setStatus(status, "Creando usuario...", "");
    app.api("createAdminUser", { user: ChurchFlowAPI.formToPayload(event.currentTarget) })
      .then(function (result) {
        ChurchFlowAPI.setStatus(status, result.message || "Usuario creado.", "success");
        event.currentTarget.reset();
        loadUsers();
      })
      .catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function userAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.usersRows || [];
    const index = Number(button.dataset.reset || button.dataset.toggle);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.reset !== undefined) {
      const password = prompt("Nueva contrasena temporal");
      if (password) runUserAction("resetAdminPassword", { userId: row.id, password: password });
    }
    if (button.dataset.toggle !== undefined) {
      runUserAction("deactivateAdminUser", { userId: row.id, active: !(row.active === true || row.active === "true") });
    }
  }

  function runUserAction(action, payload) {
    app.api(action, payload).then(function (result) {
      app.showSuccess(result.message || "Usuario actualizado.");
      loadUsers();
    }).catch(app.showError);
  }

  function field(name, label, type) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"></label>';
  }
})(window);
