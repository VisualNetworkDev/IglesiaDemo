(function (window, document) {
  "use strict";

  function initPublicForms() {
    document.querySelectorAll("[data-api-form]").forEach(function (form) {
      const dateField = form.querySelector('input[type="date"][name="date"]');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().slice(0, 10);
      }
      form.addEventListener("submit", submitForm);
    });
  }

  function submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const action = form.getAttribute("data-action");
    const status = form.querySelector(".form-status");
    const submitButton = form.querySelector('button[type="submit"]');
    const payload = ChurchFlowAPI.formToPayload(form);
    const validationError = validatePayload(action, payload);
    if (validationError) {
      ChurchFlowAPI.setStatus(status, validationError, "error");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    ChurchFlowAPI.setStatus(status, "Enviando solicitud...", "");
    ChurchFlowAPI.request(action, payload)
      .then(function (result) {
        form.reset();
        ChurchFlowAPI.setStatus(status, result.message || "Solicitud recibida correctamente.", "success");
      })
      .catch(function (error) {
        ChurchFlowAPI.setStatus(status, error.message, "error");
      })
      .finally(function () {
        if (submitButton) submitButton.disabled = false;
      });
  }

  function validatePayload(action, payload) {
    if (!payload.name && action !== "submitContactRequest") return "Indica tu nombre.";
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "Indica un email valido.";
    if (payload.amount && Number(payload.amount) <= 0) return "El monto debe ser mayor que cero.";
    if (payload.phone && payload.phone.length < 7) return "Indica un telefono valido o deja el campo vacio.";
    if (payload.communicationConsent !== "accepted") return "Debes aceptar la politica de comunicacion para enviar este formulario.";
    if ((action || "").startsWith("submit") && !payload.message && action !== "submitNewVisitorRequest") {
      if (action !== "submitDocumentRequest") return "Completa el mensaje o descripcion.";
    }
    return "";
  }

  window.ChurchFlowForms = { init: initPublicForms };
})(window, document);
