import express from "express";
import { pool } from "../database/db.js";

const router = express.Router();

/**
 * GET /api/recicla/dashboard-dados
 */
router.get("/dashboard-dados", async (req, res) => {
  try {
    const geral = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM recicla.recicla2_cadastro) AS participantes,
        (SELECT COUNT(*) FROM recicla.recicla2_pesagens) AS pesagens,
        (SELECT COALESCE(SUM(pesagem),0) FROM recicla.recicla2_pesagens) AS peso_total,
        (SELECT MAX(data_pesagem) FROM recicla.recicla2_pesagens) AS ultima_atualizacao;
    `);

    const porLocal = await pool.query(`
      SELECT 
        LOWER(TRIM(l.local)) AS local,
        COUNT(DISTINCT c.id) AS participantes,
        COUNT(p.id) AS pesagens,
        COALESCE(SUM(p.pesagem), 0) AS peso_total
      FROM (
        SELECT 'sede' AS local 
        UNION 
        SELECT 'laranjal' AS local
      ) l
      LEFT JOIN recicla.recicla2_cadastro c ON LOWER(TRIM(c.local)) = l.local
      LEFT JOIN recicla.recicla2_pesagens p ON p.participante_id = c.id
      GROUP BY l.local;
    `);

    const locaisObj = {
      sede: { participantes: 0, pesagens: 0, pesoTotal: 0 },
      laranjal: { participantes: 0, pesagens: 0, pesoTotal: 0 }
    };

    porLocal.rows.forEach(r => {
      const nomeLocal = r.local ? r.local.toLowerCase() : "";
      if (locaisObj[nomeLocal]) {
        locaisObj[nomeLocal] = {
          participantes: Number(r.participantes),
          pesagens: Number(r.pesagens),
          pesoTotal: Number(r.peso_total)
        };
      }
    });

    res.json({
      sucesso: true,
      dados: {
        consolidado: {
          participantes: Number(geral.rows[0].participantes),
          pesagens: Number(geral.rows[0].pesagens),
          pesoTotal: Number(geral.rows[0].peso_total),
          ultimaAtualizacao: geral.rows[0].ultima_atualizacao
        },
        porLocal: locaisObj
      }
    });
  } catch (err) {
    console.error("[RECICLA] Erro Dashboard:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * GET /api/recicla/ranking-diretorias
 */
router.get("/ranking-diretorias", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.diretoria AS diretoria,
        LOWER(TRIM(c.local)) AS local,
        COUNT(DISTINCT c.id) AS total_participantes,
        COALESCE(SUM(p.pesagem), 0) AS peso_total
      FROM recicla.recicla2_cadastro c
      LEFT JOIN recicla.recicla2_pesagens p ON p.participante_id = c.id
      GROUP BY c.diretoria, c.local
      HAVING COALESCE(SUM(p.pesagem), 0) > 0
      ORDER BY peso_total DESC;
    `);

    res.json({
      sucesso: true,
      dados: rows.map(r => ({
        diretoria: r.diretoria,
        local: r.local,
        totalParticipantes: Number(r.total_participantes),
        pesoTotal: Number(r.peso_total)
      }))
    });
  } catch (err) {
    console.error("[RECICLA] Erro Ranking Diretorias:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * GET /api/recicla/historico-pesagens
 */
router.get("/historico-pesagens", async (req, res) => {
  try {
    // Buscando o local associado ao participante para separar o histórico
    const { rows } = await pool.query(`
      SELECT
        p.data_pesagem::date AS data,
        c.local AS local,
        SUM(p.pesagem) AS quantidade
      FROM recicla.recicla2_pesagens p
      INNER JOIN recicla.recicla2_cadastro c ON p.participante_id = c.id
      GROUP BY p.data_pesagem::date, c.local
      ORDER BY data ASC;
    `);

    res.json({
      sucesso: true,
      dados: rows.map(r => ({
        Data: r.data ? new Date(r.data).toISOString().split("T")[0] : "",
        Local: r.local,
        Quantidade: Number(r.quantidade)
      }))
    });
  } catch (err) {
    console.error("[RECICLA] Erro Histórico Pesagens:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * GET /api/recicla/participante
 */
router.get("/participante", async (req, res) => {
  try {
    const { id, local } = req.query;

    if (!id || !local) {
      return res.status(400).json({
        sucesso: false,
        erro: "Informe o ID e o local do participante."
      });
    }

    const participante = await pool.query(`
      SELECT
        id,
        nome,
        diretoria,
        email,
        local,
        data_cadastro
      FROM recicla.recicla2_cadastro
      WHERE id = $1 AND LOWER(TRIM(local)) = LOWER(TRIM($2))
    `, [parseInt(id), local]);

    if (participante.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Participante não encontrado para este local."
      });
    }

    const pid = participante.rows[0].id;

    const somatorio = await pool.query(`
      SELECT COALESCE(SUM(pesagem), 0) AS somatorio_peso
      FROM recicla.recicla2_pesagens
      WHERE participante_id = $1
    `, [pid]);

    const pesagens = await pool.query(`
      SELECT
        id AS pesagem_id,
        pesagem,
        data_pesagem
      FROM recicla.recicla2_pesagens
      WHERE participante_id = $1
      ORDER BY data_pesagem DESC
    `, [pid]);

    res.json({
      sucesso: true,
      dados: {
        ...participante.rows[0],
        id_serial: pid, // Mantido para compatibilidade com a assinatura do front antigo
        somatorio_peso: Number(somatorio.rows[0].somatorio_peso),
        pesagens: pesagens.rows.map(p => ({
          ...p,
          local: participante.rows[0].local // Anexa o local do participante na resposta
        }))
      }
    });
  } catch (err) {
    console.error("[RECICLA] Erro Consulta Participante:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * GET /api/recicla/health
 */
router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ sucesso: true, modulo: "Recicla CEDAE", status: "online" });
  } catch (err) {
    res.status(500).json({ sucesso: false, status: "offline", erro: err.message });
  }
});

export default router;