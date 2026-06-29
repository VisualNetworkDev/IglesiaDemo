(function (window) {
  "use strict";

  const SESSION_KEY = "churchflow_admin_session";
  const CACHE_TTL_MS = 120000;
  const READ_ACTIONS = {
    getDashboardData: true,
    getRecords: true,
    getRequests: true,
    getFinanceRecords: true,
    getEvents: true,
    getMinistries: true,
    getSettings: true,
    getAuditLogs: true,
    getDriveFiles: true
  };
  const app = window.ChurchFlowAdmin || {};
  app.modules = app.modules || {};
  app.state = app.state || { session: null, currentModule: "dashboard", records: {} };
  app.cache = app.cache || {};

  app.registerModule = function (name, module) {
    app.modules[name] = module;
  };

  app.saveSession = function (session) {
    app.state.session = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  app.loadSession = function () {
    try {
      app.state.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      app.state.session = null;
    }
    return app.state.session;
  };

  app.clearSession = function () {
    app.state.session = null;
    app.clearCache();
    sessionStorage.removeItem(SESSION_KEY);
  };

  app.token = function () {
    return app.state.session && app.state.session.token;
  };

  app.clearCache = function () {
    app.cache = {};
  };

  app.api = function (action, payload, options) {
    const config = options || {};
    const body = Object.assign({}, payload || {});
    if (app.token()) body.token = app.token();
    const isRead = READ_ACTIONS[action] === true;
    const cacheKey = isRead ? action + ":" + JSON.stringify(body) : "";
    const cached = cacheKey ? app.cache[cacheKey] : null;
    if (cached && Date.now() - cached.time < (config.cacheTtlMs || CACHE_TTL_MS)) {
      return Promise.resolve(cached.result);
    }
    return ChurchFlowAPI.request(action, body, config).then(function (result) {
      if (isRead) {
        app.cache[cacheKey] = { time: Date.now(), result: result };
      } else if (action !== "validateSession") {
        app.clearCache();
      }
      return result;
    });
  };

  app.login = function (username, password) {
    return ChurchFlowAPI.request("adminLogin", { username: username, password: password })
      .then(function (result) {
        app.saveSession(result.data);
        return result.data;
      });
  };

  app.logout = function () {
    const token = app.token();
    app.clearSession();
    if (!token) return Promise.resolve();
    return ChurchFlowAPI.request("adminLogout", { token: token }).catch(function () {});
  };

  app.validateSession = function () {
    app.loadSession();
    if (!app.token()) return Promise.reject(new Error("No hay sesion activa."));
    return ChurchFlowAPI.request("validateSession", { token: app.token() })
      .then(function (result) {
        app.saveSession(Object.assign({}, app.state.session, result.data));
        return result.data;
      });
  };

  app.can = function (module, action) {
    const session = app.state.session || {};
    const permissions = session.permissions || {};
    if (permissions.all === true) return true;
    const modulePerms = permissions[module] || {};
    return modulePerms.all === true || modulePerms[action || "read"] === true;
  };

  app.requireAccess = function (module, action) {
    if (!app.can(module, action || "read")) {
      throw new Error("Tu rol no tiene permiso para esta accion.");
    }
  };

  window.ChurchFlowAdmin = app;
})(window);
