
import { createClient }
from "@supabase/supabase-js";

const supabase =
  createClient(

    process.env.SUPABASE_URL,

    process.env.SUPABASE_SERVICE_KEY
  );

export async function uploadArquivo(
  file
) {

  try {

    if (!file) {
      return null;
    }

    const fileName =
      `${Date.now()}-${file.originalname}`;

    const bucket =
      "portal-arquivos";

    const {
      error
    } =
    await supabase
      .storage
      .from(bucket)
      .upload(

        fileName,

        file.buffer,

        {

          contentType:
            file.mimetype

        }

      );

    if (error) {

      console.error(error);

      throw error;
    }

    const {
      data
    } =
    supabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;

  }

  catch (error) {

    console.error(
      "Erro upload Supabase:",
      error
    );

    throw error;

  }

}

