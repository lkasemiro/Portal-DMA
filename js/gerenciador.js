/**
 * =========================================================================
 * Autonomia DMA // Módulo de Integração com a API do Banco de Dados
 * -------------------------------------------------------------------------
 * Finalidade: Capturar as publicações da equipe técnica, processar mídias
 * e persistir os links do Canva/Box diretamente no banco corporativo.
 * =========================================================================
 */

// 1. ENDPOINT DA API: Altere para a URL real fornecida pela sua equipe de TI
const API_POST_ENDPOINT = "https://api.dma.cedae.com.br/v1/publicacoes/residuos";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formPublicacao");
    const btnSalvar = document.getElementById("btnSalvar");
    const statusMsg = document.getElementById("statusMessage");

    if (!form) return;

    // Ouvinte do evento de envio do formulário
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); // Impede o recarregamento padrão da página

        // Configuração visual de carregamento (Loading State)
        setLoadingState(true);
        clearStatusMessage();

        // 2. CAPTURA DOS CAMPOS DA INTERFACE
        const titulo = document.getElementById("tituloModulo").value.trim();
        const linkCanva = document.getElementById("linkCanva").value.trim();
        const arquivoInput = document.getElementById("arquivoUpload");

        // Validação básica de segurança no lado do cliente
        if (!titulo || !linkCanva) {
            showStatus("Por favor, preencha todos os campos obrigatórios.", "error");
            setLoadingState(false);
            return;
        }

        // 3. CONSTRUÇÃO DO PAYLOAD (FormData para suportar upload de arquivos)
        const formData = new FormData();
        formData.append("modulo", "residuos_solidos");
        formData.append("titulo", titulo);
        formData.append("urlCanva", linkCanva);

        // Se o técnico anexou um arquivo físico, anexa o binário ao pacote
        if (arquivoInput && arquivoInput.files.length > 0) {
            formData.append("arquivo", arquivoInput.files[0]);
        }

        // 4. TRANSMISSÃO SÍNCRONA VIA FETCH PARA A API
        try {
            const response = await fetch(API_POST_ENDPOINT, {
                method: "POST",
                body: formData
                // NOTA: Não adicione o header 'Content-Type' manualmente aqui. 
                // O navegador precisa definir o Boundary do Multipart/Form-Data sozinho.
            });

            // Se o banco ou a API rejeitarem a requisição (Ex: 400, 401, 500)
            if (!response.ok) {
                throw new Error(`Resposta inválida do servidor (Código: ${response.status})`);
            }

            const resultado = await response.json();
            console.log("Banco de dados atualizado com sucesso:", resultado);

            // Feedback visual de sucesso absoluto para a apresentação
            showStatus(
                `<i class="fa-solid fa-circle-check"></i> Sincronizado com o Banco de Dados! O Card "${titulo}" foi atualizado ao vivo no Portal.`, 
                "success"
            );

            // Opcional: Limpa o campo de arquivo após o sucesso
            if (arquivoInput) arquivoInput.value = "";

        } catch (error) {
            console.error("Falha catastrófica na comunicação com a API:", error);
            showStatus(
                `<i class="fa-solid fa-triangle-exclamation"></i> Erro de Conexão: Não foi possível persistir os dados no banco. (${error.message})`, 
                "error"
            );
        } finally {
            // Restaura o estado original do botão
            setLoadingState(false);
        }
    });

    /**
     * Auxiliar: Controla o estado de clique e o spinner do botão
     */
    function setLoadingState(isLoading) {
        if (!btnSalvar) return;
        
        if (isLoading) {
            btnSalvar.disabled = true;
            btnSalvar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando ao Banco e Gravando dados...`;
            btnSalvar.style.opacity = "0.7";
        } else {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = `<i class="fa-solid fa-database"></i> Transmitir e Gravar no Banco de Dados`;
            btnSalvar.style.opacity = "1";
        }
    }

    /**
     * Auxiliar: Renderiza as caixas de alerta na tela do gerenciador
     */
    function showStatus(message, type) {
        if (!statusMsg) return;
        
        statusMsg.innerHTML = message;
        statusMsg.style.display = "block";
        
        if (type === "success") {
            statusMsg.className = "status-alert success";
        } else {
            statusMsg.className = "status-alert error";
        }
    }

    /**
     * Auxiliar: Limpa mensagens antigas
     */
    function clearStatusMessage() {
        if (!statusMsg) return;
        statusMsg.style.display = "none";
        statusMsg.className = "status-alert";
    }
});