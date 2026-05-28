// postsService.js - Serviços relacionados a posts para o Portal DMA
export async function criarPost(
  formData
) {

  try {

    const response =
      await fetch(
        "/api/posts",
        {
          method: "POST",
          body: formData
        }
      );

    return await response.json();

  }

  catch (error) {

    console.error(error);

    return {
      ok: false,
      error: "Erro de conexão"
    };

  }

}

