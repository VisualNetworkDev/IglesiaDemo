(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("files", {
    title: "Archivos / Drive",
    subtitle: "Fotos, videos, documentos y comprobantes en Google Drive",
    render: function () {
      app.requireAccess("files", "write");
      app.setContent(
        '<section class="panel">' +
          '<h2>Subir archivo</h2>' +
          '<p class="muted-copy">Esta seccion guarda archivos en Google Drive y deja una referencia auditada en la hoja. Las fotos se optimizan antes de subirlas para reducir peso manteniendo buena calidad. Los videos se guardan en Drive con limite de 25 MB para evitar fallos de Apps Script.</p>' +
          '<form id="fileUploadForm">' +
            '<div class="form-grid">' +
              '<label>Tipo<select name="fileType" required><option>Fotos</option><option>Videos</option><option>Documentos</option><option>Reportes</option><option>Recibos</option></select></label>' +
              '<label>Titulo<input name="title" required></label>' +
              '<label>Archivo<input name="file" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" required></label>' +
              '<label class="full">Descripcion<textarea name="description" rows="3"></textarea></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button primary">Subir a Drive</button></div>' +
            '<p id="fileStatus" class="status" role="status"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<h2>Reemplazar archivo existente</h2>' +
          '<form id="fileReplaceForm">' +
            '<div class="form-grid">' +
              '<label>Archivo anterior Drive ID<input name="oldFileId" required></label>' +
              '<label>Tipo<select name="fileType" required><option>Fotos</option><option>Videos</option><option>Documentos</option><option>Reportes</option><option>Recibos</option></select></label>' +
              '<label>Archivo nuevo<input name="file" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" required></label>' +
              '<label class="full">Motivo<textarea name="reason" rows="3" required></textarea></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button warning">Reemplazar con auditoria</button></div>' +
            '<p id="replaceStatus" class="status" role="status"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="toolbar"><label>Tipo<select id="fileTypeFilter"><option value="">Todos</option><option>Fotos</option><option>Videos</option><option>Documentos</option><option>Reportes</option><option>Recibos</option></select></label><button type="button" class="button" id="loadFiles">Actualizar</button></div>' +
          '<div id="filesTable"></div>' +
        '</section>'
      );
      document.getElementById("fileUploadForm").addEventListener("submit", uploadFile);
      document.getElementById("fileReplaceForm").addEventListener("submit", replaceFile);
      document.getElementById("loadFiles").addEventListener("click", loadFiles);
      document.getElementById("filesTable").addEventListener("click", fileAction);
      loadFiles();
    }
  });

  function uploadFile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("fileStatus");
    const file = form.elements.file.files[0];
    if (!file) return;
    ChurchFlowAPI.setStatus(status, "Preparando archivo...", "");
    prepareAndUpload(file, {
      fileType: form.elements.fileType.value,
      title: form.elements.title.value,
      description: form.elements.description.value
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Archivo subido.", "success");
      form.reset();
      loadFiles();
    }).catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function replaceFile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("replaceStatus");
    const file = form.elements.file.files[0];
    if (!file) return;
    ChurchFlowAPI.setStatus(status, "Subiendo archivo nuevo antes de borrar el anterior...", "");
    ChurchFlowAPI.prepareUploadFile(file, form.elements.fileType.value).then(function (prepared) {
      return ChurchFlowAPI.fileToBase64(prepared).then(function (base64) {
        return app.api("replaceDriveFile", {
          oldFileId: form.elements.oldFileId.value,
          fileType: form.elements.fileType.value,
          reason: form.elements.reason.value,
          fileName: prepared.name,
          mimeType: prepared.type || "application/octet-stream",
          base64: base64
        }, { transport: "fetch", timeoutMs: 120000 });
      });
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Archivo reemplazado.", "success");
      form.reset();
      loadFiles();
    }).catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function prepareAndUpload(file, data) {
    return ChurchFlowAPI.prepareUploadFile(file, data.fileType).then(function (prepared) {
      return ChurchFlowAPI.fileToBase64(prepared).then(function (base64) {
        return app.api("uploadDriveFile", {
          fileType: data.fileType,
          title: data.title,
          description: data.description,
          fileName: prepared.name,
          mimeType: prepared.type || "application/octet-stream",
          base64: base64
        }, { transport: "fetch", timeoutMs: 120000 });
      });
    });
  }

  function loadFiles() {
    app.api("getDriveFiles", { fileType: document.getElementById("fileTypeFilter").value }).then(function (result) {
      app.state.fileRows = result.data.files || [];
      document.getElementById("filesTable").innerHTML = app.renderTable(app.state.fileRows, [
        ["title", "Titulo"],
        ["fileType", "Tipo"],
        ["fileName", "Archivo"],
        ["createdAt", "Subido"],
        ["fileId", "Drive ID"]
      ], function (row, index) {
        return '<a class="button" target="_blank" rel="noopener" href="' + app.escapeAttr(row.fileUrl) + '">Abrir</a>' +
          '<button type="button" class="button danger" data-remove="' + index + '">Borrar</button>';
      });
    }).catch(app.showError);
  }

  function fileAction(event) {
    const button = event.target.closest("button[data-remove]");
    if (!button) return;
    const row = (app.state.fileRows || [])[Number(button.dataset.remove)];
    if (!row) return;
    app.confirm({
      title: "Borrar archivo",
      message: "Borrar este archivo de Drive y del listado?",
      confirmText: "Borrar",
      danger: true
    }).then(function (confirmed) {
      if (!confirmed) return;
      app.api("deleteDriveFile", { id: row.id, fileId: row.fileId }).then(function (result) {
        app.showSuccess(result.message || "Archivo borrado.");
        loadFiles();
      }).catch(app.showError);
    });
  }
})(window);
