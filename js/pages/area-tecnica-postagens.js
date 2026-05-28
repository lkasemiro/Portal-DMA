
import { carregarModulos }
from "../services/modulosService.js";

import { criarPost }
from "../services/postsService.js";


/* =========================================================
   ELEMENTOS
========================================================= */

const form =
  document.getElementById("postForm");

const moduloSelect =
  document.getElementById("modulo_slug");

const feedback =
  document.getElementById("feedbackMessage");

const fileInput =
  document.getElementById("file");

const previewContainer =
  document.getElementById("filePreview");


/* =========================================================
   FEEDBACK
========================================================= */

function mostrarFeedback(
  mensagem,
  tipo = "success"
) {

  feedback.innerHTML = `
    <div class="feedback-${tipo}">
      ${mensagem}
    </div>
  `;

}


/* =========================================================
   PREVIEW ARQUIVO
========================================================= */

function renderPreview(
  file
) {

  if (!file) {

    previewContainer.innerHTML = "";

    return;

  }

  const type =
    file.type;

  const size =
    (
      file.size /
      1024 /
      1024
    ).toFixed(2);

  let html = "";


  /* =========================
     IMAGEM
  ========================= */

  if (
    type.includes("image")
  ) {

    const imageUrl =
      URL.createObjectURL(file);

    html = `
      <div class="upload-preview-card">

        <img
          src="${imageUrl}"
          class="upload-preview-image"
        />

        <div class="upload-preview-info">

          <strong>
            ${file.name}
          </strong>

          <span>
            ${size} MB
          </span>

        </div>

      </div>
    `;

  }


  /* =========================
     PDF
  ========================= */

  else if (
    type.includes("pdf")
  ) {

    html = `
      <div class="upload-preview-card">

        <div class="upload-preview-icon">
          📄
        </div>

        <div class="upload-preview-info">

          <strong>
            ${file.name}
          </strong>

          <span>
            PDF • ${size} MB
          </span>

        </div>

      </div>
    `;

  }


  /* =========================
     PLANILHA
  ========================= */

  else {

    html = `
      <div class="upload-preview-card">

        <div class="upload-preview-icon">
          📊
        </div>

        <div class="upload-preview-info">

          <strong>
            ${file.name}
          </strong>

          <span>
            Arquivo • ${size} MB
          </span>

        </div>

      </div>
    `;

  }

  previewContainer.innerHTML =
    html;

}


/* =========================================================
   CARREGAR MODULOS
========================================================= */

async function initModulos() {

  try {

    const data =
      await carregarModulos();

    if (!data.ok) {

      mostrarFeedback(
        "Erro ao carregar módulos",
        "error"
      );

      return;

    }

    data.modulos.forEach(
      (modulo) => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          modulo.slug;

        option.textContent =
          modulo.nome;

        moduloSelect.appendChild(
          option
        );

      }
    );

  }

  catch (error) {

    console.error(error);

    mostrarFeedback(
      "Erro interno",
      "error"
    );

  }

}


/* =========================================================
   SUBMIT
========================================================= */

async function handleSubmit(
  event
) {

  event.preventDefault();

  mostrarFeedback(
    "Publicando...",
    "loading"
  );

  try {

    const formData =
      new FormData(form);

    const data =
      await criarPost(
        formData
      );


    if (!data.ok) {

      mostrarFeedback(
        data.error ||
        "Erro ao publicar",
        "error"
      );

      return;

    }


    mostrarFeedback(
      "Publicação criada com sucesso"
    );

    form.reset();

    previewContainer.innerHTML =
      "";

  }

  catch (error) {

    console.error(error);

    mostrarFeedback(
      "Erro interno",
      "error"
    );

  }

}


/* =========================================================
   EVENTOS
========================================================= */

fileInput.addEventListener(
  "change",
  (event) => {

    const file =
      event.target.files[0];

    renderPreview(file);

  }
);


form.addEventListener(
  "submit",
  handleSubmit
);


/* =========================================================
   INIT
========================================================= */

initModulos();

