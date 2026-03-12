# data 12/03/2026

# esse documento R consolidará a primeira base de dados do programa 
# RECICLA CEDAE  

# Para eficientizar o fluxo de trabalho e o controle dos andamento do projeto

# Proposta de Projeto:

# Mantemos a fase manual de alimentação de uma tabela no excel com as pesagens,
# a partir dela, esses dados migrão para a base de dados em PostgreSQL.
# 
# O Banco por sua vez esta integrado no Sistema DMA, que possui funções de
#   - Limpeza
#   - Tratamento
#   - Processamento
#   - Apresentação final dos dados
# 
# Perguntas a coordenadora
# 
#   - O canal de comunicação continua sendo email para participantes do projeto?
#   - Vale colocar um link para uma pagina Recicla Cedae?
#   - Mudança de regras?
#   - Unidades novas? 
#   
  
# Esse script inicial carrega a aba premiacao do arquivo dados_recicla.xlsx
  
# Cria um banco de dados inicial
  
# Faz a conversão do Banco em um documento JSON (necessário para entrar temporariamente
# pelo IndexedDB no Portal-DMA 
# O sistema ficou definido em forma de Progressive Web Aplication, 
# mesma tecnológia utilizada no aplicativo destinado para coleta de dados offline
# dentro da Reserva Biólogica de Tinguá, no Sistema Acari para cumprimento das
# atividades de Supervisão Ambiental)

# O aplicativo desenvolvido esta apto para modularização, ou seja, adicionar outros
# formulários para que ocorra a coleta de dados centralizada no departamento, 
# Ainda esta previsto a finalização da sincronização online automática dos dados,
# entretanto já é possivel gerar excels padronizados de vistorias e pesagens. 
# O pipeline completo automatizado fica como sugestão de andamento 


#-------------------------------PARTE I ----------------------------------------

# ============================================================
# RECICLA CEDAE - Carga inicial da aba "premiacao"
# Data: 12/03/2026
#
# Objetivo:
# 1. Ler a aba "premiacao" do arquivo dados_recicla.xlsx
# 2. Diagnosticar colunas e tipos de dados
# 3. Padronizar e tratar a base
# 4. Gerar resumos analíticos para definição dos indicativos
# 5. Exportar JSON para uso temporário no Portal DMA (IndexedDB)
#
# Observação:
# Este script é uma base inicial e pode ser ajustado conforme
# a estrutura real da planilha.
# ============================================================

# -----------------------------
# 0) PACOTES
# -----------------------------
# install.packages(c(
#   "readxl", "dplyr", "stringr", "janitor",
#   "lubridate", "jsonlite", "purrr", "tibble"
# ))

library(readxl)
library(dplyr)
library(stringr)
library(janitor)
library(lubridate)
library(jsonlite)
library(purrr)
library(tibble)

options(stringsAsFactors = FALSE)

# -----------------------------
# 1) CONFIGURAÇÕES
# -----------------------------
ARQUIVO_XLSX <- "dados_recicla.xlsx"
ABA_PREMIACAO <- "premiacao"

DIR_SAIDA <- "data"
DIR_RELATORIOS <- file.path("output", "recicla")
ARQUIVO_JSON <- file.path(DIR_SAIDA, "recicla-premiacao-seed.json")

dir.create(DIR_SAIDA, recursive = TRUE, showWarnings = FALSE)
dir.create(DIR_RELATORIOS, recursive = TRUE, showWarnings = FALSE)

# -----------------------------
# 2) FUNÇÕES AUXILIARES
# -----------------------------

normalizar_texto <- function(x) {
  x %>%
    as.character() %>%
    str_trim() %>%
    str_squish()
}

normalizar_nome_coluna <- function(nomes) {
  nomes %>%
    janitor::make_clean_names() %>%
    str_replace_all("_+", "_")
}

converter_numero_br <- function(x) {
  # Converte números em formato brasileiro
  # Ex.: "1.234,56" -> 1234.56
  if (is.numeric(x)) return(x)
  
  x %>%
    as.character() %>%
    str_replace_all("\\.", "") %>%
    str_replace_all(",", ".") %>%
    str_replace_all("[^0-9\\.-]", "") %>%
    na_if("") %>%
    as.numeric()
}

converter_data_generica <- function(x) {
  # Tenta converter datas em formatos comuns
  if (inherits(x, "Date")) return(x)
  
  suppressWarnings({
    y <- dmy(x)
    ifelse(!is.na(y), y, suppressWarnings(ymd(x)))
  }) %>%
    as.Date(origin = "1970-01-01")
}

classe_coluna <- function(v) {
  paste(class(v), collapse = ", ")
}

perfil_coluna <- function(df) {
  tibble(
    coluna = names(df),
    classe = map_chr(df, classe_coluna),
    n = map_int(df, length),
    n_na = map_int(df, ~sum(is.na(.x))),
    preenchimento_pct = round((1 - map_dbl(df, ~mean(is.na(.x)))) * 100, 1),
    distintos = map_int(df, ~n_distinct(.x, na.rm = TRUE)),
    exemplo_1 = map_chr(df, ~{
      vals <- unique(.x[!is.na(.x)])
      if (length(vals) == 0) "" else as.character(vals[1])
    }),
    exemplo_2 = map_chr(df, ~{
      vals <- unique(.x[!is.na(.x)])
      if (length(vals) < 2) "" else as.character(vals[2])
    })
  )
}

achar_coluna <- function(nomes, candidatos) {
  idx <- which(nomes %in% candidatos)
  if (length(idx) == 0) return(NA_character_)
  nomes[idx[1]]
}

# -----------------------------
# 3) LEITURA
# -----------------------------
raw_premiacao <- read_excel(
  path = ARQUIVO_XLSX,
  sheet = ABA_PREMIACAO,
  guess_max = 5000
)

cat("\n=== Leitura inicial concluída ===\n")
cat("Linhas:", nrow(raw_premiacao), "\n")
cat("Colunas:", ncol(raw_premiacao), "\n")

premiacao <- raw_premiacao %>%
  setNames(normalizar_nome_coluna(names(.))) %>%
  mutate(across(where(is.character), normalizar_texto))

cat("\n=== Nomes das colunas padronizados ===\n")
print(names(premiacao))

diagnostico <- perfil_coluna(premiacao)

cat("\n=== Diagnóstico das colunas ===\n")
print(diagnostico)

write.csv(
  diagnostico,
  file = file.path(DIR_RELATORIOS, "diagnostico_colunas_premiacao.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

# -----------------------------
# 4) TRATAMENTO ESPECÍFICO
# -----------------------------
premiacao_tratada <- premiacao %>%
  mutate(
    nome = as.character(nome),
    diretoria = as.character(diretoria),
    broche = ifelse(is.na(broche), "Nao informado", broche),
    mochila = ifelse(is.na(mochila), "Nao informado", mochila),
    quantidade_retirada_sacos_de_composto_organico =
      ifelse(is.na(quantidade_retirada_sacos_de_composto_organico), 0,
             quantidade_retirada_sacos_de_composto_organico),
    faixa_somatorio = case_when(
      somatorio >= 100 ~ "100+",
      somatorio >= 50  ~ "50-99",
      TRUE ~ "Abaixo de 50"
    ),
    status_broche = case_when(
      broche == "Entregue" ~ "Entregue",
      broche == "Pendente" ~ "Pendente",
      TRUE ~ "Nao informado"
    ),
    status_mochila = case_when(
      mochila == "Entregue" ~ "Entregue",
      mochila == "Pendente" ~ "Pendente",
      TRUE ~ "Nao informado"
    )
  )

# -----------------------------
# 5) INDICADORES PRINCIPAIS
# -----------------------------
kpis <- list(
  total_participantes = nrow(premiacao_tratada),
  total_diretorias = dplyr::n_distinct(premiacao_tratada$diretoria),
  somatorio_total = round(sum(premiacao_tratada$somatorio, na.rm = TRUE), 2),
  somatorio_medio = round(mean(premiacao_tratada$somatorio, na.rm = TRUE), 2),
  maior_somatorio = round(max(premiacao_tratada$somatorio, na.rm = TRUE), 2),
  broches_entregues = sum(premiacao_tratada$status_broche == "Entregue", na.rm = TRUE),
  broches_pendentes = sum(premiacao_tratada$status_broche == "Pendente", na.rm = TRUE),
  mochilas_entregues = sum(premiacao_tratada$status_mochila == "Entregue", na.rm = TRUE),
  mochilas_pendentes = sum(premiacao_tratada$status_mochila == "Pendente", na.rm = TRUE),
  composto_retirado_total = sum(
    premiacao_tratada$quantidade_retirada_sacos_de_composto_organico,
    na.rm = TRUE
  ),
  participantes_com_retirada = sum(
    premiacao_tratada$quantidade_retirada_sacos_de_composto_organico > 0,
    na.rm = TRUE
  ),
  estoque_composto_disponivel_max = max(
    premiacao_tratada$quantidade_de_pacotes_disponiveis_de_composto_organico_1_pacote_10_kg,
    na.rm = TRUE
  )
)

# -----------------------------
# 6) RANKING INDIVIDUAL
# -----------------------------
ranking_individual <- premiacao_tratada %>%
  arrange(desc(somatorio), nome) %>%
  mutate(posicao = row_number()) %>%
  select(
    posicao,
    n_id,
    nome,
    diretoria,
    somatorio,
    status_broche,
    status_mochila,
    quantidade_retirada_sacos_de_composto_organico
  )

top_20 <- ranking_individual %>%
  slice_head(n = 20)

# -----------------------------
# 7) RESUMO POR DIRETORIA
# -----------------------------
por_diretoria <- premiacao_tratada %>%
  group_by(diretoria) %>%
  summarise(
    participantes = n(),
    somatorio_total = round(sum(somatorio, na.rm = TRUE), 2),
    somatorio_medio = round(mean(somatorio, na.rm = TRUE), 2),
    broches_entregues = sum(status_broche == "Entregue", na.rm = TRUE),
    mochilas_entregues = sum(status_mochila == "Entregue", na.rm = TRUE),
    composto_retirado_total = sum(
      quantidade_retirada_sacos_de_composto_organico,
      na.rm = TRUE
    ),
    .groups = "drop"
  ) %>%
  arrange(desc(somatorio_total))

# -----------------------------
# 8) DISTRIBUIÇÕES
# -----------------------------
dist_faixa_somatorio <- premiacao_tratada %>%
  count(faixa_somatorio, name = "quantidade") %>%
  arrange(desc(quantidade))

dist_broche <- premiacao_tratada %>%
  count(status_broche, name = "quantidade")

dist_mochila <- premiacao_tratada %>%
  count(status_mochila, name = "quantidade")

# -----------------------------
# 9) RECOMENDAÇÕES DE APRESENTAÇÃO
# -----------------------------
apresentacao <- list(
  cards = c(
    "Total de participantes",
    "Broches entregues",
    "Mochilas entregues",
    "Composto orgânico retirado",
    "Maior somatório",
    "Diretorias participantes"
  ),
  graficos = c(
    "Barra horizontal: Top 10 participantes por somatório",
    "Barra vertical: Somatório total por diretoria",
    "Rosca: Status do broche",
    "Rosca: Status da mochila",
    "Barra: Faixas de somatório",
    "Tabela: Ranking geral"
  ),
  secoes = c(
    "Hero institucional do programa",
    "Cards de desempenho",
    "Painel de premiações",
    "Ranking dos participantes",
    "Desempenho por diretoria",
    "Quadro de composto orgânico"
  )
)

# -----------------------------
# 10) EXPORTAÇÃO JSON
# -----------------------------
seed_json <- list(
  metadata = list(
    projeto = "Recicla CEDAE",
    modulo = "premiacao",
    data_geracao = format(Sys.time(), "%Y-%m-%d %H:%M:%S"),
    total_linhas = nrow(premiacao_tratada),
    total_colunas = ncol(premiacao_tratada)
  ),
  diagnostico = diagnostico,
  kpis = kpis,
  distribuicoes = list(
    faixa_somatorio = dist_faixa_somatorio,
    broche = dist_broche,
    mochila = dist_mochila
  ),
  ranking_top_20 = top_20,
  ranking_geral = ranking_individual,
  por_diretoria = por_diretoria,
  apresentacao = apresentacao,
  registros = premiacao_tratada
)

write_json(
  seed_json,
  path = ARQUIVO_JSON,
  pretty = TRUE,
  auto_unbox = TRUE,
  na = "null"
)

cat("\n=== JSON exportado com sucesso ===\n")
cat(ARQUIVO_JSON, "\n")

# -----------------------------
# 11) RELATÓRIO DE APOIO
# -----------------------------
write.csv(
  ranking_individual,
  file = file.path(DIR_RELATORIOS, "ranking_individual.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

write.csv(
  por_diretoria,
  file = file.path(DIR_RELATORIOS, "resumo_por_diretoria.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

cat("\n=== KPIs ===\n")
print(kpis)

cat("\n=== Top 20 ===\n")
print(top_20)

cat("\n=== Por diretoria ===\n")
print(por_diretoria)

# imprimir KPI's

cat("Total de participantes:", kpis$total_participantes, "\n")
cat("Total de diretorias:", kpis$total_diretorias, "\n")
cat("Somatório total:", kpis$somatorio_total, "\n")
cat("Somatório médio:", kpis$somatorio_medio, "\n")
cat("Maior somatório:", kpis$maior_somatorio, "\n")
cat("Broches entregues:", kpis$broches_entregues, "\n")
cat("Broches pendentes:", kpis$broches_pendentes, "\n")
cat("Mochilas entregues:", kpis$mochilas_entregues, "\n")
cat("Mochilas pendentes:", kpis$mochilas_pendentes, "\n")
cat("Composto retirado total:", kpis$composto_retirado_total, "\n")
cat("Participantes com retirada:", kpis$participantes_com_retirada, "\n")
cat("Estoque disponível de composto:", kpis$estoque_composto_disponivel_max, "\n")

# top 20
top_20 %>%
  select(posicao, nome, diretoria, somatorio, status_broche, status_mochila)

ranking_individual %>%
  slice_head(n = 10) %>%
  select(posicao, nome, diretoria, somatorio)

# resumo por diretoria

por_diretoria

por_diretoria %>%
  select(diretoria, participantes, somatorio_total, somatorio_medio, broches_entregues, mochilas_entregues)

# tabelas para distribuição de gráficos

print(dist_faixa_somatorio)
print(dist_broche)
print(dist_mochila)

# dados dos compostos organicos

premiacao_tratada %>%
  filter(quantidade_retirada_sacos_de_composto_organico > 0) %>%
  select(nome, diretoria, quantidade_retirada_sacos_de_composto_organico) %>%
  arrange(desc(quantidade_retirada_sacos_de_composto_organico))

# top retiradas
premiacao_tratada %>%
  filter(quantidade_retirada_sacos_de_composto_organico > 0) %>%
  arrange(desc(quantidade_retirada_sacos_de_composto_organico)) %>%
  slice_head(n = 10) %>%
  select(nome, diretoria, quantidade_retirada_sacos_de_composto_organico)

# estoque disponivel
unique(premiacao_tratada$quantidade_de_pacotes_disponiveis_de_composto_organico_1_pacote_10_kg)

# contagens

  # quantos broches entregues
premiacao_tratada %>%
  count(status_broche)


  # mochilas entregues 
premiacao_tratada %>%
  count(status_mochila)

  # participantes por diretoria
premiacao_tratada %>%
  count(diretoria, sort = TRUE)

  # faixa de somatório
premiacao_tratada %>%
  count(faixa_somatorio, sort = TRUE)


# exportar arquivos para front

  # top 20
write.csv(
  top_20,
  "output/recicla/top_20_para_pagina.csv",
  row.names = FALSE,
  fileEncoding = "UTF-8"
)
  # resumo por diretoria
write.csv(
  por_diretoria,
  "output/recicla/diretorias_para_pagina.csv",
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

# distribuicao 
write.csv(
  dist_broche,
  "output/recicla/dist_broche_para_pagina.csv",
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

write.csv(
  dist_mochila,
  "output/recicla/dist_mochila_para_pagina.csv",
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

write.csv(
  dist_faixa_somatorio,
  "output/recicla/dist_faixa_para_pagina.csv",
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

# json 
library(jsonlite)

pagina_recicla <- list(
  kpis = kpis,
  top_20 = top_20,
  por_diretoria = por_diretoria,
  dist_broche = dist_broche,
  dist_mochila = dist_mochila,
  dist_faixa_somatorio = dist_faixa_somatorio
)

write_json(
  pagina_recicla,
  "data/recicla-pagina.json",
  pretty = TRUE,
  auto_unbox = TRUE,
  na = "null"
)