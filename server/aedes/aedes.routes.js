import { Router } from "express";
import * as aedesController from "./aedes.controller.js";

const router = Router();

// Painel Analítico e Métricas (Gráficos e KPIs)
router.get("/nao-enviados", aedesController.getAuditoriaSemanal);
router.get("/views/motivos-nao-vistoria", aedesController.getMotivosNaoVistoria);
router.get("/views/motivos-nao-remediacao", aedesController.getMotivosNaoRemediacao);
router.get("/views/locais-foco", aedesController.getLocaisFoco);
router.get("/resumo", aedesController.getResumoKPIs);
router.get("/painel-dados", aedesController.getPainelDados);

// Exportações de Relatórios
router.get("/export/csv", aedesController.exportCSV);
router.get("/export/pdf", aedesController.exportPDF);

// Gestão e Autenticação de Agentes Focais
router.get("/focais", aedesController.getFocaisAtivos);
router.get("/focais/lista", aedesController.getFocaisListaCompleta);
router.get("/focais/login", aedesController.loginFocal);

// Consulta e Bases Consolidadas
router.get("/base", aedesController.getBaseConsolidada);
router.get("/consolidado", aedesController.getHistoricoConsolidado);
router.get("/certificados", aedesController.getCertificados);

// Processamento de Carga Operacional (Lotes de Vistorias)
router.post("/lotes", aedesController.criarLoteVistorias);
router.get("/lotes", aedesController.listarLotes);

export default router;