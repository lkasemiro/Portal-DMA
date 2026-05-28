// js/services/modulosService.js

const API_BASE =
  "http://localhost:3001/api";


/* =========================================================
   CARREGAR MÓDULOS
========================================================= */

export async function carregarModulos() {

  try {

    const response =
      await fetch(
        `${API_BASE}/modulos`
      );

    if (!response.ok) {

      throw new Error(
        "Falha ao carregar módulos."
      );

    }

    return await response.json();

  }

  catch (error) {

    console.error(
      "ERRO MODULOS:",
      error
    );

    return [];

  }

}