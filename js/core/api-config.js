// js/core/api-config.js

const LOCAL_API = "http://localhost:3001";
const PROD_API = "https://portal-dma.onrender.com";

function resolveBaseURL() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  return isLocalhost ? LOCAL_API : PROD_API;
}

// O export está correto, o navegador só precisa que este arquivo seja tratado como module
export const API_BASE = resolveBaseURL();

// Mantém injetado globalmente como fallback temporário
window.API_BASE = API_BASE;

console.log("🌐 API BASE RESOLVIDA:", API_BASE);