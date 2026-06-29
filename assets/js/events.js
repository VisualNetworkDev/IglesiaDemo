(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("events", {
    title: "Eventos",
    subtitle: "Agenda publica con fotos desde Drive",
    render: function () {
      app.requireAccess("events", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Crear o editar evento</h2>' +
            '<form id="eventForm">' +
            '<input type="hidden" name="id">' +
            '<input type="hidden" name="photoUrl">' +
            '<input type="hidden" name="galleryUrls">' +
            '<div class="form-grid">' +
              field("title", "Titulo", "text", true) +
              field("date", "Fecha", "date", true) +
              timeField("time", "Hora") +
              field("location", "Lugar", "text", false) +
              '<label>Fotos del evento<input id="eventPhotoFile" type="file" accept="image/*" multiple></label>' +
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
        ["galleryUrls", "Fotos", function (value, row) { return String(countPhotos(row.photoUrl, value)); }],
        ["active", "Visible", app.badge]
      ], function (_, index) {
        return '<button type="button" class="button" data-edit="' + index + '">Editar</button>' +
          '<button type="button" class="button warning" data-disable="' + index + '">Desactivar</button>' +
          '<button type="button" class="button danger" data-remove="' + index + '">Borrar</button>';
      });
    }).catch(app.showError);
  }

  function saveEvent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("eventStatus");
    const files = Array.from(document.getElementById("eventPhotoFile").files || []);
    ChurchFlowAPI.setStatus(status, files.length ? "Optimizando " + files.length + " foto(s)..." : "Guardando...", "");
    uploadPhotos(files, form.elements.title.value || "Foto de evento").then(function (uploads) {
      const newUrls = uploads.map(function (upload) { return upload && upload.fileUrl; }).filter(Boolean);
      const gallery = unique(parseGallery(form.elements.galleryUrls.value).concat(newUrls));
      if (newUrls.length && !form.elements.photoUrl.value) form.elements.photoUrl.value = newUrls[0];
      form.elements.galleryUrls.value = gallery.length ? JSON.stringify(gallery) : "";
      const payload = ChurchFlowAPI.formToPayload(form);
      const action = payload.id ? "updateEvent" : "createEvent";
      return app.api(action, { event: payload });
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Evento guardado.", "success");
      form.reset();
      loadEvents();
    }).catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function eventAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.eventsRows || [];
    const index = Number(button.dataset.edit || button.dataset.disable || button.dataset.remove);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.edit !== undefined) {
      const form = document.getElementById("eventForm");
      Object.keys(row).forEach(function (key) { if (form.elements[key]) form.elements[key].value = row[key] || ""; });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (button.dataset.disable !== undefined) {
      app.api("deleteEvent", { id: row.id }).then(function (result) {
        app.showSuccess(result.message || "Evento desactivado.");
        loadEvents();
      }).catch(app.showError);
    }
    if (button.dataset.remove !== undefined) {
      app.confirm({
        title: "Borrar evento",
        message: "Borrar este evento permanentemente?",
        confirmText: "Borrar",
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) return;
        app.api("removeEvent", { id: row.id }).then(function (result) {
          app.showSuccess(result.message || "Evento borrado.");
          loadEvents();
        }).catch(app.showError);
      });
    }
  }

  function uploadPhotoIfNeeded(file, title) {
    if (!file) return Promise.resolve(null);
    return ChurchFlowAPI.prepareUploadFile(file, "public-photo").then(function (prepared) {
      return ChurchFlowAPI.fileToBase64(prepared).then(function (base64) {
        return app.api("uploadDriveFile", {
          fileType: "Fotos",
          title: title,
          description: "Imagen optimizada desde el admin",
          fileName: prepared.name,
          mimeType: prepared.type || "image/jpeg",
          publicAccess: true,
          base64: base64
        }, { transport: "fetch", timeoutMs: 120000 }).then(function (result) { return result.data; });
      });
    });
  }

  function uploadPhotos(files, title) {
    return files.reduce(function (chain, file, index) {
      return chain.then(function (uploads) {
        return uploadPhotoIfNeeded(file, title + " " + (index + 1)).then(function (upload) {
          if (upload) uploads.push(upload);
          return uploads;
        });
      });
    }, Promise.resolve([]));
  }

  function parseGallery(value) {
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

  function unique(values) {
    return values.filter(function (value, index, list) {
      return value && list.indexOf(value) === index;
    });
  }

  function countPhotos(primaryUrl, galleryUrls) {
    return unique((primaryUrl ? [primaryUrl] : []).concat(parseGallery(galleryUrls))).length;
  }

  function field(name, label, type, required) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"' + (required ? " required" : "") + '></label>';
  }

  function timeField(name, label) {
    return '<label>' + label + '<input name="' + name + '" type="text" placeholder="10:00 AM" pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$"></label>';
  }
})(window);
