-- Aprovação de cadastros pela prefeitura: clínicas e profissionais só passam
-- a atender (e a aparecer para os pacientes) depois de aprovados.
--
-- Execute no Supabase SQL Editor DEPOIS de servicos_municipais.sql (precisa
-- da tabela profissionais). Pode ser executado mais de uma vez.
--
-- Acesso da prefeitura (não existe cadastro público para este perfil):
--   1. Supabase > Authentication > Users > Add user: e-mail e senha, com
--      "Auto Confirm User" marcado.
--   2. INSERT INTO administradores (nome, email)
--      VALUES ('Secretaria Municipal de Saúde', 'o-mesmo-email@prefeitura.gov.br');
--   3. No app, "Acesso da prefeitura" na tela de login.

-- Para antes de alterar qualquer coisa se a migration anterior não rodou.
DO $$
BEGIN
  IF to_regclass('public.profissionais') IS NULL THEN
    RAISE EXCEPTION 'Execute servicos_municipais.sql antes de aprovacao_cadastros.sql (tabela profissionais não existe).';
  END IF;
END $$;

-- ============================================================
-- 1. Contas da prefeitura
-- ============================================================
CREATE TABLE IF NOT EXISTS administradores (
  codigo SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. Status do cadastro
-- ============================================================
-- A coluna entra com default 'aprovado' para que clínicas e profissionais que
-- já existem continuem funcionando; logo depois o default passa a 'pendente',
-- que é o que vale para todo cadastro novo.
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS status_cadastro VARCHAR(20) NOT NULL DEFAULT 'aprovado';
ALTER TABLE clinicas ALTER COLUMN status_cadastro SET DEFAULT 'pendente';

ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS status_cadastro VARCHAR(20) NOT NULL DEFAULT 'aprovado';
ALTER TABLE profissionais ALTER COLUMN status_cadastro SET DEFAULT 'pendente';

ALTER TABLE clinicas DROP CONSTRAINT IF EXISTS clinicas_status_cadastro_check;
ALTER TABLE clinicas
  ADD CONSTRAINT clinicas_status_cadastro_check
  CHECK (status_cadastro IN ('pendente', 'aprovado', 'reprovado'));

ALTER TABLE profissionais DROP CONSTRAINT IF EXISTS profissionais_status_cadastro_check;
ALTER TABLE profissionais
  ADD CONSTRAINT profissionais_status_cadastro_check
  CHECK (status_cadastro IN ('pendente', 'aprovado', 'reprovado'));

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT,
  ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS analisado_por INTEGER REFERENCES administradores(codigo) ON DELETE SET NULL;

ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT,
  ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS analisado_por INTEGER REFERENCES administradores(codigo) ON DELETE SET NULL;

-- ============================================================
-- 3. Dados que a prefeitura confere
-- ============================================================
-- CNPJ e CPF guardados só com dígitos.
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14),
  ADD COLUMN IF NOT EXISTS responsavel_tecnico VARCHAR(120),
  ADD COLUMN IF NOT EXISTS registro_responsavel VARCHAR(50);

ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);

CREATE UNIQUE INDEX IF NOT EXISTS clinicas_cnpj_unico ON clinicas (cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profissionais_cpf_unico ON profissionais (cpf) WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS clinicas_status_cadastro_idx ON clinicas (status_cadastro);
CREATE INDEX IF NOT EXISTS profissionais_status_cadastro_idx ON profissionais (status_cadastro);

-- ============================================================
-- 4. Histórico das análises
-- ============================================================
CREATE TABLE IF NOT EXISTS analises_cadastro (
  codigo SERIAL PRIMARY KEY,
  tipo_cadastro VARCHAR(20) NOT NULL CHECK (tipo_cadastro IN ('clinica', 'profissional')),
  codigo_cadastro INTEGER NOT NULL,
  decisao VARCHAR(20) NOT NULL CHECK (decisao IN ('aprovado', 'reprovado', 'reenviado')),
  motivo TEXT,
  codigo_administrador INTEGER REFERENCES administradores(codigo) ON DELETE SET NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analises_cadastro_idx ON analises_cadastro (tipo_cadastro, codigo_cadastro);

-- ============================================================
-- 5. RLS (o backend usa a service_role; a chave anon não lê nada aqui)
-- ============================================================
ALTER TABLE administradores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises_cadastro  ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
