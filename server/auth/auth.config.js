/* auth.config.js */
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { pool } from "../database/db.js"; // Sua conexão Pool/Client atual com o Neon

export const auth = betterAuth({
    // Conexão direta com o banco de dados Neon
    database: pool, 
    
    // Seguranças de criptografia vindas do seu arquivo .env
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    
    // 🏢 Customização do Perfil do Usuário para o Ecossistema CEDAE
    user: {
        customFields: {
            unidadeId: {
                type: "number",
                references: {
                    model: "unidades", // Nome exato da sua tabela de unidades no Neon
                    field: "id"
                },
                required: false, // Opcional (evita travar o Desenvolvedor ou Admin que não pertencem a uma unidade física)
                input: true // Permite que o Frontend envie este campo no formulário de cadastro (Sign Up)
            }
        }
    },

    // 👑 Controle de Acesso Baseado em Papéis (RBAC) NATIVO
    plugins: [
        admin({
            // Árvore de permissões do sistema
            roles: ["Desenvolvedor", "Administrador", "Equipe_Tecnica", "Cedae_Funcionario", "Focal"],
            
            // Se um novo funcionário se cadastrar sozinho no site, ele cai aqui por segurança
            defaultRole: "Focal" 
        })
    ],

    // Configurações avançadas de cookies de sessão
    advanced: {
        cookiePrefix: "dma_auth"
    }
});