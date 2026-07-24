import { pool } from "../database/db.js";
import { createRequire } from "module";

// Instanciando require para compatibilidade do pdfmake no padrão ES Modules
const require = createRequire(import.meta.url);
const PdfPrinter = require("pdfmake");

export const getAuditoriaSemanal = async (req, res) => {
    try {
        const { ano, mes, semana_mes } = req.query;
        if (!ano || !mes || !semana_mes) {
            return res.status(400).json({ error: "Parâmetros 'ano', 'mes' e 'semana_mes' são obrigatórios." });
        }

        const a = parseInt(ano);
        const m = parseInt(mes);
        const s = parseInt(semana_mes);

        let diaInicio = 1 + (s - 1) * 7;
        let diaFim = s * 7;
        if (s === 4) {
            diaFim = new Date(a, m, 0).getDate();
        }

        const dataInicioStr = `${a}-${String(m).padStart(2, '0')}-${String(diaInicio).padStart(2, '0')} 00:00:00`;
        const dataFimStr = `${a}-${String(m).padStart(2, '0')}-${String(diaFim).padStart(2, '0')} 23:59:59`;
        const intervaloTexto = `${String(diaInicio).padStart(2, '0')}/${String(m).padStart(2, '0')} a ${String(diaFim).padStart(2, '0')}/${String(m).padStart(2, '0')}`;

        const sqlNaoEnviados = `
            SELECT u.unidade_id, u.nome_unidade, f.nome AS focal_name, f.email AS focal_email
            FROM aedes.unidades u
            LEFT JOIN aedes.focal_unidade fu ON u.unidade_id = fu.unidade_id AND fu.ativo = true
            LEFT JOIN aedes.focais f ON fu.focal_pk = f.focal_pk AND f.ativo = true
            WHERE u.ativo = true
              AND u.nome_unidade NOT IN (
                SELECT DISTINCT unidade_nome FROM aedes.fato_vistorias 
                WHERE data_registro >= $1::timestamp AND data_registro <= $2::timestamp AND unidade_nome IS NOT NULL
              )
            ORDER BY u.nome_unidade ASC;
        `;

        const sqlMetricas = `
            SELECT 
                COUNT(*)::int AS qtd_entrou,
                COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' THEN 1 END)::int AS qtd_focos,
                COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' AND LOWER(TRIM(foco_remediado)) = 'sim' THEN 1 END)::int AS qtd_remediados,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'unidade', unidade_nome,
                            'remediado', LOWER(TRIM(foco_remediado)),
                            'motivo_nao_remediado', COALESCE(NULLIF(motivos_nao_remediacao, ''), NULLIF(outros_motivos_nao_remediacao, ''), '-')
                        )
                    ) FILTER (WHERE LOWER(TRIM(foco_encontrado)) = 'sim'), 
                    '[]'
                ) AS lista_focos
            FROM aedes.fato_vistorias
            WHERE data_registro >= $1::timestamp AND data_registro <= $2::timestamp;
        `;

        const resNaoEnviados = await pool.query(sqlNaoEnviados, [dataInicioStr, dataFimStr]);
        const resMetricas = await pool.query(sqlMetricas, [dataInicioStr, dataFimStr]);
        const metricas = resMetricas.rows[0] || { qtd_entrou: 0, qtd_focos: 0, qtd_remediados: 0 };

        res.json({ intervalo: intervaloTexto, nao_enviados: resNaoEnviados.rows, metricas });
    } catch (err) {
        res.status(500).json({ error: "Erro interno ao processar auditoria.", detalhe: err.message });
    }
};

export const getMotivosNaoVistoria = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM aedes.vw_motivos_nao_vistoria ORDER BY quantidade DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar view de motivos não vistoria." });
    }
};

export const getMotivosNaoRemediacao = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM aedes.vw_motivos_nao_remediacao ORDER BY quantidade DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar view de motivos não remediação." });
    }
};

export const getLocaisFoco = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM aedes.vw_locais_foco ORDER BY quantidade DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar view de locais de foco." });
    }
};

export const getResumoKPIs = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM aedes.vw_resumo_aedes`);
        res.json(result.rows[0] || { total_registros: 0, total_vistorias: 0, total_focos: 0, total_remediados: 0 });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar resumo de KPIs." });
    }
};

export const getPainelDados = async (req, res) => {
    try {
        const { unidade, ano, mes, semana } = req.query;
        let query = `
            SELECT lote_id, data_registro, ano, mes, semana, unidade_id, unidade_nome, 
                   vistoria_realizada, foco_encontrado, foco_remediado, motivos_nao_vistoria, 
                   motivos_nao_remediacao, locais_foco, observacoes
            FROM aedes.fato_vistorias WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (unidade) { query += ` AND LOWER(unidade_nome) = LOWER($${pIndex})`; params.push(unidade.trim()); pIndex++; }
        if (ano) { query += ` AND ano = $${pIndex}`; params.push(parseInt(ano)); pIndex++; }
        if (mes) { query += ` AND mes = $${pIndex}`; params.push(parseInt(mes)); pIndex++; }
        if (semana) { query += ` AND semana = $${pIndex}`; params.push(parseInt(semana)); pIndex++; }

        query += ` ORDER BY data_registro DESC LIMIT 25000`;
        const result = await pool.query(query, params);
        res.json({ registros: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor.", detalhe: err.message });
    }
};

export const exportCSV = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM aedes.vistorias_itens`);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio-aedes.csv');
        
        const campos = ["id", "unidade_nome", "vistoria_realizada", "foco_encontrado", "foco_remediado", "data_registro"];
        let csvContent = campos.join(",") + "\n";
        result.rows.forEach(row => {
            csvContent += `${row.id},"${row.unidade_nome}",${row.vistoria_realizada},${row.foco_encontrado},${row.foco_remediado},${row.data_registro}\n`;
        });
        return res.status(200).send(csvContent);
    } catch (err) {
        res.status(500).json({ error: "Erro ao exportar CSV." });
    }
};

export const exportPDF = async (req, res) => {
    try {
        const result = await pool.query(`SELECT unidade_nome, vistoria_realizada, foco_encontrado FROM aedes.vistorias_itens`);
        res.json({ titulo: "Relatório Analítico de Vistorias - AEDES", emitidoEm: new Date(), dados: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erro ao preparar dados para PDF." });
    }
};

export const getFocaisAtivos = async (_req, res) => {
    try {
        const result = await pool.query(`SELECT nome, email FROM aedes.focais WHERE ativo = true ORDER BY nome ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar lista de focais" });
    }
};

export const getFocaisListaCompleta = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.focal_pk, f.matricula, f.nome, f.email, f.ativo, STRING_AGG(u.nome_unidade, ', ') AS focal_unidades
            FROM aedes.focais f
            LEFT JOIN aedes.focal_unidade fu ON f.focal_pk = fu.focal_pk
            LEFT JOIN aedes.unidades u ON fu.unidade_id = u.unidade_id
            WHERE f.ativo = true
            GROUP BY f.focal_pk, f.matricula, f.nome, f.email, f.ativo
            ORDER BY f.nome ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar lista detalhada de focais." });
    }
};

export const loginFocal = async (req, res) => {
    try {
        const { email, matricula } = req.query;
        if (!email || !matricula) return res.status(400).json({ ok: false, error: "Dados incompletos." });

        const result = await pool.query(
            `SELECT focal, matricula, email FROM aedes.stg_importacao_excel
             WHERE email = $1 AND CAST(matricula AS TEXT) = $2`,
            [email.trim(), String(matricula).trim()]
        );

        if (result.rows.length === 0) return res.status(401).json({ ok: false, error: "Credenciais inválidas." });

        res.json({ ok: true, nome: result.rows[0].focal, auth_type: "aedes_focal" });
    } catch (err) {
        res.status(500).json({ ok: false, error: "Erro no servidor." });
    }
};

export const getBaseConsolidada = async (req, res) => {
    try {
        const { filtro } = req.query;
        let sql = `
            SELECT DISTINCT u.unidade_id AS id, u.nome_unidade AS "Unidade", f.matricula, f.email, f.nome AS "focalNome"
            FROM aedes.unidades u
            INNER JOIN aedes.focal_unidade fu ON u.unidade_id = fu.unidade_id
            INNER JOIN aedes.focais f ON fu.focal_pk = f.focal_pk
            WHERE u.ativo = true AND f.ativo = true
        `;
        let params = [];
        if (filtro && filtro.trim() !== "") {
            sql += " AND (f.email = $1 OR CAST(f.matricula AS TEXT) = $2)";
            params.push(filtro.trim(), filtro.trim());
        }
        sql += " ORDER BY u.nome_unidade ASC";
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro interno ao buscar base." });
    }
};

export const getHistoricoConsolidado = async (req, res) => {
    try {
        const query = `
            SELECT ano, mes, data_registro AS data_real_envio, unidade_nome AS unidade,
                   vistoria_realizada, foco_encontrado, foco_remediado, motivos_nao_vistoria,
                   motivos_nao_remediacao, locais_foco, outros_motivos_nao_vistoria,
                   outros_motivos_nao_remediacao, outros_locais_foco, observacoes
            FROM aedes.fato_vistorias ORDER BY data_registro DESC;
        `;
        const result = await pool.query(query);
        res.json({ sucesso: true, dados: result.rows });
    } catch (err) {
        res.status(500).json({ sucesso: false, error: "Erro ao consultar tabela no banco.", details: err.message });
    }
};

export const getCertificados = async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT unidade, mes, ano, total_vistorias, cobertura_semanal_completa, focos_nao_remediados
            FROM aedes.mv_certificados_consolidados ORDER BY ano DESC, mes DESC, unidade ASC;
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro interno ao processar dados de elegibilidade." });
    }
};

export const criarLoteVistorias = async (req, res) => {
    const client = await pool.connect();
    try {
        const { cabecalho, dados } = req.body;
        await client.query('BEGIN');

        const loteRes = await client.query(
            `INSERT INTO aedes.lotes (focal_nome, payload_completo, total_registros) VALUES ($1, $2, $3) RETURNING id`,
            [cabecalho.focal_nome, JSON.stringify(req.body), dados.length]
        );
        const loteId = loteRes.rows[0].id;

        const itemQuery = `
            INSERT INTO aedes.vistorias_itens (
                lote_id, id_referencia, unidade_id, unidade_nome, vistoria_realizada, foco_encontrado, foco_remediado, 
                locais_foco, outros_local, motivos_nao_vistoria, outros_motivo_nao_vistoria, motivos_nao_remediacao, 
                outros_motivo_nao_remediacao, observacoes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id_referencia) DO UPDATE SET
                lote_id = EXCLUDED.lote_id, outros_local = EXCLUDED.outros_local,
                outros_motivo_nao_vistoria = EXCLUDED.outros_motivo_nao_vistoria,
                outros_motivo_nao_remediacao = EXCLUDED.outros_motivo_nao_remediacao, observacoes = EXCLUDED.observacoes;
        `;

        const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, '');

        for (const row of dados) {
            const idReferencia = `${row[1].replace(/\s+/g, '')}_${dataHoje}`;
            await client.query(itemQuery, [
                loteId, idReferencia, row[0], row[1], row[2], row[3], row[4],
                JSON.stringify(row[5] || []), row[6], JSON.stringify(row[7] || []),
                row[8], JSON.stringify(row[9] || []), row[10], row[11]
            ]);
        }

        await client.query('COMMIT');
        res.status(201).json({ ok: true, loteId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

export const listarLotes = async (_req, res) => {
    try {
        const result = await pool.query(`SELECT id, focal_nome, total_registros, data_envio FROM aedes.lotes ORDER BY data_envio DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar lotes." });
    }
};

export const getUnidadesLegado = async (_req, res) => {
    try {
        const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades WHERE ativo = true ORDER BY nome_unidade ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar unidades." });
    }
};