// server/services/uploadService.js - Serviço de upload de arquivos para o Portal DMA
import 'dotenv/config'; // 💡 Isso força o carregamento do .env ANTES do createClient
import { createClient } from "@supabase/supabase-js";

// Tenta pegar com SERVICE_KEY, se não achar, tenta com KEY
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);


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

