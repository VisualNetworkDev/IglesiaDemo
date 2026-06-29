(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("ministries", {
    title: "Ministerios",
    subtitle: "Areas de servicio con fotos desde Drive",
    render: function () {
      app.requireAccess("ministries", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Crear o editar ministerio</h2>' +
          '<form id="ministryForm">' +
            '<input type="hidden" name="id">' +
            '<input type="hidden" name="photoUrl">' +
            '<input type="hidden" name="galleryUrls">' +
            '<div class="form-grid">' +
              field("name", "Nombre", "text", true) +
              field("leader", "Lider opcional", "text", false) +
              '<label>Fotos del ministerio<input id="ministryPhotoFile" type="file" accept="image/*" multiple></label>' +
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
        ["galleryUrls", "Fotos", function (value, row) { return String(countPhotos(row.photoUrl, value)); }],
        ["description", "Descripcion"]
      ], function (_, index) {
        return '<button type="button" class="button" data-edit="' + index + '">Editar</button>' +
          '<button type="button" class="button warning" data-hide="' + index + '">Ocultar</button>' +
          '<button type="button" class="button danger" data-remove="' + index + '">Borrar</button>';
      });
    }).catch(app.showError);
  }

  function saveMinistry(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("ministryStatus");
    const files = Array.from(document.getElementById("ministryPhotoFile").files || []);
    ChurchFlowAPI.setStatus(status, files.length ? "Optimizando " + files.length + " foto(s)..." : "Guardando...", "");
    uploadPhotos(files, form.elements.name.value || "Foto de ministerio").then(function (uploads) {
      const newUrls = uploads.map(function (upload) { return upload && upload.fileUrl; }).filter(Boolean);
      const gallery = unique(parseGallery(form.elements.galleryUrls.value).concat(newUrls));
      if (newUrls.length && !form.elements.photoUrl.value) form.elements.photoUrl.value = newUrls[0];
      form.elements.galleryUrls.value = gallery.length ? JSON.stringify(gallery) : "";
      const payload = ChurchFlowAPI.formToPayload(form);
      const action = payload.id ? "updateMinistry" : "createMinistry";
      return app.api(action, { ministry: payload });
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Ministerio guardado.", "success");
      form.reset();
      loadMinistries();
    }).catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function ministryAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.ministriesRows || [];
    const index = Number(button.dataset.edit || button.dataset.hide || button.dataset.remove);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.edit !== undefined) {
      const form = document.getElementById("ministryForm");
      Object.keys(row).forEach(function (key) { if (form.elements[key]) form.elements[key].value = row[key] || ""; });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (button.dataset.hide !== undefined) {
      app.api("deleteMinistry", { id: row.id }).then(function (result) {
        app.showSuccess(result.message || "Ministerio ocultado.");
        loadMinistries();
      }).catch(app.showError);
    }
    if (button.dataset.remove !== undefined) {
      if (!confirm("Borrar este ministerio?")) return;
      app.api("removeMinistry", { id: row.id }).then(function (result) {
        app.showSuccess(result.message || "Ministerio borrado.");
        loadMinistries();
      }).catch(app.showError);
    }
  }

  function uploadPhotoIfNeeded(file, title) {
    if (!file) return Promise.resolve(null);
    return ChurchFlowAPI.prepareUploadFile(file, "Fotos").then(function (prepared) {
      return ChurchFlowAPI.fileToBase64(prepared).then(function (base64) {
        return app.api("uploadDriveFile", {
          fileType: "Fotos",
          title: title,
          description: "Imagen optimizada desde el admin",
          fileName: prepared.name,
          mimeType: prepared.type || "image/jpeg",
          publicAccess: true,
          base64: base64
        }, { transport: "iframe", timeoutMs: 120000 }).then(function (result) { return result.data; });
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
})(window);
