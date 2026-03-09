# ============================================================
# MVP Aedes - Exportação do PostgreSQL para aedes-seed.json
# Baseado no schema: aedes
# Saída: data/aedes-seed.json
# ============================================================

# -----------------------------
# 0) PACOTES
# -----------------------------
# install.packages(c(
#   "DBI", "RPostgres", "dplyr", "jsonlite",
#   "tibble", "stringr", "lubridate", "purrr"
# ))

library(DBI)
library(RPostgres)
library(dplyr)
library(jsonlite)
library(tibble)
library(stringr)
library(lubridate)
library(purrr)

options(stringsAsFactors = FALSE)

# -----------------------------
# 1) CONFIGURAÇÕES
# -----------------------------
DB_HOST     <- "127.0.0.1"
DB_PORT     <- 5433
DB_NAME     <- "dma"
DB_USER     <- "postgres"
DB_PASSWORD <- "cedae"
DB_SCHEMA   <- "aedes"

DIR_SAIDA   <- "data"
ARQ_SAIDA   <- file.path(DIR_SAIDA, "aedes-seed.json")

# -----------------------------
# 2) FUNÇÕES AUXILIARES
# -----------------------------
msg <- function(...) cat(glue::glue(...), "\n")

na_para_null_string <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- NA_character_
  x
}

bool_to_sim_nao <- function(x) {
  case_when(
    isTRUE(x)  ~ "sim",
    identical(x, FALSE) ~ "nao",
    is.na(x)   ~ NA_character_,
    TRUE       ~ NA_character_
  )
}

to_iso_date <- function(x) {
  if (inherits(x, "Date")) {
    return(ifelse(is.na(x), NA_character_, format(x, "%Y-%m-%d")))
  }
  x <- as.Date(x)
  ifelse(is.na(x), NA_character_, format(x, "%Y-%m-%d"))
}

clean_detail <- function(x) {
  x <- as.character(x)
  x <- str_squish(x)
  x[x == ""] <- NA_character_
  x
}

compact_list <- function(x) {
  x <- x[!is.na(x)]
  x <- x[x != ""]
  unname(unique(x))
}

dir.create(DIR_SAIDA, recursive = TRUE, showWarnings = FALSE)

# -----------------------------
# 3) CONEXÃO
# -----------------------------
msg("Conectando ao PostgreSQL...")

con <- dbConnect(
  RPostgres::Postgres(),
  host     = DB_HOST,
  port     = DB_PORT,
  dbname   = DB_NAME,
  user     = DB_USER,
  password = DB_PASSWORD
)

on.exit({
  try(dbDisconnect(con), silent = TRUE)
}, add = TRUE)

# -----------------------------
# 4) LEITURA DAS TABELAS
# -----------------------------
msg("Lendo tabelas do schema {DB_SCHEMA}...")

dim_unidade <- dbReadTable(con, Id(schema = DB_SCHEMA, table = "dim_unidade")) |>
  as_tibble()

fato_vistoria <- dbReadTable(con, Id(schema = DB_SCHEMA, table = "fato_vistoria")) |>
  as_tibble()

fato_local_foco <- dbReadTable(con, Id(schema = DB_SCHEMA, table = "fato_local_foco")) |>
  as_tibble()

fato_motivo_nao_remediacao <- dbReadTable(con, Id(schema = DB_SCHEMA, table = "fato_motivo_nao_remediacao")) |>
  as_tibble()

fato_motivo_nao_vistoria <- dbReadTable(con, Id(schema = DB_SCHEMA, table = "fato_motivo_nao_vistoria")) |>
  as_tibble()

# -----------------------------
# 5) PREPARAR UNIDADES
# -----------------------------
msg("Preparando unidades...")

unidades_json <- dim_unidade |>
  arrange(unidade_id) |>
  mutate(
    data_cadastro = to_iso_date(data_cadastro)
  ) |>
  transmute(
    id = unidade_id,
    nome = unidade_nome,
    nomeAntigo = unidade_nome_antigo,
    endereco = endereco,
    municipio = municipio,
    bairro = bairro,
    diretoria = diretoria,
    setor = setor,
    gerente = pmap(
      list(gr_nome, gr_email, gr_telefone),
      function(nome, email, telefone) {
        list(
          nome = clean_detail(nome),
          email = clean_detail(email),
          telefone = clean_detail(telefone)
        )
      }
    ),
    focal = pmap(
      list(fr_nome, fr_email, fr_telefone),
      function(nome, email, telefone) {
        list(
          nome = clean_detail(nome),
          email = clean_detail(email),
          telefone = clean_detail(telefone)
        )
      }
    ),
    apoio = pmap(
      list(bg_nome, bg_email, bg_telefone),
      function(nome, email, telefone) {
        list(
          nome = clean_detail(nome),
          email = clean_detail(email),
          telefone = clean_detail(telefone)
        )
      }
    ),
    dataCadastro = data_cadastro
  )

# -----------------------------
# 6) AGREGAÇÕES DAS TABELAS FILHAS
# -----------------------------
msg("Agregando locais de foco e motivos...")

locais_foco_agg <- fato_local_foco |>
  mutate(
    tipo_local_foco = clean_detail(tipo_local_foco),
    detalhe = clean_detail(detalhe)
  ) |>
  group_by(vistoria_id) |>
  summarise(
    locaisFoco = list(
      pmap(
        list(tipo_local_foco, detalhe),
        function(tipo, detalhe) {
          list(
            tipo = tipo,
            detalhe = detalhe
          )
        }
      )
    ),
    locaisFocoResumo = list(compact_list(tipo_local_foco)),
    .groups = "drop"
  )

motivos_nr_agg <- fato_motivo_nao_remediacao |>
  mutate(
    motivo_nao_remediacao = clean_detail(motivo_nao_remediacao),
    detalhe = clean_detail(detalhe)
  ) |>
  group_by(vistoria_id) |>
  summarise(
    motivosNaoRemediacao = list(
      pmap(
        list(motivo_nao_remediacao, detalhe),
        function(tipo, detalhe) {
          list(
            tipo = tipo,
            detalhe = detalhe
          )
        }
      )
    ),
    motivosNaoRemediacaoResumo = list(compact_list(motivo_nao_remediacao)),
    .groups = "drop"
  )

motivos_nv_agg <- fato_motivo_nao_vistoria |>
  mutate(
    motivo_nao_vistoria = clean_detail(motivo_nao_vistoria),
    detalhe = clean_detail(detalhe)
  ) |>
  group_by(vistoria_id) |>
  summarise(
    motivosNaoVistoria = list(
      pmap(
        list(motivo_nao_vistoria, detalhe),
        function(tipo, detalhe) {
          list(
            tipo = tipo,
            detalhe = detalhe
          )
        }
      )
    ),
    motivosNaoVistoriaResumo = list(compact_list(motivo_nao_vistoria)),
    .groups = "drop"
  )

# -----------------------------
# 7) PREPARAR VISTORIAS
# -----------------------------
`%||%` <- function(a, b) if (is.null(a)) b else a
msg("Preparando vistorias...")

vistorias_base <- fato_vistoria |>
  left_join(
    dim_unidade |>
      select(unidade_id, unidade_nome, endereco, municipio, bairro),
    by = "unidade_id"
  ) |>
  left_join(locais_foco_agg, by = "vistoria_id") |>
  left_join(motivos_nr_agg, by = "vistoria_id") |>
  left_join(motivos_nv_agg, by = "vistoria_id") |>
  arrange(data_referencia, vistoria_id) |>
  mutate(
    data_referencia = to_iso_date(data_referencia),
    
    vistoriaRealizada = case_when(
      status_vistoria == "realizada"     ~ "sim",
      status_vistoria == "nao_realizada" ~ "nao",
      status_vistoria == "nao_informado" ~ "nao_informado",
      TRUE                               ~ NA_character_
    ),
    
    focoEncontrado = case_when(
      isTRUE(foco_encontrado)  ~ "sim",
      identical(foco_encontrado, FALSE) ~ "nao",
      is.na(foco_encontrado)   ~ NA_character_,
      TRUE                     ~ NA_character_
    ),
    
    focoRemediado = case_when(
      isTRUE(remediado)  ~ "sim",
      identical(remediado, FALSE) ~ "nao",
      is.na(remediado)   ~ NA_character_,
      TRUE               ~ NA_character_
    ),
    
    locaisFoco = map(locaisFoco, ~ .x %||% list()),
    locaisFocoResumo = map(locaisFocoResumo, ~ .x %||% character()),
    
    motivosNaoRemediacao = map(motivosNaoRemediacao, ~ .x %||% list()),
    motivosNaoRemediacaoResumo = map(motivosNaoRemediacaoResumo, ~ .x %||% character()),
    
    motivosNaoVistoria = map(motivosNaoVistoria, ~ .x %||% list()),
    motivosNaoVistoriaResumo = map(motivosNaoVistoriaResumo, ~ .x %||% character())
  )

# operador auxiliar
#`%||%` <- function(a, b) if (is.null(a)) b else a

vistorias_json <- vistorias_base |>
  transmute(
    id = vistoria_id,
    idOrigem = id_origem,
    unidadeId = unidade_id,
    unidade = unidade_nome,
    unidadeOrigem = unidade_origem,
    endereco = endereco,
    municipio = municipio,
    bairro = bairro,
    semanaAcumulada = semana_acumulada,
    ano = ano,
    semana = semana,
    dataVistoria = data_referencia,
    statusVistoria = status_vistoria,
    vistoriaRealizada = vistoriaRealizada,
    focoEncontrado = focoEncontrado,
    focoRemediado = focoRemediado,
    locaisFoco = locaisFoco,
    locaisFocoResumo = locaisFocoResumo,
    motivosNaoRemediacao = motivosNaoRemediacao,
    motivosNaoRemediacaoResumo = motivosNaoRemediacaoResumo,
    motivosNaoVistoria = motivosNaoVistoria,
    motivosNaoVistoriaResumo = motivosNaoVistoriaResumo,
    matchCadastro = match_cadastro,
    flags = pmap(
      list(
        flag_status_ausente,
        flag_unidade_ausente,
        flag_sem_match_cadastro,
        flag_foco_sem_vistoria
      ),
      function(
    flag_status_ausente,
    flag_unidade_ausente,
    flag_sem_match_cadastro,
    flag_foco_sem_vistoria
      ) {
        list(
          statusAusente = isTRUE(flag_status_ausente),
          unidadeAusente = isTRUE(flag_unidade_ausente),
          semMatchCadastro = isTRUE(flag_sem_match_cadastro),
          focoSemVistoria = isTRUE(flag_foco_sem_vistoria)
        )
      }
    )
  )

# -----------------------------
# 8) METADADOS E RESUMO
# -----------------------------
msg("Montando metadados...")

faixa_datas <- vistorias_base |>
  summarise(
    dataMin = suppressWarnings(min(as.Date(data_referencia), na.rm = TRUE)),
    dataMax = suppressWarnings(max(as.Date(data_referencia), na.rm = TRUE))
  )

data_min <- if (is.finite(faixa_datas$dataMin)) format(faixa_datas$dataMin, "%Y-%m-%d") else NA_character_
data_max <- if (is.finite(faixa_datas$dataMax)) format(faixa_datas$dataMax, "%Y-%m-%d") else NA_character_

resumo <- list(
  totalUnidades = nrow(unidades_json),
  totalVistorias = nrow(vistorias_json),
  totalLocaisFoco = nrow(fato_local_foco),
  totalMotivosNaoRemediacao = nrow(fato_motivo_nao_remediacao),
  totalMotivosNaoVistoria = nrow(fato_motivo_nao_vistoria),
  periodo = list(
    dataMin = data_min,
    dataMax = data_max
  )
)

metadata <- list(
  sistema = "Portal DMA",
  modulo = "Aedes",
  schemaOrigem = DB_SCHEMA,
  geradoEm = format(Sys.time(), "%Y-%m-%d %H:%M:%S"),
  origem = "PostgreSQL",
  resumo = resumo,
  regraCertificado = list(
    criterio = "mínimo de 4 vistorias no mês por unidade",
    minimoVistoriasMes = 4
  )
)

# -----------------------------
# 9) OBJETO FINAL
# -----------------------------
msg("Montando objeto final...")

seed <- list(
  metadata = metadata,
  unidades = unidades_json,
  vistorias = vistorias_json
)

# -----------------------------
# 10) EXPORTAÇÃO JSON
# -----------------------------
msg("Gravando JSON em: {ARQ_SAIDA}")

jsonlite::write_json(
  seed,
  path = ARQ_SAIDA,
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null",
  digits = NA
)

msg("Arquivo gerado com sucesso.")
msg("Unidades exportadas: {nrow(unidades_json)}")
msg("Vistorias exportadas: {nrow(vistorias_json)}")
msg("Saída final: {ARQ_SAIDA}")