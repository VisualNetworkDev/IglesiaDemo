const API_URL = "https://script.google.com/macros/s/AKfycbyPw8KqHcbsu2iW9nNy9lS0i0NTNPGn6t87OYAYS0AhhbxJ1Zv5rqSx3AvFqB36kJh5Hw/exec";

(function (window) {
  "use strict";

  const PLACEHOLDER_URL = "";
  const DEFAULT_TIMEOUT_MS = 30000;
  const DEFAULT_TRANSPORT = "jsonp";

  function isConfigured() {
    return API_URL && API_URL !== PLACEHOLDER_URL && /^https?:\/\//i.test(API_URL);
  }

  function normalizeResponse(result) {
    if (!result || typeof result !== "object") {
      throw new Error("La API devolvio una respuesta vacia o invalida.");
    }
    if (result.success === false) {
      throw new Error(result.error || "La API rechazo la solicitud.");
    }
    return result;
  }

  function request(action, payload, options) {
    const config = Object.assign({ timeoutMs: DEFAULT_TIMEOUT_MS, transport: DEFAULT_TRANSPORT }, options || {});
    if (!isConfigured()) {
      return Promise.reject(new Error("Falta configurar API_URL en frontend/assets/js/api.js."));
    }
    if (!action) {
      return Promise.reject(new Error("Falta indicar la accion de API."));
    }
    if (config.transport === "fetch") {
      return fetchRequest(action, payload || {}, config).then(normalizeResponse);
    }
    return jsonpRequest(action, payload || {}, config).then(normalizeResponse);
  }

  function fetchRequest(action, payload, config) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, config.timeoutMs);
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, payload: payload }),
      signal: controller.signal
    }).then(function (response) {
      clearTimeout(timer);
      if (!response.ok) throw new Error("Error HTTP " + response.status);
      return response.json();
    }).catch(function (error) {
      clearTimeout(timer);
      throw error;
    });
  }

  function jsonpRequest(action, payload, config) {
    return new Promise(function (resolve, reject) {
      let url;
      try {
        url = new URL(API_URL);
      } catch (error) {
        reject(new Error("API_URL no es una URL valida."));
        return;
      }

      const callbackName = "__churchFlowCallback_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timer = setTimeout(function () {
        cleanup();
        reject(new Error("La API no respondio dentro del tiempo esperado."));
      }, config.timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (result) {
        cleanup();
        resolve(result);
      };

      url.searchParams.set("action", action);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("payload", JSON.stringify(payload || {}));
      url.searchParams.set("_", String(Date.now()));

      script.onerror = function () {
        cleanup();
        reject(new Error("No se pudo conectar con Apps Script. Revisa la URL publicada y los permisos del Web App."));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function formToPayload(form) {
    const data = new FormData(form);
    const payload = {};
    data.forEach(function (value, key) {
      payload[key] = typeof value === "string" ? value.trim() : value;
    });
    return payload;
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.remove("success", "error");
    if (kind) element.classList.add(kind);
  }

  function downloadText(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = function () { reject(new Error("No se pudo leer el archivo seleccionado.")); };
      reader.readAsDataURL(file);
    });
  }

  window.ChurchFlowAPI = {
    request: request,
    formToPayload: formToPayload,
    setStatus: setStatus,
    downloadText: downloadText,
    fileToBase64: fileToBase64,
    isConfigured: isConfigured
  };
})(window);
