/*auth.middleware.js*/
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.config.js";

/**
 * Middleware para verificar se o usuário está autenticado no sistema.
 * Injeta 'req.user' e 'req.session' para uso nos controladores subsequentes.
 */
export async function verificarAutenticacao(req, res, next) {
    try {
        // Converte os cabeçalhos do Node/Express para o formato que o Better Auth entende
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers)
        });

        // Se não houver sessão ativa ou válida, barra a entrada na hora
        if (!session) {
            return res.status(401).json({ 
                success: false, 
                message: "Sessão inválida ou expirada. Faça login novamente." 
            });
        }

        // Disponibiliza o usuário (com role e unidadeId) e a sessão para toda a rota
        req.user = session.user;
        req.session = session.session;

        next();
    } catch (error) {
        console.error("❌ Erro de Autenticação no Middleware:", error.message);
        return res.status(401).json({ 
            success: false, 
            message: "Não autorizado." 
        });
    }
}

/**
 * Middleware para controle de acesso baseado em papéis (RBAC).
 * 
 * Exemplo de uso nas rotas:
 * authorize("Desenvolvedor") -> Apenas devs entram
 * authorize("Desenvolvedor", "Administrador") -> Devs e Admins entram
 */
export function authorize(...papeisPermitidos) {
    return (req, res, next) => {
        // Garante que o usuário passou primeiro pelo middleware de autenticação
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: "Usuário não identificado ou não autenticado." 
            });
        }

        // O Better Auth injeta o campo 'role' diretamente no objeto user
        const possuiPermissao = papeisPermitidos.includes(req.user.role);

        if (!possuiPermissao) {
            return res.status(403).json({ 
                success: false, 
                message: "Acesso negado. Seu perfil não tem permissão para esta operação." 
            });
        }

        next();
    };
}