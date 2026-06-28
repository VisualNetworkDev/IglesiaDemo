(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("events", {
    title: "Eventos",
    subtitle: "Eventos activos para la pagina publica",
    render: function () {
      app.requireAccess("events", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Crear o editar evento</h2>' +
          '<form id="eventForm">' +
            '<input type="hidden" name="id">' +
            '<div class="form-grid">' +
              field("title", "Titulo", "text", true) +
              field("date", "Fecha", "date", true) +
              field("time", "Hora", "text", false) +
              field("location", "Lugar", "text", false) +
              field("photoUrl", "Foto URL", "url", false) +
              '<label>Visible<select name="active"><option value="true">Si</option><option value="false">No</option></select></label>' +
              '<label class="full">Descripcion<textarea name="description" rows="3"></textarea></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button primary">Guardar evento</button><button type="button" class="button" id="clearEvent">Limpiar</button></div>' +
            '<p class="status" id="eventStatus"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel"><div id="eventsTable"></div></section>'
      );
      document.getElementById("eventForm").addEventListener("submit", saveEvent);
      document.getElementById("clearEvent").addEventListener("click", function () { document.getElementById("eventForm").reset(); });
      document.getElementById("eventsTable").addEventListener("click", eventAction);
      loadEvents();
    }
  });

  function loadEvents() {
    app.api("getEvents", { includeInactive: true }).then(function (result) {
      app.state.eventsRows = result.data.events || [];
      document.getElementById("eventsTable").innerHTML = app.renderTable(app.state.eventsRows, [
        ["id", "ID"],
        ["title", "Titulo"],
        ["date", "Fecha"],
        ["time", "Hora"],
        ["location", "Lugar"],
        ["active", "Visible", app.badge]
      ], function (_, index) {
        return '<button type="button" class="button" data-edit="' + index + '">Editar</button>' +
          '<button type="button" class="button warning" data-delete="' + index + '">Desactivar</button>';
      });
    }).catch(app.showError);
  }

  function saveEvent(event) {
    event.preventDefault();
    const payload = ChurchFlowAPI.formToPayload(event.currentTarget);
    const action = payload.id ? "updateEvent" : "createEvent";
    const status = document.getElementById("eventStatus");
    ChurchFlowAPI.setStatus(status, "Guardando...", "");
    app.api(action, { event: payload })
      .then(function (result) {
        ChurchFlowAPI.setStatus(status, result.message || "Evento guardado.", "success");
        event.currentTarget.reset();
        loadEvents();
      })
      .catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function eventAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.eventsRows || [];
    const index = Number(button.dataset.edit || button.dataset.delete);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.edit !== undefined) {
      const form = document.getElementById("eventForm");
      Object.keys(row).forEach(function (key) { if (form.elements[key]) form.elements[key].value = row[key] || ""; });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (button.dataset.delete !== undefined) {
      app.api("deleteEvent", { id: row.id }).then(function (result) {
        app.showSuccess(result.message || "Evento desactivado.");
        loadEvents();
      }).catch(app.showError);
    }
  }

  function field(name, label, type, required) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"' + (required ? " required" : "") + '></label>';
  }
})(window);
