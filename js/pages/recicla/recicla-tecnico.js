const BR_NUMBER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2
});

const BR_INTEGER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

const RECICLA_FASE2_STORAGE_KEY = "dma_recicla_fase2_movimentos_v1";
const RECICLA_EXPORT_STATUS_STORAGE_KEY = "dma_recicla_fase2_export_status_v1";

const PREMIOS = [
  { premio_id: "broche", nome: "Broche", custo_pontos: 10, estoque_inicial: 80, ativo: true },
  { premio_id: "copo", nome: "Copo", custo_pontos: 20, estoque_inicial: 45, ativo: true },
  { premio_id: "mochila", nome: "Mochila", custo_pontos: 100, estoque_inicial: 12, ativo: true },
  { premio_id: "composto", nome: "Composto orgânico", custo_pontos: 0, estoque_inicial: 200, ativo: true }
];

const state = {
  participantesBase: [],
  movimentos: [],
  participantesCalculados: [],
  diretorias: [],
  premios: structuredClone(PREMIOS),
  pesagensDraft: []
};

const els = {
  reciclaDbStatus: document.getElementById("reciclaDbStatus"),

  resgateForm: document.getElementById("resgateForm"),
  resgateId: document.getElementById("resgateId"),
  resgatePremio: document.getElementById("resgatePremio"),
  resgateSaldoAtual: document.getElementById("resgateSaldoAtual"),
  resgateCusto: document.getElementById("resgateCusto"),
  resgateSaldoFinal: document.getElementById("resgateSaldoFinal"),
  resgateMessage: document.getElementById("resgateMessage"),
  clearResgateBtn: document.getElementById("clearResgateBtn"),

  compostoForm: document.getElementById("compostoForm"),
  compostoId: document.getElementById("compostoId"),
  compostoQtd: document.getElementById("compostoQtd"),
  compostoData: document.getElementById("compostoData"),
  compostoNome: document.getElementById("compostoNome"),
  compostoDiretoria: document.getElementById("compostoDiretoria"),
  compostoPontosTotal: document.getElementById("compostoPontosTotal"),
  compostoConquistado: document.getElementById("compostoConquistado"),
  compostoRetirado: document.getElementById("compostoRetirado"),
  compostoDisponivel: document.getElementById("compostoDisponivel"),
  compostoMessage: document.getElementById("compostoMessage"),
  clearCompostoBtn: document.getElementById("clearCompostoBtn"),

  movementsTableBody: document.getElementById("movementsTableBody"),
  movementsCount: document.getElementById("movementsCount"),

  addPesagemRowBtn: document.getElementById("addPesagemRowBtn"),
  processPesagensBtn: document.getElementById("processPesagensBtn"),
  clearPesagensGridBtn: document.getElementById("clearPesagensGridBtn"),
  exportPesagensExcelBtn: document.getElementById("exportPesagensExcelBtn"),
  exportPremiacoesExcelBtn: document.getElementById("exportPremiacoesExcelBtn"),
  exportRelatorioCompletoBtn: document.getElementById("exportRelatorioCompletoBtn"),
  pesagensBatchMessage: document.getElementById("pesagensBatchMessage"),
  pesagensGridBody: document.getElementById("pesagensGridBody")
};

function formatNumber(value) {
  return BR_NUMBER.format(Number(value || 0));
}

function formatInteger(value) {
  return BR_INTEGER.format(Number(value || 0));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function loadMovimentos() {
  try {
    const raw = localStorage.getItem(RECICLA_FASE2_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function persistMovimentos(movimentos) {
  localStorage.setItem(RECICLA_FASE2_STORAGE_KEY, JSON.stringify(movimentos));
}

/* =========================================================
   NORMALIZAÇÃO E PARSERS
========================================================= */

function normalizeIdInput(value) {
  return String(value || "").replace(/\D+/g, "").slice(0, 6);
}

function normalizeDecimalInput(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  let cleaned = raw
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }

  return cleaned;
}

function parseLocaleNumber(value) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeParticipante(item) {
  const somatorioBase = Number(item.somatorio || item.peso_total || item.total || 0);
  const statusBroche = item.status_broche ?? item.broche ?? "Nao informado";
  const statusMochila = item.status_mochila ?? item.mochila ?? "Nao informado";
  const compostoRetirado = Number(item.quantidade_retirada_sacos_de_composto_organico || 0);

  return {
    n_id: item.n_id ?? item.id ?? item.participante_id ?? null,
    nome: item.nome ?? "",
    diretoria: item.diretoria ?? "",
    somatorio_base: somatorioBase,
    status_broche: statusBroche,
    status_mochila: statusMochila,
    composto_retirado_base: compostoRetirado,
    broches_retirados_base: String(statusBroche).toLowerCase() === "entregue" ? 1 : 0,
    copos_retirados_base: 0,
    mochilas_retiradas_base: String(statusMochila).toLowerCase() === "entregue" ? 1 : 0
  };
}

function extractSeedRecords(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.registros)) return json.registros;
  if (Array.isArray(json.ranking_geral)) return json.ranking_geral;
  if (Array.isArray(json.participantes)) return json.participantes;
  if (Array.isArray(json.dados)) return json.dados;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.top_20)) return json.top_20;
  if (Array.isArray(json.ranking_top_20)) return json.ranking_top_20;
  return [];
}

/* =========================================================
   ESTADO
========================================================= */

function getParticipanteById(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  return state.participantesCalculados.find((item) => String(item.n_id) === normalizedId) || null;
}

function getPremioRetiradoCount(participante, premioId) {
  if (!participante || !premioId) return 0;

  if (premioId === "broche") return Number(participante.broches_retirados || 0);
  if (premioId === "copo") return Number(participante.copos_retirados || 0);
  if (premioId === "mochila") return Number(participante.mochilas_retiradas || 0);

  return 0;
}

function recalculateState() {
  const premiosState = structuredClone(PREMIOS);

  const participantesMap = new Map(
    state.participantesBase.map((p) => [
      String(p.n_id),
      {
        ...p,
        pontos_total: Number(p.somatorio_base || 0),
        pontos_resgatados: 0,
        saldo_disponivel: Number(p.somatorio_base || 0),
        broches_retirados: Number(p.broches_retirados_base || 0),
        copos_retirados: Number(p.copos_retirados_base || 0),
        mochilas_retiradas: Number(p.mochilas_retiradas_base || 0),
        composto_conquistado: 0,
        composto_retirado: Number(p.composto_retirado_base || 0),
        composto_disponivel: 0
      }
    ])
  );

  /* desconta do estoque base o que já saiu historicamente */
  for (const participante of participantesMap.values()) {
    const broches = Number(participante.broches_retirados || 0);
    const copos = Number(participante.copos_retirados || 0);
    const mochilas = Number(participante.mochilas_retiradas || 0);
    const composto = Number(participante.composto_retirado || 0);

    const premioBroche = premiosState.find((p) => p.premio_id === "broche");
    const premioCopo = premiosState.find((p) => p.premio_id === "copo");
    const premioMochila = premiosState.find((p) => p.premio_id === "mochila");
    const premioComposto = premiosState.find((p) => p.premio_id === "composto");

    if (premioBroche) premioBroche.estoque_inicial = Math.max(0, premioBroche.estoque_inicial - broches);
    if (premioCopo) premioCopo.estoque_inicial = Math.max(0, premioCopo.estoque_inicial - copos);
    if (premioMochila) premioMochila.estoque_inicial = Math.max(0, premioMochila.estoque_inicial - mochilas);
    if (premioComposto) premioComposto.estoque_inicial = Math.max(0, premioComposto.estoque_inicial - composto);
  }

  for (const mov of state.movimentos) {
    const key = String(mov.n_id);
    if (!participantesMap.has(key)) continue;

    const participante = participantesMap.get(key);
    const pontos = Number(mov.pontos || 0);
    const qtd = Number(mov.quantidade || 0);

    if (mov.tipo === "credito") {
      participante.pontos_total += pontos;
      participante.saldo_disponivel += pontos;
    }

    if (mov.tipo === "debito") {
      participante.pontos_resgatados += pontos;
      participante.saldo_disponivel -= pontos;

      if (mov.premio_id === "broche") participante.broches_retirados += qtd;
      if (mov.premio_id === "copo") participante.copos_retirados += qtd;
      if (mov.premio_id === "mochila") participante.mochilas_retiradas += qtd;

      const premio = premiosState.find((p) => p.premio_id === mov.premio_id);
      if (premio) {
        premio.estoque_inicial = Math.max(0, Number(premio.estoque_inicial || 0) - qtd);
      }
    }

    if (mov.tipo === "beneficio" && mov.origem === "retirada_composto") {
      participante.composto_retirado += qtd;

      const premioComposto = premiosState.find((p) => p.premio_id === "composto");
      if (premioComposto) {
        premioComposto.estoque_inicial = Math.max(0, Number(premioComposto.estoque_inicial || 0) - qtd);
      }
    }
  }

  for (const participante of participantesMap.values()) {
    const pontos = Number(participante.pontos_total || 0);

    participante.composto_conquistado = Math.min(Math.floor(pontos / 10), 10);

    participante.composto_disponivel = Math.max(
      participante.composto_conquistado - Number(participante.composto_retirado || 0),
      0
    );
  }

  state.premios = premiosState;

  state.participantesCalculados = [...participantesMap.values()].sort(
    (a, b) => Number(b.pontos_total || 0) - Number(a.pontos_total || 0)
  );

  const diretoriasMap = new Map();

  for (const p of state.participantesCalculados) {
    const dir = p.diretoria || "Não informada";

    if (!diretoriasMap.has(dir)) {
      diretoriasMap.set(dir, {
        diretoria: dir,
        participantes: 0,
        pontos_total: 0,
        pontos_resgatados: 0,
        saldo_disponivel: 0
      });
    }

    const agg = diretoriasMap.get(dir);
    agg.participantes += 1;
    agg.pontos_total += Number(p.pontos_total || 0);
    agg.pontos_resgatados += Number(p.pontos_resgatados || 0);
    agg.saldo_disponivel += Number(p.saldo_disponivel || 0);
  }

  state.diretorias = [...diretoriasMap.values()].sort(
    (a, b) => Number(b.pontos_total || 0) - Number(a.pontos_total || 0)
  );
}

/* =========================================================
   GRADE DE PESAGENS
========================================================= */

function createDraftRow() {
  return {
    row_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    n_id: "",
    nome: "",
    diretoria: "",
    peso: "",
    data: todayIso(),
    pontos: 0,
    status: "Pendente"
  };
}

function ensureDraftRows(min = 8) {
  while (state.pesagensDraft.length < min) {
    state.pesagensDraft.push(createDraftRow());
  }
}

function validateDraftRow(row) {
  const participante = getParticipanteById(row.n_id);
  const peso = parseLocaleNumber(row.peso);

  if (!row.n_id && !row.peso) {
    row.status = "Pendente";
    row.nome = "";
    row.diretoria = "";
    row.pontos = 0;
    return;
  }

  if (!participante) {
    row.status = "ID inválido";
    row.nome = "";
    row.diretoria = "";
    row.pontos = 0;
    return;
  }

  row.nome = participante.nome || "";
  row.diretoria = participante.diretoria || "";

  if (!(peso > 0)) {
    row.status = "Peso inválido";
    row.pontos = 0;
    return;
  }

  row.pontos = peso;
  row.status = "Pronto";
}

function updateDraftRowById(rowId, field, value) {
  const row = state.pesagensDraft.find((item) => item.row_id === rowId);
  if (!row) return;

  if (field === "n_id") {
    row.n_id = normalizeIdInput(value);
  } else if (field === "peso") {
    row.peso = value;
  } else if (field === "data") {
    row.data = value;
  } else {
    row[field] = value;
  }

  validateDraftRow(row);
}

function getStatusClass(status) {
  if (status === "Pronto") return "excel-cell-status excel-cell-status--ok";
  if (status === "ID inválido" || status === "Peso inválido") {
    return "excel-cell-status excel-cell-status--danger";
  }
  return "excel-cell-status excel-cell-status--warning";
}

function buildPesagemRowHtml(row, index) {
  return `
    <tr data-row-id="${escapeHtml(row.row_id)}">
      <td>${index + 1}</td>
      <td>
        <input
          type="text"
          inputmode="numeric"
          value="${escapeHtml(row.n_id)}"
          data-row-id="${escapeHtml(row.row_id)}"
          data-field="n_id"
          class="excel-input"
          placeholder="ID"
          maxlength="6"
        />
      </td>
      <td><div class="excel-cell-readonly" data-cell="nome">${escapeHtml(row.nome || "-")}</div></td>
      <td><div class="excel-cell-readonly" data-cell="diretoria">${escapeHtml(row.diretoria || "-")}</div></td>
      <td>
        <input
          type="text"
          inputmode="decimal"
          value="${escapeHtml(row.peso)}"
          data-row-id="${escapeHtml(row.row_id)}"
          data-field="peso"
          class="excel-input"
          placeholder="0,00"
        />
      </td>
      <td>
        <input
          type="date"
          value="${escapeHtml(row.data)}"
          data-row-id="${escapeHtml(row.row_id)}"
          data-field="data"
          class="excel-input"
        />
      </td>
      <td><div class="excel-cell-readonly" data-cell="pontos">${formatNumber(row.pontos || 0)}</div></td>
      <td><span class="${getStatusClass(row.status)}" data-cell="status">${escapeHtml(row.status)}</span></td>
      <td>
        <button
          class="excel-row-remove"
          type="button"
          data-remove-row="${escapeHtml(row.row_id)}"
        >
          Remover
        </button>
      </td>
    </tr>
  `;
}

function renderPesagemRowState(rowId) {
  const tr = els.pesagensGridBody?.querySelector(`tr[data-row-id="${CSS.escape(rowId)}"]`);
  const row = state.pesagensDraft.find((item) => item.row_id === rowId);

  if (!tr || !row) return;

  const nomeCell = tr.querySelector('[data-cell="nome"]');
  const diretoriaCell = tr.querySelector('[data-cell="diretoria"]');
  const pontosCell = tr.querySelector('[data-cell="pontos"]');
  const statusCell = tr.querySelector('[data-cell="status"]');

  const idInput = tr.querySelector('input[data-field="n_id"]');
  const pesoInput = tr.querySelector('input[data-field="peso"]');

  if (idInput) idInput.value = row.n_id;
  if (pesoInput) pesoInput.value = row.peso;

  if (nomeCell) nomeCell.textContent = row.nome || "-";
  if (diretoriaCell) diretoriaCell.textContent = row.diretoria || "-";
  if (pontosCell) pontosCell.textContent = formatNumber(row.pontos || 0);

  if (statusCell) {
    statusCell.className = getStatusClass(row.status);
    statusCell.textContent = row.status;
  }
}

function renderPesagensGrid() {
  if (!els.pesagensGridBody) return;

  ensureDraftRows(8);

  els.pesagensGridBody.innerHTML = state.pesagensDraft
    .map((row, index) => buildPesagemRowHtml(row, index))
    .join("");
}

function bindPesagensGridEvents() {
  if (!els.pesagensGridBody) return;

  els.pesagensGridBody.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const rowId = target.dataset.rowId;
    const field = target.dataset.field;
    if (!rowId || !field) return;

    updateDraftRowById(rowId, field, target.value);
    renderPesagemRowState(rowId);
  });

  els.pesagensGridBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const rowId = target.dataset.rowId;
    const field = target.dataset.field;
    if (!rowId || !field) return;

    updateDraftRowById(rowId, field, target.value);
    renderPesagemRowState(rowId);
  });

  els.pesagensGridBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const removeRow = target.getAttribute("data-remove-row");
    if (!removeRow) return;

    state.pesagensDraft = state.pesagensDraft.filter((row) => row.row_id !== removeRow);
    ensureDraftRows(8);
    renderPesagensGrid();
  });
}

function addDraftRow() {
  state.pesagensDraft.push(createDraftRow());
  renderPesagensGrid();
}

function clearDraftGrid() {
  state.pesagensDraft = [];
  ensureDraftRows(8);
  renderPesagensGrid();

  if (els.pesagensBatchMessage) {
    els.pesagensBatchMessage.className = "technical-inline-message";
    els.pesagensBatchMessage.textContent =
      "Grade limpa. Digite o ID e o peso em cada linha. Nome e diretoria serão preenchidos automaticamente.";
  }
}

function processPesagensBatch() {
  const validRows = state.pesagensDraft.filter((row) => row.status === "Pronto");

  if (!validRows.length) {
    if (els.pesagensBatchMessage) {
      els.pesagensBatchMessage.className = "technical-inline-message technical-inline-message--danger";
      els.pesagensBatchMessage.textContent =
        "Nenhuma linha válida para processamento. Revise os IDs e os pesos informados.";
    }
    return;
  }

  validRows.forEach((row) => {
    const peso = parseLocaleNumber(row.peso);

    state.movimentos.push({
      movimento_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${row.row_id}`,
      n_id: Number(row.n_id),
      participante_nome: row.nome || "",
      participante_diretoria: row.diretoria || "",
      tipo: "credito",
      origem: "pesagem",
      pontos: peso,
      peso_kg: peso,
      peso,
      data: row.data || todayIso(),
      premio_id: "",
      premio_nome: "",
      quantidade: 0,
      observacao: "Pesagem em lote registrada pela equipe técnica"
    });
  });

  persistMovimentos(state.movimentos);
  state.pesagensDraft = [];
  ensureDraftRows(8);
  refreshAll();

  if (els.pesagensBatchMessage) {
    els.pesagensBatchMessage.className = "technical-inline-message";
    els.pesagensBatchMessage.textContent =
      `${formatInteger(validRows.length)} linha(s) processada(s) com sucesso.`;
  }
}

/* =========================================================
   RESGATE DE PRÊMIOS
========================================================= */

function populatePremiosSelect() {
  if (!els.resgatePremio) return;

  els.resgatePremio.innerHTML = state.premios
    .filter((item) => item.ativo && item.premio_id !== "composto")
    .map(
      (item) => `
        <option value="${escapeHtml(item.premio_id)}">
          ${escapeHtml(`${item.nome} · ${item.custo_pontos} pontos`)}
        </option>
      `
    )
    .join("");
}

function updateResgatePreview() {
  const id = normalizeIdInput(els.resgateId?.value || "");
  const premioId = els.resgatePremio?.value || "";

  if (els.resgateId) {
    els.resgateId.value = id;
  }

  const participante = getParticipanteById(id);
  const premio = state.premios.find((item) => item.premio_id === premioId);

  const saldoAtual = Number(participante?.saldo_disponivel || 0);
  const custo = premio ? Number(premio.custo_pontos || 0) : 0;
  const saldoFinal = saldoAtual - custo;
  const retiradoCount = participante && premio ? getPremioRetiradoCount(participante, premioId) : 0;

  if (els.resgateSaldoAtual) {
    els.resgateSaldoAtual.textContent = formatNumber(saldoAtual);
  }

  if (els.resgateCusto) {
    els.resgateCusto.textContent = formatNumber(custo);
  }

  if (els.resgateSaldoFinal) {
    els.resgateSaldoFinal.textContent = formatNumber(saldoFinal);
  }

  if (!participante) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent =
        "Informe um ID válido para localizar o participante e verificar a elegibilidade do resgate.";
    }
    return;
  }

  if (!premio) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent = "Selecione um prêmio válido.";
    }
    return;
  }

  if (retiradoCount >= 1) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent =
        `${participante.nome} já realizou a retirada de ${premio.nome}. Este prêmio só pode ser retirado uma vez por participante.`;
    }
    return;
  }

  if (premio.estoque_inicial < 1) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent =
        `Estoque insuficiente para registrar a retirada de ${premio.nome}.`;
    }
    return;
  }

  if (saldoAtual < custo) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent =
        `${participante.nome} não possui saldo suficiente para este resgate.`;
    }
    return;
  }

  if (els.resgateMessage) {
    els.resgateMessage.className = "technical-inline-message";
    els.resgateMessage.textContent =
      `${participante.nome} pode retirar 1 unidade de ${premio.nome}. Saldo após a operação: ${formatNumber(saldoFinal)} pontos.`;
  }
}

function handleResgateSubmit(event) {
  event.preventDefault();

  const id = normalizeIdInput(els.resgateId?.value || "");
  const premioId = els.resgatePremio?.value || "";

  const participante = getParticipanteById(id);
  const premio = state.premios.find((item) => item.premio_id === premioId);

  if (!participante || !premio) return;

  const retiradoCount = getPremioRetiradoCount(participante, premioId);
  if (retiradoCount >= 1) return;

  const custo = Number(premio.custo_pontos || 0);
  const saldoAtual = Number(participante.saldo_disponivel || 0);

  if (premio.estoque_inicial < 1) return;
  if (saldoAtual < custo) return;

  state.movimentos.push({
    movimento_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    n_id: participante.n_id,
    participante_nome: participante.nome || "",
    participante_diretoria: participante.diretoria || "",
    tipo: "debito",
    origem: "resgate",
    pontos: custo,
    peso_kg: 0,
    peso: 0,
    data: todayIso(),
    premio_id: premio.premio_id,
    premio_nome: premio.nome,
    quantidade: 1,
    observacao: "Resgate confirmado pela equipe técnica"
  });

  persistMovimentos(state.movimentos);

  if (els.resgateId) els.resgateId.value = "";

  refreshAll();
}

/* =========================================================
   COMPOSTO
========================================================= */

function updateCompostoPreview() {
  const id = normalizeIdInput(els.compostoId?.value || "");
  const qtd = Number(els.compostoQtd?.value || 0);
  const participante = getParticipanteById(id);

  if (els.compostoId) {
    els.compostoId.value = id;
  }

  if (!participante) {
    if (els.compostoNome) els.compostoNome.textContent = "-";
    if (els.compostoDiretoria) els.compostoDiretoria.textContent = "-";
    if (els.compostoPontosTotal) els.compostoPontosTotal.textContent = "0";
    if (els.compostoConquistado) els.compostoConquistado.textContent = "0";
    if (els.compostoRetirado) els.compostoRetirado.textContent = "0";
    if (els.compostoDisponivel) els.compostoDisponivel.textContent = "0";

    if (els.compostoMessage) {
      els.compostoMessage.className = "technical-inline-message technical-inline-message--danger";
      els.compostoMessage.textContent =
        "Informe um ID válido para verificar o direito a composto.";
    }
    return;
  }

  if (els.compostoNome) els.compostoNome.textContent = participante.nome || "-";
  if (els.compostoDiretoria) els.compostoDiretoria.textContent = participante.diretoria || "-";
  if (els.compostoPontosTotal) els.compostoPontosTotal.textContent = formatNumber(participante.pontos_total || 0);
  if (els.compostoConquistado) els.compostoConquistado.textContent = formatInteger(participante.composto_conquistado || 0);
  if (els.compostoRetirado) els.compostoRetirado.textContent = formatInteger(participante.composto_retirado || 0);
  if (els.compostoDisponivel) els.compostoDisponivel.textContent = formatInteger(participante.composto_disponivel || 0);

  const premioComposto = state.premios.find((item) => item.premio_id === "composto");
  const estoque = Number(premioComposto?.estoque_inicial || 0);

  if (!(qtd > 0)) {
    if (els.compostoMessage) {
      els.compostoMessage.className = "technical-inline-message technical-inline-message--danger";
      els.compostoMessage.textContent = "Informe uma quantidade válida de pacotes.";
    }
    return;
  }

  if (Number(participante.composto_disponivel || 0) < qtd) {
    if (els.compostoMessage) {
      els.compostoMessage.className = "technical-inline-message technical-inline-message--danger";
      els.compostoMessage.textContent =
        `Quantidade indisponível. Este participante pode retirar no máximo ${formatInteger(participante.composto_disponivel || 0)} pacote(s) neste momento.`;
    }
    return;
  }

  if (estoque < qtd) {
    if (els.compostoMessage) {
      els.compostoMessage.className = "technical-inline-message technical-inline-message--danger";
      els.compostoMessage.textContent =
        `Estoque insuficiente. Há ${formatInteger(estoque)} pacote(s) disponíveis em estoque.`;
    }
    return;
  }

  if (els.compostoMessage) {
    els.compostoMessage.className = "technical-inline-message";
    els.compostoMessage.textContent =
      `Saída válida. Após esta retirada, o participante ficará com ${formatInteger(
        Number(participante.composto_disponivel || 0) - qtd
      )} pacote(s) disponíveis.`;
  }
}

function handleCompostoSubmit(event) {
  event.preventDefault();

  const id = normalizeIdInput(els.compostoId?.value || "");
  const qtd = Number(els.compostoQtd?.value || 0);
  const data = els.compostoData?.value || todayIso();

  const participante = getParticipanteById(id);
  const premioComposto = state.premios.find((item) => item.premio_id === "composto");

  if (!participante || !(qtd > 0) || !premioComposto) return;
  if (Number(participante.composto_disponivel || 0) < qtd) return;
  if (Number(premioComposto.estoque_inicial || 0) < qtd) return;

  state.movimentos.push({
    movimento_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    n_id: participante.n_id,
    participante_nome: participante.nome || "",
    participante_diretoria: participante.diretoria || "",
    tipo: "beneficio",
    origem: "retirada_composto",
    pontos: 0,
    peso_kg: 0,
    peso: 0,
    data,
    premio_id: "composto",
    premio_nome: "Composto orgânico",
    quantidade: qtd,
    observacao: "Saída de composto registrada pela equipe técnica"
  });

  persistMovimentos(state.movimentos);

  if (els.compostoId) els.compostoId.value = "";
  if (els.compostoQtd) els.compostoQtd.value = "1";
  if (els.compostoData) els.compostoData.value = todayIso();

  refreshAll();
}

/* =========================================================
   HISTÓRICO
========================================================= */

function renderMovementsHistory() {
  if (els.movementsCount) {
    els.movementsCount.textContent = `${formatInteger(state.movimentos.length)} movimentos`;
  }

  if (!els.movementsTableBody) return;

  const rows = [...state.movimentos].sort(
    (a, b) => String(b.data || "").localeCompare(String(a.data || ""))
  );

  els.movementsTableBody.innerHTML = rows.length
    ? rows
        .map((mov) => {
          const participante = getParticipanteById(mov.n_id);
          const nome = mov.participante_nome || participante?.nome || "-";
          const diretoria = mov.participante_diretoria || participante?.diretoria || "-";

          return `
            <tr>
              <td>${escapeHtml(mov.data || "-")}</td>
              <td>${escapeHtml(String(mov.n_id || "-"))}</td>
              <td>${escapeHtml(nome)}</td>
              <td>${escapeHtml(diretoria)}</td>
              <td>${escapeHtml(mov.tipo || "-")}</td>
              <td>${escapeHtml(mov.origem || "-")}</td>
              <td>${formatNumber(mov.pontos || 0)}</td>
              <td>${escapeHtml(mov.premio_nome || "-")}</td>
              <td>${escapeHtml(mov.observacao || "-")}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="9">Nenhum movimento registrado na Fase 2.</td></tr>`;
}

function renderTecnico() {
  renderMovementsHistory();

  if (els.compostoData && !els.compostoData.value) {
    els.compostoData.value = todayIso();
  }

  updateCompostoPreview();
  updateResgatePreview();
}

/* =========================================================
   EXPORTAÇÕES
========================================================= */

async function exportPesagensExcel() {
  if (!window.ExcelJS) {
    alert("Biblioteca ExcelJS não carregada.");
    return;
  }

  const dados = state.movimentos
    .filter((mov) => mov.origem === "pesagem")
    .map((mov) => {
      const participante = getParticipanteById(mov.n_id);
      return {
        data: mov.data,
        n_id: mov.n_id,
        nome: participante?.nome || mov.participante_nome || "",
        diretoria: participante?.diretoria || mov.participante_diretoria || "",
        peso_kg: Number(mov.peso_kg || 0),
        pontos: Number(mov.pontos || 0),
        observacao: mov.observacao || ""
      };
    });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pesagens");

  worksheet.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "ID", key: "n_id", width: 10 },
    { header: "Nome", key: "nome", width: 34 },
    { header: "Diretoria", key: "diretoria", width: 14 },
    { header: "Peso (kg)", key: "peso_kg", width: 14 },
    { header: "Pontos", key: "pontos", width: 12 },
    { header: "Observação", key: "observacao", width: 34 }
  ];

  dados.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recicla_fase2_pesagens_${todayIso()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  updateExportStatus("pesagens");
}

async function exportPremiacoesExcel() {
  if (!window.ExcelJS) {
    alert("Biblioteca ExcelJS não carregada.");
    return;
  }

  const dados = state.movimentos
    .filter((mov) => mov.origem === "resgate")
    .map((mov) => {
      const participante = getParticipanteById(mov.n_id);
      return {
        data: mov.data,
        n_id: mov.n_id,
        nome: participante?.nome || mov.participante_nome || "",
        diretoria: participante?.diretoria || mov.participante_diretoria || "",
        premio: mov.premio_nome || "",
        quantidade: Number(mov.quantidade || 0),
        pontos_resgatados: Number(mov.pontos || 0),
        observacao: mov.observacao || ""
      };
    });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Premiacoes");

  worksheet.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "ID", key: "n_id", width: 10 },
    { header: "Nome", key: "nome", width: 34 },
    { header: "Diretoria", key: "diretoria", width: 14 },
    { header: "Prêmio", key: "premio", width: 18 },
    { header: "Quantidade", key: "quantidade", width: 12 },
    { header: "Pontos resgatados", key: "pontos_resgatados", width: 18 },
    { header: "Observação", key: "observacao", width: 34 }
  ];

  dados.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recicla_fase2_premiacoes_${todayIso()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  updateExportStatus("premiacoes");
}

async function exportRelatorioCompleto() {
  if (!window.ExcelJS) {
    alert("Biblioteca ExcelJS não carregada.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal DMA";
  workbook.created = new Date();

  const wsPesagens = workbook.addWorksheet("Pesagens");
  wsPesagens.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "ID", key: "n_id", width: 10 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Diretoria", key: "diretoria", width: 12 },
    { header: "Peso (kg)", key: "peso", width: 12 },
    { header: "Pontos", key: "pontos", width: 12 }
  ];

  state.movimentos
    .filter((m) => m.tipo === "credito")
    .forEach((m) => {
      const participante = state.participantesCalculados.find(
        (p) => String(p.n_id) === String(m.n_id)
      );

      wsPesagens.addRow({
        data: m.data || "",
        n_id: m.n_id,
        nome: participante?.nome || m.participante_nome || "",
        diretoria: participante?.diretoria || m.participante_diretoria || "",
        peso: m.peso_kg || m.peso || "",
        pontos: m.pontos || ""
      });
    });

  const wsPremios = workbook.addWorksheet("Premiacoes");
  wsPremios.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "ID", key: "n_id", width: 10 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Premio", key: "premio", width: 18 },
    { header: "Quantidade", key: "qtd", width: 14 },
    { header: "Pontos", key: "pontos", width: 12 }
  ];

  state.movimentos
    .filter((m) => m.tipo === "debito")
    .forEach((m) => {
      const participante = state.participantesCalculados.find(
        (p) => String(p.n_id) === String(m.n_id)
      );

      wsPremios.addRow({
        data: m.data || "",
        n_id: m.n_id,
        nome: participante?.nome || m.participante_nome || "",
        premio: m.premio_nome || m.premio_id,
        qtd: m.quantidade || 1,
        pontos: m.pontos || 0
      });
    });

  const wsComposto = workbook.addWorksheet("Composto");
  wsComposto.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "ID", key: "n_id", width: 10 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Pacotes", key: "qtd", width: 12 }
  ];

  state.movimentos
    .filter((m) => m.tipo === "beneficio")
    .forEach((m) => {
      const participante = state.participantesCalculados.find(
        (p) => String(p.n_id) === String(m.n_id)
      );

      wsComposto.addRow({
        data: m.data || "",
        n_id: m.n_id,
        nome: participante?.nome || m.participante_nome || "",
        qtd: m.quantidade || 0
      });
    });

  const wsParticipantes = workbook.addWorksheet("Participantes");
  wsParticipantes.columns = [
    { header: "Posição", key: "pos", width: 10 },
    { header: "ID", key: "n_id", width: 10 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Diretoria", key: "diretoria", width: 12 },
    { header: "Pontos Total", key: "pontos_total", width: 16 },
    { header: "Pontos Resgatados", key: "resgatados", width: 18 },
    { header: "Saldo", key: "saldo", width: 12 },
    { header: "Composto Conquistado", key: "composto_c", width: 20 },
    { header: "Composto Retirado", key: "composto_r", width: 18 },
    { header: "Composto Disponível", key: "composto_d", width: 18 },
    { header: "Broches Retirados", key: "broches", width: 18 },
    { header: "Copos Retirados", key: "copos", width: 18 },
    { header: "Mochilas Retiradas", key: "mochilas", width: 18 }
  ];

  state.participantesCalculados.forEach((p, i) => {
    wsParticipantes.addRow({
      pos: i + 1,
      n_id: p.n_id,
      nome: p.nome,
      diretoria: p.diretoria,
      pontos_total: p.pontos_total,
      resgatados: p.pontos_resgatados,
      saldo: p.saldo_disponivel,
      composto_c: p.composto_conquistado,
      composto_r: p.composto_retirado,
      composto_d: p.composto_disponivel,
      broches: p.broches_retirados,
      copos: p.copos_retirados,
      mochilas: p.mochilas_retiradas
    });
  });

  const wsDiretorias = workbook.addWorksheet("Diretorias");
  wsDiretorias.columns = [
    { header: "Diretoria", key: "diretoria", width: 12 },
    { header: "Participantes", key: "participantes", width: 16 },
    { header: "Pontos Total", key: "pontos", width: 16 },
    { header: "Pontos Resgatados", key: "resgatados", width: 18 },
    { header: "Saldo", key: "saldo", width: 14 }
  ];

  state.diretorias.forEach((d) => {
    wsDiretorias.addRow({
      diretoria: d.diretoria,
      participantes: d.participantes,
      pontos: d.pontos_total,
      resgatados: d.pontos_resgatados,
      saldo: d.saldo_disponivel
    });
  });

  const wsGraficos = workbook.addWorksheet("Dados_Graficos");
  wsGraficos.columns = [
    { header: "Indicador", key: "indicador", width: 28 },
    { header: "Valor", key: "valor", width: 16 }
  ];

  const totalPontos = state.participantesCalculados.reduce((a, b) => a + Number(b.pontos_total || 0), 0);
  const totalResgatados = state.participantesCalculados.reduce((a, b) => a + Number(b.pontos_resgatados || 0), 0);
  const saldo = state.participantesCalculados.reduce((a, b) => a + Number(b.saldo_disponivel || 0), 0);
  const compostoConquistado = state.participantesCalculados.reduce((a, b) => a + Number(b.composto_conquistado || 0), 0);
  const compostoRetirado = state.participantesCalculados.reduce((a, b) => a + Number(b.composto_retirado || 0), 0);
  const compostoDisponivel = state.participantesCalculados.reduce((a, b) => a + Number(b.composto_disponivel || 0), 0);

  wsGraficos.addRows([
    { indicador: "Participantes", valor: state.participantesCalculados.length },
    { indicador: "Diretorias", valor: state.diretorias.length },
    { indicador: "Pontos Gerados", valor: totalPontos },
    { indicador: "Pontos Resgatados", valor: totalResgatados },
    { indicador: "Saldo Disponível", valor: saldo },
    { indicador: "Composto Conquistado", valor: compostoConquistado },
    { indicador: "Composto Retirado", valor: compostoRetirado },
    { indicador: "Composto Disponível", valor: compostoDisponivel }
  ]);

  workbook.worksheets.forEach((ws) => {
    ws.getRow(1).font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Relatorio_Recicla_CEDAE.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  updateExportStatus("relatorio");
}

function nowBrString() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());
}

function loadExportStatus() {
  try {
    const raw = localStorage.getItem(RECICLA_EXPORT_STATUS_STORAGE_KEY);
    if (!raw) {
      return {
        pesagens: "",
        premiacoes: "",
        relatorio: ""
      };
    }

    const parsed = JSON.parse(raw);
    return {
      pesagens: parsed?.pesagens || "",
      premiacoes: parsed?.premiacoes || "",
      relatorio: parsed?.relatorio || ""
    };
  } catch (_error) {
    return {
      pesagens: "",
      premiacoes: "",
      relatorio: ""
    };
  }
}

function persistExportStatus(status) {
  localStorage.setItem(RECICLA_EXPORT_STATUS_STORAGE_KEY, JSON.stringify(status));
}

function updateExportStatus(type) {
  const current = loadExportStatus();
  current[type] = nowBrString();
  persistExportStatus(current);
  updateStatusBox();
}

function updateStatusBox() {
  if (!els.reciclaDbStatus) return;

  const exportStatus = loadExportStatus();

  const pesagensTxt = exportStatus.pesagens
    ? `baixado em ${exportStatus.pesagens}`
    : "ainda não gerado";

  const premiacoesTxt = exportStatus.premiacoes
    ? `baixado em ${exportStatus.premiacoes}`
    : "ainda não gerado";

  const relatorioTxt = exportStatus.relatorio
    ? `baixado em ${exportStatus.relatorio}`
    : "ainda não gerado";

  els.reciclaDbStatus.innerHTML = `
    <strong>Base carregada</strong> com ${formatInteger(state.participantesCalculados.length)} participantes e ${formatInteger(state.movimentos.length)} movimentos locais.<br>
    <strong>Excel de pesagens:</strong> ${escapeHtml(pesagensTxt)}.<br>
    <strong>Excel de premiações:</strong> ${escapeHtml(premiacoesTxt)}.<br>
    <strong>Relatório completo:</strong> ${escapeHtml(relatorioTxt)}.
  `;
}

/* =========================================================
   CICLO PRINCIPAL
========================================================= */

function refreshAll() {
  recalculateState();
  populatePremiosSelect();
  renderTecnico();
  renderPesagensGrid();
  updateStatusBox();

  if (els.reciclaDbStatus) {
    els.reciclaDbStatus.textContent =
      `Base carregada com ${formatInteger(state.participantesCalculados.length)} participantes e ${formatInteger(state.movimentos.length)} movimentos locais.`;
  }
}

function bindEvents() {
  bindPesagensGridEvents();

  els.addPesagemRowBtn?.addEventListener("click", addDraftRow);
  els.processPesagensBtn?.addEventListener("click", processPesagensBatch);
  els.clearPesagensGridBtn?.addEventListener("click", clearDraftGrid);

  els.exportPesagensExcelBtn?.addEventListener("click", exportPesagensExcel);
  els.exportPremiacoesExcelBtn?.addEventListener("click", exportPremiacoesExcel);
  els.exportRelatorioCompletoBtn?.addEventListener("click", exportRelatorioCompleto);

  els.compostoId?.addEventListener("input", updateCompostoPreview);
  els.compostoQtd?.addEventListener("input", updateCompostoPreview);
  els.compostoForm?.addEventListener("submit", handleCompostoSubmit);
  els.clearCompostoBtn?.addEventListener("click", () => {
    if (els.compostoId) els.compostoId.value = "";
    if (els.compostoQtd) els.compostoQtd.value = "1";
    if (els.compostoData) els.compostoData.value = todayIso();
    updateCompostoPreview();
  });

  els.resgateId?.addEventListener("input", updateResgatePreview);
  els.resgatePremio?.addEventListener("change", updateResgatePreview);
  els.resgateForm?.addEventListener("submit", handleResgateSubmit);
  els.clearResgateBtn?.addEventListener("click", () => {
    if (els.resgateId) els.resgateId.value = "";
    updateResgatePreview();
  });
}

async function loadData() {
  if (els.reciclaDbStatus) {
    els.reciclaDbStatus.innerHTML = "Lendo base técnica do Recicla CEDAE...";
  }

  const response = await fetch("./data/recicla-premiacao-seed.json", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar data/recicla-premiacao-seed.json");
  }

  const json = await response.json();
  const rawRecords = extractSeedRecords(json);

  state.participantesBase = rawRecords.map(normalizeParticipante);
  state.movimentos = loadMovimentos();

  refreshAll();
  updateStatusBox();
}

async function bootstrap() {
  try {
    bindEvents();
    ensureDraftRows(8);
    await loadData();

    if (els.compostoData && !els.compostoData.value) {
      els.compostoData.value = todayIso();
    }
  } catch (error) {
    console.error(error);

    if (els.reciclaDbStatus) {
      els.reciclaDbStatus.textContent = "Erro ao carregar a área técnica do Recicla CEDAE.";
    }
  }
}

bootstrap();