# Plano de serviços municipais

## Objetivo

Este documento consolida as ideias levantadas para evolução do aplicativo, incluindo:

- Dashboard para acompanhamento da prefeitura;
- Telas operacionais para cidadãos e prestadores;
- Atendimento UPA/SUS;
- Psicologia;
- Clínicas veterinárias;
- Telemedicina;
- Modelo de assinatura do add-on de telemedicina;
- Roteiro técnico para tornar o protótipo funcional.

O dashboard e as telas operacionais são experiências diferentes:

- O **dashboard** é voltado para gestão e acompanhamento de indicadores;
- As **telas operacionais** são voltadas para agendamento, fila, consultas e execução do atendimento.

---

## 1. Perfis do sistema

O sistema deve diferenciar os seguintes perfis:

```text
paciente
clinica
psicologo
veterinario
profissional_sus
gestor_upa
administrador
```

Psicólogos e veterinários podem atuar:

- Vinculados a uma clínica; ou
- Como profissionais independentes.

Não deve existir um perfil chamado `profissional_telemedicina`.

Telemedicina é uma **modalidade de atendimento**, não um tipo de profissional.

---

## 2. Dashboard da prefeitura

O dashboard é uma área de gestão municipal. Ele não substitui as telas normais de atendimento.

### 2.1 Visão geral

Indicadores sugeridos:

- Atendimentos do dia;
- Tempo médio de espera;
- Satisfação do cidadão;
- Serviços ativos;
- Atendimentos por serviço;
- Atividade recente;
- Ações rápidas;

### 2.2 Saúde pública

Indicadores:

- Pacientes aguardando na UPA;
- Tempo porta-médico;
- Classificação de risco;
- Ocupação de leitos;
- Status das unidades;
- Produção por plantão;

### 2.3 Psicologia e bem-estar

Indicadores:

- Sessões realizadas;
- Pacientes aguardando acolhimento;
- Profissionais disponíveis;
- Retornos agendados;
- Taxa de presença;
- Encaminhamentos por origem;

### 2.4 Proteção animal

Indicadores:

- Consultas veterinárias;
- Castrações realizadas;
- Animais aguardando atendimento;
- Animais para adoção;
- Clínicas credenciadas;
- Chamados de abandono;

### 2.5 Telemedicina

Indicadores:

- Consultas online;
- Salas em atendimento;
- Pacientes aguardando conexão;
- Tempo médio para conexão;
- Taxa de resolutividade;
- Consultas finalizadas;

### 2.6 Observação

Os dados do dashboard devem vir das mesmas consultas e tabelas usadas na operação. Não devem ser mantidos números separados ou mockados quando o sistema estiver em produção.

---

## 3. Tela de serviços do cidadão

A tela inicial de serviços permite escolher o tipo de atendimento:

```text
Serviços de atendimento

UPA / SUS
Agendar atendimento e acompanhar fila

Psicólogo
Escolher profissional e horário

Clínica veterinária
Agendar consulta para seu animal

Telemedicina
Entrar ou marcar uma consulta online
```

Essa tela é apenas uma entrada para os fluxos específicos.

---

## 4. Atendimento UPA / SUS

UPA não deve utilizar exatamente o mesmo fluxo de consulta agendada de uma clínica.

### 4.1 Fluxo do cidadão

1. Escolher uma unidade;
2. Consultar lotação e tempo estimado;
3. Escolher entre:
   - Consultar informações;
   - Entrar na fila, quando permitido;
   - Consultar protocolo existente;
4. Receber protocolo;
5. Acompanhar o status;
6. Receber atualização quando for chamado;
7. Finalizar o atendimento.

### 4.2 Status da fila

```text
aguardando_triagem
em_triagem
aguardando_atendimento
em_atendimento
finalizado
cancelado
```

### 4.3 Classificação de risco

```text
vermelho  - emergência
amarelo   - urgência
verde     - pouco urgente
azul      - não urgente
```

A classificação de risco só pode ser alterada por profissional autorizado.

### 4.4 Tela da equipe da UPA

Funcionalidades:

- Visualizar fila;
- Chamar próximo paciente;
- Registrar triagem;
- Alterar classificação de risco;
- Encaminhar para atendimento;
- Transferir de setor;
- Finalizar atendimento;
- Consultar tempo de espera;
- Visualizar produção do plantão.

---

## 5. Atendimento psicológico

### 5.1 Fluxo do cidadão

1. Escolher psicólogo, clínica ou unidade;
2. Escolher modalidade:
   - Presencial;
   - Telemedicina, se o profissional possuir o add-on;
3. Escolher data;
4. Escolher horário;
5. Confirmar consulta;
6. Receber lembrete;
7. Acompanhar a consulta em “Minhas consultas”.

### 5.2 Tela do psicólogo

Funcionalidades:

- Agenda do dia;
- Lista de pacientes;
- Confirmar presença;
- Iniciar atendimento;
- Iniciar teleconsulta;
- Registrar evolução;
- Fazer encaminhamento;
- Finalizar consulta;
- Consultar horários presenciais e online;

Informações de saúde mental devem possuir acesso restrito ao paciente e ao profissional autorizado.

### 5.3 Agenda

Exemplo:

```text
Dra. Ana Souza - Psicóloga

09:00 - Presencial
10:30 - Telemedicina
14:00 - Telemedicina
16:00 - Presencial
```

---

## 6. Clínicas veterinárias

### 6.1 Cadastro do animal

O paciente deve poder cadastrar:

- Nome;
- Espécie;
- Raça;
- Data de nascimento;
- Peso;
- Observações;
- Vacinas;

### 6.2 Fluxo do cidadão

1. Escolher um animal;
2. Escolher uma clínica ou veterinário;
3. Escolher o tipo de atendimento:
   - Consulta;
   - Vacinação;
   - Castração;
   - Retorno;
   - Orientação online;
   - Emergência;
4. Escolher modalidade;
5. Escolher data;
6. Escolher horário;
7. Confirmar.

### 6.3 Tela da clínica veterinária

Funcionalidades:

- Agenda do dia;
- Dados do animal;
- Histórico clínico;
- Vacinas;
- Prescrições;
- Retornos;
- Castrações;
- Atualização de adoções;
- Iniciar teleconsulta, quando contratada;

### 6.4 Limitações da telemedicina veterinária

A consulta online pode ser utilizada para:

- Orientação inicial;
- Retorno;
- Acompanhamento pós-operatório;
- Avaliação de exames;
- Orientação sobre medicação;

Casos de emergência ou que exigem exame físico devem ser direcionados para atendimento presencial.

---

## 7. Telemedicina

## 7.1 Regra principal

Telemedicina é uma modalidade oferecida por prestadores que assinaram o add-on.

Podem assinar:

- Clínicas;
- Psicólogos independentes;
- Veterinários independentes;

O recurso não cria um novo tipo de profissional.

```text
Prestador
 ├── Clínica
 ├── Psicólogo independente
 └── Veterinário independente

Prestador assina telemedicina
        ↓
Prestador configura horários online
        ↓
Paciente agenda consulta
        ↓
Sistema cria sala privada
```

### 7.2 Assinatura

Cada prestador assina individualmente:

```text
Clínica: addon_telemedicina = true
Psicólogo: addon_telemedicina = true
Veterinário: addon_telemedicina = true
```

O add-on só deve ser liberado após a assinatura ou confirmação do pagamento.

### 7.3 Configuração do prestador

O prestador poderá:

- Ativar ou desativar a telemedicina;
- Definir quais profissionais atendem online;
- Definir quais especialidades estão disponíveis;
- Criar horários online;
- Criar horários presenciais;
- Definir duração da consulta;
- Configurar regras de cancelamento;

Exemplo:

```text
Dra. Ana Souza

Segunda-feira
09:00 - Presencial
10:30 - Telemedicina
14:00 - Telemedicina
16:00 - Presencial
```

### 7.4 Fluxo do cidadão

1. Abrir Telemedicina;
2. Visualizar apenas prestadores com add-on ativo;
3. Escolher clínica ou profissional;
4. Escolher especialidade;
5. Escolher data;
6. Escolher horário online;
7. Confirmar consulta;
8. Receber lembrete;
9. Entrar na sala no horário permitido.

### 7.5 Fluxo do prestador

1. Abrir a agenda;
2. Visualizar as consultas online;
3. Gerar ou abrir a sala;
4. Entrar na consulta;
5. Registrar observações;
6. Finalizar o atendimento.

### 7.6 Acesso à sala

O botão deve ser liberado somente:

- Alguns minutos antes da consulta;
- Durante o horário da consulta;
- Dentro de um período de tolerância configurado.

Antes disso, exibir:

```text
A sala será liberada 10 minutos antes do atendimento.
```

O backend deve validar:

- Usuário autenticado;
- Consulta existente;
- Usuário vinculado à consulta;
- Modalidade `telemedicina`;
- Prestador com add-on ativo;
- Horário autorizado;

---

## 8. Opções técnicas para videochamada

### 8.1 Jitsi Meet público

É a opção mais simples para protótipo e demonstração:

```text
https://meet.jit.si
```

Recursos:

- Vídeo;
- Áudio;
- Chat;
- Compartilhamento de tela;
- Senha de sala;
- Integração com navegador;
- SDK para Android e iOS;

Limitação: não é recomendado depender de uma sala pública sem controles adicionais para dados reais de saúde.

### 8.2 Jitsi self-hosted

É a opção recomendada para produção inicial:

- Software open source;
- Servidor controlado pelo projeto;
- Domínio próprio;
- Controle da infraestrutura;
- Configuração de autenticação e salas;

Mesmo com software gratuito, haverá custos de:

- Servidor;
- Domínio;
- Certificado/HTTPS;
- Monitoramento;
- Backup;
- Manutenção;

### 8.3 WebRTC próprio

WebRTC é uma tecnologia aberta para vídeo, áudio e dados em tempo real.

Entretanto, seria necessário desenvolver:

- Servidor de sinalização;
- Criação de salas;
- STUN/TURN;
- Autorização;
- Reconexão;
- Tratamento de câmera e microfone;
- Compatibilidade mobile;
- Segurança;

Não é a melhor primeira opção para este projeto.

### 8.4 BigBlueButton

É open source e possui API, mas foi projetado principalmente para:

- Aulas;
- Treinamentos;
- Salas com vários participantes;
- Apresentações;

Para consultas individuais, tende a ser mais complexo do que o necessário.

### 8.5 Recomendação

```text
Protótipo: Jitsi público
MVP: Jitsi com links gerados pelo backend
Produção: Jitsi self-hosted ou provedor especializado
```

Não gravar consultas inicialmente. Gravação exigiria regras adicionais de consentimento, armazenamento, segurança e privacidade.

---

## 9. Banco de dados

### 9.1 Profissionais

```sql
CREATE TABLE profissionais (
  codigo SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  registro_profissional VARCHAR(50),
  tipo VARCHAR(30) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);
```

Tipos:

```text
psicologo
medico
enfermeiro
veterinario
profissional_sus
```

### 9.2 Disponibilidades

```sql
CREATE TABLE disponibilidades (
  codigo SERIAL PRIMARY KEY,
  codigo_profissional INTEGER REFERENCES profissionais(codigo),
  codigo_clinica INTEGER REFERENCES clinicas(codigo),
  dia_semana INTEGER NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  modalidade VARCHAR(20) NOT NULL
    CHECK (modalidade IN ('presencial', 'telemedicina')),
  ativo BOOLEAN DEFAULT TRUE
);
```

### 9.3 Animais

```sql
CREATE TABLE animais (
  codigo SERIAL PRIMARY KEY,
  codigo_paciente INTEGER REFERENCES pacientes(codigo) ON DELETE CASCADE,
  nome VARCHAR(80) NOT NULL,
  especie VARCHAR(30) NOT NULL,
  raca VARCHAR(80),
  data_nascimento DATE,
  peso DECIMAL(6,2),
  observacoes TEXT
);
```

### 9.4 Fila da UPA

```sql
CREATE TABLE filas_upa (
  codigo SERIAL PRIMARY KEY,
  codigo_paciente INTEGER REFERENCES pacientes(codigo),
  codigo_clinica INTEGER REFERENCES clinicas(codigo),
  protocolo VARCHAR(30) UNIQUE NOT NULL,
  classificacao_risco VARCHAR(20),
  status VARCHAR(30) NOT NULL,
  entrada_em TIMESTAMP DEFAULT NOW(),
  chamado_em TIMESTAMP,
  finalizado_em TIMESTAMP
);
```

### 9.5 Salas de telemedicina

```sql
CREATE TABLE salas_telemedicina (
  codigo SERIAL PRIMARY KEY,
  codigo_consulta INTEGER NOT NULL REFERENCES consultas(codigo),
  room_id VARCHAR(150) UNIQUE NOT NULL,
  meeting_url TEXT NOT NULL,
  criada_em TIMESTAMP DEFAULT NOW(),
  liberada_em TIMESTAMP,
  encerrada_em TIMESTAMP
);
```

### 9.6 Alterações em consultas

A tabela existente `consultas` deve receber:

```sql
ALTER TABLE consultas
ADD COLUMN codigo_profissional INTEGER REFERENCES profissionais(codigo),
ADD COLUMN codigo_animal INTEGER REFERENCES animais(codigo),
ADD COLUMN modalidade VARCHAR(20)
  CHECK (modalidade IN ('presencial', 'telemedicina')),
ADD COLUMN motivo_cancelamento TEXT,
ADD COLUMN confirmado_em TIMESTAMP,
ADD COLUMN iniciado_em TIMESTAMP,
ADD COLUMN finalizado_em TIMESTAMP;
```

Também deve existir uma regra para impedir dois atendimentos no mesmo horário para o mesmo profissional.

---

## 10. Assinaturas do add-on

Como clínicas, psicólogos e veterinários podem assinar individualmente, a assinatura não deve ser limitada a clínicas.

Modelo conceitual:

```sql
CREATE TABLE assinaturas (
  codigo SERIAL PRIMARY KEY,
  tipo_prestador VARCHAR(30) NOT NULL,
  codigo_prestador INTEGER NOT NULL,
  plano VARCHAR(30) NOT NULL DEFAULT 'basico',
  addon_telemedicina BOOLEAN NOT NULL DEFAULT FALSE,
  addon_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  addon_relatorios BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  inicio_em TIMESTAMP DEFAULT NOW(),
  expira_em TIMESTAMP
);
```

O campo `tipo_prestador` pode ser:

```text
clinica
psicologo
veterinario
```

O projeto já possui o conceito de add-ons em:

- [backend/src/middlewares/checkAddon.ts](../backend/src/middlewares/checkAddon.ts);
- [backend/src/routes/addons.ts](../backend/src/routes/addons.ts);
- [mobile/src/hooks/useAddonGuard.ts](../mobile/src/hooks/useAddonGuard.ts);
- [mobile/src/contexts/ClinicContexts.tsx](../mobile/src/contexts/ClinicContexts.tsx).

Essas estruturas devem ser generalizadas para aceitar qualquer prestador elegível.

---

## 11. API planejada

### Disponibilidade

```text
GET    /availability
GET    /availability/:professionalId
POST   /availability
PUT    /availability/:id
DELETE /availability/:id
```

### Consultas

```text
POST   /appointments
GET    /appointments/patient/:patientId
GET    /appointments/professional/:professionalId
GET    /appointments/clinic/:clinicId
PATCH  /appointments/:id/confirm
PATCH  /appointments/:id/cancel
PATCH  /appointments/:id/start
PATCH  /appointments/:id/finish
```

### Profissionais

```text
GET    /professionals
GET    /professionals/:id
POST   /professionals
PUT    /professionals/:id
GET    /professionals/:id/availability
```

### Animais

```text
GET    /animals
GET    /animals/:id
POST   /animals
PUT    /animals/:id
DELETE /animals/:id
```

### UPA

```text
GET    /upa/units
GET    /upa/:unitId/queue
POST   /upa/:unitId/queue
PATCH  /upa/queue/:id/status
PATCH  /upa/queue/:id/risk
GET    /upa/queue/:protocol
```

### Telemedicina

```text
GET    /telemedicine/providers
GET    /telemedicine/providers/:id/availability
POST   /telemedicine/rooms
GET    /telemedicine/rooms/:appointmentId
POST   /telemedicine/rooms/:id/join
POST   /telemedicine/rooms/:id/finish
```

O endpoint existente de geração de link deve validar o prestador e a assinatura antes de criar a sala:

```text
POST /addons/telemedicina/gerar-link
```

---

## 12. Alterações no aplicativo mobile

A tela atual está em:

- [mobile/src/screens/ServiceScreens.tsx](../mobile/src/screens/ServiceScreens.tsx);
- [mobile/src/navigation/RootNavigator.tsx](../mobile/src/navigation/RootNavigator.tsx);
- [mobile/src/api/client.ts](../mobile/src/api/client.ts).

As telas demonstrativas devem substituir dados fixos e `Alert` por chamadas à API.

### UPA

Substituir unidades e filas fixas por:

```text
GET /upa/units
GET /upa/:unitId/queue
POST /upa/:unitId/queue
```

### Psicologia

Buscar profissionais e horários:

```text
GET /professionals?type=psicologo
GET /professionals/:id/availability
POST /appointments
```

### Veterinária

Buscar animais e clínicas:

```text
GET /animals
GET /clinics?type=veterinary
GET /professionals?type=veterinario
POST /appointments
```

### Telemedicina

Buscar apenas prestadores assinantes:

```text
GET /telemedicine/providers
```

Depois:

1. Escolher prestador;
2. Escolher especialidade;
3. Escolher profissional;
4. Buscar horários online;
5. Criar consulta com `modalidade = telemedicina`;
6. Buscar a sala;
7. Entrar quando autorizado.

---

## 13. Segurança e privacidade

Como o sistema tratará dados de saúde, devem ser adotadas medidas específicas:

- Autenticação obrigatória;
- Controle por perfil;
- Acesso somente às consultas relacionadas;
- Links de sala não públicos;
- Expiração de links;
- HTTPS;
- Não expor dados sensíveis em logs;
- Não gravar chamadas inicialmente;
- Registro de acesso à consulta;
- Consentimento quando necessário;
- Política de privacidade;
- Adequação à LGPD;
- Controle de documentos e prontuários;

O usuário nunca deve conseguir acessar uma sala apenas conhecendo o `room_id`.

---

## 14. Roteiro de implementação

### Fase 1 — Consultas comuns

- Criar profissionais;
- Criar disponibilidades;
- Buscar horários livres;
- Criar agendamento;
- Cancelar;
- Confirmar;
- Criar tela “Minhas consultas”;

### Fase 2 — Psicologia e veterinária

- Listar psicólogos;
- Cadastrar animais;
- Listar veterinários;
- Criar prontuário do animal;
- Agendar consultas;
- Criar telas dos prestadores;

### Fase 3 — UPA

- Criar unidades;
- Criar fila;
- Gerar protocolo;
- Classificar risco;
- Atualizar status;
- Criar tela operacional da equipe;

### Fase 4 — Add-on de telemedicina

- Generalizar assinaturas;
- Permitir assinatura por clínica;
- Permitir assinatura por psicólogo;
- Permitir assinatura por veterinário;
- Criar configuração de agenda online;
- Filtrar prestadores assinantes;

### Fase 5 — Salas online

- Integrar Jitsi;
- Gerar sala por consulta;
- Validar acesso;
- Liberar botão no horário;
- Registrar entrada;
- Encerrar atendimento;

### Fase 6 — Dashboard

- Consultar dados reais;
- Criar indicadores;
- Filtrar por período;
- Filtrar por serviço;
- Exportar relatórios;
- Criar visão da prefeitura;

### Fase 7 — Notificações

- Confirmação de consulta;
- Lembrete no dia anterior;
- Lembrete antes do atendimento;
- Aviso de alteração;
- Aviso de chamada na fila da UPA;

---

## 15. MVP recomendado

Para entregar uma primeira versão funcional, priorizar:

1. Login de paciente;
2. Cadastro de profissionais;
3. Cadastro de animais;
4. Agenda real;
5. Agendamento de psicologia;
6. Agendamento veterinário;
7. Tela de minhas consultas;
8. Entrada na fila da UPA;
9. Add-on de telemedicina;
10. Agendamento online;
11. Sala Jitsi protegida;
12. Tela básica para o prestador;

O dashboard municipal deve ser conectado depois que os fluxos operacionais estiverem gravando dados reais.

---

## 16. Resumo da arquitetura

```text
Prestador
 ├── Clínica
 ├── Psicólogo independente
 └── Veterinário independente

Prestador
 └── pode assinar o add-on de telemedicina

Prestador assinante
 └── configura horários online

Paciente
 └── agenda uma consulta

Consulta
 ├── pertence ao paciente
 ├── pertence ao prestador
 ├── possui modalidade
 └── pode possuir uma sala virtual

Dashboard
 └── consulta os dados operacionais agregados
```

Regra central:

> Telemedicina pertence ao prestador que assinou o add-on. Ela não é um perfil, não é uma profissão e não é uma unidade separada.

---

## 17. Status da implementação

O MVP da seção 15 está implementado, junto com o dashboard da prefeitura (seção 2), que é a tela inicial do perfil `prefeitura`. Os indicadores são calculados no banco pela função `dashboard_prefeitura` ([dashboard_prefeitura.sql](../backend/migrations/dashboard_prefeitura.sql)) e lidos em `GET /dashboard?de=&ate=`. Ficam de fora os indicadores sem fonte de dados no sistema: ocupação de leitos, adoções, chamados de abandono, encaminhamentos e satisfação. Notificações (Fase 7) ficam para depois.

### Como colocar no ar

1. Executar no Supabase SQL Editor, nesta ordem (depois de `init.sql` e `fix_schema.sql`):
   [servicos_municipais.sql](../backend/migrations/servicos_municipais.sql), [aprovacao_cadastros.sql](../backend/migrations/aprovacao_cadastros.sql) e [dashboard_prefeitura.sql](../backend/migrations/dashboard_prefeitura.sql). Todos podem ser executados mais de uma vez. O primeiro copia as assinaturas de `clinica_assinaturas` para `assinaturas`; o segundo marca como aprovadas as clínicas que já existem.
2. Criar a conta da prefeitura: usuário em Supabase > Authentication e linha em `administradores` com o mesmo e-mail (instruções no topo de `aprovacao_cadastros.sql`).
3. Configurar as variáveis novas do [backend/.env.example](../backend/.env.example) (`APP_TIMEZONE`, `JITSI_*`, `TELEMEDICINA_*`) e manter a `SUPABASE_SERVICE_ROLE_KEY`: as tabelas novas têm RLS ligado sem policies.
4. Liberar o add-on para um prestador (depois do pagamento), logado como prefeitura:
   `PUT /addons/admin/clinica/:codigo/plano` ou `PUT /addons/admin/profissional/:codigo/addon`.

### Decisões tomadas na implementação

- **Perfis:** o login tem quatro papéis (`paciente`, `clinica`, `profissional`, `prefeitura`). Psicólogo, veterinário, médico, enfermeiro e profissional do SUS são o `tipo` do profissional. UPA e clínica veterinária são `clinicas.tipo`. `gestor_upa` é a conta da própria UPA; `administrador` é o papel `prefeitura` (tabela `administradores`, sem cadastro público).
- **Aprovação de cadastros:** clínicas e profissionais novos entram como `pendente` (CNPJ/CPF, responsável técnico e registro conferidos no cadastro). Até a prefeitura aprovar, não aparecem para os pacientes nem operam: o login leva à tela de acompanhamento, que mostra o motivo em caso de reprovação e permite corrigir e reenviar. A prefeitura também pode suspender um cadastro aprovado. Rotas: `GET/PATCH /approvals` (prefeitura) e `GET /approvals/me`, `POST /approvals/me/resubmit` (prestador).
- **Sessão:** o app guarda o token e o refresh_token (AsyncStorage, que na web é o localStorage). Ao abrir, a tela inicial chama `GET /auth/me` e leva o usuário direto ao menu dele; token expirado é renovado em `POST /auth/refresh`.
- **Assinatura:** `tipo_prestador` é `clinica` ou `profissional`, porque o tipo do profissional já está em `profissionais.tipo`. Um profissional vinculado usa a assinatura da clínica.
- **Profissional vinculado:** a clínica o cadastra na Equipe. Se ele quiser login próprio, faz o cadastro de Profissional com o mesmo e-mail, e a conta é ligada à linha existente.
- **Sala:** é identificada pela consulta (`/telemedicine/rooms/:appointmentId`). O `room_id` é aleatório e o link só é entregue no `join`, depois de validar vínculo, modalidade, add-on e horário.
- **Status da consulta:** ganhou `em_atendimento` e `faltou`. As transições ficam em `PATCH /appointments/:id/confirm|start|finish|no-show|cancel`.
- **Agenda:** horários livres são gerados a partir de `disponibilidades` menos as consultas existentes. O índice único `(codigo_profissional, data_hora)` impede dois agendamentos no mesmo horário.
