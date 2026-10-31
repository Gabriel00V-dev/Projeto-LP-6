export interface Patient {
  codigo: number;       
  nome: string;
  datan?: string;         
  fone?: string;
  ende?: string;
  email: string;
  senha: string;
}

export interface Clinic {
  codigo: number;       
  nome: string;
  endereco?: string;
  fone?: string;
  email: string;
  senha?: string;
  imagem?: string | null;
  atende_unimed?: boolean;
  tipo?: 'clinica' | 'veterinaria' | 'upa' | 'psicologia';
  aceita_fila_online?: boolean;
}

export interface Specialization {
  codigo: number;
  nome: string;
}

export interface ClinicSpecialization {
  codigo_clinica: number;
  codigo_especializacao: number;
}

export interface Appointment {
  codigo: number;
  codigo_paciente: number;
  codigo_clinica: number | null;
  codigo_especializacao: number | null;
  codigo_profissional?: number | null;
  codigo_animal?: number | null;
  data_hora: string;
  duracao_minutos?: number;
  modalidade?: 'presencial' | 'telemedicina';
  tipo_atendimento?: 'consulta' | 'vacinacao' | 'castracao' | 'retorno' | 'orientacao_online' | 'emergencia' | null;
  status: 'agendada' | 'confirmada' | 'em_atendimento' | 'cancelada' | 'concluida' | 'faltou';
  observacoes?: string;
  motivo_cancelamento?: string | null;
  confirmado_em?: string | null;
  iniciado_em?: string | null;
  finalizado_em?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface AppointmentWithDetails extends Appointment {
  paciente_nome?: string;
  paciente_email?: string;
  paciente_fone?: string;
  clinica_nome?: string;
  clinica_endereco?: string;
  clinica_fone?: string;
  especializacao_nome?: string;
  profissional_nome?: string;
  profissional_tipo?: string;
  animal_nome?: string;
  animal_especie?: string;
}

export interface Document {
  codigo: number;
  codigo_paciente: number;
  codigo_clinica?: number;
  nome_arquivo: string;
  url_arquivo: string;
  tipo_documento: 'exame' | 'receita' | 'laudo' | 'atestado' | 'pedido_exame' | 'resultado_exame' | 'outro';
  descricao?: string;
  tamanho_arquivo?: number;
  enviado_por: 'paciente' | 'clinica';
  criado_em?: string;
}

export interface DocumentWithDetails extends Document {
  paciente_nome?: string;
  clinica_nome?: string;
}

export interface Database {
  public: {
    Tables: {
      pacientes: {
        Row: Patient;
        Insert: Omit<Patient, 'codigo'>;
        Update: Partial<Omit<Patient, 'codigo'>>;
      };
      clinicas: {
        Row: Clinic;
        Insert: Omit<Clinic, 'codigo'>;
        Update: Partial<Omit<Clinic, 'codigo'>>;
      };
      especializacoes: {
        Row: Specialization;
        Insert: Omit<Specialization, 'codigo'>;
        Update: Partial<Omit<Specialization, 'codigo'>>;
      };
      clinicas_especializacoes: {
        Row: ClinicSpecialization;
        Insert: ClinicSpecialization;
        Update: Partial<ClinicSpecialization>;
      };
      consultas: {
        Row: Appointment;
        Insert: Omit<Appointment, 'codigo' | 'criado_em' | 'atualizado_em'>;
        Update: Partial<Omit<Appointment, 'codigo' | 'criado_em' | 'atualizado_em'>>;
      };
      documentos: {
        Row: Document;
        Insert: Omit<Document, 'codigo' | 'criado_em'>;
        Update: Partial<Omit<Document, 'codigo' | 'criado_em'>>;
      };
    };
    Functions: Record<string, unknown>;
    Views: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
}
