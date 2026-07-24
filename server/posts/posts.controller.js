import { pool } from "../database/db.js";

/* ==========================================================================
   SEÇÃO 1: GERENCIAMENTO DE PUBLICAÇÕES (POSTS)
   ========================================================================== */

// GET /api/posts/publicados
export const listarPostsPublicados = async (req, res) => {
  try {
    const queryText = `
      SELECT p.*, f.nome as autor_nome 
      FROM portal_posts p
      LEFT JOIN portal_focais f ON p.autor_id = f.id
      ORDER BY p.data_criacao DESC
    `;
    const { rows } = await pool.query(queryText);
    res.json({ sucesso: true, dados: rows });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

// GET /api/posts/:id
export const buscarPostPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const queryText = `
      SELECT p.*, f.nome as autor_nome 
      FROM portal_posts p
      LEFT JOIN portal_focais f ON p.autor_id = f.id
      WHERE p.id = $1
    `;
    const { rows } = await pool.query(queryText, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: "Publicação não encontrada." });
    }
    res.json({ sucesso: true, dados: rows[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

// POST /api/posts
export const criarPost = async (req, res) => {
  try {
    const { titulo, conteudo, resumo, autor_id } = req.body;
    const imagem_url = req.file ? `/uploads/${req.file.filename}` : req.body.imagem_url;
    
    if (!titulo || !conteudo) {
      return res.status(400).json({ sucesso: false, erro: "Título e Conteúdo são obrigatórios." });
    }

    const queryText = `
      INSERT INTO portal_posts (titulo, conteudo, resumo, imagem_url, autor_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [titulo, conteudo, resumo, imagem_url, autor_id]);
    res.status(201).json({ sucesso: true, mensagem: "Publicação criada!", dados: rows[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

// PUT /api/posts/:id
export const atualizarPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, conteudo, resumo } = req.body;
    
    let queryText;
    let params;

    if (req.file) {
      const imagem_url = `/uploads/${req.file.filename}`;
      queryText = `
        UPDATE portal_posts 
        SET titulo = $1, conteudo = $2, resumo = $3, imagem_url = $4, data_atualizacao = CURRENT_TIMESTAMP
        WHERE id = $5 RETURNING *`;
      params = [titulo, conteudo, resumo, imagem_url, id];
    } else {
      queryText = `
        UPDATE portal_posts 
        SET titulo = $1, conteudo = $2, resumo = $3, data_atualizacao = CURRENT_TIMESTAMP
        WHERE id = $4 RETURNING *`;
      params = [titulo, conteudo, resumo, id];
    }

    const { rows } = await pool.query(queryText, params);
    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: "Post não encontrado." });
    }

    res.json({ sucesso: true, dados: rows[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

// DELETE /api/posts/:id
export const deletarPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM portal_posts WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ sucesso: false, erro: "Publicação não encontrada." });
    }

    res.json({ sucesso: true, mensagem: "Publicação removida com sucesso." });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

/* ==========================================================================
   SEÇÃO 2: ADMINISTRAÇÃO DE FOCAIS E TÉCNICOS
   ========================================================================== */

export const listarFocais = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM portal_focais ORDER BY nome ASC");
    res.json({ sucesso: true, dados: rows });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

export const adicionarFocal = async (req, res) => {
  try {
    const { nome, email, funcao } = req.body;

    if (!nome || !email) {
      return res.status(400).json({ sucesso: false, erro: "Nome e e-mail são obrigatórios." });
    }

    const queryText = `
      INSERT INTO portal_focais (nome, email, funcao)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [nome, email, funcao || "Tecnico"]);
    res.status(201).json({ sucesso: true, mensagem: "Membro da equipe adicionado!", dados: rows[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

export const removerFocal = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("UPDATE portal_focais SET ativo = FALSE WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ sucesso: false, erro: "Focal não encontrado." });
    }

    res.json({ sucesso: true, mensagem: "Acesso do focal desativado com sucesso." });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};