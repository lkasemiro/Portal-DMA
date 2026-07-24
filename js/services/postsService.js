// js/services/postsService.js - Serviços relacionados a posts para o Portal DMA

// Detecta automaticamente se está em ambiente local ou produção
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE_URL = isLocal 
  ? "http://localhost:3001/api/posts" 
  : "https://dma-aedes-api.onrender.com/api/posts";

export async function criarPost(formData) {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      body: formData // O Multer no back-end vai ler esse corpo contendo o arquivo e os campos
    });

    if (!response.ok) {
      throw new Error(`Falha HTTP: Status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao criar post:", error);
    return {
      sucesso: false,
      erro: error.message || "Erro de conexão com o servidor"
    };
  }
}