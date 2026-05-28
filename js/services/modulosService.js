
export async function carregarModulos() {

  try {

    const response =
      await fetch(
        "/api/modulos"
      );

    return await response.json();

  }

  catch (error) {

    console.error(error);

    return {
      ok: false,
      error: "Erro ao carregar módulos"
    };

  }

}

