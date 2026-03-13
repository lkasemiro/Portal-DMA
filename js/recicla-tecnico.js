const BR_NUMBER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2
});

const RECICLA_FASE2_STORAGE_KEY = "dma_recicla_fase2_movimentos_v1";

const PREMIOS = [
  { premio_id: "broche", nome: "Broche", custo_pontos: 10, estoque_inicial: 80, ativo: true },
  { premio_id: "copo", nome: "Copo", custo_pontos: 20, estoque_inicial: 45, ativo: true },
  { premio_id: "mochila", nome: "Mochila", custo_pontos: 100, estoque_inicial: 12, ativo: true },
  { premio_id: "composto", nome: "Composto orgânico", custo_pontos: 0, estoque_inicial: 200, ativo: true }
];

function formatNumber(value) {
  return BR_NUMBER.format(Number(value || 0));
}

function formatInteger(value) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
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

function normalizeParticipante(item) {
  return {
    n_id: item.n_id ?? null,
    nome: item.nome ?? "",
    diretoria: item.diretoria ?? ""
  };
}

function getPremioInicialById(premioId) {
  return PREMIOS.find((item) => item.premio_id === premioId) || null;
}

function extractSeedRecords(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.registros)) return json.registros;
  if (Array.isArray(json.ranking_geral)) return json.ranking_geral;
  if (Array.isArray(json.top_20)) return json.top_20;
  return [];
}

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
  resgateQtd: document.getElementById("resgateQtd"),
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

function getParticipanteById(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  return state.participantesCalculados.find((item) => String(item.n_id) === normalizedId) || null;
}

function recalculateState() {
  const premiosState = structuredClone(PREMIOS);

  const participantesMap = new Map(
    state.participantesBase.map((p) => [
      String(p.n_id),
      {
        ...p,
        pontos_total: 0,
        pontos_resgatados: 0,
        saldo_disponivel: 0,
        broches_retirados: 0,
        copos_retirados: 0,
        mochilas_retiradas: 0,
        composto_conquistado: 0,
        composto_retirado: 0,
        composto_disponivel: 0
      }
    ])
  );

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

    participante.composto_conquistado = Math.min(
      Math.floor(pontos / 10),
      10
    );

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
  const peso = Number(row.peso || 0);

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

  row[field] = value;

  if (field === "n_id") {
    const participante = getParticipanteById(value);
    row.nome = participante?.nome || "";
    row.diretoria = participante?.diretoria || "";
  }

  if (field === "peso") {
    const pesoNum = Number(value || 0);
    row.pontos = pesoNum > 0 ? pesoNum : 0;
  }

  validateDraftRow(row);
  renderPesagensGrid();
}

function getStatusClass(status) {
  if (status === "Pronto") return "excel-cell-status excel-cell-status--ok";
  if (status === "ID inválido" || status === "Peso inválido") {
    return "excel-cell-status excel-cell-status--danger";
  }
  return "excel-cell-status excel-cell-status--warning";
}

function renderPesagensGrid() {
  if (!els.pesagensGridBody) return;

  ensureDraftRows(8);

  els.pesagensGridBody.innerHTML = state.pesagensDraft
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>
          <input
            type="number"
            value="${escapeHtml(row.n_id)}"
            data-row-id="${escapeHtml(row.row_id)}"
            data-field="n_id"
            class="excel-input"
            placeholder="ID"
          />
        </td>
        <td><div class="excel-cell-readonly">${escapeHtml(row.nome || "-")}</div></td>
        <td><div class="excel-cell-readonly">${escapeHtml(row.diretoria || "-")}</div></td>
        <td>
          <input
            type="number"
            step="0.01"
            min="0.01"
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
        <td><div class="excel-cell-readonly">${formatNumber(row.pontos || 0)}</div></td>
        <td><span class="${getStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
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
    `)
    .join("");

  els.pesagensGridBody.querySelectorAll(".excel-input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const rowId = event.target.dataset.rowId;
      const field = event.target.dataset.field;
      updateDraftRowById(rowId, field, event.target.value);
    });

    input.addEventListener("change", (event) => {
      const rowId = event.target.dataset.rowId;
      const field = event.target.dataset.field;
      updateDraftRowById(rowId, field, event.target.value);
    });
  });

  els.pesagensGridBody.querySelectorAll("[data-remove-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const rowId = button.dataset.removeRow;
      state.pesagensDraft = state.pesagensDraft.filter((row) => row.row_id !== rowId);
      ensureDraftRows(8);
      renderPesagensGrid();
    });
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
    state.movimentos.push({
      movimento_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${row.row_id}`,
      n_id: Number(row.n_id),
      tipo: "credito",
      origem: "pesagem",
      pontos: Number(row.pontos || 0),
      peso_kg: Number(row.peso || 0),
      peso: Number(row.peso || 0),
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
  const id = els.resgateId?.value || "";
  const premioId = els.resgatePremio?.value || "";
  const qtd = Number(els.resgateQtd?.value || 0);
  const participante = getParticipanteById(id);
  const premio = state.premios.find((item) => item.premio_id === premioId);

  const saldoAtual = Number(participante?.saldo_disponivel || 0);
  const custo = premio ? Number(premio.custo_pontos || 0) * Math.max(qtd, 0) : 0;
  const saldoFinal = saldoAtual - custo;

  if (els.resgateSaldoAtual) els.resgateSaldoAtual.textContent = formatNumber(saldoAtual);
  if (els.resgateCusto) els.resgateCusto.textContent = formatNumber(custo);
  if (els.resgateSaldoFinal) els.resgateSaldoFinal.textContent = formatNumber(saldoFinal);

  if (!participante) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent = "Informe um ID válido para verificar saldo e elegibilidade.";
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

  if (premio.estoque_inicial < qtd) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent = "Estoque insuficiente para a quantidade informada.";
    }
    return;
  }

  if (saldoAtual < custo) {
    if (els.resgateMessage) {
      els.resgateMessage.className = "technical-inline-message technical-inline-message--danger";
      els.resgateMessage.textContent = "Saldo insuficiente para este resgate.";
    }
    return;
  }

  if (els.resgateMessage) {
    els.resgateMessage.className = "technical-inline-message";
    els.resgateMessage.textContent =
      `Resgate elegível para ID ${participante.n_id}. Saldo após operação: ${formatNumber(saldoFinal)} pontos.`;
  }
}

function handleResgateSubmit(event) {
  event.preventDefault();

  const id = String(els.resgateId?.value || "").trim();
  const premioId = els.resgatePremio?.value || "";
  const qtd = Number(els.resgateQtd?.value || 0);

  const participante = getParticipanteById(id);
  const premio = state.premios.find((item) => item.premio_id === premioId);

  if (!participante || !premio || !(qtd > 0)) return;

  const custo = Number(premio.custo_pontos || 0) * qtd;
  const saldoAtual = Number(participante.saldo_disponivel || 0);

  if (premio.estoque_inicial < qtd) return;
  if (saldoAtual < custo) return;

  state.movimentos.push({
    movimento_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    n_id: participante.n_id,
    tipo: "debito",
    origem: "resgate",
    pontos: custo,
    peso_kg: 0,
    peso: 0,
    data: todayIso(),
    premio_id: premio.premio_id,
    premio_nome: premio.nome,
    quantidade: qtd,
    observacao: "Resgate confirmado pela equipe técnica"
  });

  persistMovimentos(state.movimentos);

  if (els.resgateId) els.resgateId.value = "";
  if (els.resgateQtd) els.resgateQtd.value = "1";

  refreshAll();
}

function updateCompostoPreview() {
  const id = els.compostoId?.value || "";
  const qtd = Number(els.compostoQtd?.value || 0);
  const participante = getParticipanteById(id);

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

  const id = String(els.compostoId?.value || "").trim();
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

function renderMovementsHistory() {
  if (els.movementsCount) {
    els.movementsCount.textContent = `${formatInteger(state.movimentos.length)} movimentos`;
  }

  if (!els.movementsTableBody) return;

  const rows = [...state.movimentos].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));

  els.movementsTableBody.innerHTML = rows.length
    ? rows
        .map(
          (mov) => `
            <tr>
              <td>${escapeHtml(mov.data)}</td>
              <td>${escapeHtml(mov.n_id)}</td>
              <td>${escapeHtml(mov.tipo)}</td>
              <td>${escapeHtml(mov.origem)}</td>
              <td>${formatNumber(mov.pontos || 0)}</td>
              <td>${escapeHtml(mov.premio_nome || "-")}</td>
              <td>${escapeHtml(mov.observacao || "-")}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="7">Nenhum movimento registrado na Fase 2.</td></tr>`;
}

function renderTecnico() {
  renderMovementsHistory();

  if (els.compostoData && !els.compostoData.value) {
    els.compostoData.value = todayIso();
  }

  updateCompostoPreview();
  updateResgatePreview();
}

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
        nome: participante?.nome || "",
        diretoria: participante?.diretoria || "",
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
        nome: participante?.nome || "",
        diretoria: participante?.diretoria || "",
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
    .filter(m => m.tipo === "credito")
    .forEach(m => {
      const participante = state.participantesCalculados.find(
        p => String(p.n_id) === String(m.n_id)
      );

      wsPesagens.addRow({
        data: m.data || "",
        n_id: m.n_id,
        nome: participante?.nome || "",
        diretoria: participante?.diretoria || "",
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
    .filter(m => m.tipo === "debito")
    .forEach(m => {
      const participante = state.participantesCalculados.find(
        p => String(p.n_id) === String(m.n_id)
      );

      wsPremios.addRow({
        data: m.data || "",
        n_id: m.n_id,
        nome: participante?.nome || "",
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
    .filter(m => m.tipo === "beneficio")
    .forEach(m => {
      const participante = state.participantesCalculados.find(
        p => String(p.n_id) === String(m.n_id)
      );

      wsComposto.addRow({
        data: m.data || "",
        n_id: m.n_id,
        nome: participante?.nome || "",
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
    { header: "Composto Disponível", key: "composto_d", width: 18 }
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
      composto_d: p.composto_disponivel
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

  state.diretorias.forEach(d => {
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
    type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Relatorio_Recicla_CEDAE.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function refreshAll() {
  recalculateState();
  populatePremiosSelect();
  renderTecnico();
  renderPesagensGrid();

  if (els.reciclaDbStatus) {
    els.reciclaDbStatus.textContent =
      `Base carregada com ${formatInteger(state.participantesCalculados.length)} participantes e ${formatInteger(state.movimentos.length)} movimentos locais.`;
  }
}

function bindEvents() {
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
  els.resgateQtd?.addEventListener("input", updateResgatePreview);
  els.resgateForm?.addEventListener("submit", handleResgateSubmit);
  els.clearResgateBtn?.addEventListener("click", () => {
    if (els.resgateId) els.resgateId.value = "";
    if (els.resgateQtd) els.resgateQtd.value = "1";
    updateResgatePreview();
  });
}

async function loadData() {
  if (els.reciclaDbStatus) {
    els.reciclaDbStatus.textContent = "Lendo base técnica do Recicla CEDAE...";
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