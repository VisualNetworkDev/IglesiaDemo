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
        const actions = [];
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
    }).catch(app.showError);
  }

  function financeAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const rows = app.state.financeRows || [];
    const index = Number(button.dataset.verify || button.dataset.reject || button.dataset.void || button.dataset.correct);
    const row = rows[index];
    if (!row) return;
    if (button.dataset.verify !== undefined) return run("verifyContribution", { id: row.id });
    if (button.dataset.reject !== undefined) {
      const reason = prompt("Motivo del rechazo");
      if (reason) run("rejectContribution", { id: row.id, reason: reason });
    }
    if (button.dataset.void !== undefined) {
      const reason = prompt("Motivo obligatorio de anulacion");
      if (reason) run("voidContribution", { id: row.id, reason: reason });
    }
    if (button.dataset.correct !== undefined) {
      const reason = prompt("Motivo obligatorio de correccion");
      if (!reason) return;
      const amount = prompt("Monto corregido", row.amount);
      if (!amount || Number(amount) <= 0) return;
      const notes = prompt("Notas de correccion", row.notes || "") || "";
      run("correctContribution", { id: row.id, reason: reason, correction: Object.assign({}, row, { amount: amount, notes: notes }) });
    }
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
})(window);
