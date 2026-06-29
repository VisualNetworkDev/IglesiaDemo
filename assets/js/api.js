const API_URL = "https://script.google.com/macros/s/AKfycbyPw8KqHcbsu2iW9nNy9lS0i0NTNPGn6t87OYAYS0AhhbxJ1Zv5rqSx3AvFqB36kJh5Hw/exec";

(function (window) {
  "use strict";

  const PLACEHOLDER_URL = "";
  const DEFAULT_TIMEOUT_MS = 60000;
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
    if (config.transport === "iframe") {
      return iframePostRequest(action, payload || {}, config).then(normalizeResponse);
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
      let settled = false;
      const timer = setTimeout(function () {
        settled = true;
        cleanupAfterTimeout();
        reject(new Error("La API no respondio dentro del tiempo esperado."));
      }, config.timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      function cleanupAfterTimeout() {
        clearTimeout(timer);
        window[callbackName] = function () {};
        if (script.parentNode) script.parentNode.removeChild(script);
        setTimeout(function () { delete window[callbackName]; }, 300000);
      }

      window[callbackName] = function (result) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      url.searchParams.set("action", action);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("payload", JSON.stringify(payload || {}));
      url.searchParams.set("_", String(Date.now()));

      script.onerror = function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("No se pudo conectar con Apps Script. Revisa la URL publicada y los permisos del Web App."));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function iframePostRequest(action, payload, config) {
    return new Promise(function (resolve, reject) {
      let url;
      try {
        url = new URL(API_URL);
      } catch (error) {
        reject(new Error("API_URL no es una URL valida."));
        return;
      }

      const callbackName = "__churchFlowIframe_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const iframeName = callbackName + "_frame";
      const iframe = document.createElement("iframe");
      const form = document.createElement("form");
      const timer = setTimeout(function () {
        cleanup();
        reject(new Error("La API no respondio dentro del tiempo esperado."));
      }, config.timeoutMs || 120000);

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (form.parentNode) form.parentNode.removeChild(form);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }

      function addField(name, value) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      function onMessage(event) {
        const data = event.data || {};
        if (!data || data.churchFlowCallback !== callbackName) return;
        cleanup();
        resolve(data.response);
      }

      iframe.name = iframeName;
      iframe.style.display = "none";
      form.method = "POST";
      form.action = url.toString();
      form.target = iframeName;
      form.style.display = "none";
      addField("action", action);
      addField("payload", JSON.stringify(payload || {}));
      addField("iframeCallback", callbackName);

      window.addEventListener("message", onMessage);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
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

  function optimizeImageFile(file, options) {
    const config = Object.assign({ maxWidth: 1800, maxHeight: 1800, quality: 0.86, type: "image/jpeg", extension: "jpg", exact: false }, options || {});
    if (!file || !/^image\//i.test(file.type || "")) return Promise.resolve(file);
    return new Promise(function (resolve, reject) {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = function () {
        try {
          const sourceWidth = image.naturalWidth || image.width;
          const sourceHeight = image.naturalHeight || image.height;
          const scale = config.exact ? Math.max(config.maxWidth / sourceWidth, config.maxHeight / sourceHeight) : Math.min(1, config.maxWidth / sourceWidth, config.maxHeight / sourceHeight);
          const width = config.exact ? config.maxWidth : Math.max(1, Math.round(sourceWidth * scale));
          const height = config.exact ? config.maxHeight : Math.max(1, Math.round(sourceHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { alpha: false });
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          if (config.exact) {
            const drawnWidth = Math.round(sourceWidth * scale);
            const drawnHeight = Math.round(sourceHeight * scale);
            const dx = Math.round((width - drawnWidth) / 2);
            const dy = Math.round((height - drawnHeight) / 2);
            ctx.drawImage(image, dx, dy, drawnWidth, drawnHeight);
          } else {
            ctx.drawImage(image, 0, 0, width, height);
          }
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error("No se pudo optimizar la imagen."));
              return;
            }
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const optimized = new File([blob], baseName + "." + config.extension, { type: config.type, lastModified: Date.now() });
            optimized.originalSize = file.size;
            resolve(optimized.size < file.size ? optimized : file);
          }, config.type, config.quality);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo leer la imagen seleccionada."));
      };
      image.src = objectUrl;
    });
  }

  function prepareUploadFile(file, fileType, options) {
    if (!file) return Promise.reject(new Error("Selecciona un archivo."));
    const isImage = /^image\//i.test(file.type || "");
    const isVideo = /^video\//i.test(file.type || "");
    if (isImage) return optimizeImageFile(file, Object.assign(imagePreset(fileType), options || {}));
    if (isVideo && file.size > 25 * 1024 * 1024) {
      return Promise.reject(new Error("El video es demasiado grande para subirlo desde esta app. Usa un video menor de 25 MB o comprimelo desde el telefono antes de subirlo."));
    }
    return Promise.resolve(file);
  }

  function imagePreset(fileType) {
    const type = String(fileType || "").toLowerCase();
    if (type === "qr") return { maxWidth: 1000, maxHeight: 1000, quality: 0.92 };
    if (type === "public-photo") return { maxWidth: 1600, maxHeight: 900, quality: 0.86, exact: true };
    if (type === "fotos" || type === "foto") return { maxWidth: 1600, maxHeight: 1200, quality: 0.86 };
    return { maxWidth: 1800, maxHeight: 1800, quality: 0.86 };
  }

  window.ChurchFlowAPI = {
    request: request,
    formToPayload: formToPayload,
    setStatus: setStatus,
    downloadText: downloadText,
    fileToBase64: fileToBase64,
    optimizeImageFile: optimizeImageFile,
    prepareUploadFile: prepareUploadFile,
    isConfigured: isConfigured
  };
})(window);
