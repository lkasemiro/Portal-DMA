/**
 * ==========================================================================
 * RECICLA CEDAE FASE 2 - MOTOR DE CRÉDITOS, RANKINGS E DASHBOARDS R
 * Coordenação de Resíduos Sólidos · CEDAE · CRS 2026
 * ==========================================================================
 */

const state = {
  registros: [], kpis: {}, dadosReciclados: null, dadosMacro: null,
  dadosMediaMensal: null,
  // Guarda as instâncias ativas do ApexCharts para poder destruí-las
  // antes de recriar — evita o "donut fantasma" que aparece quando
  // renderCharts() roda mais de uma vez (ex: loadData chamado 2x,
  // F5 parcial via SPA router, etc). innerHTML = "" sozinho NÃO
  // desliga os observers internos do ApexCharts, só destroy() faz isso.
  chartInstances: {}
};
const BR_NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const BR_INTEGER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const PREMIOS = [
  { premio_id: "mochila", nome: "Mochila", custo_pontos: 100, estoque_inicial: 20, ativo: true },
  { premio_id: "tablet", nome: "Tablet", custo_pontos: 100, estoque_inicial: 3, ativo: true }
];

// Paleta de subcategorias recicláveis (mantida igual à já usada em produção)
const CORES_GRAFICO = { Metal: "#fffb00", Papel: "#3dade6", Plastico: "#e72f2f", Vidro: "#339433" };

// Paleta de macro-resíduos: roxo / laranja / ciano — propositalmente distinta
// da paleta de subcategorias, para deixar claro visualmente que são dois
// níveis de informação diferentes (alinhado ao que foi definido no relatório R).
const CORES_MACRO = { Organico: "#95b40a", Rejeito: "rgb(15, 93, 238)", Reciclavel: "#ffa90a" };

const els = {
  fase2DbStatus: document.getElementById("fase2DbStatus"),
  publicKpiParticipantes: document.getElementById("publicKpiParticipantes"),
  publicKpiPesoTotal: document.getElementById("publicKpiPesoTotal"),
  awardCatalog: document.getElementById("awardCatalog"),
  historicTop5Body: document.getElementById("historicTop5Body"),
  historicTop5Count: document.getElementById("historicTop5Count"),
  historicTop5Highlight: document.getElementById("historicTop5Highlight"),
  consultaForm: document.getElementById("consultaForm"),
  consultaId: document.getElementById("consultaId"),
  consultaResultado: document.getElementById("consultaResultado"),
  // Mini-gráficos de subcategorias (já existentes)
  grafico2024: document.getElementById("graficoPizza2024Sub"),
  grafico2025: document.getElementById("graficoPizza2025Sub"),
  // Mini-gráficos de macro-resíduos (novos, ficam lado a lado dos de sub)
  graficoMacro2024: document.getElementById("graficoPizza2024Macro"),
  graficoMacro2025: document.getElementById("graficoPizza2025Macro")
};

function formatNumber(value) { return BR_NUMBER.format(Number(value || 0)); }
function formatInteger(value) { return BR_INTEGER.format(Number(value || 0)); }
function escapeHtml(t) { return String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function extractRecords(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.registros)) return json.registros;
  return [];
}

function extractKpis(regs, dadosBrutos) {
  const totalPeso = dadosBrutos.reduce((a, b) => a + Number(b.Quantidade || 0), 0);
  return { total_participantes: regs.length, somatorio_total: totalPeso };
}

/* ==========================================================================
   RECICLA CEDAE — Ranking, Premiações e KPIs
   Substitui: renderHistoricTop5(), renderAwardCatalog(), renderKpis()
   ========================================================================== */

function renderKpis() {
  if (els.publicKpiParticipantes) {
    els.publicKpiParticipantes.textContent = formatInteger(state.kpis.total_participantes ?? 0);
  }
  if (els.publicKpiPesoTotal) {
    els.publicKpiPesoTotal.textContent = `${formatNumber(state.kpis.somatorio_total ?? 0)} kg`;
  }
}

/* --------------------------------------------------------------------------
   renderHistoricTop5
   — Pódio visual escalonado (1º maior, 2º médio, 3º menor)
   — Lista compacta (4º em diante) com barra verde proporcional
   — Injeta CSS na primeira chamada (flag _rankingCssInjetado)
   -------------------------------------------------------------------------- */
function renderHistoricTop5() {
  if (!els.historicTop5Body || !state.dadosDiretorias) return;

  _injetarCssRanking();

  const sorted = [...state.dadosDiretorias].sort((a, b) => b.pesoTotal - a.pesoTotal);
  const maxPeso = sorted[0]?.pesoTotal || 1;
  const top3    = sorted.slice(0, 3);
  const demais  = sorted.slice(3);

  /* --- Pódio ---
     order: 1=centro (1º), 0=esquerda (2º), 2=direita (3º)
     rc-p1 tem flex maior para ser visualmente mais largo/alto */
  const MEDALS  = ['🥇', '🥈', '🥉'];
  const POD_CLS = ['rc-pc rc-p1', 'rc-pc rc-p2', 'rc-pc rc-p3'];
  const BAR_CLS = ['rc-bg1', 'rc-bg2', 'rc-bg3'];

  const podiumHTML = `
    <div class="rc-podium">
      ${top3.map((dir, i) => {
        const pct = Math.round((dir.pesoTotal / maxPeso) * 100);
        return `
          <div class="${POD_CLS[i]}">
            ${i === 0 ? '<span class="rc-ldr">líder</span>' : ''}
            <span class="rc-medal">${MEDALS[i]}</span>
            <div class="rc-eyebrow">Diretoria</div>
            <div class="rc-pname">${escapeHtml(dir.diretoria)}</div>
            <div class="rc-pkg">${formatNumber(dir.pesoTotal)}<sup>kg</sup></div>
            <div class="rc-pppl">${dir.totalParticipantes} ${dir.totalParticipantes === 1 ? 'colaborador' : 'colaboradores'}</div>
            <div class="rc-bart"><div class="rc-barf ${BAR_CLS[i]}" data-pct="${pct}"></div></div>
          </div>`;
      }).join('')}
    </div>`;

  /* --- Lista (4º em diante) --- */
  const listaHTML = demais.length === 0 ? '' : `
    <div class="rc-sec-lbl">
      <i class="fa-solid fa-list-ol"></i> Classificação
    </div>
    <div class="rc-lista">
      ${demais.map((dir, i) => {
        const pct = Math.round((dir.pesoTotal / maxPeso) * 100);
        return `
          <div class="rc-row">
            <div class="rc-pos">${i + 4}º</div>
            <div class="rc-dir">
              <div class="rc-dn">DIRETORIA ${escapeHtml(dir.diretoria)}</div>
              <div class="rc-dp">
                <i class="fa-solid fa-users" style="font-size:10px"></i>
                ${dir.totalParticipantes} ${dir.totalParticipantes === 1 ? 'colaborador' : 'colaboradores'}
              </div>
            </div>
            <div class="rc-bw">
              <div class="rc-bt"><div class="rc-bf" data-pct="${pct}"></div></div>
            </div>
            <div class="rc-kg">${formatNumber(dir.pesoTotal)} kg</div>
          </div>`;
      }).join('')}
    </div>`;

  if (els.historicTop5Count) {
    els.historicTop5Count.textContent = `${state.dadosDiretorias.length} diretorias disputando`;
  }

  els.historicTop5Body.closest('table')
    ? _injetarForaTabela(els.historicTop5Body, podiumHTML + listaHTML)
    : (els.historicTop5Body.innerHTML = podiumHTML + listaHTML);

  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.rc-barf[data-pct], .rc-bf[data-pct]').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    }, 80);
  });
}

function _injetarForaTabela(tbody, html) {
  const table = tbody.closest('table');
  const wrapper = document.createElement('div');
  wrapper.id = 'historicTop5Body';
  wrapper.innerHTML = html;
  table.parentNode.replaceChild(wrapper, table);
  els.historicTop5Body = wrapper;
}

function renderAwardCatalog() {

  const top3 = [
    {
      nome: "Heitor Diogo da Silva",
      diretoria: "DFI",
      posicao: 1
    },
    {
      nome: "Lilian da Silva Braga",
      diretoria: "DPR",
      posicao: 2
    },
    {
      nome: "Paulo Cesar Sant Anna Rosa",
      diretoria: "DTP",
      posicao: 3
    }
  ];

  

  els.awardCatalog.innerHTML = `

    <div class="rc-premiacoes">

      <div class="rc-section-title">
        🏆 Pódio dos Campeões
      </div>

      <div class="rc-podio">

        <div class="rc-podio-card rc-prata">
          <div class="rc-medalha">🥈</div>
          <div class="rc-podio-nome">${top3[1].nome}</div>
          <div class="rc-podio-dir">${top3[1].diretoria}</div>
          <div class="rc-podio-premio">📱 Tablet</div>
        </div>

        <div class="rc-podio-card rc-ouro">
          <div class="rc-medalha">🥇</div>
          <div class="rc-podio-nome">${top3[0].nome}</div>
          <div class="rc-podio-dir">${top3[0].diretoria}</div>
          <div class="rc-podio-premio">📱 Tablet</div>
        </div>

        <div class="rc-podio-card rc-bronze">
          <div class="rc-medalha">🥉</div>
          <div class="rc-podio-nome">${top3[2].nome}</div>
          <div class="rc-podio-dir">${top3[2].diretoria}</div>
          <div class="rc-podio-premio">📱 Tablet</div>
        </div>

      </div>

      <div class="rc-awards-grid">

      <div class="rc-award-card">

        <h3>100 Pontos</h3>

        <p>
          Foram entregues 
          aos 20 primeiros participantes que alcançaram
          <strong>100 pontos</strong> uma <strong>Mochila personalizada</strong> do programa.
        </p>
      </div>

      <div class="rc-award-card">
        <h3>50 Pontos</h3>

        <p>
          Todos os participantes que alcançaram
          <strong>50 pontos</strong> receberam o
          Broche Oficial do Programa Recicla CEDAE.
        </p>
      </div>

    </div>
  `;
}

function _iniciarCarrossel() {
  const slides  = document.getElementById('rcSlides');
  const dots    = document.querySelectorAll('.rc-dot');
  const btnPrev = document.getElementById('rcPrev');
  const btnNext = document.getElementById('rcNext');
  if (!slides) return;

  let atual = 0;
  let timer = null;
  const total = dots.length;

  function irPara(idx) {
    atual = (idx + total) % total;
    slides.style.transform = `translateX(-${atual * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('rc-dot-ativo', i === atual));
  }

  function avancar() { irPara(atual + 1); }

  function iniciarAuto() {
    clearInterval(timer);
    timer = setInterval(avancar, 3500);
  }

  function pararAuto() { clearInterval(timer); }

  btnNext?.addEventListener('click', () => { avancar();          iniciarAuto(); });
  btnPrev?.addEventListener('click', () => { irPara(atual - 1); iniciarAuto(); });
  dots.forEach(d => d.addEventListener('click', () => { irPara(+d.dataset.idx); iniciarAuto(); }));

  const carr = document.getElementById('rcCarrossel');
  carr?.addEventListener('mouseenter', pararAuto);
  carr?.addEventListener('mouseleave', iniciarAuto);

  /* Swipe touch */
  let touchX = null;
  carr?.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  carr?.addEventListener('touchend', e => {
    if (touchX === null) return;
    const diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? avancar() : irPara(atual - 1);
    touchX = null;
    iniciarAuto();
  }, { passive: true });

  iniciarAuto();
}

/* --------------------------------------------------------------------------
   CSS — injetado uma única vez
   -------------------------------------------------------------------------- */
function _injetarCssRanking() {
  if (window._rankingCssInjetado) return;
  window._rankingCssInjetado = true;

  const css = `

/* ---- Label de seção ---- */
.rc-sec-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #000000;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 1.25rem 0 10px;
}
.rc-sec-lbl::after {
  content: '';
  flex: 1;
  height: 2px;
  background: linear-gradient(to right, #2db564, transparent);
  border-radius: 2px;
}

/* ---- Pódio ---- */
.rc-podium {
  display: flex;
  gap: 8px;
  align-items: flex-end;   /* ancora todos pela base — o padding-top cria a altura escalonada */
  margin-bottom: 1rem;
}

/* Base comum dos cards do pódio */
.rc-pc {
  border-radius: 12px;
  padding: 14px 13px 12px;
  position: relative;
  background: #ffffff;
  border: 1.5px solid #d4e8db;
  /* Largura proporcional à posição: 1º ocupa mais espaço */
  flex: 1;
}

/* 1º lugar — centro, maior, borda verde forte */
.rc-p1 {
  order: 2;
  flex: 1.35;
  border-color: #e7d429;
  padding-top: 30px;        /* empurra o conteúdo pra baixo, tornando o card visualmente mais alto */
}

/* 2º lugar — esquerda, tamanho médio */
.rc-p2 {
  order: 1;
  flex: 1.1;
  border-color: #604a9b;
  padding-top: 18px;
}

/* 3º lugar — direita, menor */
.rc-p3 {
  order: 3;
  flex: 0.9;
  border-color: #604a9b;
  padding-top: 8px;
}

/* Badge "líder" flutuante no 1º */
.rc-ldr {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  background: #e7d429;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
  padding: 3px 14px;
  border-radius: 20px;
  white-space: nowrap;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.rc-medal   { font-size: 22px; display: block; margin-bottom: 6px; }
.rc-eyebrow { font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase; color: #5a9c7a; margin-bottom: 2px; }
.rc-pname   { font-size: 15px; font-weight: 800; color: #0091d8; margin-bottom: 6px; line-height: 1.2; }
.rc-pkg     { font-size: 20px; font-weight: 800; color: #1a6b3c; margin-bottom: 2px; }
.rc-pkg sup { font-size: 11px; color: #5a9c7a; font-weight: 600; margin-left: 3px; }
.rc-pppl    { font-size: 11px; color: #7ab899; margin-bottom: 10px; }

/* Barra de progresso do pódio */
.rc-bart { height: 5px; background: #e8f5ee; border-radius: 3px; overflow: hidden; }
.rc-barf { height: 100%; border-radius: 3px; transition: width 0.9s cubic-bezier(.4,0,.2,1); width: 0%; }
.rc-bg1  { background: #309218; }   /* 1º — verde escuro */
.rc-bg2  { background: #dac930; }   /* 2º — verde médio */
.rc-bg3  { background: #e27d3a; }   /* 3º — verde claro */

/* ---- Lista (4º em diante) ---- */
.rc-lista { display: flex; flex-direction: column; gap: 5px; }
.rc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #ffffff;
  border: 1px solid #d4e8db;
  border-radius: 8px;
  transition: border-color .15s, background .15s;
}
.rc-row:hover { border-color: #2db564; background: #f2fbf6; }

.rc-pos  { font-size: 13px; font-weight: 700; color: #5a9c7a; width: 22px; text-align: center; flex-shrink: 0; }
.rc-dir  { flex: 1; min-width: 0; }
.rc-dn   { font-size: 13px; font-weight: 700; color: #0d3d22; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-dp   { font-size: 11px; color: #7ab899; margin-top: 1px; }

/* Barra proporcional — container largo para mostrar a diferença entre diretorias */
.rc-bw   { flex: 1; min-width: 60px; max-width: 160px; flex-shrink: 0; }
.rc-bt   { height: 6px; background: #e8f5ee; border-radius: 3px; overflow: hidden; }
.rc-bf   {
  height: 100%;
  background: linear-gradient(to right, #e04747, #fae151);
  border-radius: 3px;
  transition: width 0.9s cubic-bezier(.4,0,.2,1);
  width: 0%;
}

.rc-kg   { font-size: 13px; font-weight: 700; color: #000000; white-space: nowrap; flex-shrink: 0; text-align: right; min-width: 80px; }

/* ---- Layout award: premiações + carrossel lado a lado ---- */
.rc-award-wrap {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 14px;
  align-items: stretch;
}
@media (max-width: 560px) {
  .rc-award-wrap { grid-template-columns: 1fr; }
}

/* ---- Premiações compactas (coluna esquerda) ---- */
.rc-premios-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rc-premio-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #ffffff;
  border: 1.5px solid #d4e8db;
  border-radius: 10px;
  padding: 10px 12px;
  flex: 1;
}
.rc-premio-destaque { border-color: #e8c97a; background: #fffdf5; }
.rc-pr-pts  { font-size: 13px; font-weight: 800; color: #0d3d22; margin-bottom: 1px; }
.rc-pr-desc { font-size: 11px; color: #5a9c7a; margin-bottom: 4px; line-height: 1.4; }
.rc-ptag    { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 9px; border-radius: 20px; letter-spacing: 0.4px; }
.rc-t1 { background: #e8f5ee; color: #1a6b3c; }
.rc-t2 { background: #d4f0e0; color: #0d4a28; }
.rc-t3 { background: #fff3dc; color: #7a4e00; }

/* ---- Carrossel (coluna direita) ---- */
.rc-carrossel-col { min-width: 0; }
.rc-carrossel {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #0d3d22;
  height: 200px;
  cursor: grab;
}
.rc-carrossel:active { cursor: grabbing; }
.rc-slides {
  display: flex;
  height: 100%;
  transition: transform 0.5s cubic-bezier(.4,0,.2,1);
}
.rc-slide {
  min-width: 100%;
  height: 100%;
  flex-shrink: 0;
}
.rc-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
  user-select: none;
}

/* Botões prev/next */
.rc-carr-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(13,61,34,0.65);
  border: none;
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: background .2s;
  z-index: 2;
}
.rc-carr-btn:hover { background: rgba(13,61,34,0.9); }
.rc-carr-prev { left: 8px; }
.rc-carr-next { right: 8px; }

/* Dots */
.rc-carr-dots {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 5px;
  z-index: 2;
}
.rc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: background .3s, transform .3s;
}
.rc-dot-ativo {
  background: #2db564;
  transform: scale(1.3);
}

  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
function bindConsulta() {
  if (!els.consultaForm) return;
  els.consultaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = String(els.consultaId?.value || "").trim();
    const part = state.registros.find(r => String(r.n_id) === id);

    if (!els.consultaResultado) return;
    if (!part) {
      els.consultaResultado.innerHTML = `<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; border-radius: 8px; padding: 14px; color: #ef4444; font-size: 0.8rem; text-align: center;"><strong>ID não localizado!</strong> Verifique os dados ou contate a CRS.</div>`;
      return;
    }

    els.consultaResultado.innerHTML = `
      <div style="background: rgba(255,255,255,0.15); border: 1px solid var(--verde-sustentavel); border-radius: 8px; padding: 14px; color: #fff;">
        <strong style="font-size: 0.95rem; color: var(--verde-sustentavel); display:block; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">ID: ${escapeHtml(part.n_id)}</strong>
        <p style="margin: 4px 0; font-size: 0.8rem;"><strong>Diretoria:</strong> ${escapeHtml(part.diretoria)}</p>
        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem;">Pesagens Acumuladas:</span>
          <strong style="font-size: 1.2rem; color: var(--verde-sustentavel);">${formatNumber(part.somatorio)} kg</strong>
        </div>
      </div>`;
  });
}

/**
 * Agrega os registros de subcategorias (papel/plástico/metal/vidro)
 * de data/dados_reciclados.json para um ano específico.
 *
 * Usa o campo ISO `data` (ex: "2024-01-01") em vez de `Data.endsWith(sufixo)`,
 * que é mais robusto: o sufixo de string podia colidir com qualquer
 * outro campo terminado nos mesmos dois dígitos.
 */
function prepararDadosOrigemR(dados, anoFiltro) {
  let totaisMaterial = { Papel: 0, Plastico: 0, Metal: 0, Vidro: 0 };
  let totalAno = 0;

  dados.forEach(r => {
    const dataIso = String(r.data || r.Data_fpa || "");
    const matCamp = String(r.Material || "Papel");
    const qtdCamp = Number(r.Quantidade || 0);

    if (dataIso.startsWith(String(anoFiltro))) {
      if (/papel/i.test(matCamp)) totaisMaterial.Papel += qtdCamp;
      else if (/plastico|pl[aá]stico/i.test(matCamp)) totaisMaterial.Plastico += qtdCamp;
      else if (/metal/i.test(matCamp)) totaisMaterial.Metal += qtdCamp;
      else if (/vidro/i.test(matCamp)) totaisMaterial.Vidro += qtdCamp;

      totalAno += qtdCamp;
    }
  });

  const categorias = ['Papel', 'Plastico', 'Metal', 'Vidro'];

  let porcentagensRelativas = categorias.map(mat => {
    if (totalAno === 0) return 0;
    return (totaisMaterial[mat] / totalAno) * 100;
  });

  let valoresReais = categorias.map(mat => totaisMaterial[mat]);

  return {
    porcentagensRelativas,
    valoresReais,
    labels: categorias,
    totalAno
  };
}

/**
 * Extrai os totais de macro-resíduos (Orgânico / Rejeito / Reciclável)
 * de data/dados_reciclagem.json para um ano específico.
 *
 * Essa fonte vem dos totais já auditados a partir da planilha original
 * (Excel), em vez de derivar de dados_reciclados.json — que cobre só
 * as 4 subcategorias recicláveis, não Orgânico/Rejeito.
 */
function prepararDadosMacro(dadosMacroJson, anoFiltro) {
  const labelsOrdem = ['Organico', 'Rejeito', 'Reciclavel'];
  const itensAno = (dadosMacroJson?.dados_macro || []).filter(i => String(i.Ano) === String(anoFiltro));

  const totaisPorTipo = {};
  itensAno.forEach(i => { totaisPorTipo[i.Tipo] = Number(i.Total || 0); });

  const valoresReais = labelsOrdem.map(tipo => totaisPorTipo[tipo] ?? 0);
  const totalAno = valoresReais.reduce((a, b) => a + b, 0);

  return {
    valoresReais,
    labels: labelsOrdem,
    totalAno
  };
}

/**
 * Monta a configuração base de um mini-gráfico de pizza ApexCharts.
 * Compartilhada entre os gráficos de macro-resíduos e subcategorias,
 * variando cores, rótulos e valores.
 */
function obterBlueprintR(dataset, tituloAno, coresOrdenadas) {
  return {
    chart: {
      type: 'pie',
      height: 260,
      fontFamily: 'inherit'
    },
    colors: coresOrdenadas,
    series: dataset.valoresReais,
    labels: dataset.labels,
    stroke: {
      show: true,
      width: 2,
      colors: ['#ffffff']
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '11px',
      labels: { colors: '#334155' },
      markers: { radius: 12 },
      itemMargin: { horizontal: 6, vertical: 2 },
      // Mostra a porcentagem junto do nome da categoria na legenda,
      // em vez de deixar o percentual só dentro da fatia.
      formatter: function (seriesName, opts) {
        const idx = opts.seriesIndex;
        const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
        const valor = opts.w.globals.series[idx];
        const pct = total > 0 ? (valor / total) * 100 : 0;
        return `${seriesName} (${pct.toFixed(1)}%)`;
      }
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      y: {
        formatter: (val) => `${formatNumber(val)} kg`
      }
    },
    // O pie não tem "centro" como o donut, então o total em kg —
    // que antes ficava no meio do anel — passa a aparecer como
    // subtítulo acima do gráfico.
    title: {
      text: `${tituloAno} · ${formatNumber(dataset.totalAno)} kg`,
      align: 'center',
      style: {
        fontSize: '12px',
        fontWeight: 700,
        color: '#1d3557'
      }
    }
  };
}

/**
 * Cria (ou recria) um donut ApexCharts numa div, destruindo com segurança
 * qualquer instância anterior montada nessa mesma chave antes de criar
 * a nova. Isso é o que de fato previne o "donut fantasma" sobreposto:
 * innerHTML = "" remove os elementos da tela, mas não chama o cleanup
 * interno do ApexCharts (listeners de resize, animações em andamento),
 * então uma segunda chamada de renderCharts() pode deixar uma instância
 * órfã desenhando por baixo da nova.
 */
function montarChart(chaveInstancia, elemento, config) {
  if (!elemento) return;

  const instanciaAnterior = state.chartInstances[chaveInstancia];
  if (instanciaAnterior) {
    try {
      instanciaAnterior.destroy();
    } catch (e) {
      // Instância já pode ter sido destruída/desmontada — seguro ignorar.
    }
    state.chartInstances[chaveInstancia] = null;
  }

  // Limpa qualquer resíduo de DOM (ex: de uma renderização anterior
  // a esta correção, antes de existir o tracking de instâncias).
  elemento.innerHTML = "";

  const novaInstancia = new ApexCharts(elemento, config);
  state.chartInstances[chaveInstancia] = novaInstancia;
  novaInstancia.render();
}

function renderCharts() {
  const temSub = els.grafico2024 && els.grafico2025 && state.dadosReciclados;
  const temMacro = els.graficoMacro2024 && els.graficoMacro2025 && state.dadosMacro;

  if (!temSub && !temMacro) return;

  // ---------- Subcategorias recicláveis (Papel/Plástico/Metal/Vidro) ----------
  if (temSub) {
    const datasetSub2024 = prepararDadosOrigemR(state.dadosReciclados, "2024");
    const datasetSub2025 = prepararDadosOrigemR(state.dadosReciclados, "2025");

    const coresSub = [CORES_GRAFICO.Papel, CORES_GRAFICO.Plastico, CORES_GRAFICO.Metal, CORES_GRAFICO.Vidro];

    try {
      montarChart("sub2024", els.grafico2024, obterBlueprintR(datasetSub2024, "Reciclável 2024", coresSub));
      montarChart("sub2025", els.grafico2025, obterBlueprintR(datasetSub2025, "Reciclável 2025", coresSub));
    } catch (error) {
      console.error("Erro ao renderizar gráficos de subcategorias:", error);
    }
  }

  // ---------- Macro-resíduos (Orgânico/Rejeito/Reciclável) ----------
  if (temMacro) {
    const datasetMacro2024 = prepararDadosMacro(state.dadosMacro, "2024");
    const datasetMacro2025 = prepararDadosMacro(state.dadosMacro, "2025");

    const coresMacro = [CORES_MACRO.Organico, CORES_MACRO.Rejeito, CORES_MACRO.Reciclavel];

    try {
      montarChart("macro2024", els.graficoMacro2024, obterBlueprintR(datasetMacro2024, "Geral 2024", coresMacro));
      montarChart("macro2025", els.graficoMacro2025, obterBlueprintR(datasetMacro2025, "Geral 2025", coresMacro));
    } catch (error) {
      console.error("Erro ao renderizar gráficos de macro-resíduos:", error);
    }
  }

  adicionarCaptionEstilizado();
  renderTabelaMediaMensal();
}

function adicionarCaptionEstilizado() {
  const containerId = "dashboardInsightCaption";
  let capEl = document.getElementById(containerId);

  const containerPai =
    els.grafico2024?.closest(".graficos-pizza-grid") ||
    els.grafico2024?.parentElement;

  if (!capEl && containerPai) {
    capEl = document.createElement("div");
    capEl.id = containerId;
    capEl.className = "dashboard-insight";
    containerPai.appendChild(capEl);
  }

  if (capEl) {
    capEl.innerHTML = `
      <div class="dashboard-insight__header">
        <i class="fa-solid fa-chart-line"></i>
        <span>EVOLUÇÃO HISTÓRICA DA COLETA SELETIVA</span>
      </div>

      <div class="dashboard-insight__subtitle">
        Análise comparativa da geração geral e da composição dos materiais reciclados (2024–2025)
      </div>

      <div class="dashboard-insight__content">
        Em 2024, a operação era sustentada predominantemente pelo papel reciclável.
        Em 2025, observa-se uma evolução significativa da diversidade dos materiais
        coletados, especialmente a partir de agosto, marcada pela incorporação do
        vidro nas métricas do programa.
      </div>
    `;
  }
}

/**
 * Constrói uma única linha <tr> da tabela de geração média mensal,
 * com 4 colunas por categoria (Total, Meses, Média/mês, % do ano).
 * O bloco de 4 colunas é destacado em âmbar quando o número de meses
 * com dado é menor que o esperado (12 para 2024, 10 para 2025) — sinal
 * de que a média ali é calculada sobre uma base menor, conforme
 * apurado na planilha de origem (ex: Rejeito 2024 só tem 4 meses).
 */
function construirLinhaMediaMensal(ano, itensCategoria, mesesEsperados) {
  const celulas = itensCategoria.map(item => {
    const incompleto = item.mesesPreenchidos < mesesEsperados;
    const estiloDestaque = incompleto
      ? 'background: #fff3cd;'
      : '';
    const pctDoAno = item._pctDoAno != null ? `${item._pctDoAno.toFixed(1)}%` : "—";

    return `
      <td style="text-align:right; padding:10px 12px; border-bottom:1px solid #f1f5f9; ${estiloDestaque}">
        ${formatNumber(item._total)} kg
      </td>
      <td style="text-align:center; padding:10px 12px; border-bottom:1px solid #f1f5f9; ${estiloDestaque}">
        ${item.mesesPreenchidos}${incompleto ? ' <span title="Meses sem dado na planilha de origem" style="color:#b45309; cursor:help;">⚠</span>' : ''}
      </td>
      <td style="text-align:right; padding:10px 12px; border-bottom:1px solid #f1f5f9; ${estiloDestaque}">
        ${formatNumber(item.mediaMensal)} kg
      </td>
      <td style="text-align:right; padding:10px 12px; border-bottom:1px solid #f1f5f9; font-weight:700; color:var(--azul-cedae); ${estiloDestaque}">
        ${pctDoAno}
      </td>
    `;
  }).join("");

  return `<tr><td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; font-weight:800; color:#0f172a;">${ano}</td>${celulas}</tr>`;
}

/**
 * Monta o <table> completo (cabeçalho com spanners por categoria + corpo)
 * para um nível (macro ou sub), reaproveitado pelas duas tabelas.
 */
function construirTabelaMediaMensal(titulo, subtitulo, categorias, dadosPorAno, anosEsperados) {
  // O JSON de origem (media_mensal_reciclagem.json) não traz um campo
  // "Total" pronto — só valoresMensais (array com null nos meses sem
  // dado), mesesPreenchidos e mediaMensal. O total da categoria/ano é
  // a soma dos valores mensais reais (mais preciso que mediaMensal *
  // mesesPreenchidos, que acumularia erro de arredondamento).
  Object.entries(dadosPorAno).forEach(([ano, itens]) => {
    itens.forEach(i => {
      i._total = (i.valoresMensais || []).reduce((acc, v) => acc + (v ?? 0), 0);
    });
    const totalAno = itens.reduce((acc, i) => acc + i._total, 0);
    itens.forEach(i => { i._pctDoAno = totalAno > 0 ? (i._total / totalAno) * 100 : 0; });
  });

  const cabecalhoSpanners = categorias.map(cat => `
    <th colspan="4" style="text-align:center; padding:8px 12px; border-bottom:1px solid #e2e8f0; border-left:1px solid #f1f5f9; font-size:0.78rem; color:#1d3557; font-weight:800;">
      ${cat.label}
    </th>
  `).join("");

  const cabecalhoSub = categorias.map(() => `
    <th style="text-align:right; padding:6px 12px; font-size:0.68rem; color:#64748b; font-weight:700; border-left:1px solid #f1f5f9;">Total</th>
    <th style="text-align:center; padding:6px 12px; font-size:0.68rem; color:#64748b; font-weight:700;">Meses</th>
    <th style="text-align:right; padding:6px 12px; font-size:0.68rem; color:#64748b; font-weight:700;">Média/mês</th>
    <th style="text-align:right; padding:6px 12px; font-size:0.68rem; color:#64748b; font-weight:700;">% do ano</th>
  `).join("");

  const linhas = Object.entries(dadosPorAno).map(([ano, itensTodos]) => {
    // Ordena os itens da linha na mesma ordem das colunas do cabeçalho
    const itensOrdenados = categorias.map(cat => itensTodos.find(i => i.Tipo === cat.tipo));
    return construirLinhaMediaMensal(ano, itensOrdenados, anosEsperados[ano]);
  }).join("");

  return `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:16px; overflow-x:auto;">
      <h4 style="margin:0 0 2px; font-size:0.95rem; color:#1d3557; font-weight:800;">${titulo}</h4>
      <p style="margin:0 0 12px; font-size:0.75rem; color:#64748b;">${subtitulo}</p>
      <table style="width:100%; border-collapse:collapse; min-width:560px;">
        <thead>
          <tr><th></th>${cabecalhoSpanners}</tr>
          <tr><th style="text-align:left; padding:6px 12px; font-size:0.68rem; color:#64748b; font-weight:700;">Ano</th>${cabecalhoSub}</tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
     
    </div>
  `;
}

/**
 * Renderiza as duas tabelas de geração média mensal (Macro-resíduos e
 * Subcategorias) usando data/media_mensal_reciclagem.json, e injeta o
 * bloco resultante logo abaixo da grade de gráficos de pizza.
 */
function renderTabelaMediaMensal() {
  if (!state.dadosMediaMensal) return;

  const containerId = "tabelaMediaMensalContainer";
  let container = document.getElementById(containerId);

  // O grid de gráficos (.graficos-pizza-grid) é o ponto de referência:
  const gridGraficos = els.grafico2024?.closest(".graficos-pizza-grid");

  if (!container && gridGraficos) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.cssText = "margin-top: 24px;";
    gridGraficos.insertAdjacentElement("afterend", container);
  }
  if (!container) return;

  const { media_macro, media_sub } = state.dadosMediaMensal;

  const categoriasMacro = [
    { tipo: "Rejeito", label: "Rejeito" },
    { tipo: "Organico", label: "Orgânico" },
    { tipo: "Reciclavel", label: "Reciclável" }
  ];
  const categoriasSub = [
    { tipo: "Papel", label: "Papel" },
    { tipo: "Plastico", label: "Plástico" },
    { tipo: "Metal", label: "Metal" },
    { tipo: "Vidro", label: "Vidro" }
  ];
  const anosEsperados = { "2024": 12, "2025": 10 };

  // CORREÇÃO: Passando o subtítulo correto e ordenando os dados e categorias
  const htmlMacro = construirTabelaMediaMensal(
    "Macro-resíduos",
    "Visão consolidada por grandes grupos de descarte", // subtitulo adicionado
    categoriasMacro,                                   // categorias
    media_macro,                                       // dadosPorAno
    anosEsperados                                      // anosEsperados
  );

  // CORREÇÃO: Passando o subtítulo correto e ordenando os dados e categorias
  const htmlSub = construirTabelaMediaMensal(
    "Subcategorias Recicláveis",
    "Detalhamento dos materiais triados no fluxo reciclável", // subtitulo adicionado
    categoriasSub,                                            // categorias
    media_sub,                                                // dadosPorAno
    anosEsperados                                             // anosEsperados
  );

  container.innerHTML = `
    <h3 style="margin:0 0 4px; font-size:1.05rem; color:#1d3557; font-weight:800;">
      <i class="fa-solid fa-table"></i> Geração Média Mensal
    </h3>
    <p style="margin:0 0 14px; font-size:0.78rem; color:#64748b;">
      Média calculada apenas sobre os meses com dado preenchido em cada ano.
    </p>
    ${htmlMacro}
    ${htmlSub}
  `;
}


function processarRegistrosDoConsolidado(dados) {
  let agrupadoParticipantes = {};
  let agrupadoDiretorias = {};

  dados.forEach(item => {
    const id = String(item.n_id || item.id || "");
    if (!id) return;

    // Normaliza a diretoria (ex: "DFI", "DSG")
    const diretoria = String(item.diretoria || "DMA / CRS").toUpperCase().trim();
    const quantidade = Number(item.Quantidade || 0);
    const nome = item["Nome do Participante:"] || item.nome || `Participante ${id}`;

    // 1. Agrupamento por Participante (Para uso na busca de crachá se necessário)
    if (!agrupadoParticipantes[id]) {
      agrupadoParticipantes[id] = { n_id: id, nome: nome, diretoria: diretoria, somatorio: 0 };
    }
    agrupadoParticipantes[id].somatorio += quantidade;

    // 2. Agrupamento por Diretoria (Métrica Solicitada)
    if (!agrupadoDiretorias[diretoria]) {
      agrupadoDiretorias[diretoria] = {
        nomeDiretoria: diretoria,
        pesoTotal: 0,
        participantesUnicos: new Set() // Armazena IDs únicos para contar o tamanho da equipe
      };
    }
    agrupadoDiretorias[diretoria].pesoTotal += quantidade;
    agrupadoDiretorias[diretoria].participantesUnicos.add(id);
  });

  // Guardamos a lista de diretorias processada no state para o render do ranking usar
  state.dadosDiretorias = Object.values(agrupadoDiretorias).map(d => ({
    diretoria: d.nomeDiretoria,
    pesoTotal: d.pesoTotal,
    totalParticipantes: d.participantesUnicos.size
  }));

  return Object.values(agrupadoParticipantes);
}

async function loadData() {
  // Trava de concorrência: se loadData() já estiver em andamento, ignora a chamada.
  if (state._loadingEmAndamento) return;
  state._loadingEmAndamento = true;

  try {
    // Executa as requisições em paralelo para máxima performance.
    const [resConsolidado, resPesagens, resMacro, resMediaMensal] = await Promise.all([
      fetch("data/dados_reciclados.json"),
      fetch("data/dados_pesagens.json"),
      fetch("data/dados_reciclagem.json"),
      fetch("data/media_mensal_reciclagem.json")
    ]);

    // 1. Carrega os dados históricos de subcategorias para os gráficos do R
    const jsonConsolidado = extractRecords(await resConsolidado.json());
    state.dadosReciclados = jsonConsolidado;

    // 2. Carrega os totais de macro-resíduos (Orgânico/Rejeito/Reciclável)
    state.dadosMacro = await resMacro.json();

    // 3. Carrega a granularidade mensal para a tabela de média mensal
    state.dadosMediaMensal = await resMediaMensal.json();

    // 4. Carrega as pesagens individuais para os Rankings e KPIs de engajamento
    const jsonPesagens = extractRecords(await resPesagens.json());
    
    // Processa os participantes e pesos agregados com base no arquivo de pesagens
    state.registros = processarRegistrosDoConsolidado(jsonPesagens);
    state.kpis = extractKpis(state.registros, jsonPesagens);

    // Dispara as renderizações isoladas por contexto de dados
    renderKpis();
    renderAwardCatalog();
    renderHistoricTop5();
    renderCharts();
    
  } catch (err) {
    // O bloco 'catch' foi esvaziado intencionalmente para não exibir nenhum erro na tela ou no console
  } finally {
    state._loadingEmAndamento = false;
  }
}

document.addEventListener("DOMContentLoaded", () => { loadData(); bindConsulta(); });