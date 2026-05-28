// =========================================================
// API CONFIG
// =========================================================

const LOCAL_API =
  "http://localhost:3001";

const PROD_API =
  "https://dma-aedes-api.onrender.com";


// =========================================================
// RESOLVE BASE URL
// =========================================================

function resolveBaseURL() {

  const hostname =
    window.location.hostname;

  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  return isLocalhost
    ? LOCAL_API
    : PROD_API;

}


// =========================================================
// EXPORT
// =========================================================

export const API_BASE =
  resolveBaseURL();


// =========================================================
// GLOBAL DEBUG
// =========================================================

window.API_BASE =
  API_BASE;

console.log(
  "🌐 API BASE:",
  API_BASE
);