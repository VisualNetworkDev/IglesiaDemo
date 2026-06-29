(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("reports", {
    title: "Reportes",
    subtitle: "PDF bajo demanda",
    render: function () {
      app.requireAccess("reports", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Reportes disponibles</h2>' +
          '<div class="form-grid">' +
            '<label>Registro ID para historial financiero<input id="reportRecordId" placeholder="REG-000001"></label>' +
            '<label>Email opcional para resumen anual<input id="statementEmail" type="email"></label>' +
            '<label>Año<input id="reportYear" type="number" min="2020" max="2100"></label>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button type="button" class="button" data-report="recordPdf">Generar registro de la iglesia local</button>' +
            '<button type="button" class="button" data-report="financialPdf">Generar historial financiero de una persona</button>' +
            '<button type="button" class="button" data-report="yearStatement">Generar resumen anual</button>' +
            '<button type="button" class="button" data-report="bulkStatements">Generar recibos anuales por lote (maximo 10 por vez)</button>' +
            '<button type="button" class="button" data-report="retryBulk">Reintentar fallidos</button>' +
            '<button type="button" class="button" data-report="auditPdf">Generar reporte de auditoria</button>' +
          '</div>' +
          '<p class="status" id="reportsStatus" role="status"></p>' +
          '<div id="reportsOutput"></div>' +
        '</section>'
      );
      const year = document.getElementById("reportYear");
      year.value = new Date().getFullYear();
      document.querySelectorAll("[data-report]").forEach(function (button) {
        button.addEventListener("click", handleReport);
      });
    }
  });

  function handleReport(event) {
    const button = event.target.closest("[data-report]");
    if (!button) return;
    const type = button.dataset.report;
    const recordId = value("reportRecordId");
    const year = value("reportYear");
    const email = value("statementEmail");
    const status = document.getElementById("reportsStatus");
    ChurchFlowAPI.setStatus(status, "Generando...", "");
    const cleanRecordId = normalizeRecordId(recordId);
    const actions = {
      recordPdf: ["generateRecordReport", { year: year }],
      financialPdf: ["generateRecordFinancialReport", { recordId: cleanRecordId, year: year }],
      yearStatement: ["generateYearEndStatement", { recordId: cleanRecordId, year: year, email: email }],
      bulkStatements: ["generateBulkYearEndStatements", { year: year, retryFailed: false, batchSize: 10 }],
      retryBulk: ["generateBulkYearEndStatements", { year: year, retryFailed: true, batchSize: 10 }],
      auditPdf: ["generateAuditReport", { year: year }]
    };
    const request = actions[type];
    if (!request) return;
    if ((type === "financialPdf" || type === "yearStatement") && !cleanRecordId) {
      ChurchFlowAPI.setStatus(status, "Indica un Registro ID.", "error");
      return;
    }
    app.api(request[0], request[1]).then(function (result) {
      ChurchFlowAPI.setStatus(status, result.message || "Reporte generado.", "success");
      renderOutput(type, result.data || {});
    }).catch(function (error) {
      ChurchFlowAPI.setStatus(status, error.message, "error");
    });
  }

  function renderOutput(type, data) {
    const output = document.getElementById("reportsOutput");
    if (data.csv) {
      ChurchFlowAPI.downloadText(data.filename || "reporte.csv", data.csv, "text/csv;charset=utf-8");
      output.innerHTML = '<div class="empty">El archivo CSV se descargo correctamente.</div>';
      return;
    }
    if (data.fileUrl) {
      output.innerHTML = '<div class="panel"><p>Archivo generado:</p><a class="button primary" target="_blank" rel="noopener" href="' + app.escapeAttr(data.fileUrl) + '">Abrir archivo</a></div>';
      return;
    }
    if (data.results) {
      output.innerHTML = app.renderTable(data.results, [["recordId", "Registro ID"], ["status", "Estado", app.badge], ["fileUrl", "Archivo"]]);
      return;
    }
    output.innerHTML = '<pre>' + app.escapeHtml(JSON.stringify(data, null, 2)) + '</pre>';
  }

  function normalizeRecordId(value) {
    const text = String(value || "").trim();
    const match = text.match(/\bREG-\d{6}\b/i);
    return match ? match[0].toUpperCase() : text;
  }

  function value(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }
})(window);
