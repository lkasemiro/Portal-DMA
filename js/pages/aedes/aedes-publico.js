// js/pages/aedes-publico.js

import { AedesAPI } from '../../modules/aedes/aedes-api.js';
import { openPrintableCertificate } from '../../modules/aedes/certs.js';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://dma-aedes-api.onrender.com';

let dadosCertificadoPendente = null;

const els = {
  certUnidade: document.getElementById('certUnidade'),
  certMes:     document.getElementById('certMes'),
  certAno:     document.getElementById('certAno'),
  checkBtn:    document.getElementById('checkCertificateBtn'),
  downloadBtn: document.getElementById('downloadCertificateBtn'),
  statusBar:   document.getElementById('statusBar'), // Referência para a barra de status
};

/* ── Função de Resposta Visual Animada ─────────────────── */

function mostrarFeedback(tipo, mensagem) {
  if (!els.statusBar) return;

  // Reseta classes para reiniciar animações CSS
  els.statusBar.className = 'status-bar'; 
  
  // Força um reflow para o navegador perceber que a classe foi removida (reinicia animação)
  void els.statusBar.offsetWidth; 

  els.statusBar.classList.add('show');
  els.statusBar.classList.add(tipo === 'sucesso' ? 'success' : 'error');
  
  const icone = tipo === 'sucesso' 
    ? '<i class="fas fa-check-circle status-icon"></i>' 
    : '<i class="fas fa-exclamation-circle status-icon"></i>';
  
  els.statusBar.innerHTML = `${icone} <span>${mensagem}</span>`;
}

/* ── Bootstrap: carrega unidades ───────────────────────── */

async function bootstrap() {
  try {
    const unidades = await AedesAPI.getUnidades();
    els.certUnidade.innerHTML =
      '<option value="">Selecione uma unidade...</option>' +
      unidades.map(u => `<option value="${u.unidade_id}">${u.nome_unidade}</option>`).join('');
  } catch (err) {
    console.error('Erro ao carregar unidades:', err);
    mostrarFeedback('error', 'Erro ao carregar lista de unidades.');
  }
}

/* ── Verificação ───────────────────────────────────────── */
async function verificarElegibilidade() {
  const selectElement = els.certUnidade;

  if (!selectElement.value) {
    mostrarFeedback('error', 'Por favor, selecione uma unidade operacional.');
    return;
  }

  const unidadeSelecionada = selectElement.options[selectElement.selectedIndex].text.trim().toUpperCase();
  const mesFiltro = parseInt(els.certMes.value);
  const anoFiltro = parseInt(els.certAno.value);

  try {
    // UI Loading state
    els.checkBtn.disabled = true;
    els.checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFICANDO...';
    els.statusBar.classList.remove('show'); // Esconde feedback anterior ao re-verificar

    const response = await fetch(`${API_BASE}/api/aedes/certificados`);
    if (!response.ok) throw new Error('Falha na comunicação com o servidor');

    const certificados = await response.json();

    // Procura o registro da unidade para o mês/ano selecionado
    const dadosUnidade = certificados.find(c =>
      c.unidade.trim().toUpperCase() === unidadeSelecionada &&
      parseInt(c.mes) === mesFiltro &&
      parseInt(c.ano) === anoFiltro
    );

    // 1. CAPTURA DAS CONDIÇÕES DA NOVA REGRA DE NEGÓCIO
    // (Ajuste o nome dessas chaves conforme o seu banco de dados retornar)
    const contadorVistorias    = dadosUnidade ? parseInt(dadosUnidade.total_vistorias) : 0;
    const cobriuTodasSemanas   = dadosUnidade ? !!dadosUnidade.cobertura_semanal_completa : false; // Deve ser true se inspecionou todas as semanas do mês
    const possuiFocosAbertos   = dadosUnidade ? !!dadosUnidade.focos_nao_remediados : true;       // Deve ser false se não tem foco ou se todos foram controlados

    // 2. VALIDAÇÃO LOGICA DA ELEGIBILIDADE
    // Elegível se: Cobriu todas as semanas do mês AND NÃO possui focos em aberto (sem remediação)
    const ehElegivel = cobriuTodasSemanas && !possuiFocosAbertos;

    if (ehElegivel) {
      dadosCertificadoPendente = {
        unidadeNome: selectElement.options[selectElement.selectedIndex].text,
        ano:   anoFiltro,
        mes:   mesFiltro,
        total: contadorVistorias,
      };
      
      mostrarFeedback('sucesso', `🏆 Unidade Protegida! Cobertura semanal completa e 100% dos focos tratados.`);
      ativarBotaoDownload(true);
    } else {
      dadosCertificadoPendente = null;
      
      // Monta uma mensagem de erro inteligente explicando o motivo da reprovação
      let mensagemErro = `⚠️ Unidade Inelegível: `;
      if (!cobriuTodasSemanas) {
        mensagemErro += `Não houve vistoria em todas as semanas do mês ou focos não foram remediados (Total: ${contadorVistorias}). `;
      } else if (possuiFocosAbertos) {
        mensagemErro += `Foram encontrados focos de Aedes que não constam como remediados no sistema.`;
      }

      mostrarFeedback('error', mensagemErro);
      ativarBotaoDownload(false);
    }
  } catch (err) {
    console.error('Erro na verificação:', err);
    mostrarFeedback('error', 'Erro ao consultar vistorias. Verifique sua conexão.');
  } finally {
    els.checkBtn.disabled = false;
    els.checkBtn.innerHTML = '<i class="fas fa-search"></i> VERIFICAR STATUS';
  }
}

/* ── Ativa/desativa botão de download ──────────────────── */

function ativarBotaoDownload(status) {
  if (!els.downloadBtn) return;
  
  els.downloadBtn.disabled = !status;
  
  if (status) {
    els.downloadBtn.classList.add('is-active');
  } else {
    els.downloadBtn.classList.remove('is-active');
  }
}

/* ── Listeners ─────────────────────────────────────────── */

els.checkBtn?.addEventListener('click', verificarElegibilidade);

els.downloadBtn?.addEventListener('click', () => {
  if (!dadosCertificadoPendente) return;
  try {
    openPrintableCertificate(dadosCertificadoPendente);
  } catch (err) {
    console.error('Erro ao abrir certificado:', err);
    mostrarFeedback('error', 'Erro ao gerar o PDF. Verifique os pop-ups do navegador.');
  }
});

/* ── Init ──────────────────────────────────────────────── */
bootstrap();