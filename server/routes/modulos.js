
// server/routes/modulos.js

import express from "express";
import { pool } from "../js/db.js";

const router = express.Router();

/* =========================================================
   LISTAR TODOS OS MÓDULOS
========================================================= */

router.get(
  "/",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT
          id,
          nome,
          slug,
          descricao,
          icone,
          cor,
          ativo,
          criado_em
        FROM portal.modulos
        ORDER BY nome ASC
      `);

      res.json({
        ok: true,
        modulos: result.rows
      });

    } catch (error) {

      console.error(
        "ERRO AO LISTAR MÓDULOS:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao listar módulos"
      });

    }

  }
);


/* =========================================================
   BUSCAR MÓDULO POR SLUG
========================================================= */

router.get(
  "/:slug",
  async (req, res) => {

    try {

      const { slug } = req.params;

      const result = await pool.query(
        `
        SELECT
          *
        FROM portal.modulos
        WHERE slug = $1
        LIMIT 1
        `,
        [slug]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          ok: false,
          error: "Módulo não encontrado"
        });

      }

      res.json({
        ok: true,
        modulo: result.rows[0]
      });

    } catch (error) {

      console.error(
        "ERRO AO BUSCAR MÓDULO:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao buscar módulo"
      });

    }

  }
);


/* =========================================================
   CRIAR MÓDULO
========================================================= */

router.post(
  "/",
  async (req, res) => {

    try {

      const {
        nome,
        slug,
        descricao,
        icone,
        cor
      } = req.body;

      if (!nome || !slug) {

        return res.status(400).json({
          ok: false,
          error: "Nome e slug são obrigatórios"
        });

      }

      const existe = await pool.query(
        `
        SELECT id
        FROM portal.modulos
        WHERE slug = $1
        `,
        [slug]
      );

      if (existe.rows.length > 0) {

        return res.status(409).json({
          ok: false,
          error: "Já existe um módulo com este slug"
        });

      }

      const result = await pool.query(
        `
        INSERT INTO portal.modulos (
          nome,
          slug,
          descricao,
          icone,
          cor
        )
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          nome,
          slug,
          descricao || null,
          icone || null,
          cor || "#0b3d91"
        ]
      );

      res.status(201).json({
        ok: true,
        modulo: result.rows[0]
      });

    } catch (error) {

      console.error(
        "ERRO AO CRIAR MÓDULO:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao criar módulo"
      });

    }

  }
);


/* =========================================================
   EDITAR MÓDULO
========================================================= */

router.put(
  "/:id",
  async (req, res) => {

    try {

      const { id } = req.params;

      const {
        nome,
        slug,
        descricao,
        icone,
        cor,
        ativo
      } = req.body;

      const result = await pool.query(
        `
        UPDATE portal.modulos
        SET
          nome = $1,
          slug = $2,
          descricao = $3,
          icone = $4,
          cor = $5,
          ativo = $6
        WHERE id = $7
        RETURNING *
        `,
        [
          nome,
          slug,
          descricao,
          icone,
          cor,
          ativo,
          id
        ]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          ok: false,
          error: "Módulo não encontrado"
        });

      }

      res.json({
        ok: true,
        modulo: result.rows[0]
      });

    } catch (error) {

      console.error(
        "ERRO AO EDITAR MÓDULO:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao editar módulo"
      });

    }

  }
);


/* =========================================================
   DELETAR MÓDULO
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {

    try {

      const { id } = req.params;

      const result = await pool.query(
        `
        DELETE FROM portal.modulos
        WHERE id = $1
        RETURNING *
        `,
        [id]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          ok: false,
          error: "Módulo não encontrado"
        });

      }

      res.json({
        ok: true,
        mensagem: "Módulo removido com sucesso"
      });

    } catch (error) {

      console.error(
        "ERRO AO DELETAR MÓDULO:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Erro ao deletar módulo"
      });

    }

  }
);


export default router;
