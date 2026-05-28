
import express from "express";

import {
  criarPost,
  listarPostsPublicados,
  buscarPostPorId,
  atualizarPost,
  deletarPost
}
from "../controllers/postController.js";

import { upload }
from "../middleware/upload.js";

const router = express.Router();


/* =========================================================
   POSTS
========================================================= */

router.post(
  "/",
  upload.single("file"),
  criarPost
);

router.get(
  "/publicados",
  listarPostsPublicados
);

router.get(
  "/:id",
  buscarPostPorId
);

router.put(
  "/:id",
  upload.single("file"),
  atualizarPost
);

router.delete(
  "/:id",
  deletarPost
);

export default router;

