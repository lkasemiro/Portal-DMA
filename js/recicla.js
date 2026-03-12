const BR_NUMBER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2
});

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

function getFaixaSomatorio(value) {
  const n = Number(value || 0);

  if (n >= 100) return "100+";
  if (n >= 50) return "50-99";
  return "Abaixo de 50";
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y
  ].join(" ");
}

function renderPieChart(container, config) {
  if (!container) return;

  const { centerValue, centerLabel, slices = [], legend = [] } = config;

  const total = slices.reduce((acc, slice) => acc + Number(slice.value || 0), 0);
  let currentAngle = 0;
  const arcs = [];

  if (total > 0) {
    for (const slice of slices) {
      const value = Number(slice.value || 0);
      if (value <= 0) continue;

      const angle = (value / total) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;

      if (angle >= 360) {
        arcs.push(`
          <circle cx="120" cy="120" r="78" fill="none" stroke="${slice.color}" stroke-width="26"></circle>
        `);
      } else {
        arcs.push(`
          <path
            d="${describeArc(120, 120, 78, start, end)}"
            fill="none"
            stroke="${slice.color}"
            stroke-width="26"
            stroke-linecap="round"
          ></path>
        `);
      }

      currentAngle = end;
    }
  }

  container.innerHTML = `
    <div class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 240 240" width="220" height="220" aria-hidden="true">
        <circle cx="120" cy="120" r="78" fill="none" stroke="#e2e8f0" stroke-width="26"></circle>
        ${arcs.join("")}
      </svg>

      <div class="chart-center">
        <strong>${escapeHtml(centerValue)}</strong>
        <span>${escapeHtml(centerLabel)}</span>
      </div>

      <div class="chart-legend">
        ${legend
          .map(
            (item) => `
              <div class="chart-legend__item">
                <span class="chart-legend__left">
                  <span class="chart-dot ${item.dotClass}"></span>
                  <span>${escapeHtml(item.label)}</span>
                </span>
                <strong>${escapeHtml(item.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
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

function getStatusPill(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "entregue") {
    return {
      text: "Entregue",
      className: "status-pill status-pill--success"
    };
  }

  if (normalized === "pendente") {
    return {
      text: "Pendente",
      className: "status-pill status-pill--warning"
    };
  }

  return {
    text: "Não informado",
    className: "status-pill status-pill--muted"
  };
}

function normalizeRankingItem(item) {
  return {
    ...item,
    n_id: item.n_id ?? null,
    nome: item.nome ?? "",
    diretoria: item.diretoria ?? "",
    somatorio: Number(item.somatorio || 0),
    status_broche: item.status_broche || item.broche || "Nao informado",
    status_mochila: item.status_mochila || item.mochila || "Nao informado",
    quantidade_retirada_sacos_de_composto_organico: Number(
      item.quantidade_retirada_sacos_de_composto_organico || 0
    ),
    faixa_somatorio: item.faixa_somatorio || getFaixaSomatorio(item.somatorio)
  };
}

function extractSeedRecords(json) {
  if (Array.isArray(json)) {
    return json;
  }

  if (Array.isArray(json.registros)) {
    return json.registros;
  }

  if (Array.isArray(json.ranking_geral)) {
    return json.ranking_geral;
  }

  if (Array.isArray(json.top_20)) {
    return json.top_20;
  }

  return [];
}

function buildDerivedData(rows) {
  const ranking = [...rows]
    .sort((a, b) => Number(b.somatorio || 0) - Number(a.somatorio || 0))
    .map((item, index) => ({
      ...item,
      posicao: index + 1
    }));

  const diretoriasMap = new Map();
  const faixasMap = new Map();
  const brocheMap = new Map();
  const mochilaMap = new Map();

  let somatorioTotal = 0;
  let compostoRetiradoTotal = 0;
  let participantesComRetirada = 0;

  for (const item of ranking) {
    const diretoria = item.diretoria || "Não informada";
    const faixa = item.faixa_somatorio || "Não informado";
    const broche = item.status_broche || "Nao informado";
    const mochila = item.status_mochila || "Nao informado";
    const retirada = Number(item.quantidade_retirada_sacos_de_composto_organico || 0);
    const somatorio = Number(item.somatorio || 0);

    somatorioTotal += somatorio;
    compostoRetiradoTotal += retirada;
    if (retirada > 0) participantesComRetirada += 1;

    faixasMap.set(faixa, (faixasMap.get(faixa) || 0) + 1);
    brocheMap.set(broche, (brocheMap.get(broche) || 0) + 1);
    mochilaMap.set(mochila, (mochilaMap.get(mochila) || 0) + 1);

    if (!diretoriasMap.has(diretoria)) {
      diretoriasMap.set(diretoria, {
        diretoria,
        participantes: 0,
        somatorio_total: 0,
        broches_entregues: 0,
        mochilas_entregues: 0,
        composto_retirado_total: 0
      });
    }

    const agg = diretoriasMap.get(diretoria);
    agg.participantes += 1;
    agg.somatorio_total += somatorio;
    agg.composto_retirado_total += retirada;

    if (String(broche).toLowerCase() === "entregue") agg.broches_entregues += 1;
    if (String(mochila).toLowerCase() === "entregue") agg.mochilas_entregues += 1;
  }

  const por_diretoria = [...diretoriasMap.values()]
    .map((item) => ({
      ...item,
      somatorio_medio: item.participantes
        ? item.somatorio_total / item.participantes
        : 0
    }))
    .sort((a, b) => Number(b.somatorio_total || 0) - Number(a.somatorio_total || 0));

  const dist_faixa_somatorio = [...faixasMap.entries()].map(([faixa_somatorio, quantidade]) => ({
    faixa_somatorio,
    quantidade
  }));

  const dist_broche = [...brocheMap.entries()].map(([status_broche, quantidade]) => ({
    status_broche,
    quantidade
  }));

  const dist_mochila = [...mochilaMap.entries()].map(([status_mochila, quantidade]) => ({
    status_mochila,
    quantidade
  }));

  const top_retiradas = [...ranking]
    .filter((item) => Number(item.quantidade_retirada_sacos_de_composto_organico || 0) > 0)
    .sort(
      (a, b) =>
        Number(b.quantidade_retirada_sacos_de_composto_organico || 0) -
        Number(a.quantidade_retirada_sacos_de_composto_organico || 0)
    )
    .slice(0, 10);

  const kpis = {
    total_participantes: ranking.length,
    total_diretorias: uniqueSorted(ranking.map((item) => item.diretoria)).length,
    somatorio_total: somatorioTotal,
    somatorio_medio: ranking.length ? somatorioTotal / ranking.length : 0,
    maior_somatorio: ranking.length ? Number(ranking[0].somatorio || 0) : 0,
    broches_entregues: ranking.filter(
      (item) => String(item.status_broche || "").toLowerCase() === "entregue"
    ).length,
    broches_pendentes: ranking.filter(
      (item) => String(item.status_broche || "").toLowerCase() === "pendente"
    ).length,
    mochilas_entregues: ranking.filter(
      (item) => String(item.status_mochila || "").toLowerCase() === "entregue"
    ).length,
    mochilas_pendentes: ranking.filter(
      (item) => String(item.status_mochila || "").toLowerCase() === "pendente"
    ).length,
    composto_retirado_total: compostoRetiradoTotal,
    participantes_com_retirada: participantesComRetirada,
    estoque_composto_disponivel_max: 0
  };

  return {
    ranking,
    por_diretoria,
    dist_faixa_somatorio,
    dist_broche,
    dist_mochila,
    top_retiradas,
    kpis
  };
}

const state = {
  data: null,
  ranking: [],
  diretorias: [],
  topRetiradas: [],
  filteredRanking: [],
  filteredDiretorias: []
};

const els = {
  reciclaDbStatus: document.getElementById("reciclaDbStatus"),
  overviewBaseText: document.getElementById("overviewBaseText"),

  publicKpiParticipantes: document.getElementById("publicKpiParticipantes"),
  publicKpiDiretorias: document.getElementById("publicKpiDiretorias"),
  publicKpiBroches: document.getElementById("publicKpiBroches"),
  publicKpiMochilas: document.getElementById("publicKpiMochilas"),
  publicKpiComposto: document.getElementById("publicKpiComposto"),
  publicKpiEstoque: document.getElementById("publicKpiEstoque"),

  awardAbaixo50: document.getElementById("awardAbaixo50"),
  award50a99: document.getElementById("award50a99"),
  award100mais: document.getElementById("award100mais"),

  highlightDiretoriaLider: document.getElementById("highlightDiretoriaLider"),
  highlightDiretoriaLiderText: document.getElementById("highlightDiretoriaLiderText"),
  highlightMaiorPontuacao: document.getElementById("highlightMaiorPontuacao"),
  highlightMaiorPontuacaoText: document.getElementById("highlightMaiorPontuacaoText"),
  highlightRetirada: document.getElementById("highlightRetirada"),
  highlightRetiradaText: document.getElementById("highlightRetiradaText"),

  kpiParticipantes: document.getElementById("kpiParticipantes"),
  kpiDiretorias: document.getElementById("kpiDiretorias"),
  kpiSomatorioTotal: document.getElementById("kpiSomatorioTotal"),
  kpiSomatorioMedio: document.getElementById("kpiSomatorioMedio"),
  kpiBrochesEntregues: document.getElementById("kpiBrochesEntregues"),
  kpiMochilasEntregues: document.getElementById("kpiMochilasEntregues"),
  kpiCompostoRetirado: document.getElementById("kpiCompostoRetirado"),
  kpiParticipantesComRetirada: document.getElementById("kpiParticipantesComRetirada"),

  chartBroche: document.getElementById("chartBroche"),
  chartMochila: document.getElementById("chartMochila"),
  chartFaixas: document.getElementById("chartFaixas"),
  chartTop10: document.getElementById("chartTop10"),
  chartDiretorias: document.getElementById("chartDiretorias"),
  chartComposto: document.getElementById("chartComposto"),

  rankingTableBody: document.getElementById("rankingTableBody"),
  diretoriasTableBody: document.getElementById("diretoriasTableBody"),
  historyCount: document.getElementById("historyCount"),
  diretoriasCount: document.getElementById("diretoriasCount"),

  filterDiretoria: document.getElementById("filterDiretoria"),
  filterFaixa: document.getElementById("filterFaixa"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  reloadDataBtn: document.getElementById("reloadDataBtn")
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

function populateDiretoriaFilter() {
  const diretorias = uniqueSorted(state.ranking.map((item) => item.diretoria));
  const currentValue = els.filterDiretoria?.value || "";

  if (!els.filterDiretoria) return;

  els.filterDiretoria.innerHTML = `
    <option value="">Todas</option>
    ${diretorias
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("")}
  `;

  if ([...els.filterDiretoria.options].some((option) => option.value === currentValue)) {
    els.filterDiretoria.value = currentValue;
  }
}

function applyFilters() {
  const diretoria = els.filterDiretoria?.value || "";
  const faixa = els.filterFaixa?.value || "";

  state.filteredRanking = state.ranking.filter((item) => {
    const byDiretoria = !diretoria || item.diretoria === diretoria;
    const byFaixa = !faixa || item.faixa_somatorio === faixa;
    return byDiretoria && byFaixa;
  });

  state.filteredDiretorias = !diretoria
    ? [...state.diretorias]
    : state.diretorias.filter((item) => item.diretoria === diretoria);

  renderManagementLayer();
}

function renderPublicLayer() {
  const kpis = state.data?.kpis || {};
  const faixas = Array.isArray(state.data?.dist_faixa_somatorio)
    ? state.data.dist_faixa_somatorio
    : [];

  const lider = [...state.diretorias].sort(
    (a, b) => Number(b.somatorio_total || 0) - Number(a.somatorio_total || 0)
  )[0];

  const maiorPontuador = [...state.ranking].sort(
    (a, b) => Number(b.somatorio || 0) - Number(a.somatorio || 0)
  )[0];

  const topRetirada = [...state.topRetiradas].sort(
    (a, b) =>
      Number(b.quantidade_retirada_sacos_de_composto_organico || 0) -
      Number(a.quantidade_retirada_sacos_de_composto_organico || 0)
  )[0];

  const abaixo50 = faixas.find((item) => item.faixa_somatorio === "Abaixo de 50");
  const faixa50a99 = faixas.find((item) => item.faixa_somatorio === "50-99");
  const faixa100 = faixas.find((item) => item.faixa_somatorio === "100+");

  if (els.publicKpiParticipantes) {
    els.publicKpiParticipantes.textContent = formatInteger(kpis.total_participantes);
  }
  if (els.publicKpiDiretorias) {
    els.publicKpiDiretorias.textContent = formatInteger(kpis.total_diretorias);
  }
  if (els.publicKpiBroches) {
    els.publicKpiBroches.textContent = formatInteger(kpis.broches_entregues);
  }
  if (els.publicKpiMochilas) {
    els.publicKpiMochilas.textContent = formatInteger(kpis.mochilas_entregues);
  }
  if (els.publicKpiComposto) {
    els.publicKpiComposto.textContent = formatInteger(kpis.composto_retirado_total);
  }
  if (els.publicKpiEstoque) {
    els.publicKpiEstoque.textContent = formatInteger(kpis.estoque_composto_disponivel_max);
  }

  if (els.awardAbaixo50) {
    els.awardAbaixo50.textContent = formatInteger(abaixo50?.quantidade || 0);
  }
  if (els.award50a99) {
    els.award50a99.textContent = formatInteger(faixa50a99?.quantidade || 0);
  }
  if (els.award100mais) {
    els.award100mais.textContent = formatInteger(faixa100?.quantidade || 0);
  }

  if (els.highlightDiretoriaLider) {
    els.highlightDiretoriaLider.textContent = lider?.diretoria || "-";
  }
  if (els.highlightDiretoriaLiderText) {
    els.highlightDiretoriaLiderText.textContent = lider
      ? `${formatInteger(lider.participantes)} participantes e ${formatNumber(lider.somatorio_total)} pontos acumulados.`
      : "Sem dados de diretoria disponíveis.";
  }

  if (els.highlightMaiorPontuacao) {
    els.highlightMaiorPontuacao.textContent = formatNumber(maiorPontuador?.somatorio || 0);
  }
  if (els.highlightMaiorPontuacaoText) {
    els.highlightMaiorPontuacaoText.textContent = maiorPontuador
      ? `ID ${maiorPontuador.n_id} · ${maiorPontuador.diretoria}`
      : "Sem destaque individual disponível.";
  }

  if (els.highlightRetirada) {
    els.highlightRetirada.textContent = formatInteger(kpis.participantes_com_retirada || 0);
  }
  if (els.highlightRetiradaText) {
    els.highlightRetiradaText.textContent = topRetirada
      ? `Maior retirada atual: ID ${topRetirada.n_id} com ${formatInteger(
          topRetirada.quantidade_retirada_sacos_de_composto_organico
        )} sacos.`
      : "Sem registros de retirada disponíveis.";
  }
}

function renderManagementKPIs() {
  const rows = state.filteredRanking;
  const diretorias = state.filteredDiretorias;

  const participantes = rows.length;
  const totalDiretorias = uniqueSorted(rows.map((item) => item.diretoria)).length;
  const somatorioTotal = rows.reduce((acc, item) => acc + Number(item.somatorio || 0), 0);
  const somatorioMedio = participantes ? somatorioTotal / participantes : 0;
  const brochesEntregues = rows.filter(
    (item) => String(item.status_broche || "").toLowerCase() === "entregue"
  ).length;
  const mochilasEntregues = rows.filter(
    (item) => String(item.status_mochila || "").toLowerCase() === "entregue"
  ).length;
  const compostoRetirado = rows.reduce(
    (acc, item) => acc + Number(item.quantidade_retirada_sacos_de_composto_organico || 0),
    0
  );
  const participantesComRetirada = rows.filter(
    (item) => Number(item.quantidade_retirada_sacos_de_composto_organico || 0) > 0
  ).length;

  if (els.kpiParticipantes) els.kpiParticipantes.textContent = formatInteger(participantes);
  if (els.kpiDiretorias) els.kpiDiretorias.textContent = formatInteger(totalDiretorias);
  if (els.kpiSomatorioTotal) els.kpiSomatorioTotal.textContent = formatNumber(somatorioTotal);
  if (els.kpiSomatorioMedio) els.kpiSomatorioMedio.textContent = formatNumber(somatorioMedio);
  if (els.kpiBrochesEntregues) els.kpiBrochesEntregues.textContent = formatInteger(brochesEntregues);
  if (els.kpiMochilasEntregues) els.kpiMochilasEntregues.textContent = formatInteger(mochilasEntregues);
  if (els.kpiCompostoRetirado) els.kpiCompostoRetirado.textContent = formatInteger(compostoRetirado);
  if (els.kpiParticipantesComRetirada) {
    els.kpiParticipantesComRetirada.textContent = formatInteger(participantesComRetirada);
  }

  if (els.overviewBaseText) {
    els.overviewBaseText.textContent =
      `${formatInteger(participantes)} participantes e ${formatInteger(diretorias.length)} diretorias na leitura atual`;
  }
}

function renderManagementCharts() {
  const rows = state.filteredRanking;

  const distBroche = Array.isArray(state.data?.dist_broche)
    ? state.data.dist_broche.map((item) => ({
        label: item.status_broche,
        value: Number(item.quantidade || 0),
        color:
          item.status_broche === "Entregue"
            ? "#16a34a"
            : item.status_broche === "Pendente"
            ? "#d97706"
            : "#64748b",
        dotClass:
          item.status_broche === "Entregue"
            ? "chart-dot--green"
            : item.status_broche === "Pendente"
            ? "chart-dot--amber"
            : "chart-dot--muted"
      }))
    : [];

  const distMochila = Array.isArray(state.data?.dist_mochila)
    ? state.data.dist_mochila.map((item) => ({
        label: item.status_mochila,
        value: Number(item.quantidade || 0),
        color:
          item.status_mochila === "Entregue"
            ? "#16a34a"
            : item.status_mochila === "Pendente"
            ? "#d97706"
            : "#64748b",
        dotClass:
          item.status_mochila === "Entregue"
            ? "chart-dot--green"
            : item.status_mochila === "Pendente"
            ? "chart-dot--amber"
            : "chart-dot--muted"
      }))
    : [];

  renderPieChart(els.chartBroche, {
    centerValue: formatInteger(
      distBroche.find((item) => item.label === "Entregue")?.value || 0
    ),
    centerLabel: "entregues",
    slices: distBroche.map((item) => ({ value: item.value, color: item.color })),
    legend: distBroche.map((item) => ({
      label: item.label,
      value: formatInteger(item.value),
      dotClass: item.dotClass
    }))
  });

  renderPieChart(els.chartMochila, {
    centerValue: formatInteger(
      distMochila.find((item) => item.label === "Entregue")?.value || 0
    ),
    centerLabel: "entregues",
    slices: distMochila.map((item) => ({ value: item.value, color: item.color })),
    legend: distMochila.map((item) => ({
      label: item.label,
      value: formatInteger(item.value),
      dotClass: item.dotClass
    }))
  });

  renderBarList(
    els.chartFaixas,
    Array.isArray(state.data?.dist_faixa_somatorio)
      ? state.data.dist_faixa_somatorio.map((item) => [
          item.faixa_somatorio,
          Number(item.quantidade || 0)
        ])
      : [],
    "bar-item__fill--amber"
  );

  renderBarList(
    els.chartTop10,
    [...rows]
      .sort((a, b) => Number(b.somatorio || 0) - Number(a.somatorio || 0))
      .slice(0, 10)
      .map((item) => [
        `ID ${item.n_id} · ${item.diretoria}`,
        Number(item.somatorio || 0)
      ]),
    "bar-item__fill--green"
  );

  renderBarList(
    els.chartDiretorias,
    [...state.filteredDiretorias]
      .sort((a, b) => Number(b.somatorio_total || 0) - Number(a.somatorio_total || 0))
      .map((item) => [item.diretoria, Number(item.somatorio_total || 0)]),
    "bar-item__fill--blue"
  );

  renderBarList(
    els.chartComposto,
    [...state.topRetiradas].map((item) => [
      `ID ${item.n_id} · ${item.diretoria}`,
      Number(item.quantidade_retirada_sacos_de_composto_organico || 0)
    ]),
    "bar-item__fill--muted"
  );
}

function renderRankingTable() {
  if (!els.rankingTableBody) return;

  const rows = [...state.filteredRanking].sort(
    (a, b) => Number(a.posicao || 0) - Number(b.posicao || 0)
  );

  if (els.historyCount) {
    els.historyCount.textContent = `${formatInteger(rows.length)} registros`;
  }

  if (!rows.length) {
    els.rankingTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum participante encontrado para os filtros selecionados.</td>
      </tr>
    `;
    return;
  }

  els.rankingTableBody.innerHTML = rows
    .map((item) => {
      const broche = getStatusPill(item.status_broche);
      const mochila = getStatusPill(item.status_mochila);

      return `
        <tr>
          <td>${formatInteger(item.posicao)}</td>
          <td>${escapeHtml(`ID ${item.n_id}`)}</td>
          <td>${escapeHtml(item.diretoria || "-")}</td>
          <td>${formatNumber(item.somatorio || 0)}</td>
          <td><span class="${broche.className}">${escapeHtml(broche.text)}</span></td>
          <td><span class="${mochila.className}">${escapeHtml(mochila.text)}</span></td>
          <td>${formatInteger(item.quantidade_retirada_sacos_de_composto_organico || 0)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderDiretoriasTable() {
  if (!els.diretoriasTableBody) return;

  const rows = [...state.filteredDiretorias].sort(
    (a, b) => Number(b.somatorio_total || 0) - Number(a.somatorio_total || 0)
  );

  if (els.diretoriasCount) {
    els.diretoriasCount.textContent = `${formatInteger(rows.length)} diretorias`;
  }

  if (!rows.length) {
    els.diretoriasTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma diretoria encontrada para o filtro selecionado.</td>
      </tr>
    `;
    return;
  }

  els.diretoriasTableBody.innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.diretoria || "-")}</td>
          <td>${formatInteger(item.participantes || 0)}</td>
          <td>${formatNumber(item.somatorio_total || 0)}</td>
          <td>${formatNumber(item.somatorio_medio || 0)}</td>
          <td>${formatInteger(item.broches_entregues || 0)}</td>
          <td>${formatInteger(item.mochilas_entregues || 0)}</td>
          <td>${formatInteger(item.composto_retirado_total || 0)}</td>
        </tr>
      `
    )
    .join("");
}

function renderManagementLayer() {
  renderManagementKPIs();
  renderManagementCharts();
  renderRankingTable();
  renderDiretoriasTable();
}

async function loadData() {
  if (els.reciclaDbStatus) {
    els.reciclaDbStatus.textContent = "Lendo arquivo de dados do Recicla CEDAE...";
  }

  const response = await fetch("./data/recicla-premiacao-seed.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Não foi possível carregar data/recicla-premiacao-seed.json");
  }

  const json = await response.json();
  const rawRecords = extractSeedRecords(json);
  const normalizedRecords = rawRecords.map(normalizeRankingItem);
  const derived = buildDerivedData(normalizedRecords);

  state.data = derived;
  state.ranking = derived.ranking;
  state.diretorias = derived.por_diretoria;
  state.topRetiradas = derived.top_retiradas;
  state.filteredRanking = [...state.ranking];
  state.filteredDiretorias = [...state.diretorias];

  populateDiretoriaFilter();
  renderPublicLayer();
  renderManagementLayer();

  if (els.reciclaDbStatus) {
    els.reciclaDbStatus.textContent =
      `Base carregada com ${formatInteger(state.ranking.length)} participantes e ${formatInteger(
        state.diretorias.length
      )} diretorias.`;
  }
}

async function reloadData() {
  try {
    if (els.reciclaDbStatus) {
      els.reciclaDbStatus.textContent = "Recarregando base do Recicla CEDAE...";
    }

    await loadData();

    if (els.reciclaDbStatus) {
      els.reciclaDbStatus.textContent = "Base recarregada com sucesso.";
    }
  } catch (error) {
    console.error(error);

    if (els.reciclaDbStatus) {
      els.reciclaDbStatus.textContent = "Falha ao recarregar a base.";
    }
  }
}

function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });

  els.filterDiretoria?.addEventListener("change", applyFilters);
  els.filterFaixa?.addEventListener("change", applyFilters);

  els.clearFiltersBtn?.addEventListener("click", () => {
    if (els.filterDiretoria) els.filterDiretoria.value = "";
    if (els.filterFaixa) els.filterFaixa.value = "";
    applyFilters();
  });

  els.reloadDataBtn?.addEventListener("click", reloadData);
}

async function bootstrap() {
  try {
    bindEvents();
    await loadData();
  } catch (error) {
    console.error(error);

    if (els.reciclaDbStatus) {
      els.reciclaDbStatus.textContent = "Erro ao carregar a base do módulo Recicla CEDAE.";
    }

    if (els.overviewBaseText) {
      els.overviewBaseText.textContent = "Falha na leitura da base.";
    }
  }
}

bootstrap();