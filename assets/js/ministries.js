(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("ministries", {
    title: "Ministerios",
    subtitle: "Tarjetas visibles en la pagina publica",
    render: function () {
      app.requireAccess("ministries", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Crear o editar ministerio</h2>' +
          '<form id="ministryForm">' +
            '<input type="hidden" name="id">' +
            '<div class="form-grid">' +
              field("name", "Nombre", "text", true) +
              field("leader", "Lider opcional", "text", false) +
              field("photoUrl", "Foto URL", "url", false) +
              '<label>Visible<select name="visible"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label class="full">Descripcion<textarea name="description" rows="3"></textarea></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button primary">Guardar ministerio</button><button type="button" class="button" id="clearMinistry">Limpiar</button></div>' +
            '<p class="status" id="ministryStatus"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel"><div id="ministriesTable"></div></section>'
      );
      document.getElementById("ministryForm").addEventListener("submit", saveMinistry);
      document.getElementById("clearMinistry").addEventListener("click", function () { document.getElementById("ministryForm").reset(); });
      document.getElementById("ministriesTable").addEventListener("click", ministryAction);
      loadMinistries();
    }
  });

  function loadMinistries() {
    app.api("getMinistries", { includeHidden: true }).then(function (result) {
      app.state.ministriesRows = result.data.ministries || [];
      document.getElementById("ministriesTable").innerHTML = app.renderTable(app.state.ministriesRows, [
        ["id", "ID"],
        ["name", "Nombre"],
        ["leader", "Lider"],
        ["visible", "Visible", app.badge],
        ["description", "Descripcion"]
      ], function (_, index) {
        return '<button type="button" class="button" data-edit="' + index + '">Editar</button>' +
          '<button type="button" class="button warning" data-delete="' + index + '">Ocultar</button>';
      });
    }).catch(app.showError);
  }

  function saveMinistry(event) {
    event.preventDefault();
    const payload = ChurchFlowAPI.formToPayload(event.currentTarget);
    const action = payload.id ? "updateMinistry" : "createMinistry";
    const status = document.getElementById("ministryStatus");
    ChurchFlowAPI.setStatus(status, "Guardando...", "");
    app.api(action, { ministry: payload })
      .then(function (result) {
        ChurchFlowAPI.setStatus(status, result.message || "Ministerio guardado.", "success");
        event.currentTarget.reset();
        loadMinistries();
      })
      .catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function ministryAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.ministriesRows || [];
    const index = Number(button.dataset.edit || button.dataset.delete);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.edit !== undefined) {
      const form = document.getElementById("ministryForm");
      Object.keys(row).forEach(function (key) { if (form.elements[key]) form.elements[key].value = row[key] || ""; });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (button.dataset.delete !== undefined) {
      app.api("deleteMinistry", { id: row.id }).then(function (result) {
        app.showSuccess(result.message || "Ministerio ocultado.");
        loadMinistries();
      }).catch(app.showError);
    }
  }

  function field(name, label, type, required) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"' + (required ? " required" : "") + '></label>';
  }
})(window);
