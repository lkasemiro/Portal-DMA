/**
 * ============================================================
 * AEDES - ÁREA DOS FOCAIS (Versão Final com CSS e Agrupamento)
 * ============================================================
 */

// 1. Importa a API_BASE do arquivo centralizado que gerencia Local/Produção
import { API_BASE as CENTRAL_API } from "../../core/api-config.js";

const AedesFocaisApp = (() => {
  // 2. Aponta para a nova rota unificada de focais da sua API unificada
  const API_BASE = CENTRAL_API;
  const FOCAL_SESSION_KEY = "dma_aedes_focal_session_v1";

  const state = {
    focaisBrutos: [], 
    focaisLista: [],  
    selectedFocal: null
  };

  const els = {};

  function cacheElements() {
    els.focaisGrid = document.getElementById("focaisGrid");
    els.focaisCounter = document.getElementById("focaisCounter");
    els.loginModal = document.getElementById("loginModal");
    els.closeLoginModal = document.getElementById("closeLoginModal");
    els.focalLoginForm = document.getElementById("focalLoginForm");
    els.selectedFocalId = document.getElementById("selectedFocalId");
    els.selectedFocalName = document.getElementById("selectedFocalName");
    els.focalEmail = document.getElementById("focalEmail");
    els.focalMatricula = document.getElementById("focalMatricula");
    els.loginError = document.getElementById("loginError");
  }

  async function loadFocaisFromApi() {
  try {
    const response = await fetch(`${API_BASE}/api/aedes/focais/lista`); 
    
    if (!response.ok) {
      throw new Error(`Erro no servidor: ${response.status}`);
    }

    const data = await response.json();
    
    // 🔽 Garante a leitura tanto se vier array direto quanto se vier dentro de .dados
    const listaFocais = data.dados || (Array.isArray(data) ? data : []);
    state.focaisBrutos = listaFocais;

    const processados = new Set();
    state.focaisLista = state.focaisBrutos.filter(item => {
      const nome = (item.nome || item.focal)?.trim().toUpperCase(); 
      if (!nome || nome === "SEM FOCAL DESIGNADO" || processados.has(nome)) return false;
      processados.add(nome);
      return true;
    });

    return state.focaisLista;
  } catch (err) {
    console.error("Erro API:", err);
    throw err;
  }
}

  function renderFocais() {
    if (!els.focaisGrid) return;

    els.focaisGrid.innerHTML = state.focaisLista.map(f => `
      <article class="focal-card" onclick="window.AedesFocaisApp.handleCardClick('${f.matricula}')" style="cursor:pointer">
        <div class="focal-card__avatar">
          ${f.nome ? f.nome.charAt(0).toUpperCase() : '?'}
        </div>
        <div class="focal-card__content">
          <h3 class="focal-card__title">${f.nome}</h3>
          <span class="focal-card-btn__action">Selecionar para Vistoria</span>
        </div>
      </article>
    `).join('');

    if (els.focaisCounter) els.focaisCounter.textContent = state.focaisLista.length;
  }

  function handleCardClick(matricula) {
    const focal = state.focaisLista.find(f => String(f.matricula) === String(matricula));
    if (!focal) return;

    state.selectedFocal = focal;

    const nameEl = document.getElementById("selectedFocalName");
    if (nameEl) {
      nameEl.textContent = focal.nome; 
    }

    const modal = document.getElementById("loginModal");
    if (modal) {
      modal.classList.add("is-active");
      setTimeout(() => document.getElementById("focalMatricula")?.focus(), 100);
    }
  }

  function bindEvents() {
    els.closeLoginModal?.addEventListener("click", () => {
      els.loginModal?.classList.remove("is-active");
      if (els.loginError) els.loginError.style.display = "none";
    });

    els.focalLoginForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const matriculaDigitada = els.focalMatricula?.value.trim();

      if (matriculaDigitada !== String(state.selectedFocal.matricula)) {
        if (els.loginError) {
          els.loginError.textContent = "Matrícula incorreta para este focal.";
          els.loginError.style.display = "block";
        }
        return;
      }

      const unidadesFiltradas = state.focaisBrutos
        .filter(item => String(item.focal_pk) === String(state.selectedFocal.focal_pk) || String(item.id) === String(state.selectedFocal.id))
        .map(item => ({
          unidade: item.focal_unidades || item.nome_unidade || item.unidade || "Unidade não definida",
          matricula: item.matricula,
          focalNome: item.nome || item.focal 
        }));

      const sessionData = {
        focal_pk: state.selectedFocal.focal_pk || state.selectedFocal.id,
        matricula: state.selectedFocal.matricula,
        nome: state.selectedFocal.nome, 
        email: state.selectedFocal.email,
        unidades: unidadesFiltradas.length > 0 ? unidadesFiltradas : [{ unidade: "Geral", matricula: state.selectedFocal.matricula, focalNome: state.selectedFocal.nome }],
        auth_type: "aedes_focal",
        login_at: new Date().toISOString()
      };

      console.log(`✅ Login realizado: ${sessionData.nome}`);
      
      localStorage.setItem(FOCAL_SESSION_KEY, JSON.stringify(sessionData));
      localStorage.removeItem("dma_aedes_grid_state_v1"); 
      
      window.location.href = "./aedes-vistoria-focal.html";
    });
  }

  async function init() {
    cacheElements();
    bindEvents();
    try {
      await loadFocaisFromApi();
      renderFocais();
    } catch (err) {
      if (els.focaisGrid) els.focaisGrid.innerHTML = "Erro ao carregar dados.";
    }
  }

  return { init, handleCardClick };
})();

// 4. Injeta globalmente na 'window' para permitir que o 'onclick' inline ache a função mesmo com ES Modules
window.AedesFocaisApp = AedesFocaisApp;

document.addEventListener("DOMContentLoaded", AedesFocaisApp.init);