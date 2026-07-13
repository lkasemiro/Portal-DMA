// server/routes/aedes_routes.js
import express from "express";
import * as aedesController from "../controllers/aedesController.js";

const router = express.Router();

// Definição das sub-rotas vinculadas ao prefixo /api/aedes
router.get("/focais", aedesController.getFocais);
router.get("/focais/lista", aedesController.getFocaisLista);
router.get("/focais/login", aedesController.focalLogin);
router.get("/base", aedesController.getBase);
router.get("/certificados", aedesController.getCertificados);
router.post("/lotes", aedesController.criarLote);
router.get("/lotes", aedesController.getLotes);
router.get("/painel-dados", aedesController.getPainelDados);
router.get("/focal-dossie", aedesController.getFocalDossie);

// ========================================================
// NOVAS ROTAS - Consumindo as Views do Banco de Dados
// ========================================================
router.get("/resumo", aedesController.getResumoGeral);
router.get("/motivos-nao-vistoria", aedesController.getMotivosNaoVistoria);
router.get("/motivos-nao-remediacao", aedesController.getMotivosNaoRemediacao);
router.get("/vistas-unidades", aedesController.getEstatisticasUnidades);

export default router;