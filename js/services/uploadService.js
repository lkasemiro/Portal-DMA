
import path from "path";

import { supabase }
from "../config/supabase.js";


/* =========================================================
   DEFINIR BUCKET
========================================================= */

function getBucket(
  mimetype
) {

  if (
    mimetype.includes("pdf")
  ) {

    return "pdfs";

  }

  if (
    mimetype.includes("image")
  ) {

    return "imagens";

  }

  if (
    mimetype.includes("sheet") ||
    mimetype.includes("excel")
  ) {

    return "planilhas";

  }

  return "outros";

}


/* =========================================================
   UPLOAD PARA SUPABASE
========================================================= */

export async function uploadArquivo(
  file
) {

  try {

    if (!file) {

      return null;

    }


    const bucket =
      getBucket(file.mimetype);


    const extension =
      path.extname(
        file.originalname
      );


    const filename =
      `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${extension}`;


    const filepath =
      `${bucket}/${filename}`;


    const {
      error
    } = await supabase.storage
      .from(bucket)
      .upload(
        filename,
        file.buffer,
        {
          contentType:
            file.mimetype,

          upsert: false
        }
      );


    if (error) {

      console.error(
        "Erro Supabase Upload:",
        error
      );

      throw error;

    }


    const {
      data
    } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);


    return data.publicUrl;

  }

  catch (error) {

    console.error(
      "Erro uploadArquivo:",
      error
    );

    throw error;

  }

}

