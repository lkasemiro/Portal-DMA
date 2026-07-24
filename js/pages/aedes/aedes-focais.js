/**
 * ============================================================
 * AEDES - ÁREA DOS FOCAIS (Versão Final com CSS e Agrupamento)
 * ============================================================
 */

const AedesFocaisApp = (() => {
  const API_BASE = window.AEDES_API_BASE_URL || "https://dma-aedes-api.onrender.com";
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
    const data = await response.json();
    state.focaisBrutos = Array.isArray(data) ? data : [];

    const processados = new Set();
        state.focaisLista = state.focaisBrutos.filter(item => {
      // AJUSTE: Troque item.focal por item.nome
      const nome = item.nome?.trim().toUpperCase(); 
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
    <article class="focal-card" onclick="AedesFocaisApp.handleCardClick('${f.matricula}')" style="cursor:pointer">
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
    // 1. Encontra o focal na lista carregada pela API
    const focal = state.focaisLista.find(f => String(f.matricula) === String(matricula));
    if (!focal) return;

    // 2. Guarda o focal selecionado no estado global
    state.selectedFocal = focal;

    // 3. ATUALIZA O NOME NO MODAL (O ponto que você pediu)
    const nameEl = document.getElementById("selectedFocalName");
    if (nameEl) {
        nameEl.textContent = focal.nome; // Injeta o nome real aqui
    }

    // 4. Abre o modal e foca no campo de senha
    const modal = document.getElementById("loginModal");
    if (modal) {
        modal.classList.add("is-active");
        setTimeout(() => document.getElementById("focalMatricula")?.focus(), 100);
    }
}

function bindEvents() {
    // 1. Fechar o modal
    els.closeLoginModal?.addEventListener("click", () => {
        els.loginModal?.classList.remove("is-active");
        if (els.loginError) els.loginError.style.display = "none";
    });

    // 2. Submissão do Login
    els.focalLoginForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const matriculaDigitada = els.focalMatricula?.value.trim();

        // VALIDAÇÃO DE SEGURANÇA: Matrícula
        if (matriculaDigitada !== String(state.selectedFocal.matricula)) {
            if (els.loginError) {
                els.loginError.textContent = "Matrícula incorreta para este focal.";
                els.loginError.style.display = "block";
            }
            return;
        }

        /**
         * O FUNIL: Filtragem de Unidades
         * Aqui garantimos que apenas as linhas onde o focal_pk coincide sejam salvas.
         */
        const unidadesFiltradas = state.focaisBrutos
            .filter(item => String(item.focal_pk) === String(state.selectedFocal.focal_pk))
            .map(item => ({
                // Usamos 'focal_unidades' (coluna do seu banco) ou 'unidade' como fallback
                unidade: item.focal_unidades || item.nome_unidade || item.unidade || "Unidade não definida",
                matricula: item.matricula,
                focalNome: item.nome || item.focal // Usando 'nome' que corrigimos antes
            }));

        // Verificação: Se após o filtro a lista estiver vazia, algo está errado no banco
        if (unidadesFiltradas.length === 0) {
            alert("Atenção: Não encontramos unidades vinculadas a este focal nos dados da API.");
            return;
        }

        // 3. MONTAGEM DA SESSÃO
        const sessionData = {
            focal_pk: state.selectedFocal.focal_pk,
            matricula: state.selectedFocal.matricula,
            nome: state.selectedFocal.nome, 
            email: state.selectedFocal.email,
            unidades: unidadesFiltradas, // AQUI está apenas o que passou pelo filtro
            auth_type: "aedes_focal",
            login_at: new Date().toISOString()
        };

        // 4. PERSISTÊNCIA E LIMPEZA
        console.log(`✅ Login realizado: ${sessionData.nome} | Unidades: ${unidadesFiltradas.length}`);
        
        localStorage.setItem(FOCAL_SESSION_KEY, JSON.stringify(sessionData));
        
        // IMPORTANTE: Remove o estado salvo da grade para obrigar a página de vistoria 
        // a ler as novas unidades do focal que acabou de logar.
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
      els.focaisGrid.innerHTML = "Erro ao carregar dados.";
    }
  }

  return { init, handleCardClick };
})();

document.addEventListener("DOMContentLoaded", AedesFocaisApp.init);