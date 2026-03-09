let deferredPrompt = null;

const installBtn = document.getElementById("installBtn");
const aboutBtn = document.getElementById("aboutBtn");
const aboutModal = document.getElementById("aboutModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");

function openModal() {
  aboutModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  aboutModal.hidden = true;
  document.body.style.overflow = "";
}

if (aboutBtn) {
  aboutBtn.addEventListener("click", openModal);
}

if (modalBackdrop) {
  modalBackdrop.addEventListener("click", closeModal);
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", closeModal);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && aboutModal && !aboutModal.hidden) {
    closeModal();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;

  if (installBtn) {
    installBtn.hidden = false;
  }
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.log("Service worker registrado com sucesso.");
    } catch (error) {
      console.error("Erro ao registrar service worker:", error);
    }
  });
}