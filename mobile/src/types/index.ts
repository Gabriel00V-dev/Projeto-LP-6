export type Patient = {
  codigo?: number;        
  nome: string;
  datan: string;         
  fone: string;
  ende: string;
  email: string;
  senha?: string;        
};

export type Clinic = {
  codigo?: number;        
  nome: string;
  endereco: string;
  fone: string;
  email: string;
  senha?: string;         
  imagem?: string | null;
  atende_unimed?: boolean;
  especializacoes?: string[];
  tipo?: ClinicType;
  aceita_fila_online?: boolean;
  cnpj?: string | null;
  responsavel_tecnico?: string | null;
  registro_responsavel?: string | null;
  status_cadastro?: ApprovalStatus;
  motivo_reprovacao?: string | null;
};

export type ClinicType = 'clinica' | 'veterinaria' | 'upa' | 'psicologia';

export type Specialization = {
  codigo: number; 
  nome: string;
};

export type ClinicSpecialization = {
  codigo_clinica: number;
  codigo_especializacao: number;
};

export type AppointmentStatus = 'agendada' | 'confirmada' | 'em_atendimento' | 'cancelada' | 'concluida' | 'faltou';

export type Modalidade = 'presencial' | 'telemedicina';

export type TipoAtendimento = 'consulta' | 'vacinacao' | 'castracao' | 'retorno' | 'orientacao_online' | 'emergencia';

export type Appointment = {
  codigo?: number;
  codigo_paciente: number;
  codigo_clinica?: number | null;
  codigo_especializacao?: number | null;
  codigo_profissional?: number | null;
  codigo_animal?: number | null;
  data_hora: string;
  duracao_minutos?: number;
  modalidade?: Modalidade;
  tipo_atendimento?: TipoAtendimento | null;
  status: AppointmentStatus;
  observacoes?: string;
  motivo_cancelamento?: string | null;
  criado_em?: string;
  atualizado_em?: string;
};

export type AppointmentWithDetails = Appointment & {
  paciente_nome?: string;
  paciente_email?: string;
  paciente_fone?: string;
  clinica_nome?: string;
  clinica_endereco?: string;
  especializacao_nome?: string;
  profissional_nome?: string;
  profissional_tipo?: ProfessionalType;
  animal_nome?: string;
  animal_especie?: string;
  clinicas?: {
    nome: string;
    endereco?: string;
    fone?: string;
  };
  pacientes?: {
    nome: string;
    email?: string;
    fone?: string;
  };
  especializacoes?: {
    nome: string;
  };
};

export type DocumentType = 'exame' | 'receita' | 'laudo' | 'atestado' | 'pedido_exame' | 'resultado_exame' | 'outro';

export type Document = {
  codigo?: number;
  codigo_paciente: number;
  codigo_clinica?: number;
  nome_arquivo: string;
  url_arquivo: string;
  tipo_documento: DocumentType;
  descricao?: string;
  tamanho_arquivo?: number;
  enviado_por: 'paciente' | 'clinica';
  criado_em?: string;
};

export type DocumentWithDetails = Document & {
  paciente_nome?: string;
  clinica_nome?: string;
  clinicas?: {
    nome: string;
  };
};

// ============================================================
// Serviços municipais (docs/PLANO-SERVICOS-MUNICIPAIS.md)
// ============================================================

export type ProfessionalType = 'psicologo' | 'medico' | 'enfermeiro' | 'veterinario' | 'profissional_sus';

export type Professional = {
  codigo: number;
  nome: string;
  email: string;
  fone?: string | null;
  registro_profissional?: string | null;
  tipo: ProfessionalType;
  codigo_clinica?: number | null;
  codigo_especializacao?: number | null;
  bio?: string | null;
  imagem?: string | null;
  ativo: boolean;
  clinica_nome?: string | null;
  clinica_endereco?: string | null;
  clinica_tipo?: ClinicType | null;
  especializacao_nome?: string | null;
  independente?: boolean;
  telemedicina?: boolean;
  cpf?: string | null;
  status_cadastro?: ApprovalStatus;
  motivo_reprovacao?: string | null;
};

// ============================================================
// Aprovação de cadastros pela prefeitura
// ============================================================

export type ApprovalStatus = 'pendente' | 'aprovado' | 'reprovado';

export type ApprovalType = 'clinica' | 'profissional';

export type ApprovalItem = {
  tipo_cadastro: ApprovalType;
  codigo: number;
  nome: string;
  email: string;
  fone?: string | null;
  status_cadastro: ApprovalStatus;
  motivo_reprovacao?: string | null;
  enviado_em?: string | null;
  analisado_em?: string | null;
  // clínica
  endereco?: string | null;
  cnpj?: string | null;
  responsavel_tecnico?: string | null;
  registro_responsavel?: string | null;
  atende_unimed?: boolean;
  imagem?: string | null;
  // clínica (ClinicType) ou profissional (ProfessionalType)
  tipo?: string;
  // profissional
  cpf?: string | null;
  registro_profissional?: string | null;
  bio?: string | null;
  codigo_clinica?: number | null;
  clinica_nome?: string | null;
};

// ============================================================
// Dashboard da prefeitura (GET /dashboard)
// ============================================================

export type DashboardServico = 'upa' | 'clinica' | 'psicologia' | 'veterinaria';

export type PrefeituraDashboard = {
  periodo: { de: string; ate: string };
  visao_geral: {
    atendimentos_realizados: number;
    consultas_marcadas: number;
    cancelamentos: number;
    atendimentos_online: number;
    taxa_presenca: number | null;
    espera_media_upa_minutos: number | null;
    cadastros_pendentes: number;
    por_servico: { servico: DashboardServico; total: number }[];
    serie_diaria: { dia: string; total: number }[];
    rede: { estabelecimentos: number; profissionais: number };
  };
  saude_publica: {
    aguardando_agora: number;
    em_atendimento_agora: number;
    entradas: number;
    atendidos: number;
    finalizados: number;
    desistencias: number;
    espera_media_minutos: number | null;
    risco: Record<RiskLevel | 'sem_classificacao', number>;
    unidades: {
      codigo: number;
      nome: string;
      aceita_fila_online: boolean;
      aguardando: number;
      em_atendimento: number;
      entradas_periodo: number;
      espera_media_minutos: number | null;
    }[];
  };
  psicologia: {
    sessoes_realizadas: number;
    sessoes_online: number;
    faltas: number;
    cancelamentos: number;
    taxa_presenca: number | null;
    agendadas_futuras: number;
    profissionais: number;
  };
  protecao_animal: {
    consultas_realizadas: number;
    castracoes: number;
    vacinacoes: number;
    aguardando_atendimento: number;
    animais_cadastrados: number;
    clinicas_credenciadas: number;
    veterinarios: number;
  };
  telemedicina: {
    consultas_marcadas: number;
    consultas_realizadas: number;
    faltas: number;
    em_atendimento_agora: number;
    taxa_presenca: number | null;
    prestadores_com_addon: number;
  };
};

export type MyApproval = ApprovalItem & {
  historico: { decisao: 'aprovado' | 'reprovado' | 'reenviado'; motivo: string | null; criado_em: string }[];
};

export type Availability = {
  codigo: number;
  codigo_profissional: number | null;
  codigo_clinica: number | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
  modalidade: Modalidade;
  profissional_nome?: string | null;
};

export type Slot = {
  data_hora: string;
  hora: string;
  modalidade: Modalidade;
  duracao_minutos: number;
  codigo_disponibilidade: number;
  codigo_profissional: number | null;
  codigo_clinica: number | null;
  profissional_nome: string | null;
};

export type Vaccine = {
  codigo: number;
  nome: string;
  aplicada_em: string;
  proxima_dose?: string | null;
  registrada_por?: string;
};

export type Animal = {
  codigo: number;
  codigo_paciente: number;
  nome: string;
  especie: string;
  raca?: string | null;
  data_nascimento?: string | null;
  peso?: number | null;
  observacoes?: string | null;
  vacinas?: Vaccine[];
};

export type AppointmentNote = {
  codigo: number;
  codigo_consulta: number;
  autor_papel: 'clinica' | 'profissional';
  texto: string;
  criado_em: string;
};

export type RiskLevel = 'vermelho' | 'amarelo' | 'verde' | 'azul';

export type UpaQueueStatus =
  | 'aguardando_triagem'
  | 'em_triagem'
  | 'aguardando_atendimento'
  | 'em_atendimento'
  | 'finalizado'
  | 'cancelado';

export type UpaOccupancy = {
  aguardando: number;
  em_atendimento: number;
  por_classificacao: Record<RiskLevel | 'sem_classificacao', number>;
  tempo_estimado_minutos: number;
  estimativa_por_historico: boolean;
};

export type UpaUnit = UpaOccupancy & {
  codigo: number;
  nome: string;
  endereco?: string | null;
  fone?: string | null;
  imagem?: string | null;
  aceita_fila_online: boolean;
};

export type UpaQueueEntry = {
  codigo: number;
  codigo_paciente?: number;
  codigo_clinica?: number;
  protocolo: string;
  status: UpaQueueStatus;
  classificacao_risco: RiskLevel | null;
  setor?: string | null;
  sintomas?: string | null;
  entrada_em: string;
  triado_em?: string | null;
  chamado_em?: string | null;
  finalizado_em?: string | null;
  posicao: number | null;
  tempo_estimado_minutos?: number | null;
  unidade_nome?: string | null;
  unidade_endereco?: string | null;
  foi_chamado?: boolean;
  paciente_nome?: string | null;
  paciente_nascimento?: string | null;
  profissional_nome?: string | null;
};

export type UpaQueue = UpaOccupancy & {
  unidade: { codigo: number; nome: string; endereco?: string | null; aceita_fila_online: boolean };
  // Só para a equipe da unidade:
  fila?: UpaQueueEntry[];
  producao_plantao?: {
    horas: number;
    entradas: number;
    atendidos: number;
    finalizados: number;
    cancelados: number;
    tempo_medio_porta_medico_minutos: number | null;
  };
  pode_classificar?: boolean;
};

export type TelemedicineProvider =
  | {
      tipo_prestador: 'clinica';
      codigo: number;
      nome: string;
      endereco?: string | null;
      imagem?: string | null;
      tipo?: ClinicType;
      especializacoes: { codigo: number; nome: string }[];
      profissionais: { codigo: number; nome: string; tipo: ProfessionalType; especializacao_nome: string | null; tem_horarios_online: boolean }[];
      tem_horarios_online: boolean;
    }
  | {
      tipo_prestador: 'profissional';
      codigo: number;
      nome: string;
      tipo: ProfessionalType;
      registro_profissional?: string | null;
      bio?: string | null;
      imagem?: string | null;
      especializacao_nome: string | null;
      tem_horarios_online: boolean;
    };

export type RoomStatus = {
  codigo_consulta: number;
  possui_sala: boolean;
  liberada: boolean;
  encerrada: boolean;
  abre_em: string;
  fecha_em: string;
  mensagem: string;
};
