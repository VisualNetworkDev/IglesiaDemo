(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("records", {
    title: "Registro local",
    subtitle: "Personas, hogares, estados e historial autorizado",
    render: function () {
      app.requireAccess("records", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Agregar o editar registro</h2>' +
          '<form id="recordForm">' +
            '<input type="hidden" name="id">' +
            '<div class="form-grid">' +
              field("firstName", "Nombre", "text", true) +
              field("lastName", "Apellido", "text", true) +
              field("familyId", "Familia / hogar", "text", false) +
              select("status", "Estado", ["Activo", "Inactivo", "Trasladado", "Fallecido", "Pendiente"]) +
              field("phone", "Telefono", "text", false) +
              field("email", "Email", "email", false) +
              field("address", "Direccion", "text", false) +
              field("joinDate", "Fecha de ingreso", "date", false) +
              field("birthDate", "Fecha de nacimiento", "date", false) +
              field("ministryRole", "Ministerio / cargo", "text", false) +
              '<label class="full">Notas privadas<textarea name="privateNotes" rows="3"></textarea></label>' +
            '</div>' +
            '<div class="form-actions">' +
              '<button type="submit" class="button primary">Guardar registro</button>' +
              '<button type="button" class="button" id="resetRecordForm">Limpiar</button>' +
            '</div>' +
            '<p class="status" id="recordStatus" role="status"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="toolbar">' +
            '<label>Buscar<input id="recordSearch" placeholder="Nombre, apellido, telefono o email"></label>' +
            '<label>Estado<select id="recordStateFilter"><option value="">Todos</option><option>Activo</option><option>Inactivo</option><option>Trasladado</option><option>Fallecido</option><option>Pendiente</option></select></label>' +
            '<button type="button" class="button" id="searchRecords">Buscar</button>' +
            '<button type="button" class="button" id="exportRecords">Descargar CSV alfabetico</button>' +
          '</div>' +
          '<div id="recordsTable"></div>' +
        '</section>' +
        '<section class="panel hidden" id="recordProfilePanel">' +
          '<h2>Perfil e historial</h2>' +
          '<div id="recordProfile"></div>' +
        '</section>'
      );
      bind();
      loadRecords();
    }
  });

  function bind() {
    document.getElementById("recordForm").addEventListener("submit", saveRecord);
    document.getElementById("resetRecordForm").addEventListener("click", function () {
      document.getElementById("recordForm").reset();
      document.querySelector('#recordForm [name="id"]').value = "";
    });
    document.getElementById("searchRecords").addEventListener("click", loadRecords);
    document.getElementById("recordSearch").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadRecords();
      }
    });
    document.getElementById("exportRecords").addEventListener("click", exportRecords);
    document.getElementById("recordsTable").addEventListener("click", tableAction);
  }

  function saveRecord(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = ChurchFlowAPI.formToPayload(form);
    const status = document.getElementById("recordStatus");
    const action = payload.id ? "updateRecord" : "createRecord";
    ChurchFlowAPI.setStatus(status, "Guardando...", "");
    app.api(action, { record: payload })
      .then(function (result) {
        ChurchFlowAPI.setStatus(status, result.message || "Registro guardado.", "success");
        form.reset();
        loadRecords();
      })
      .catch(function (error) {
        ChurchFlowAPI.setStatus(status, error.message, "error");
      });
  }

  function loadRecords() {
    app.api("getRecords", {
      query: value("recordSearch"),
      status: value("recordStateFilter")
    }).then(function (result) {
      app.state.records.rows = result.data.records || [];
      renderRecords(app.state.records.rows);
    }).catch(app.showError);
  }

  function renderRecords(rows) {
    const html = app.renderTable(rows, [
      ["id", "ID"],
      ["lastName", "Apellido"],
      ["firstName", "Nombre"],
      ["status", "Estado", app.badge],
      ["phone", "Telefono"],
      ["email", "Email"],
      ["ministryRole", "Ministerio / cargo"]
    ], function (_, index) {
      return '<button type="button" class="button" data-edit="' + index + '">Editar</button>' +
        '<button type="button" class="button" data-profile="' + index + '">Perfil</button>' +
        (app.can("finance", "read") ? '<button type="button" class="button" data-history="' + index + '">Historial financiero</button>' : "");
    });
    document.getElementById("recordsTable").innerHTML = html;
  }

  function tableAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.records.rows || [];
    const index = Number(button.dataset.edit || button.dataset.profile || button.dataset.history);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.edit !== undefined) fillForm(row);
    if (button.dataset.profile !== undefined) loadProfile(row.id);
    if (button.dataset.history !== undefined) loadHistory(row.id);
  }

  function fillForm(row) {
    const form = document.getElementById("recordForm");
    Object.keys(row).forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = row[key] || "";
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadProfile(id) {
    app.api("getRecordProfile", { recordId: id }).then(function (result) {
      const panel = document.getElementById("recordProfilePanel");
      panel.classList.remove("hidden");
      document.getElementById("recordProfile").innerHTML = '<pre>' + app.escapeHtml(JSON.stringify(result.data, null, 2)) + '</pre>';
    }).catch(app.showError);
  }

  function loadHistory(id) {
    app.api("getRecordFinancialHistory", { recordId: id }).then(function (result) {
      const panel = document.getElementById("recordProfilePanel");
      panel.classList.remove("hidden");
      const rows = result.data.records || [];
      document.getElementById("recordProfile").innerHTML =
        '<p><strong>Total verificado:</strong> $' + Number(result.data.total || 0).toFixed(2) + '</p>' +
        app.renderTable(rows, [["id", "ID"], ["date", "Fecha"], ["type", "Tipo"], ["amount", "Monto"], ["method", "Metodo"], ["status", "Estado", app.badge]]);
    }).catch(app.showError);
  }

  function exportRecords() {
    app.api("exportRecords", { status: value("recordStateFilter") }).then(function (result) {
      ChurchFlowAPI.downloadText(result.data.filename || "registros.csv", result.data.csv || "", "text/csv;charset=utf-8");
    }).catch(app.showError);
  }

  function value(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function field(name, label, type, required) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"' + (required ? " required" : "") + '></label>';
  }

  function select(name, label, options) {
    return '<label>' + label + '<select name="' + name + '">' +
      options.map(function (option) { return '<option>' + option + '</option>'; }).join("") +
      '</select></label>';
  }
})(window);
