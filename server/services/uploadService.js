/**
 * ============================================================
 * Portal Ambiental
 * Serviço de Upload de Arquivos (Versão Armazenamento Local)
 * ============================================================
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configura o equivalente ao __dirname no ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Faz o upload de um arquivo salvando-o localmente no servidor.
 * @param {Object} file - Arquivo enviado via Multer (req.file)
 * @returns {Promise<string|null>} URL ou caminho relativo do arquivo salvo
 */
export async function uploadArquivo(file) {
  try {
    if (!file) {
      return null;
    }

    // Define a pasta onde os arquivos ficarão salvos (server/public/uploads)
    const uploadDir = path.join(__dirname, "..", "public", "uploads");

    // Garante que a pasta existe. Se não existir, ela é criada de forma recursiva
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Gera um nome único para o arquivo para evitar que um sobrescreva o outro
    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    const filePath = path.join(uploadDir, fileName);

    // Grava o buffer do arquivo no disco do Codespaces
    await fs.promises.writeFile(filePath, file.buffer);

    // Retorna a URL relativa que será salva no banco (Neon PostgreSQL)
    // Se o seu app Express servir a pasta "public" como estática, isso funcionará perfeitamente
    return `/uploads/${fileName}`;

  } catch (error) {
    console.error("❌ Erro ao salvar arquivo localmente:", error);
    throw new Error("Erro ao realizar o upload do arquivo.");
  }
}