// server/routes/aedes.js
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

export default router;