// server/posts/posts.routes.js - Rotas relacionadas a posts para o Portal DMA
import express from "express";

import {
  criarPost,
  listarPostsPublicados,
  buscarPostPorId,
  atualizarPost,
  deletarPost
} from "./posts.controller.js";

import { upload } from "./upload.js";

const router = express.Router();

/* =========================================================
   POSTS
========================================================= */

router.post("/", upload.single("file"), criarPost);
router.get("/publicados", listarPostsPublicados);
router.get("/:id", buscarPostPorId);
router.put("/:id", upload.single("file"), atualizarPost);
router.delete("/:id", deletarPost);

export default router;