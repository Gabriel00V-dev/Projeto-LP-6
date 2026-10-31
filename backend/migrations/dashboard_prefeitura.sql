-- Dashboard da prefeitura (plano, seção 2): indicadores calculados no banco,
-- numa chamada só. Calcular no app exigiria baixar as consultas inteiras do
-- período — e o PostgREST corta respostas em 1000 linhas, o que deixaria os
-- números errados sem aviso.
--
-- Execute no Supabase SQL Editor DEPOIS de servicos_municipais.sql e
-- aprovacao_cadastros.sql. Pode ser executado mais de uma vez.
--
-- Fusos: consultas.data_hora é horário de parede (o que o paciente escolheu);
-- os carimbos NOW() (filas_upa.entrada_em etc.) estão em UTC. A função
-- converte o período pedido para cada um.

DO $$
BEGIN
  IF to_regclass('public.profissionais') IS NULL OR to_regclass('public.analises_cadastro') IS NULL THEN
    RAISE EXCEPTION 'Execute servicos_municipais.sql e aprovacao_cadastros.sql antes de dashboard_prefeitura.sql.';
  END IF;
END $$;

-- O dashboard filtra por período em todas as clínicas de uma vez.
CREATE INDEX IF NOT EXISTS consultas_data_hora_idx ON consultas (data_hora);
CREATE INDEX IF NOT EXISTS filas_upa_entrada_idx ON filas_upa (entrada_em);

CREATE OR REPLACE FUNCTION dashboard_prefeitura(
  p_de DATE,
  p_ate DATE,
  p_fuso TEXT DEFAULT 'America/Sao_Paulo'
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
WITH
limites AS (
  SELECT
    p_de::timestamp AS ini,
    (p_ate + 1)::timestamp AS fim,
    (p_de::timestamp AT TIME ZONE p_fuso) AT TIME ZONE 'UTC' AS ini_utc,
    ((p_ate + 1)::timestamp AT TIME ZONE p_fuso) AT TIME ZONE 'UTC' AS fim_utc,
    (now() AT TIME ZONE p_fuso) AS agora_local
),
-- Área de cada consulta. A modalidade (presencial/online) é independente
-- disso: uma sessão de psicologia online conta em psicologia E em telemedicina.
consultas_area AS (
  SELECT
    co.codigo, co.data_hora, co.status, co.modalidade, co.tipo_atendimento,
    CASE
      WHEN co.codigo_animal IS NOT NULL OR p.tipo = 'veterinario' OR cl.tipo = 'veterinaria' THEN 'veterinaria'
      WHEN p.tipo = 'psicologo' OR cl.tipo = 'psicologia' THEN 'psicologia'
      ELSE 'clinica'
    END AS area
  FROM consultas co
  LEFT JOIN profissionais p ON p.codigo = co.codigo_profissional
  LEFT JOIN clinicas cl ON cl.codigo = co.codigo_clinica
),
c AS (
  SELECT ca.* FROM consultas_area ca, limites l
  WHERE ca.data_hora >= l.ini AND ca.data_hora < l.fim
),
-- Agenda futura (não limitada ao período): "retornos agendados", "aguardando atendimento".
futuras AS (
  SELECT ca.* FROM consultas_area ca, limites l
  WHERE ca.data_hora >= l.agora_local AND ca.status IN ('agendada', 'confirmada')
),
f AS (
  SELECT fu.* FROM filas_upa fu, limites l
  WHERE fu.entrada_em >= l.ini_utc AND fu.entrada_em < l.fim_utc
),
espera AS (
  SELECT round(avg(extract(epoch FROM (chamado_em - entrada_em)) / 60))::int AS minutos
  FROM f WHERE chamado_em IS NOT NULL AND chamado_em >= entrada_em
),
dias AS (
  SELECT d::date AS dia FROM generate_series(p_de::timestamp, p_ate::timestamp, interval '1 day') d
)
SELECT jsonb_build_object(
  'periodo', jsonb_build_object('de', p_de, 'ate', p_ate),

  'visao_geral', jsonb_build_object(
    'atendimentos_realizados',
      (SELECT count(*) FROM c WHERE status = 'concluida')
      + (SELECT count(*) FROM f WHERE status = 'finalizado'),
    'consultas_marcadas', (SELECT count(*) FROM c WHERE status <> 'cancelada'),
    'cancelamentos', (SELECT count(*) FROM c WHERE status = 'cancelada'),
    'atendimentos_online', (SELECT count(*) FROM c WHERE status = 'concluida' AND modalidade = 'telemedicina'),
    'taxa_presenca', (
      SELECT CASE WHEN count(*) FILTER (WHERE status IN ('concluida', 'faltou')) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE status = 'concluida')
                   / count(*) FILTER (WHERE status IN ('concluida', 'faltou'))) END
      FROM c
    ),
    'espera_media_upa_minutos', (SELECT minutos FROM espera),
    'cadastros_pendentes',
      (SELECT count(*) FROM clinicas WHERE status_cadastro = 'pendente')
      + (SELECT count(*) FROM profissionais WHERE status_cadastro = 'pendente'),
    -- Realizados por área (UPA = pacientes chamados para atendimento).
    'por_servico', jsonb_build_array(
      jsonb_build_object('servico', 'upa', 'total', (SELECT count(*) FROM f WHERE chamado_em IS NOT NULL)),
      jsonb_build_object('servico', 'clinica', 'total', (SELECT count(*) FROM c WHERE area = 'clinica' AND status = 'concluida')),
      jsonb_build_object('servico', 'psicologia', 'total', (SELECT count(*) FROM c WHERE area = 'psicologia' AND status = 'concluida')),
      jsonb_build_object('servico', 'veterinaria', 'total', (SELECT count(*) FROM c WHERE area = 'veterinaria' AND status = 'concluida'))
    ),
    -- Demanda por dia: consultas marcadas + entradas na fila da UPA.
    'serie_diaria', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', d.total) ORDER BY d.dia), '[]'::jsonb)
      FROM (
        SELECT dias.dia,
          (SELECT count(*) FROM c WHERE c.data_hora::date = dias.dia AND c.status <> 'cancelada')
          + (SELECT count(*) FROM f WHERE ((f.entrada_em AT TIME ZONE 'UTC') AT TIME ZONE p_fuso)::date = dias.dia) AS total
        FROM dias
      ) d
    ),
    'rede', jsonb_build_object(
      'estabelecimentos', (SELECT count(*) FROM clinicas WHERE status_cadastro = 'aprovado'),
      'profissionais', (SELECT count(*) FROM profissionais WHERE status_cadastro = 'aprovado' AND ativo)
    )
  ),

  'saude_publica', jsonb_build_object(
    'aguardando_agora', (SELECT count(*) FROM filas_upa WHERE status IN ('aguardando_triagem', 'em_triagem', 'aguardando_atendimento')),
    'em_atendimento_agora', (SELECT count(*) FROM filas_upa WHERE status = 'em_atendimento'),
    'entradas', (SELECT count(*) FROM f),
    'atendidos', (SELECT count(*) FROM f WHERE chamado_em IS NOT NULL),
    'finalizados', (SELECT count(*) FROM f WHERE status = 'finalizado'),
    'desistencias', (SELECT count(*) FROM f WHERE status = 'cancelado'),
    'espera_media_minutos', (SELECT minutos FROM espera),
    'risco', jsonb_build_object(
      'vermelho', (SELECT count(*) FROM f WHERE classificacao_risco = 'vermelho'),
      'amarelo', (SELECT count(*) FROM f WHERE classificacao_risco = 'amarelo'),
      'verde', (SELECT count(*) FROM f WHERE classificacao_risco = 'verde'),
      'azul', (SELECT count(*) FROM f WHERE classificacao_risco = 'azul'),
      'sem_classificacao', (SELECT count(*) FROM f WHERE classificacao_risco IS NULL)
    ),
    'unidades', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'codigo', u.codigo,
        'nome', u.nome,
        'aceita_fila_online', u.aceita_fila_online,
        'aguardando', (SELECT count(*) FROM filas_upa fu WHERE fu.codigo_clinica = u.codigo
                         AND fu.status IN ('aguardando_triagem', 'em_triagem', 'aguardando_atendimento')),
        'em_atendimento', (SELECT count(*) FROM filas_upa fu WHERE fu.codigo_clinica = u.codigo AND fu.status = 'em_atendimento'),
        'entradas_periodo', (SELECT count(*) FROM f WHERE f.codigo_clinica = u.codigo),
        'espera_media_minutos', (
          SELECT round(avg(extract(epoch FROM (chamado_em - entrada_em)) / 60))::int
          FROM f WHERE f.codigo_clinica = u.codigo AND chamado_em IS NOT NULL AND chamado_em >= entrada_em
        )
      ) ORDER BY u.nome), '[]'::jsonb)
      FROM clinicas u WHERE u.tipo = 'upa' AND u.status_cadastro = 'aprovado'
    )
  ),

  'psicologia', jsonb_build_object(
    'sessoes_realizadas', (SELECT count(*) FROM c WHERE area = 'psicologia' AND status = 'concluida'),
    'sessoes_online', (SELECT count(*) FROM c WHERE area = 'psicologia' AND status = 'concluida' AND modalidade = 'telemedicina'),
    'faltas', (SELECT count(*) FROM c WHERE area = 'psicologia' AND status = 'faltou'),
    'cancelamentos', (SELECT count(*) FROM c WHERE area = 'psicologia' AND status = 'cancelada'),
    'taxa_presenca', (
      SELECT CASE WHEN count(*) FILTER (WHERE status IN ('concluida', 'faltou')) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE status = 'concluida')
                   / count(*) FILTER (WHERE status IN ('concluida', 'faltou'))) END
      FROM c WHERE area = 'psicologia'
    ),
    'agendadas_futuras', (SELECT count(*) FROM futuras WHERE area = 'psicologia'),
    'profissionais', (SELECT count(*) FROM profissionais WHERE tipo = 'psicologo' AND status_cadastro = 'aprovado' AND ativo)
  ),

  'protecao_animal', jsonb_build_object(
    'consultas_realizadas', (SELECT count(*) FROM c WHERE area = 'veterinaria' AND status = 'concluida'),
    'castracoes', (SELECT count(*) FROM c WHERE area = 'veterinaria' AND status = 'concluida' AND tipo_atendimento = 'castracao'),
    'vacinacoes', (SELECT count(*) FROM c WHERE area = 'veterinaria' AND status = 'concluida' AND tipo_atendimento = 'vacinacao'),
    'aguardando_atendimento', (SELECT count(*) FROM futuras WHERE area = 'veterinaria'),
    'animais_cadastrados', (SELECT count(*) FROM animais),
    'clinicas_credenciadas', (SELECT count(*) FROM clinicas WHERE tipo = 'veterinaria' AND status_cadastro = 'aprovado'),
    'veterinarios', (SELECT count(*) FROM profissionais WHERE tipo = 'veterinario' AND status_cadastro = 'aprovado' AND ativo)
  ),

  'telemedicina', jsonb_build_object(
    'consultas_marcadas', (SELECT count(*) FROM c WHERE modalidade = 'telemedicina' AND status <> 'cancelada'),
    'consultas_realizadas', (SELECT count(*) FROM c WHERE modalidade = 'telemedicina' AND status = 'concluida'),
    'faltas', (SELECT count(*) FROM c WHERE modalidade = 'telemedicina' AND status = 'faltou'),
    'em_atendimento_agora', (SELECT count(*) FROM consultas WHERE modalidade = 'telemedicina' AND status = 'em_atendimento'),
    'taxa_presenca', (
      SELECT CASE WHEN count(*) FILTER (WHERE status IN ('concluida', 'faltou')) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE status = 'concluida')
                   / count(*) FILTER (WHERE status IN ('concluida', 'faltou'))) END
      FROM c WHERE modalidade = 'telemedicina'
    ),
    'prestadores_com_addon', (
      SELECT count(*) FROM assinaturas
      WHERE ativo AND addon_telemedicina
        AND (expira_em IS NULL OR expira_em > now() AT TIME ZONE 'UTC')
    )
  )
)
FROM limites;
$$;

-- Indicadores de saúde agregados: só o backend (service_role) chama.
-- Funções em public ficam expostas no PostgREST para anon/authenticated por padrão.
REVOKE ALL ON FUNCTION dashboard_prefeitura(DATE, DATE, TEXT) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION dashboard_prefeitura(DATE, DATE, TEXT) FROM anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION dashboard_prefeitura(DATE, DATE, TEXT) TO service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
