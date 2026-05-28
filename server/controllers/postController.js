
import { pool }
from "../config/db.js";


import { uploadArquivo }
from "../services/uploadService.js";


/* =========================================================
   CRIAR POST
========================================================= */

export async function criarPost(req, res) {

  try {

    const {
      titulo,
      resumo,
      conteudo,
      modulo_slug,
      submodulo_slug,
      tipo,
      autor,
      setor,
      status,
      link_externo,
      destaque,
      fixado,
      data_evento
    } = req.body;

    const arquivo_url =
      req.file
         ? await uploadArquivo(req.file)
         : null;

    const result = await pool.query(
      `
      INSERT INTO portal.posts (
        titulo,
        resumo,
        conteudo,
        modulo_slug,
        submodulo_slug,
        tipo,
        autor,
        setor,
        status,
        link_externo,
        destaque,
        fixado,
        data_evento,
        arquivo_url
      )

      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14
      )

      RETURNING *
      `,
      [
        titulo,
        resumo,
        conteudo,
        modulo_slug,
        submodulo_slug,
        tipo,
        autor,
        setor,
        status || "rascunho",
        link_externo,
        destaque === "true",
        fixado === "true",
        data_evento || null,
        arquivo_url
      ]
    );


    res.status(201).json({
      ok: true,
      post: result.rows[0]
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Erro ao criar postagem"
    });

  }

}


/* =========================================================
   LISTAR POSTS PUBLICADOS
========================================================= */

export async function listarPostsPublicados(
  req,
  res
) {

  try {

    const result = await pool.query(`
      SELECT *
      FROM portal.posts
      WHERE status = 'publicado'
      ORDER BY
        fixado DESC,
        criado_em DESC
    `);

    res.json({
      ok: true,
      posts: result.rows
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Erro ao buscar posts"
    });

  }

}


/* =========================================================
   BUSCAR POST POR ID
========================================================= */

export async function buscarPostPorId(
  req,
  res
) {

  try {

    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM portal.posts
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        ok: false,
        error: "Post não encontrado"
      });

    }

    res.json({
      ok: true,
      post: result.rows[0]
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Erro ao buscar post"
    });

  }

}


/* =========================================================
   ATUALIZAR POST
========================================================= */

export async function atualizarPost(
  req,
  res
) {

  try {

    const { id } = req.params;

    const {
      titulo,
      resumo,
      conteudo,
      status
    } = req.body;


    const result = await pool.query(
      `
      UPDATE portal.posts
      SET
        titulo = $1,
        resumo = $2,
        conteudo = $3,
        status = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        titulo,
        resumo,
        conteudo,
        status,
        id
      ]
    );

    res.json({
      ok: true,
      post: result.rows[0]
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Erro ao atualizar post"
    });

  }

}


/* =========================================================
   DELETAR POST
========================================================= */

export async function deletarPost(
  req,
  res
) {

  try {

    const { id } = req.params;

    await pool.query(
      `
      DELETE
      FROM portal.posts
      WHERE id = $1
      `,
      [id]
    );

    res.json({
      ok: true,
      message: "Post deletado"
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Erro ao deletar post"
    });

  }

}

