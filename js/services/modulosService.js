// js/services/modulosService.js - Carregamento dinâmico de módulos do Portal DMA

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE = isLocal 
  ? "http://localhost:3001/api" 
  : "https://dma-aedes-api.onrender.com/api";

/* =========================================================
   CARREGAR MÓDULOS
========================================================= */
export async function carregarModulos() {
  try {
    const response = await fetch(`${API_BASE}/modulos`);

    if (!response.ok) {
      throw new Error("Falha ao carregar módulos.");
    }

    const resultado = await response.json();
    
    // Ajustado para capturar a propriedade 'modulos' enviada pelo novo controlador
    return resultado.modulos || []; 
  } catch (error) {
    console.error("ERRO MODULOS:", error);
    return [];
  }
}