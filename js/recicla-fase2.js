const BR_NUMBER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2
});

const RECICLA_FASE2_STORAGE_KEY = "dma_recicla_fase2_movimentos_v1";

const PREMIOS = [
  {
    premio_id: "broche",
    nome: "Broche",
    custo_pontos: 10,
    estoque_inicial: 80,
    ativo: true
  },
  {
    premio_id: "copo",
    nome: "Copo",
    custo_pontos: 20,
    estoque_inicial: 45,
    ativo: true
  },
  {
    premio_id: "mochila",
    nome: "Mochila",
    custo_pontos: 100,
    estoque_inicial: 12,
    ativo: true
  }
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

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ""))]
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
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
  filteredParticipantes: [],
  filteredDiretorias: []
};

const els = {
  fase2DbStatus: document.getElementById("fase2DbStatus"),

  publicKpiParticipantes: document.getElementById("publicKpiParticipantes"),
  publicKpiPontosGerados: document.getElementById("publicKpiPontosGerados"),
  publicKpiPontosResgatados: document.getElementById("publicKpiPontosResgatados"),
  publicKpiSaldo: document.getElementById("publicKpiSaldo"),
  publicKpiAptos20: document.getElementById("publicKpiAptos20"),
  publicKpiAptos100: document.getElementById("publicKpiAptos100"),

  awardCatalog: document.getElementById("awardCatalog"),

  filterDiretoria: document.getElementById("filterDiretoria"),
  filterFaixaSaldo: document.getElementById("filterFaixaSaldo"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  reloadDataBtn: document.getElementById("reloadDataBtn"),

  kpiPontosGerados: document.getElementById("kpiPontosGerados"),
  kpiPontosResgatados: document.getElementById("kpiPontosResgatados"),
  kpiSaldoCirculacao: document.getElementById("kpiSaldoCirculacao"),
  kpiMovimentos: document.getElementById("kpiMovimentos"),
  kpiBrochesRetirados: document.getElementById("kpiBrochesRetirados"),
  kpiCoposRetirados: document.getElementById("kpiCoposRetirados"),
  kpiMochilasRetiradas: document.getElementById("kpiMochilasRetiradas"),
  kpiEstoqueRestante: document.getElementById("kpiEstoqueRestante"),

  chartResgatesPremio: document.getElementById("chartResgatesPremio"),
  chartEstoque: document.getElementById("chartEstoque"),
  chartTopPontos: document.getElementById("chartTopPontos"),
  chartTopSaldo: document.getElementById("chartTopSaldo"),
  chartDiretorias: document.getElementById("chartDiretorias"),

  participantsTableBody: document.getElementById("participantsTableBody"),
  participantsCount: document.getElementById("participantsCount"),

  pesagemForm: document.getElementById("pesagemForm"),
  pesagemId: document.getElementById("pesagemId"),
  pesagemPeso: document.getElementById("pesagemPeso"),
  pesagemData: document.getElementById("pesagemData"),
  pesagemNome: document.getElementById("pesagemNome"),
  pesagemDiretoria: document.getElementById("pesagemDiretoria"),
  pesagemPontosGerados: document.getElementById("pesagemPontosGerados"),
  clearPesagemBtn: document.getElementById("clearPesagemBtn"),

  resgateForm: document.getElementById("resgateForm"),
  resgateId: document.getElementById("resgateId"),
  resgatePremio: document.getElementById("resgatePremio"),
  resgateQtd: document.getElementById("resgateQtd"),
  resgateSaldoAtual: document.getElementById("resgateSaldoAtual"),
  resgateCusto: document.getElementById("resgateCusto"),
  resgateSaldoFinal: document.getElementById("resgateSaldoFinal"),
  resgateMessage: document.getElementById("resgateMessage"),
  clearResgateBtn: document.getElementById("clearResgateBtn"),

  movementsTableBody: document.getElementById("movementsTableBody"),
  movementsCount: document.getElementById("movementsCount")
};

const tabButtons = Array.from(document.querySelectorAll(".module-nav-card"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

function activateTab(tabName) {
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
  }
}

function renderBarList(container, entries, fillClass = "") {
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">Sem dados para exibição.</p>`;
    return;
  }

  const max = Math.max(...entries.map(([, value]) => Number(value || 0)), 1);

  container.innerHTML = entries
    .map(([label, value]) => {
      const width = Math.max((Number(value || 0) / max) * 100, 2);

      return `
        <div class="bar-item" title="${escapeHtml(label)} · ${formatNumber(value)}">
          <div class="bar-item__head">
            <span class="bar-item__label">${escapeHtml(label)}</span>
            <span class="bar-item__value">${formatNumber(value)}</span>
          </div>
          <div class="bar-item__track">
            <div class="bar-item__fill ${fillClass}" style="width:${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function getFaixaSaldo(value) {
  const n = Number(value || 0);
  if (n >= 100) return "100mais";
  if (n >= 20) return "20a99";
  if (n >= 10) return "10a19";
  return "ate9";
}

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
        mochilas_retiradas: 0
      }
    ])
  );

  for (const mov of state.movimentos) {
    const key = String(mov.n_id);
    if (!participantesMap.has(key)) continue;

    const participante = participantesMap.get(key);

    if (mov.tipo === "credito") {
      participante.pontos_total += Number(mov.pontos || 0);
      participante.saldo_disponivel += Number(mov.pontos || 0);
    }

    if (mov.tipo === "debito") {
      participante.pontos_resgatados += Number(mov.pontos || 0);
      participante.saldo_disponivel -= Number(mov.pontos || 0);

      if (mov.premio_id === "broche") participante.broches_retirados += Number(mov.quantidade || 0);
      if (mov.premio_id === "copo") participante.copos_retirados += Number(mov.quantidade || 0);
      if (mov.premio_id === "mochila") participante.mochilas_retiradas += Number(mov.quantidade || 0);

      const premio = premiosState.find((p) => p.premio_id === mov.premio_id);
      if (premio) {
        premio.estoque_inicial -= Number(mov.quantidade || 0);
      }
    }
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

function populateFilters() {
  if (!els.filterDiretoria) return;

  const diretorias = uniqueSorted(state.participantesCalculados.map((item) => item.diretoria));

  els.filterDiretoria.innerHTML = `
    <option value="">Todas</option>
    ${diretorias
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("")}
  `;
}

function populatePremiosSelect() {
  if (!els.resgatePremio) return;

  els.resgatePremio.innerHTML = state.premios
    .filter((item) => item.ativo)
    .map(
      (item) => `
        <option value="${escapeHtml(item.premio_id)}">
          ${escapeHtml(`${item.nome} · ${item.custo_pontos} pontos`)}
        </option>
      `
    )
    .join("");
}

function applyFilters() {
  const diretoria = els.filterDiretoria?.value || "";
  const faixaSaldo = els.filterFaixaSaldo?.value || "";

  state.filteredParticipantes = state.participantesCalculados.filter((item) => {
    const byDiretoria = !diretoria || item.diretoria === diretoria;
    const byFaixa = !faixaSaldo || getFaixaSaldo(item.saldo_disponivel) === faixaSaldo;
    return byDiretoria && byFaixa;
  });

  state.filteredDiretorias = !diretoria
    ? [...state.diretorias]
    : state.diretorias.filter((item) => item.diretoria === diretoria);

  renderGerencial();
}

function renderPublico() {
  const participantes = state.participantesCalculados;
  const pontosGerados = participantes.reduce((acc, item) => acc + Number(item.pontos_total || 0), 0);
  const pontosResgatados = participantes.reduce((acc, item) => acc + Number(item.pontos_resgatados || 0), 0);
  const saldo = participantes.reduce((acc, item) => acc + Number(item.saldo_disponivel || 0), 0);
  const aptos20 = participantes.filter((item) => Number(item.saldo_disponivel || 0) >= 20).length;
  const aptos100 = participantes.filter((item) => Number(item.saldo_disponivel || 0) >= 100).length;

  if (els.publicKpiParticipantes) els.publicKpiParticipantes.textContent = formatInteger(participantes.length);
  if (els.publicKpiPontosGerados) els.publicKpiPontosGerados.textContent = formatNumber(pontosGerados);
  if (els.publicKpiPontosResgatados) els.publicKpiPontosResgatados.textContent = formatNumber(pontosResgatados);
  if (els.publicKpiSaldo) els.publicKpiSaldo.textContent = formatNumber(saldo);
  if (els.publicKpiAptos20) els.publicKpiAptos20.textContent = formatInteger(aptos20);
  if (els.publicKpiAptos100) els.publicKpiAptos100.textContent = formatInteger(aptos100);

  if (els.awardCatalog) {
    els.awardCatalog.innerHTML = state.premios
      .map(
        (premio) => `
          <article class="award-item">
            <span>${escapeHtml(premio.nome)}</span>
            <strong>${formatInteger(premio.custo_pontos)} pontos</strong>
            <p>Prêmio disponível para resgate mediante saldo suficiente e confirmação da equipe técnica.</p>
            <div class="award-item__meta">
              <span class="award-pill">Estoque: ${formatInteger(premio.estoque_inicial)}</span>
            </div>
          </article>
        `
      )
      .join("");
  }
}

function renderGerencial() {
  const participantes = state.filteredParticipantes;
  const pontosGerados = participantes.reduce((acc, item) => acc + Number(item.pontos_total || 0), 0);
  const pontosResgatados = participantes.reduce((acc, item) => acc + Number(item.pontos_resgatados || 0), 0);
  const saldo = participantes.reduce((acc, item) => acc + Number(item.saldo_disponivel || 0), 0);

  const brochesRetirados = participantes.reduce((acc, item) => acc + Number(item.broches_retirados || 0), 0);
  const coposRetirados = participantes.reduce((acc, item) => acc + Number(item.copos_retirados || 0), 0);
  const mochilasRetiradas = participantes.reduce((acc, item) => acc + Number(item.mochilas_retiradas || 0), 0);
  const estoqueRestante = state.premios.reduce((acc, item) => acc + Number(item.estoque_inicial || 0), 0);

  if (els.kpiPontosGerados) els.kpiPontosGerados.textContent = formatNumber(pontosGerados);
  if (els.kpiPontosResgatados) els.kpiPontosResgatados.textContent = formatNumber(pontosResgatados);
  if (els.kpiSaldoCirculacao) els.kpiSaldoCirculacao.textContent = formatNumber(saldo);
  if (els.kpiMovimentos) els.kpiMovimentos.textContent = formatInteger(state.movimentos.length);
  if (els.kpiBrochesRetirados) els.kpiBrochesRetirados.textContent = formatInteger(brochesRetirados);
  if (els.kpiCoposRetirados) els.kpiCoposRetirados.textContent = formatInteger(coposRetirados);
  if (els.kpiMochilasRetiradas) els.kpiMochilasRetiradas.textContent = formatInteger(mochilasRetiradas);
  if (els.kpiEstoqueRestante) els.kpiEstoqueRestante.textContent = formatInteger(estoqueRestante);

  renderBarList(
    els.chartResgatesPremio,
    [
      ["Broche", brochesRetirados],
      ["Copo", coposRetirados],
      ["Mochila", mochilasRetiradas]
    ],
    "bar-item__fill--amber"
  );

  renderBarList(
    els.chartEstoque,
    state.premios.map((item) => [item.nome, Number(item.estoque_inicial || 0)]),
    "bar-item__fill--blue"
  );

  renderBarList(
    els.chartTopPontos,
    [...participantes]
      .sort((a, b) => Number(b.pontos_total || 0) - Number(a.pontos_total || 0))
      .slice(0, 10)
      .map((item) => [`ID ${item.n_id} · ${item.diretoria}`, Number(item.pontos_total || 0)]),
    "bar-item__fill--green"
  );

  renderBarList(
    els.chartTopSaldo,
    [...participantes]
      .sort((a, b) => Number(b.saldo_disponivel || 0) - Number(a.saldo_disponivel || 0))
      .slice(0, 10)
      .map((item) => [`ID ${item.n_id} · ${item.diretoria}`, Number(item.saldo_disponivel || 0)]),
    "bar-item__fill--green"
  );

  renderBarList(
    els.chartDiretorias,
    [...state.filteredDiretorias]
      .sort((a, b) => Number(b.pontos_total || 0) - Number(a.pontos_total || 0))
      .map((item) => [item.diretoria, Number(item.pontos_total || 0)]),
    "bar-item__fill--blue"
  );

  if (els.participantsCount) {
    els.participantsCount.textContent = `${formatInteger(participantes.length)} registros`;
  }

  if (els.participantsTableBody) {
    els.participantsTableBody.innerHTML = participantes.length
      ? participantes
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.n_id)}</td>
                <td>${escapeHtml(item.diretoria || "-")}</td>
                <td>${formatNumber(item.pontos_total || 0)}</td>
                <td>${formatNumber(item.pontos_resgatados || 0)}</td>
                <td>${formatNumber(item.saldo_disponivel || 0)}</td>
                <td>${formatInteger(item.broches_retirados || 0)}</td>
                <td>${formatInteger(item.copos_retirados || 0)}</td>
                <td>${formatInteger(item.mochilas_retiradas || 0)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="8">Nenhum participante encontrado para os filtros selecionados.</td></tr>`;
  }
}

function updatePesagemPreview() {
  const id = els.pesagemId?.value || "";
  const peso = Number(els.pesagemPeso?.value || 0);
  const participante = getParticipanteById(id);

  if (els.pesagemPontosGerados) {
    els.pesagemPontosGerados.textContent = formatNumber(peso > 0 ? peso : 0);
  }

  if (!participante) {
    if (els.pesagemNome) els.pesagemNome.textContent = "-";
    if (els.pesagemDiretoria) els.pesagemDiretoria.textContent = "-";
    return;
  }

  if (els.pesagemNome) els.pesagemNome.textContent = participante.nome || "-";
  if (els.pesagemDiretoria) els.pesagemDiretoria.textContent = participante.diretoria || "-";
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

function renderMovementsHistory() {
  if (els.movementsCount) {
    els.movementsCount.textContent = `${formatInteger(state.movimentos.length)} movimentos`;
  }

  if (!els.movementsTableBody) return;

  const rows = [...state.movimentos].sort((a, b) => String(b.data).localeCompare(String(a.data)));

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

  if (els.pesagemData && !els.pesagemData.value) {
    els.pesagemData.value = todayIso();
  }

  updatePesagemPreview();
  updateResgatePreview();
}

function refreshAll() {
  recalculateState();
  populateFilters();
  populatePremiosSelect();
  renderPublico();
  applyFilters();
  renderTecnico();
}

function handlePesagemSubmit(event) {
  event.preventDefault();

  const id = String(els.pesagemId?.value || "").trim();
  const peso = Number(els.pesagemPeso?.value || 0);
  const data = els.pesagemData?.value || todayIso();
  const participante = getParticipanteById(id);

  if (!participante || !(peso > 0)) return;

  state.movimentos.push({
    movimento_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    n_id: participante.n_id,
    tipo: "credito",
    origem: "pesagem",
    pontos: peso,
    peso_kg: peso,
    data,
    premio_id: "",
    premio_nome: "",
    quantidade: 0,
    observacao: "Pesagem registrada pela equipe técnica"
  });

  persistMovimentos(state.movimentos);

  if (els.pesagemId) els.pesagemId.value = "";
  if (els.pesagemPeso) els.pesagemPeso.value = "";
  if (els.pesagemData) els.pesagemData.value = todayIso();

  refreshAll();
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

function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });

  els.filterDiretoria?.addEventListener("change", applyFilters);
  els.filterFaixaSaldo?.addEventListener("change", applyFilters);

  els.clearFiltersBtn?.addEventListener("click", () => {
    if (els.filterDiretoria) els.filterDiretoria.value = "";
    if (els.filterFaixaSaldo) els.filterFaixaSaldo.value = "";
    applyFilters();
  });

  els.reloadDataBtn?.addEventListener("click", loadData);

  els.pesagemId?.addEventListener("input", updatePesagemPreview);
  els.pesagemPeso?.addEventListener("input", updatePesagemPreview);
  els.pesagemForm?.addEventListener("submit", handlePesagemSubmit);
  els.clearPesagemBtn?.addEventListener("click", () => {
    if (els.pesagemId) els.pesagemId.value = "";
    if (els.pesagemPeso) els.pesagemPeso.value = "";
    if (els.pesagemData) els.pesagemData.value = todayIso();
    updatePesagemPreview();
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
  if (els.fase2DbStatus) {
    els.fase2DbStatus.textContent = "Lendo base de referência da Fase 2...";
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

  if (els.fase2DbStatus) {
    els.fase2DbStatus.textContent =
      `Base carregada com ${formatInteger(state.participantesCalculados.length)} participantes e ${formatInteger(state.movimentos.length)} movimentos locais.`;
  }
}

async function bootstrap() {
  try {
    bindEvents();
    await loadData();

    if (els.pesagemData && !els.pesagemData.value) {
      els.pesagemData.value = todayIso();
    }
  } catch (error) {
    console.error(error);

    if (els.fase2DbStatus) {
      els.fase2DbStatus.textContent = "Erro ao carregar a Fase 2 do Recicla CEDAE.";
    }
  }
}

bootstrap();