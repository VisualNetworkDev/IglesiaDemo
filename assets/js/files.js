(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("files", {
    title: "Archivos / Drive",
    subtitle: "Fotos, videos, documentos, reportes y reemplazos auditados",
    render: function () {
      app.requireAccess("files", "write");
      app.setContent(
        '<section class="panel">' +
          '<h2>Subir archivo</h2>' +
          '<form id="fileUploadForm">' +
            '<div class="form-grid">' +
              '<label>Tipo<select name="fileType" required><option>Fotos</option><option>Videos</option><option>Documentos</option><option>Reportes</option><option>Recibos</option></select></label>' +
              '<label>Titulo<input name="title" required></label>' +
              '<label>Archivo<input name="file" type="file" required></label>' +
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
              '<label>Archivo nuevo<input name="file" type="file" required></label>' +
              '<label class="full">Motivo<textarea name="reason" rows="3" required></textarea></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button warning">Reemplazar con auditoria</button></div>' +
            '<p id="replaceStatus" class="status" role="status"></p>' +
          '</form>' +
        '</section>'
      );
      document.getElementById("fileUploadForm").addEventListener("submit", uploadFile);
      document.getElementById("fileReplaceForm").addEventListener("submit", replaceFile);
    }
  });

  function uploadFile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("fileStatus");
    const file = form.elements.file.files[0];
    if (!file) return;
    ChurchFlowAPI.setStatus(status, "Leyendo archivo...", "");
    ChurchFlowAPI.fileToBase64(file).then(function (base64) {
      return app.api("uploadDriveFile", {
        fileType: form.elements.fileType.value,
        title: form.elements.title.value,
        description: form.elements.description.value,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: base64
      });
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Archivo subido.", "success");
      form.reset();
    }).catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function replaceFile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("replaceStatus");
    const file = form.elements.file.files[0];
    if (!file) return;
    ChurchFlowAPI.setStatus(status, "Subiendo archivo nuevo antes de borrar el anterior...", "");
    ChurchFlowAPI.fileToBase64(file).then(function (base64) {
      return app.api("replaceDriveFile", {
        oldFileId: form.elements.oldFileId.value,
        fileType: form.elements.fileType.value,
        reason: form.elements.reason.value,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: base64
      });
    }).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Archivo reemplazado.", "success");
      form.reset();
    }).catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }
})(window);
