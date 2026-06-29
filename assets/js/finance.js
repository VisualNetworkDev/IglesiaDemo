(function (window) {
  "use strict";

  const app = window.ChurchFlowAdmin;

  app.registerModule("finance", {
    title: "Finanzas",
    subtitle: "Registro, verificacion, anulaciones y correcciones",
    render: function () {
      app.requireAccess("finance", "read");
      app.setContent(
        '<section class="panel">' +
          '<h2>Registrar movimiento</h2>' +
          '<form id="financeForm">' +
            '<div class="form-grid">' +
              field("date", "Fecha", "date", true) +
              '<label>Tipo<select name="type" required><option value="diezmo">Diezmo</option><option value="ofrenda">Ofrenda</option><option value="donacion">Donacion</option><option value="ayuda">Ayuda dada por la iglesia</option></select></label>' +
              field("category", "Categoria", "text", false) +
              field("recordId", "Registro ID", "text", false) +
              field("personName", "Nombre de persona / beneficiario", "text", true) +
              field("amount", "Monto o valor estimado", "number", true, 'min="0.01" step="0.01"') +
              '<label>Metodo<select name="method" required><option>Cash App</option><option>Zelle</option><option>Cash</option><option>Check</option><option>Otro</option></select></label>' +
              field("reference", "Referencia", "text", false) +
              field("approvedBy", "Aprobado por", "text", false) +
              field("deliveredBy", "Entregado por", "text", false) +
              '<label class="full">Notas<textarea name="notes" rows="3"></textarea></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="button primary">Registrar</button></div>' +
            '<p id="financeStatus" class="status" role="status"></p>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="toolbar">' +
            '<label>Buscar<input id="financeQuery" placeholder="ID, persona, referencia"></label>' +
            '<label>Tipo<select id="financeType"><option value="">Todos</option><option value="diezmo">Diezmo</option><option value="ofrenda">Ofrenda</option><option value="donacion">Donacion</option><option value="ayuda">Ayuda</option></select></label>' +
            '<label>Estado<select id="financeState"><option value="">Todos</option><option>Reportado</option><option>Verificado</option><option>Rechazado</option><option>Anulado</option><option>Corregido</option></select></label>' +
            '<label>Desde<input id="financeFrom" type="date"></label>' +
            '<label>Hasta<input id="financeTo" type="date"></label>' +
            '<button type="button" class="button" id="loadFinance">Buscar</button>' +
          '</div>' +
          '<div id="financeTable"></div>' +
        '</section>'
      );
      document.querySelector('#financeForm [name="date"]').value = new Date().toISOString().slice(0, 10);
      bind();
      loadFinance();
    }
  });

  function bind() {
    document.getElementById("financeForm").addEventListener("submit", saveFinance);
    document.getElementById("loadFinance").addEventListener("click", loadFinance);
    document.getElementById("financeTable").addEventListener("click", financeAction);
  }

  function saveFinance(event) {
    event.preventDefault();
    const payload = ChurchFlowAPI.formToPayload(event.currentTarget);
    const status = document.getElementById("financeStatus");
    ChurchFlowAPI.setStatus(status, "Guardando...", "");
    app.api("registerContribution", { contribution: payload })
      .then(function (result) {
        ChurchFlowAPI.setStatus(status, result.message || "Movimiento registrado.", "success");
        event.currentTarget.reset();
        document.querySelector('#financeForm [name="date"]').value = new Date().toISOString().slice(0, 10);
        loadFinance();
      })
      .catch(function (error) { ChurchFlowAPI.setStatus(status, error.message, "error"); });
  }

  function loadFinance() {
    app.api("getFinanceRecords", {
      query: value("financeQuery"),
      type: value("financeType"),
      status: value("financeState"),
      from: value("financeFrom"),
      to: value("financeTo")
    }).then(function (result) {
      app.state.financeRows = result.data.records || [];
      document.getElementById("financeTable").innerHTML = app.renderTable(app.state.financeRows, [
        ["id", "ID"],
        ["date", "Fecha"],
        ["personName", "Persona / beneficiario"],
        ["type", "Tipo"],
        ["amount", "Monto", function (value) { return "$" + Number(value || 0).toFixed(2); }],
        ["method", "Metodo"],
        ["status", "Estado", app.badge],
        ["reference", "Referencia"]
      ], function (row, index) {
        const actions = ['<button type="button" class="button primary" data-view="' + index + '">Ver</button>'];
        if (row.status === "Reportado") {
          actions.push('<button type="button" class="button ok" data-verify="' + index + '">Verificar</button>');
          actions.push('<button type="button" class="button warning" data-reject="' + index + '">Rechazar</button>');
        }
        if (row.status !== "Anulado" && row.status !== "Corregido") {
          actions.push('<button type="button" class="button danger" data-void="' + index + '">Anular</button>');
          actions.push('<button type="button" class="button" data-correct="' + index + '">Corregir</button>');
        }
        return actions.join("");
      });
      if (app.state.pendingFinanceOpen) {
        const pending = app.state.pendingFinanceOpen;
        const row = app.state.financeRows.filter(function (item) { return String(item.id) === String(pending.id); })[0];
        app.state.pendingFinanceOpen = null;
        if (row) showFinanceDetails(row);
      }
    }).catch(app.showError);
  }

  function financeAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.financeRows || [];
    const index = Number(button.dataset.view || button.dataset.verify || button.dataset.reject || button.dataset.void || button.dataset.correct);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.view !== undefined) return showFinanceDetails(row);
    if (button.dataset.verify !== undefined) return run("verifyContribution", { id: row.id });
    if (button.dataset.reject !== undefined) {
      return app.prompt({
        title: "Rechazar movimiento",
        label: "Motivo del rechazo",
        multiline: true,
        required: true,
        primaryText: "Rechazar"
      }).then(function (reason) {
        if (reason) run("rejectContribution", { id: row.id, reason: reason });
      });
    }
    if (button.dataset.void !== undefined) {
      return app.prompt({
        title: "Anular movimiento",
        label: "Motivo obligatorio",
        multiline: true,
        required: true,
        primaryText: "Anular"
      }).then(function (reason) {
        if (reason) run("voidContribution", { id: row.id, reason: reason });
      });
    }
    if (button.dataset.correct !== undefined) {
      return app.openModal({
        title: "Corregir movimiento",
        size: "wide",
        body: '<form class="modal-form">' +
          '<label>Motivo obligatorio<textarea name="reason" rows="3" required></textarea></label>' +
          '<div class="form-grid">' +
            '<label>Monto corregido<input name="amount" type="number" min="0.01" step="0.01" value="' + app.escapeAttr(row.amount || "") + '" required></label>' +
            '<label>Fecha<input name="date" type="date" value="' + app.escapeAttr(row.date || "") + '"></label>' +
            '<label>Metodo<input name="method" value="' + app.escapeAttr(row.method || "") + '"></label>' +
            '<label>Referencia<input name="reference" value="' + app.escapeAttr(row.reference || "") + '"></label>' +
          '</div>' +
          '<label>Notas de correccion<textarea name="notes" rows="3">' + app.escapeHtml(row.notes || "") + '</textarea></label>' +
        '</form>',
        primaryText: "Guardar correccion",
        cancelText: "Cancelar"
      }).then(function (result) {
        if (!result) return;
        const values = result.values || {};
        if (!values.amount || Number(values.amount) <= 0) return;
        run("correctContribution", {
          id: row.id,
          reason: values.reason,
          correction: Object.assign({}, row, {
            amount: values.amount,
            date: values.date || row.date,
            method: values.method || row.method,
            reference: values.reference || row.reference,
            notes: values.notes || ""
          })
        });
      });
    }
  }

  function showFinanceDetails(row) {
    app.openModal({
      title: "Movimiento " + (row.id || ""),
      size: "wide",
      body: '<div class="detail-grid">' +
        detail("Fecha", row.date) +
        detail("Estado", row.status) +
        detail("Persona / beneficiario", row.personName) +
        detail("Tipo", row.type) +
        detail("Monto", "$" + Number(row.amount || 0).toFixed(2)) +
        detail("Metodo", row.method) +
        detail("Referencia", row.reference) +
        detail("Registro ID", row.recordId) +
        detail("Categoria", row.category) +
        detail("Creado", row.createdAt) +
        detail("Actualizado", row.updatedAt) +
        detail("Notas", row.notes, true) +
      '</div>'
    });
  }

  function run(action, payload) {
    app.api(action, payload).then(function (result) {
      app.showSuccess(result.message || "Accion completada.");
      loadFinance();
    }).catch(app.showError);
  }

  function value(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function field(name, label, type, required, extra) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '"' + (required ? " required" : "") + (extra ? " " + extra : "") + '></label>';
  }

  function detail(label, value, full) {
    const text = value === undefined || value === null || value === "" ? "Sin dato" : value;
    const body = full ? '<p>' + app.escapeHtml(text).replace(/\n/g, "<br>") + '</p>' : '<strong>' + app.escapeHtml(text) + '</strong>';
    return '<div class="detail-item' + (full ? " full" : "") + '"><span>' + app.escapeHtml(label) + '</span>' + body + '</div>';
  }
})(window);
