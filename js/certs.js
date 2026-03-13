const AedesCerts = (() => {
  const MONTHS = [
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatLongDate(date = new Date()) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function buildCertificateHTML({ unidadeNome, ano, mes, total }) {
    const mesNome = MONTHS[mes] || "";
    const dataGeracao = formatLongDate();

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificado - ${escapeHtml(unidadeNome)}</title>
  <style>
    :root {
      --blue: #0b3d91;
      --blue-dark: #072b66;
      --text: #142033;
      --text-soft: #42536a;
      --border: #d6e0ef;
      --gold: #c79a2b;
      --sheet-w: 297mm;
      --sheet-h: 210mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #f3f6fb;
      color: var(--text);
      font-family: "Segoe UI", Arial, sans-serif;
    }

    body {
      padding: 12px;
    }

    .page-actions {
      max-width: 297mm;
      margin: 0 auto 10px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .page-actions button {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      font: inherit;
      cursor: pointer;
      background: var(--blue);
      color: white;
    }

    .certificate-sheet {
      width: var(--sheet-w);
      height: var(--sheet-h);
      margin: 0 auto;
      background: white;
      position: relative;
      overflow: hidden;
      box-shadow: 0 12px 30px rgba(11, 61, 145, 0.14);
      border: 7px solid var(--blue);
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .certificate-sheet::before {
      content: "";
      position: absolute;
      inset: 10mm;
      border: 1.5px solid var(--gold);
      pointer-events: none;
    }

    .certificate-topbar {
      background: linear-gradient(135deg, var(--blue-dark) 0%, var(--blue) 100%);
      color: white;
      padding: 8mm 12mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .brand-block {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.2);
      font-weight: 700;
      letter-spacing: 0.08em;
      font-size: 0.9rem;
      flex: 0 0 auto;
    }

    .brand-text small {
      display: block;
      opacity: 0.84;
      font-size: 0.72rem;
      margin-bottom: 2px;
    }

    .brand-text strong {
      display: block;
      font-size: 1.08rem;
      line-height: 1.15;
    }

    .certificate-badge {
      text-align: right;
      font-size: 0.78rem;
      line-height: 1.35;
      max-width: 90mm;
    }

    .certificate-content {
      padding: 10mm 16mm 8mm;
      display: flex;
      flex-direction: column;
      height: calc(var(--sheet-h) - 60px);
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .eyebrow {
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--blue);
      font-size: 0.7rem;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .title {
      text-align: center;
      font-size: 1.9rem;
      color: var(--blue-dark);
      margin: 0 0 4px;
      letter-spacing: 0.02em;
      line-height: 1.1;
    }

    .subtitle {
      text-align: center;
      font-size: 0.84rem;
      color: var(--text-soft);
      margin: 0 0 12px;
      line-height: 1.3;
    }

    .cert-body {
      max-width: 230mm;
      margin: 0 auto;
      text-align: center;
      line-height: 1.5;
      font-size: 0.96rem;
      color: var(--text);
    }

    .cert-body p {
      margin: 0 0 9px;
    }

    .unit-name {
      display: inline-block;
      font-size: 1.45rem;
      color: var(--blue-dark);
      font-weight: 700;
      margin: 8px 0 10px;
      padding: 5px 12px 7px;
      border-bottom: 2px solid var(--gold);
      line-height: 1.2;
      max-width: 100%;
      word-break: break-word;
    }

    .highlight {
      color: var(--blue-dark);
      font-weight: 700;
    }

    .info-grid {
      margin: 12px auto 0;
      max-width: 210mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .info-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px;
      background: #f8fbff;
      min-height: 0;
    }

    .info-card span {
      display: block;
      color: var(--text-soft);
      font-size: 0.68rem;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-card strong {
      color: var(--blue-dark);
      font-size: 0.92rem;
      line-height: 1.25;
      word-break: break-word;
    }

    .certificate-footer {
      margin-top: auto;
      padding-top: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18mm;
      align-items: end;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .signature-block {
      text-align: center;
    }

    .signature-line {
      border-top: 1px solid #8ea2bf;
      padding-top: 6px;
      color: var(--text-soft);
      font-size: 0.78rem;
      line-height: 1.3;
    }

    .footer-note {
      margin-top: 10px;
      text-align: center;
      color: var(--text-soft);
      font-size: 0.72rem;
      line-height: 1.4;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @page {
      size: A4 landscape;
      margin: 0;
    }

    @media print {
      html, body {
        width: var(--sheet-w);
        height: var(--sheet-h);
        background: white;
      }

      body {
        padding: 0;
      }

      .page-actions {
        display: none !important;
      }

      .certificate-sheet {
        width: var(--sheet-w);
        height: var(--sheet-h);
        margin: 0;
        box-shadow: none;
        border-width: 7px;
      }
    }
  </style>
</head>
<body>
  <div class="page-actions">
    <button onclick="window.print()">Imprimir / Salvar em PDF</button>
  </div>

  <div class="certificate-sheet">
    <header class="certificate-topbar">
      <div class="brand-block">
        <img src="../assets/icon-192.png" style="width:55px;height:55px;object-fit:contain;" />
        <div class="brand-text">
          <small>Sistema de Gestão Ambiental</small>
          <strong>Portal DMA</strong>
        </div>
      </div>

      <div class="certificate-badge">
        <div>Programa de combate ao Aedes aegypti</div>
        <div>Certificado de conformidade mensal</div>
      </div>
    </header>

    <main class="certificate-content">
      <div class="eyebrow">Certificado institucional</div>
      <h1 class="title">Certificado de Conformidade</h1>
      <p class="subtitle">
        Controle de vistorias e acompanhamento preventivo
      </p>

      <div class="cert-body">
        <p>Certificamos que a unidade</p>

        <div class="unit-name">${escapeHtml(unidadeNome)}</div>

        <p>
          atendeu ao critério mínimo de vistorias estabelecido para o
          <span class="highlight">Programa de combate ao Aedes aegypti</span>,
          registrando <span class="highlight">${escapeHtml(total)} vistorias</span>
          no mês de <span class="highlight">${escapeHtml(mesNome)} de ${escapeHtml(ano)}</span>.
        </p>

        <p>
          Este certificado reconhece a conformidade da unidade no período informado,
          considerando a regra operacional vigente no módulo Aedes do Portal DMA.
        </p>
      </div>

      <section class="info-grid">
        <div class="info-card">
          <span>Unidade</span>
          <strong>${escapeHtml(unidadeNome)}</strong>
        </div>

        <div class="info-card">
          <span>Período</span>
          <strong>${escapeHtml(mesNome)} / ${escapeHtml(ano)}</strong>
        </div>

        <div class="info-card">
          <span>Total de vistorias</span>
          <strong>${escapeHtml(total)}</strong>
        </div>
      </section>

      <section class="certificate-footer">
        <div class="signature-block">
          <div class="signature-line">
            Departamento de Meio Ambiente
          </div>
        </div>

        <div class="signature-block">
          <div class="signature-line">
            Emissão gerada pelo Portal DMA
          </div>
        </div>
      </section>

      <div class="footer-note">
        Documento emitido em ${escapeHtml(dataGeracao)} pelo Sistema de Gestão Ambiental - Portal DMA.
      </div>
    </main>
  </div>
</body>
</html>
    `.trim();
  }

  function openPrintableCertificate(data) {
    const html = buildCertificateHTML(data);
    const win = window.open("", "_blank", "width=1280,height=900");

    if (!win) {
      throw new Error("Não foi possível abrir a janela do certificado.");
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
    return win;
  }

  return {
    openPrintableCertificate
  };
})();
