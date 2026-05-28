//auth.js - Gerenciamento de autenticação para o Portal DMA
const AUTH_STORAGE_KEY = "dma_session_v2";
const AUTH_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 horas

function now() {
  return Date.now();
}

function readLoginConfig() {
  if (
    window.DMA_LOGIN_CONFIG &&
    typeof window.DMA_LOGIN_CONFIG === "object"
  ) {
    return window.DMA_LOGIN_CONFIG;
  }

  return null;
}

function getLoginElements() {
  return {
    usernameInput: document.getElementById("username"),
    passwordInput: document.getElementById("password"),
    loginBtn: document.getElementById("loginBtn"),
    loginError: document.getElementById("loginError")
  };
}

function setLoginError(message = "") {
  const { loginError } = getLoginElements();
  if (loginError) {
    loginError.textContent = message;
  }
}

function normalizeString(value) {
  return String(value || "").trim();
}

function buildSession({ username, role = "tecnico", module = "portal_dma" }) {
  return {
    username: normalizeString(username),
    role,
    module,
    loginTime: now()
  };
}

function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      clearSession();
      return null;
    }

    if (!parsed.loginTime || Number.isNaN(Number(parsed.loginTime))) {
      clearSession();
      return null;
    }

    if (now() - Number(parsed.loginTime) > AUTH_SESSION_MAX_AGE_MS) {
      clearSession();
      return null;
    }

    return parsed;
  } catch (_error) {
    clearSession();
    return null;
  }
}

function hasValidSession() {
  return Boolean(getSession());
}

function requireAuth(redirectTo = "./login.html") {
  if (!hasValidSession()) {
    window.location.href = redirectTo;
  }
}

function logout(redirectTo = "./login.html") {
  clearSession();
  window.location.href = redirectTo;
}

function login(username, password) {
  const config = readLoginConfig();

  if (!config) {
    setLoginError(
      "Login temporário não configurado. Defina window.DMA_LOGIN_CONFIG fora do código-fonte."
    );
    return false;
  }

  const normalizedUsername = normalizeString(username);
  const normalizedPassword = String(password || "");

  const expectedUsername = normalizeString(config.user);
  const expectedPassword = String(config.password || "");
  const redirectTo = normalizeString(config.redirectTo || "./area-tecnica.html");
  const role = normalizeString(config.role || "tecnico");
  const module = normalizeString(config.module || "portal_dma");

  if (
    normalizedUsername === expectedUsername &&
    normalizedPassword === expectedPassword
  ) {
    const session = buildSession({
      username: normalizedUsername,
      role,
      module
    });

    saveSession(session);
    setLoginError("");
    window.location.href = redirectTo;
    return true;
  }

  setLoginError("Usuário ou senha inválidos.");
  return false;
}

function bindLoginForm() {
  const { usernameInput, passwordInput, loginBtn } = getLoginElements();

  if (!loginBtn || !usernameInput || !passwordInput) return;

  loginBtn.addEventListener("click", () => {
    login(usernameInput.value, passwordInput.value);
  });

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      login(usernameInput.value, passwordInput.value);
    }
  });

  usernameInput.addEventListener("input", () => setLoginError(""));
  passwordInput.addEventListener("input", () => setLoginError(""));
}

document.addEventListener("DOMContentLoaded", bindLoginForm);