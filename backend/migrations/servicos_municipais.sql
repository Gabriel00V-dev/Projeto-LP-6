-- Serviços municipais: profissionais, agenda, animais, fila da UPA,
-- assinaturas por prestador e salas de telemedicina.
-- Ver docs/PLANO-SERVICOS-MUNICIPAIS.md.
--
-- Execute este script no Supabase SQL Editor depois de init.sql e
-- fix_schema.sql. Ele pode ser executado mais de uma vez.

-- ============================================================
-- 1. Tipo de estabelecimento
-- ============================================================
-- UPAs e clínicas veterinárias continuam sendo linhas de `clinicas`; o tipo
-- separa o fluxo (fila x agenda) sem duplicar cadastro e login.
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'clinica';

ALTER TABLE clinicas DROP CONSTRAINT IF EXISTS clinicas_tipo_check;
ALTER TABLE clinicas
  ADD CONSTRAINT clinicas_tipo_check
  CHECK (tipo IN ('clinica', 'veterinaria', 'upa', 'psicologia'));

-- "Entrar na fila, quando permitido": cada UPA decide se aceita fila pelo app.
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS aceita_fila_online BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. Profissionais
-- ============================================================
-- codigo_clinica NULL = profissional independente.
CREATE TABLE IF NOT EXISTS profissionais (
  codigo SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  fone VARCHAR(20),
  registro_profissional VARCHAR(50),
  tipo VARCHAR(30) NOT NULL
    CHECK (tipo IN ('psicologo', 'medico', 'enfermeiro', 'veterinario', 'profissional_sus')),
  codigo_clinica INTEGER REFERENCES clinicas(codigo) ON DELETE SET NULL,
  codigo_especializacao INTEGER REFERENCES especializacoes(codigo) ON DELETE SET NULL,
  bio TEXT,
  imagem TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profissionais_tipo_idx ON profissionais (tipo) WHERE ativo;
CREATE INDEX IF NOT EXISTS profissionais_clinica_idx ON profissionais (codigo_clinica);

-- ============================================================
-- 3. Disponibilidades (agenda semanal)
-- ============================================================
-- Uma linha sem codigo_profissional é uma agenda da própria clínica.
CREATE TABLE IF NOT EXISTS disponibilidades (
  codigo SERIAL PRIMARY KEY,
  codigo_profissional INTEGER REFERENCES profissionais(codigo) ON DELETE CASCADE,
  codigo_clinica INTEGER REFERENCES clinicas(codigo) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0 = domingo
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60 CHECK (duracao_minutos BETWEEN 10 AND 240),
  modalidade VARCHAR(20) NOT NULL
    CHECK (modalidade IN ('presencial', 'telemedicina')),
  ativo BOOLEAN DEFAULT TRUE,
  CHECK (hora_fim > hora_inicio),
  CHECK (codigo_profissional IS NOT NULL OR codigo_clinica IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS disponibilidades_profissional_idx
  ON disponibilidades (codigo_profissional, dia_semana) WHERE ativo;
CREATE INDEX IF NOT EXISTS disponibilidades_clinica_idx
  ON disponibilidades (codigo_clinica, dia_semana) WHERE ativo;

-- ============================================================
-- 4. Animais e vacinas
-- ============================================================
CREATE TABLE IF NOT EXISTS animais (
  codigo SERIAL PRIMARY KEY,
  codigo_paciente INTEGER NOT NULL REFERENCES pacientes(codigo) ON DELETE CASCADE,
  nome VARCHAR(80) NOT NULL,
  especie VARCHAR(30) NOT NULL,
  raca VARCHAR(80),
  data_nascimento DATE,
  peso DECIMAL(6,2),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS animais_paciente_idx ON animais (codigo_paciente);

CREATE TABLE IF NOT EXISTS vacinas_animais (
  codigo SERIAL PRIMARY KEY,
  codigo_animal INTEGER NOT NULL REFERENCES animais(codigo) ON DELETE CASCADE,
  nome VARCHAR(80) NOT NULL,
  aplicada_em DATE NOT NULL,
  proxima_dose DATE,
  registrada_por VARCHAR(20) NOT NULL DEFAULT 'paciente'
    CHECK (registrada_por IN ('paciente', 'clinica', 'profissional')),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 5. Consultas: profissional, animal, modalidade e ciclo de vida
-- ============================================================
-- Profissional independente não tem clínica, e psicologia/veterinária nem
-- sempre usam a tabela de especializações médicas.
ALTER TABLE consultas ALTER COLUMN codigo_clinica DROP NOT NULL;
ALTER TABLE consultas ALTER COLUMN codigo_especializacao DROP NOT NULL;

ALTER TABLE consultas
  ADD COLUMN IF NOT EXISTS codigo_profissional INTEGER REFERENCES profissionais(codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo_animal INTEGER REFERENCES animais(codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modalidade VARCHAR(20) NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS tipo_atendimento VARCHAR(30),
  ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMP;

ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_modalidade_check;
ALTER TABLE consultas
  ADD CONSTRAINT consultas_modalidade_check
  CHECK (modalidade IN ('presencial', 'telemedicina'));

ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_tipo_atendimento_check;
ALTER TABLE consultas
  ADD CONSTRAINT consultas_tipo_atendimento_check
  CHECK (tipo_atendimento IS NULL OR tipo_atendimento IN (
    'consulta', 'vacinacao', 'castracao', 'retorno', 'orientacao_online', 'emergencia'
  ));

-- 'em_atendimento' e 'faltou' entram para o fluxo do prestador (iniciar
-- atendimento, registrar ausência / taxa de presença).
ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_status_check;
ALTER TABLE consultas
  ADD CONSTRAINT consultas_status_check
  CHECK (status IN ('agendada', 'confirmada', 'em_atendimento', 'cancelada', 'concluida', 'faltou'));

ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_prestador_check;
ALTER TABLE consultas
  ADD CONSTRAINT consultas_prestador_check
  CHECK (codigo_clinica IS NOT NULL OR codigo_profissional IS NOT NULL);

-- Impede dois atendimentos no mesmo horário para o mesmo profissional.
-- O backend também valida, mas só o índice resolve duas requisições simultâneas.
CREATE UNIQUE INDEX IF NOT EXISTS consultas_profissional_horario_unico
  ON consultas (codigo_profissional, data_hora)
  WHERE codigo_profissional IS NOT NULL AND status NOT IN ('cancelada');

CREATE INDEX IF NOT EXISTS consultas_profissional_idx ON consultas (codigo_profissional, data_hora);
CREATE INDEX IF NOT EXISTS consultas_animal_idx ON consultas (codigo_animal);

-- ============================================================
-- 6. Evoluções (prontuário)
-- ============================================================
-- Acesso restrito ao paciente e ao prestador da consulta (validado no backend).
CREATE TABLE IF NOT EXISTS evolucoes (
  codigo SERIAL PRIMARY KEY,
  codigo_consulta INTEGER NOT NULL REFERENCES consultas(codigo) ON DELETE CASCADE,
  autor_papel VARCHAR(20) NOT NULL CHECK (autor_papel IN ('clinica', 'profissional')),
  autor_codigo INTEGER NOT NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evolucoes_consulta_idx ON evolucoes (codigo_consulta);

-- ============================================================
-- 7. Fila da UPA
-- ============================================================
CREATE TABLE IF NOT EXISTS filas_upa (
  codigo SERIAL PRIMARY KEY,
  codigo_paciente INTEGER NOT NULL REFERENCES pacientes(codigo) ON DELETE CASCADE,
  codigo_clinica INTEGER NOT NULL REFERENCES clinicas(codigo) ON DELETE CASCADE,
  protocolo VARCHAR(30) UNIQUE NOT NULL,
  sintomas TEXT,
  classificacao_risco VARCHAR(20)
    CHECK (classificacao_risco IS NULL OR classificacao_risco IN ('vermelho', 'amarelo', 'verde', 'azul')),
  status VARCHAR(30) NOT NULL DEFAULT 'aguardando_triagem'
    CHECK (status IN (
      'aguardando_triagem', 'em_triagem', 'aguardando_atendimento',
      'em_atendimento', 'finalizado', 'cancelado'
    )),
  setor VARCHAR(40),
  codigo_profissional INTEGER REFERENCES profissionais(codigo) ON DELETE SET NULL,
  entrada_em TIMESTAMP DEFAULT NOW(),
  triado_em TIMESTAMP,
  chamado_em TIMESTAMP,
  finalizado_em TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS filas_upa_unidade_idx ON filas_upa (codigo_clinica, status);

-- Um paciente só pode estar em uma fila ativa por vez.
CREATE UNIQUE INDEX IF NOT EXISTS filas_upa_paciente_ativo_unico
  ON filas_upa (codigo_paciente)
  WHERE status NOT IN ('finalizado', 'cancelado');

-- ============================================================
-- 8. Assinaturas por prestador (clínica ou profissional independente)
-- ============================================================
CREATE TABLE IF NOT EXISTS assinaturas (
  codigo SERIAL PRIMARY KEY,
  tipo_prestador VARCHAR(30) NOT NULL CHECK (tipo_prestador IN ('clinica', 'profissional')),
  codigo_prestador INTEGER NOT NULL,
  plano VARCHAR(30) NOT NULL DEFAULT 'basico'
    CHECK (plano IN ('basico', 'profissional', 'enterprise')),
  addon_telemedicina BOOLEAN NOT NULL DEFAULT FALSE,
  addon_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  addon_relatorios BOOLEAN NOT NULL DEFAULT FALSE,
  addon_api_externa BOOLEAN NOT NULL DEFAULT FALSE,
  trial_ativo BOOLEAN NOT NULL DEFAULT FALSE,
  trial_expira_em TIMESTAMP,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  inicio_em TIMESTAMP DEFAULT NOW(),
  expira_em TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_prestador_ativo_unico
  ON assinaturas (tipo_prestador, codigo_prestador)
  WHERE ativo;

-- Migra as assinaturas que hoje vivem em clinica_assinaturas, se a tabela
-- existir. Ela continua lá intacta; o backend passa a ler só de `assinaturas`.
DO $$
BEGIN
  IF to_regclass('public.clinica_assinaturas') IS NOT NULL THEN
    INSERT INTO assinaturas (
      tipo_prestador, codigo_prestador, plano,
      addon_telemedicina, addon_pdf, addon_relatorios, addon_api_externa,
      trial_ativo, trial_expira_em, ativo
    )
    SELECT
      'clinica', ca.codigo_clinica, ca.plano,
      ca.addon_telemedicina, ca.addon_pdf, ca.addon_relatorios, ca.addon_api_externa,
      ca.trial_ativo, ca.trial_expira_em, ca.ativo
    FROM clinica_assinaturas ca
    WHERE ca.ativo
      AND NOT EXISTS (
        SELECT 1 FROM assinaturas a
        WHERE a.tipo_prestador = 'clinica'
          AND a.codigo_prestador = ca.codigo_clinica
          AND a.ativo
      );
  END IF;
END $$;

-- ============================================================
-- 9. Salas de telemedicina e registro de acesso
-- ============================================================
CREATE TABLE IF NOT EXISTS salas_telemedicina (
  codigo SERIAL PRIMARY KEY,
  codigo_consulta INTEGER NOT NULL UNIQUE REFERENCES consultas(codigo) ON DELETE CASCADE,
  room_id VARCHAR(150) UNIQUE NOT NULL,
  meeting_url TEXT NOT NULL,
  criada_em TIMESTAMP DEFAULT NOW(),
  liberada_em TIMESTAMP,
  encerrada_em TIMESTAMP
);

CREATE TABLE IF NOT EXISTS acessos_salas (
  codigo SERIAL PRIMARY KEY,
  codigo_sala INTEGER NOT NULL REFERENCES salas_telemedicina(codigo) ON DELETE CASCADE,
  auth_user_id VARCHAR(64) NOT NULL,
  papel VARCHAR(20) NOT NULL,
  codigo_entidade INTEGER NOT NULL,
  entrou_em TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 10. RLS
-- ============================================================
-- O backend acessa as tabelas com a service_role (que ignora RLS) e faz o
-- controle de acesso no authMiddleware. Ligar o RLS sem policies impede que
-- a chave anon, que é pública, leia dados de saúde direto do PostgREST.
ALTER TABLE profissionais       ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE animais             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacinas_animais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolucoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE filas_upa           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE salas_telemedicina  ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessos_salas       ENABLE ROW LEVEL SECURITY;

-- Recarrega o cache de schema do PostgREST para as colunas novas aparecerem
-- na API imediatamente.
NOTIFY pgrst, 'reload schema';
