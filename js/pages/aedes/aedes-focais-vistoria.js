/**
 * ============================================================
 * Aedes · Área dos Focais · Vistoria semanal por grade
 * ------------------------------------------------------------
 * Versão Otimizada: Payload em Matriz para Alta Performance
 * ============================================================
 */

const AEDES_FOCAL_SESSION_KEY = "dma_aedes_focal_session_v1";
const AEDES_FOCAL_REPORTS_STORAGE_KEY = "dma_aedes_focal_reports_v7";
const AEDES_API_TIMEOUT_MS = 90000;
const DASH_VALUE = "-";

/**
 * CATÁLOGOS FIXOS
 */
const LOCAIS_FOCO_OPTIONS = [
  { value: "objetos_acumulando_agua", label: "Objetos acumulando água" },
  { value: "reservatorio_de_agua", label: "Reservatório de água" },
  { value: "calha", label: "Calha ou ralos" },
  { value: "bromelias", label: "Bromélias ou vasos de plantas" },
  { value: "outros", label: "Outros" }
];

const MOTIVOS_NAO_REMEDIACAO_OPTIONS = [
  { value: "falta_de_treinamento_capacitacao", label: "Falta de treinamento/capacitação" },
  { value: "falta_de_cloro_larvicida", label: "Falta de cloro/larvicida" },
  { value: "necessidade_limpeza_terreno", label: "Necessidade de limpeza do terreno" },
  { value: "reservatorio_sem_cobertura", label: "Reservatório sem cobertura" },
  { value: "aguardando_responsavel_local", label: "Aguardando responsável local" },
  { value: "outros", label: "Outros" }
];

const MOTIVOS_NAO_VISTORIA_OPTIONS = [
  { value: "sem_condicao_acesso", label: "Sem acesso" },
  { value: "sem_brigadista", label: "Sem brigadista" },
  { value: "sem_viatura_disponivel", label: "Sem viatura disponível" },
  { value: "esquecimento", label: "Esquecimento" },
  { value: "outros", label: "Outros" }
];

let currentSession = null;
let gridRows = [];
let systemDate = new Date();

document.addEventListener("DOMContentLoaded", () => {
  setupActions();
  currentSession = getFocalSession();
  if (!isValidSession(currentSession)) {
    showSessionWarning();
    return;
  }
  showApp();
  fillSessionInfo(currentSession);
  initializeSystemDateInfo();
  buildGridRows();
  bindGridEvents();
  renderGrid();
});

function setupActions() {
  const btnEncerrarSessao = document.getElementById("btnEncerrarSessao");
  const form = document.getElementById("vistoriaForm");
  if (btnEncerrarSessao) {
    btnEncerrarSessao.addEventListener("click", () => {
      clearFocalSession();
      window.location.href = "./aedes-focais.html";
    });
  }
  if (form) form.addEventListener("submit", handleSubmitReport);
}

function getFocalSession() {
  try {
    const raw = localStorage.getItem(AEDES_FOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) { return null; }
}

function isValidSession(session) {
  return !!(session && session.auth_type === "aedes_focal" && (session.focal_id || session.focal_pk) && session.nome);
}

function clearFocalSession() { localStorage.removeItem(AEDES_FOCAL_SESSION_KEY); }

function showSessionWarning() {
  document.getElementById("sessionWarning")?.classList.remove("hidden");
  document.getElementById("vistoriaApp")?.classList.add("hidden");
}

function showApp() {
  document.getElementById("sessionWarning")?.classList.add("hidden");
  document.getElementById("vistoriaApp")?.classList.remove("hidden");
}

function fillSessionInfo(session) {
  const nomeEl = document.getElementById("infoFocalNome");
  const emailEl = document.getElementById("infoFocalEmail");
  if (nomeEl) nomeEl.textContent = session.nome || "---";
  if (emailEl) emailEl.textContent = session.email || "---";
}

function initializeSystemDateInfo() {
  systemDate = new Date();
  const dataEl = document.getElementById("infoDataPreenchimento");
  const semanaEl = document.getElementById("infoSemanaReferencia");
  if (dataEl) dataEl.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(systemDate);
  if (semanaEl) {
    const ano = getIsoWeekYear(systemDate);
    const semana = getIsoWeek(systemDate);
    semanaEl.textContent = `Ano ${ano} · Semana ${String(semana).padStart(2, "0")}`;
  }
}

async function buildGridRows() {
  const tbody = document.getElementById("vistoriaGridBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">Sincronizando...</td></tr>`;

  try {
    const emailFocal = currentSession?.email;
    if (!emailFocal) throw new Error("Sessão inválida.");

    const response = await fetch(`${window.AEDES_API_BASE_URL}/api/aedes/base?filtro=${encodeURIComponent(emailFocal)}`);
    if (!response.ok) throw new Error("Não foi possível carregar suas unidades.");
    
    const unidadesFocal = await response.json();
    if (unidadesFocal.length === 0) {
       if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">Nenhuma unidade vinculada.</td></tr>`;
       return;
    }

    gridRows = unidadesFocal.map((itemSTG) => ({
      rowId: createLocalId("row"),
      
      // CORREÇÃO 1: O ID da unidade vindo do banco (u.unidade_id AS id)
      unidadeId: itemSTG.id || "S/M",
      
      // CORREÇÃO 2: Blindagem para ler o nome da unidade independente de como venha da API
      unidade: itemSTG.unidade_nome || itemSTG.nome_unidade || itemSTG.Unidade || "Unidade sem identificação",
      
      statusLinha: "Pendente",
      vistoriaRealizada: "",
      motivosNaoVistoria: [],
      outrosMotivoNaoVistoria: "",
      focoEncontrado: "",
      locaisFoco: [],
      outrosLocalFoco: "",
      focoRemediado: "",
      motivosNaoRemediacao: [],
      outrosMotivoNaoRemediacao: "",
      observacoes: ""
    }));

    renderGrid();
  } catch (error) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center;">Erro: ${error.message}</td></tr>`;
  }
}
function getRowVisibility(row) {
  const vSim = row.vistoriaRealizada === "sim";
  const vNao = row.vistoriaRealizada === "nao";
  const fSim = row.focoEncontrado === "sim";
  return {
    showFocoEncontrado: vSim,
    showFocoRemediado: vSim && fSim,
    showLocaisFoco: vSim && fSim,
    showMotivosNaoRemediacao: vSim && fSim && row.focoRemediado === "nao",
    showMotivosNaoVistoria: vNao
  };
}

function renderGrid() {
  const tbody = document.getElementById("vistoriaGridBody");
  if (!tbody) return;
  
  document.getElementById("gridUnitCount").textContent = `${formatNumber(gridRows.length)} unidades`;

  tbody.innerHTML = gridRows.map((row, index) => {
    row.statusLinha = getRowStatus(row);
    const v = getRowVisibility(row);
    return `
      <tr data-row-id="${escapeHtml(row.rowId)}">
        <td class="col-unidade">
          <div class="unit-cell">
            <strong class="unit-name">${escapeHtml(row.unidade)}</strong>
            <span class="status-pill ${getStatusClass(row.statusLinha)}">${row.statusLinha}</span>
          </div>
        </td>
        <td class="col-vistoria">${renderInlineRadioGroup({ rowId: row.rowId, field: "vistoriaRealizada", value: row.vistoriaRealizada, index, options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não", className: "radio-chip-inline--danger" }] })}</td>
        <td class="col-nao-vistoria">${v.showMotivosNaoVistoria ? renderCheckboxGroup({ rowId: row.rowId, groupKey: "motivosNaoVistoria", values: row.motivosNaoVistoria, otherText: row.outrosMotivoNaoVistoria, options: MOTIVOS_NAO_VISTORIA_OPTIONS, otherPlaceholder: "Especifique", otherField: "outrosMotivoNaoVistoria" }) : DASH_VALUE}</td>
        <td class="col-foco">${v.showFocoEncontrado ? renderInlineRadioGroup({ rowId: row.rowId, field: "focoEncontrado", value: row.focoEncontrado, index, options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não", className: "radio-chip-inline--danger" }] }) : DASH_VALUE}</td>
        <td class="col-locais-foco">${v.showLocaisFoco ? renderCheckboxGroup({ rowId: row.rowId, groupKey: "locaisFoco", values: row.locaisFoco, otherText: row.outrosLocalFoco, options: LOCAIS_FOCO_OPTIONS, otherPlaceholder: "Especifique", otherField: "outrosLocalFoco" }) : DASH_VALUE}</td>
        <td class="col-remediacao">${v.showFocoRemediado ? renderInlineRadioGroup({ rowId: row.rowId, field: "focoRemediado", value: row.focoRemediado, index, options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não", className: "radio-chip-inline--danger" }] }) : DASH_VALUE}</td>
        <td class="col-nao-remediacao">${v.showMotivosNaoRemediacao ? renderCheckboxGroup({ rowId: row.rowId, groupKey: "motivosNaoRemediacao", values: row.motivosNaoRemediacao, otherText: row.outrosMotivoNaoRemediacao, options: MOTIVOS_NAO_REMEDIACAO_OPTIONS, otherPlaceholder: "Especifique", otherField: "outrosMotivoNaoRemediacao" }) : DASH_VALUE}</td>
        <td class="col-observacoes"><textarea class="input-control input-control--compact" rows="2" data-row-id="${escapeHtml(row.rowId)}" data-field="observacoes">${escapeHtml(row.observacoes)}</textarea></td>
      </tr>`;
  }).join("");
  updateConditionalColumnsVisibility();
}

function updateConditionalColumnsVisibility() {
  const table = document.querySelector(".history-table--focal-grid");
  if (!table) return;
  table.classList.toggle("show-col-nao-vistoria", gridRows.some(r => getRowVisibility(r).showMotivosNaoVistoria));
  table.classList.toggle("show-col-locais-foco", gridRows.some(r => getRowVisibility(r).showLocaisFoco));
  table.classList.toggle("show-col-nao-remediacao", gridRows.some(r => getRowVisibility(r).showMotivosNaoRemediacao));
}

function renderInlineRadioGroup({ rowId, field, value, index, options }) {
  return `<div class="radio-group-inline compact">
    ${options.map((opt, optIdx) => `
      <label class="radio-chip-inline ${opt.className || ""}">
        <input type="radio" name="${field}_${rowId}" value="${opt.value}" ${value === opt.value ? "checked" : ""} data-row-id="${rowId}" data-field="${field}" />
        <span>${opt.label}</span>
      </label>`).join("")}
  </div>`;
}

function renderCheckboxGroup({ rowId, groupKey, values, otherText, options, otherPlaceholder, otherField }) {
  const hasOther = values.includes("outros");
  return `<div class="checkbox-group">
    ${options.map((opt, idx) => `
      <label class="checkbox-option">
        <input type="checkbox" value="${opt.value}" data-row-id="${rowId}" data-group-key="${groupKey}" ${values.includes(opt.value) ? "checked" : ""} />
        <span>${opt.label}</span>
      </label>`).join("")}
    <textarea class="${hasOther ? "" : "hidden"}" placeholder="${otherPlaceholder}" data-row-id="${rowId}" data-field="${otherField}">${isDashValue(otherText) ? "" : otherText}</textarea>
  </div>`;
}

function bindGridEvents() {
  const tbody = document.getElementById("vistoriaGridBody");
  tbody.addEventListener("change", (e) => {
    const { rowId, field, groupKey } = e.target.dataset;
    if (!rowId) return;
    if (field) updateGridRow(rowId, field, e.target.value, { rerender: true });
    else if (groupKey) updateGridCheckboxGroup(rowId, groupKey, e.target.value, e.target.checked);
  });
  tbody.addEventListener("input", (e) => {
    if (e.target.dataset.field === "observacoes") updateGridRow(e.target.dataset.rowId, "observacoes", e.target.value, { rerender: false });
  });
}

function updateGridRow(rowId, field, value, options = { rerender: true }) {
  const row = gridRows.find(r => r.rowId === rowId);
  if (!row) return;
  row[field] = normalizeFieldValue(field, value);
  if (field === "vistoriaRealizada") value === "nao" ? applyNoVistoriaState(row) : (clearNoVistoriaState(row), row.focoEncontrado = "", row.focoRemediado = "");
  else if (field === "focoEncontrado") value === "nao" ? applyNoFocoState(row) : (clearNoFocoState(row), row.focoRemediado = "");
  else if (field === "focoRemediado" && value === "sim") clearNaoRemediacaoState(row);
  row.statusLinha = getRowStatus(row);
  if (options.rerender) renderGrid();
}

function updateGridCheckboxGroup(rowId, groupKey, val, checked) {
  const row = gridRows.find(r => r.rowId === rowId);
  if (!row) return;
  row[groupKey] = checked ? uniqueArray([...row[groupKey], val]) : row[groupKey].filter(v => v !== val);
  if (val === "outros" && !checked) {
    if (groupKey === "locaisFoco") row.outrosLocalFoco = "";
    if (groupKey === "motivosNaoRemediacao") row.outrosMotivoNaoRemediacao = "";
    if (groupKey === "motivosNaoVistoria") row.outrosMotivoNaoVistoria = "";
  }
  row.statusLinha = getRowStatus(row);
  renderGrid();
}

/**
 * ESTADOS DE LIMPEZA
 */
function applyNoVistoriaState(row) { row.focoEncontrado = row.focoRemediado = row.outrosLocalFoco = row.outrosMotivoNaoRemediacao = DASH_VALUE; row.locaisFoco = row.motivosNaoRemediacao = []; }
function clearNoVistoriaState(row) { row.motivosNaoVistoria = []; row.outrosMotivoNaoVistoria = ""; }
function applyNoFocoState(row) { row.focoRemediado = row.outrosLocalFoco = row.outrosMotivoNaoRemediacao = DASH_VALUE; row.locaisFoco = row.motivosNaoRemediacao = []; }
function clearNoFocoState(row) { row.locaisFoco = row.outrosLocalFoco = row.motivosNaoRemediacao = []; row.outrosMotivoNaoRemediacao = ""; }
function clearNaoRemediacaoState(row) { row.motivosNaoRemediacao = []; row.outrosMotivoNaoRemediacao = ""; }

function getRowStatus(row) {
  if (!row.vistoriaRealizada) return "Pendente";
  if (row.vistoriaRealizada === "nao") return hasValidGroupSelection(row.motivosNaoVistoria, row.outrosMotivoNaoVistoria) ? "Pronto" : "Motivo obrigatório";
  if (!row.focoEncontrado) return "Informar foco";
  if (row.focoEncontrado === "nao") return "Pronto";
  if (!hasValidGroupSelection(row.locaisFoco, row.outrosLocalFoco)) return "Local obrigatório";
  if (!row.focoRemediado) return "Informar remediação";
  if (row.focoRemediado === "nao" && !hasValidGroupSelection(row.motivosNaoRemediacao, row.outrosMotivoNaoRemediacao)) return "Motivo obrigatório";
  return "Pronto";
}

function hasValidGroupSelection(values, otherText) {
  const sel = values.filter(Boolean);
  if (!sel.length) return false;
  if (sel.includes("outros")) return safeTrim(otherText).length > 0 && !isDashValue(otherText);
  return true;
}

function getStatusClass(s) { return s === "Pronto" ? "status-pill--success" : (s === "Pendente" ? "status-pill--muted" : "status-pill--danger"); }

/**
 * ENVIO DE DADOS 
 */
function buildBatchPayload(dataRef) {
  const user = currentSession;
  return {
    cabecalho: {
      focal_nome: user?.nome || "Não Identificado",
      focal_email: user?.email || "",
      matricula: String(user?.matricula || ""),
      semana_iso: String(getIsoWeek(dataRef)),
      ano_iso: getIsoWeekYear(dataRef),
      total_registros: gridRows.length,
      lote_id_cliente: createLocalId("lote")
    },
    dados: gridRows.map(row => [
      row.unidadeId,                             // 0: unidade_id [cite: 24, 64]
      row.unidade,                               // 1: unidade_nome [cite: 24, 64]
      row.vistoriaRealizada || DASH_VALUE,       // 2: vistoria_realizada 
      row.focoEncontrado || DASH_VALUE,          // 3: foco_encontrado 
      row.focoRemediado || DASH_VALUE,           // 4: foco_remediado 
      row.locaisFoco || [],                      // 5: locais_foco (Array) 
      safeTrim(row.outrosLocalFoco),             // 6: outros_local (NOVO) 
      row.motivosNaoVistoria || [],              // 7: motivos_nao_vistoria (Array) 
      safeTrim(row.outrosMotivoNaoVistoria),     // 8: outros_motivo_nao_vistoria (NOVO) 
      row.motivosNaoRemediacao || [],            // 9: motivos_nao_remediacao (Array) 
      safeTrim(row.outrosMotivoNaoRemediacao),   // 10: outros_motivo_nao_remediacao (NOVO) 
      safeTrim(row.observacoes) || DASH_VALUE    // 11: observacoes [cite: 24, 66]
    ])
  };
}
// listener do botão no final do arquivo para gerenciar o cursor
document.addEventListener('DOMContentLoaded', () => {
    const chk = document.getElementById('chkResponsabilidade');
    const btn = document.getElementById('btnEnviarRelatorio');
    
    if (chk && btn) {
        chk.addEventListener('change', () => { 
            btn.disabled = !chk.checked;
            btn.style.opacity = chk.checked ? "1" : "0.5"; 
        });
    }
});
async function handleSubmitReport(event) {
  if (event?.preventDefault) event.preventDefault();
  if (!document.getElementById('chkResponsabilidade').checked) return alert("Aceite o termo.");
  if (gridRows.some(r => getRowStatus(r) !== "Pronto")) return alert("Existem linhas incompletas.");

  const btn = document.getElementById("btnEnviarRelatorio");
  try {
    btn.disabled = true; btn.innerText = "Enviando lote...";
    const payload = buildBatchPayload(new Date());
    
    const res = await fetch(`${window.AEDES_API_BASE_URL}/api/aedes/lotes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      document.querySelector('main').style.display = 'none';
      document.getElementById("successScreen").classList.remove("hidden");
      iniciarAnimacaoSucesso();
    } else {
        throw new Error("Erro ao salvar lote.");
    }
  } catch (e) {
    alert(e.message);
    btn.disabled = false; btn.innerText = "Enviar relatório semanal";
  }
}

function iniciarAnimacaoSucesso() {
  const fill = document.querySelector('.progress-fill');
  if (fill) { fill.style.width = '100%'; }
  setTimeout(() => { window.location.href = 'aedes.html'; }, 3000);
}

// Helpers
function createLocalId(p) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`; }
function escapeHtml(v) { return String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }
function formatNumber(v) { return new Intl.NumberFormat("pt-BR").format(v); }
function safeTrim(v) { return String(v || "").trim(); }
function uniqueArray(v) { return [...new Set(v.filter(Boolean))]; }
function isDashValue(v) { return safeTrim(v) === DASH_VALUE; }
function normalizeFieldValue(f, v) { return f === "observacoes" ? v : (isDashValue(v) ? DASH_VALUE : safeTrim(v)); }
function getIsoWeek(d) { const t = new Date(d.valueOf()); t.setDate(t.getDate() - ((d.getDay() + 6) % 7) + 3); const f = new Date(t.getFullYear(), 0, 4); return 1 + Math.round((t - (f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3))) / 604800000); }
function getIsoWeekYear(d) { const t = new Date(d.valueOf()); t.setDate(t.getDate() - ((d.getDay() + 6) % 7) + 3); return t.getFullYear(); }

// Toggle botão enviar
document.addEventListener('DOMContentLoaded', () => {
    const chk = document.getElementById('chkResponsabilidade');
    const btn = document.getElementById('btnEnviarRelatorio');
    if (chk && btn) chk.addEventListener('change', () => { btn.disabled = !chk.checked; btn.style.opacity = chk.checked ? "1" : "0.5"; });
});