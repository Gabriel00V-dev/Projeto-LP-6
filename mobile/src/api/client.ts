import {
  Clinic, Patient, Specialization, Appointment, AppointmentWithDetails, AppointmentStatus, Document, DocumentWithDetails,
  Professional, ProfessionalType, Availability, Slot, Modalidade, Animal, Vaccine, AppointmentNote,
  UpaUnit, UpaQueue, UpaQueueEntry, UpaQueueStatus, RiskLevel, TelemedicineProvider, RoomStatus, ClinicType,
  ApprovalItem, ApprovalStatus, ApprovalType, MyApproval, PrefeituraDashboard,
} from "../types";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sessionStore } from "../session/sessionStore";

// Domínio de produção do projeto (alias estável). A URL com hash que a Vercel
// mostra a cada deploy muda toda vez — não serve para o app.
// Para testar com o backend local, defina EXPO_PUBLIC_API_URL em mobile/.env.local
// (ignorado pelo git) e reinicie o Expo; sem ela, usa produção.
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://backend-gabriel00souzavasconcelos-1989s-projects.vercel.app";

const TOKEN_KEY = '@clinica:token';
const REFRESH_KEY = '@clinica:refresh';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ============================================================
// Renovação do token: o access_token do Supabase vale ~1h. Com a sessão
// mantida entre aberturas do app, ele expira com frequência; quando o backend
// responde INVALID_TOKEN, troca-se o refresh_token por um novo e a requisição
// é repetida uma vez. Várias requisições falhando juntas esperam a mesma renovação.
// ============================================================
let renovacaoEmAndamento: Promise<string | null> | null = null;

function renovarToken(): Promise<string | null> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = (async () => {
      const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
      if (!refreshToken) return null;
      try {
        // axios puro (e não `api`) para não passar pelos interceptors abaixo.
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 30000 });
        const session = res.data?.session;
        if (!session?.access_token) return null;
        await saveSession(session);
        return session.access_token as string;
      } catch {
        return null;
      }
    })().finally(() => {
      renovacaoEmAndamento = null;
    });
  }
  return renovacaoEmAndamento;
}

// ============================================================
// Injeta o token JWT em TODOS os requests automaticamente
// ============================================================
api.interceptors.request.use(async (request) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  console.log('Request:', request.method?.toUpperCase(), request.url);
  return request;
});

api.interceptors.response.use(
  (response) => {
    console.log('Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    console.log('Request failed:', error.config?.url, error.message);

    const original = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'INVALID_TOKEN' &&
      original &&
      !original._tentouRenovar
    ) {
      original._tentouRenovar = true;
      const token = await renovarToken();
      // O interceptor de request relê o token salvo; aqui só repete a chamada.
      if (token) return api(original);
    }

    return Promise.reject(error);
  }
);

// ============================================================
// Helpers de token e sessão
// AsyncStorage persiste entre aberturas do app; na web, usa o localStorage,
// então a sessão também sobrevive a fechar a aba/navegador.
// ============================================================
export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function saveSession(session: { access_token: string; refresh_token?: string }): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, session.access_token);
  if (session.refresh_token) await AsyncStorage.setItem(REFRESH_KEY, session.refresh_token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// ============================================================
// AUTH
// ============================================================
export type Role = "paciente" | "clinica" | "profissional";

/** Papéis que fazem login. A prefeitura não tem cadastro público. */
export type SessionRole = Role | "prefeitura";

export async function authLogin(email: string, senha: string, role: SessionRole) {
  const res = await api.post("/auth/login", { email, senha, role });
  const data = res.data;

  // Salva o JWT (e o refresh_token, que mantém a sessão) para os próximos requests
  if (data?.session?.access_token) {
    await saveSession(data.session);
  }

  return data; // { user, session }
}

export async function authRegister(role: Role, payload: any) {
  const res = await api.post("/auth/register", { role, payload });
  const data = res.data;

  // Salva o JWT se o register retornar sessão
  if (data?.session?.access_token) {
    await saveSession(data.session);
  }

  return data; // { user, session }
}

export async function authLogout(): Promise<void> {
  await clearToken();
  sessionStore.clear();
}

/**
 * Retoma a sessão salva ao abrir o app: com token guardado, pergunta ao
 * backend quem é o usuário (e o status do cadastro). Token recusado limpa a
 * sessão; falha de rede mantém o token para a próxima abertura.
 */
export async function restoreSession(): Promise<{ role: SessionRole; user: any } | null> {
  if (!(await getStoredToken())) return null;

  try {
    const res = await api.get("/auth/me");
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403 || status === 404) await authLogout();
    return null;
  }
}

// ============================================================
// IMAGE UPLOAD
// ============================================================
export async function uploadImage(imageUri: string) {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('image', { uri: imageUri, name: filename, type } as any);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.imageUrl;
}

// ============================================================
// PATIENTS
// ============================================================
export async function createPatient(payload: Omit<Patient, "codigo">) {
  const res = await api.post("/patients", payload);
  return res.data;
}

export async function getPatient(id: number) {
  const res = await api.get(`/patients/${id}`);
  return res.data as Patient;
}

export async function updatePatient(id: number, payload: Partial<Omit<Patient, "codigo">>) {
  const res = await api.put(`/patients/${id}`, payload);
  return res.data as Patient;
}

// ============================================================
// CLINICS
// ============================================================
export async function createClinic(payload: Omit<Clinic, "codigo">) {
  const res = await api.post("/clinics", payload);
  return res.data;
}

export async function getClinics(specialization?: string, atendeUnimed?: boolean, tipo?: ClinicType) {
  const params: any = {};
  if (specialization) params.specialization = specialization;
  if (atendeUnimed !== undefined) params.atende_unimed = atendeUnimed;
  if (tipo) params.type = tipo;
  const res = await api.get("/clinics", { params });
  return res.data as Clinic[];
}

export async function getClinicById(id: number) {
  const res = await api.get(`/clinics/${id}`);
  return res.data as Clinic;
}

export async function updateClinic(id: number, payload: Partial<Clinic>) {
  const res = await api.put(`/clinics/${id}`, payload);
  return res.data;
}

// ============================================================
// SPECIALIZATIONS
// ============================================================
export async function getSpecializations() {
  const res = await api.get("/specializations");
  return res.data as Specialization[];
}

export async function createSpecialization(nome: string) {
  const res = await api.post("/specializations", { nome });
  return res.data as Specialization;
}

export async function getClinicSpecializations(clinicCode: number) {
  const res = await api.get(`/clinics/${clinicCode}/specializations`);
  return res.data as Specialization[];
}

export async function addSpecializationToClinic(clinicCode: number, specializationName: string) {
  const specializations = await getSpecializations();
  const specialization = specializations.find(s => s.nome === specializationName);
  if (!specialization) throw new Error('Especialização não encontrada');
  const res = await api.post(`/clinics/${clinicCode}/specializations`, { codigo_especializacao: specialization.codigo });
  return res.data;
}

export async function removeSpecializationFromClinic(clinicCode: number, specializationName: string) {
  const specializations = await getSpecializations();
  const specialization = specializations.find(s => s.nome === specializationName);
  if (!specialization) throw new Error('Especialização não encontrada');
  const res = await api.delete(`/clinics/${clinicCode}/specializations/${specialization.codigo}`);
  return res.data;
}

export async function getClinicPatients(clinicCode: number) {
  const res = await api.get(`/appointments/clinic/${clinicCode}`);
  const appointments = res.data as AppointmentWithDetails[];
  const uniquePatients = appointments.reduce((acc, appointment) => {
    if (!acc.find(p => p.codigo === appointment.codigo_paciente)) {
      acc.push({
        codigo: appointment.codigo_paciente,
        nome: appointment.paciente_nome || '',
        email: appointment.paciente_email || '',
        datan: '',
        fone: '',
        ende: '',
      } as Patient);
    }
    return acc;
  }, [] as Patient[]);
  return uniquePatients;
}

// ============================================================
// APPOINTMENTS
// ============================================================
export async function createAppointment(appointmentData: Omit<Appointment, 'codigo' | 'criado_em' | 'atualizado_em'>) {
  const res = await api.post("/appointments", appointmentData);
  return res.data as Appointment;
}

export async function getAppointmentById(codigo: number) {
  const res = await api.get(`/appointments/${codigo}`);
  return res.data as AppointmentWithDetails;
}

export async function getAppointmentsByPatient(codigo_paciente: number) {
  const res = await api.get(`/appointments/patient/${codigo_paciente}`);
  return res.data as AppointmentWithDetails[];
}

export async function getAppointmentsByClinic(codigo_clinica: number) {
  const res = await api.get(`/appointments/clinic/${codigo_clinica}`);
  return res.data as AppointmentWithDetails[];
}

export async function updateAppointmentStatus(codigo: number, status: AppointmentStatus) {
  const res = await api.patch(`/appointments/${codigo}/status`, { status });
  return res.data as Appointment;
}

export async function updateAppointment(codigo: number, updates: Partial<Omit<Appointment, 'codigo' | 'criado_em' | 'atualizado_em'>>) {
  const res = await api.put(`/appointments/${codigo}`, updates);
  return res.data as Appointment;
}

export async function deleteAppointment(codigo: number) {
  const res = await api.delete(`/appointments/${codigo}`);
  return res.data;
}

export async function getAvailableSlots(codigo_clinica: number, data: string) {
  const res = await api.get(`/appointments/slots/available`, { params: { codigo_clinica, data } });
  return res.data as string[];
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function uploadDocument(fileUri: string, documentData: Omit<Document, 'codigo' | 'criado_em' | 'url_arquivo' | 'nome_arquivo' | 'tamanho_arquivo'>) {
  const imageUrl = await uploadImage(fileUri);
  const filename = fileUri.split('/').pop() || 'document';
  const res = await api.post("/documents", { ...documentData, url_arquivo: imageUrl, nome_arquivo: filename });
  return res.data as Document;
}

export async function createDocument(documentData: Omit<Document, 'codigo' | 'criado_em'>) {
  const res = await api.post("/documents", documentData);
  return res.data as Document;
}

export async function getDocumentById(codigo: number) {
  const res = await api.get(`/documents/${codigo}`);
  return res.data as DocumentWithDetails;
}

export async function getDocumentsByPatient(codigo_paciente: number) {
  const res = await api.get(`/documents/patient/${codigo_paciente}`);
  return res.data as DocumentWithDetails[];
}

export async function getDocumentsByClinic(codigo_clinica: number) {
  const res = await api.get(`/documents/clinic/${codigo_clinica}`);
  return res.data as DocumentWithDetails[];
}

export async function getDocumentsByPatientAndClinic(codigo_paciente: number, codigo_clinica: number) {
  const res = await api.get(`/documents/patient/${codigo_paciente}/clinic/${codigo_clinica}`);
  return res.data as DocumentWithDetails[];
}

export async function deleteDocument(codigo: number) {
  const res = await api.delete(`/documents/${codigo}`);
  return res.data;
}

export async function updateDocument(codigo: number, updates: Partial<Omit<Document, 'codigo' | 'criado_em'>>) {
  const res = await api.put(`/documents/${codigo}`, updates);
  return res.data as Document;
}

// ============================================================
// PROFESSIONALS
// ============================================================
export async function getProfessionals(params: { type?: ProfessionalType; clinic?: number } = {}) {
  const res = await api.get("/professionals", { params });
  return res.data as Professional[];
}

export async function getProfessional(id: number) {
  const res = await api.get(`/professionals/${id}`);
  return res.data as Professional;
}

export async function createProfessional(payload: Partial<Professional>) {
  const res = await api.post("/professionals", payload);
  return res.data as Professional;
}

export async function updateProfessional(id: number, payload: Partial<Professional>) {
  const res = await api.put(`/professionals/${id}`, payload);
  return res.data as Professional;
}

export async function getProfessionalSlots(id: number, data: string, modalidade?: Modalidade) {
  const res = await api.get(`/professionals/${id}/availability`, { params: { data, modalidade } });
  return res.data as Slot[];
}

// ============================================================
// AVAILABILITY (agenda semanal do prestador)
// ============================================================
export async function getAvailability(params: { codigo_profissional?: number; codigo_clinica?: number }) {
  const res = await api.get("/availability", { params });
  return res.data as Availability[];
}

export async function createAvailability(payload: Omit<Availability, "codigo" | "codigo_clinica" | "profissional_nome">) {
  const res = await api.post("/availability", payload);
  return res.data as Availability;
}

export async function deleteAvailability(codigo: number) {
  const res = await api.delete(`/availability/${codigo}`);
  return res.data;
}

// ============================================================
// APPOINTMENTS — agenda real, ciclo de vida e evolução
// ============================================================
export type ScheduledAppointmentPayload = {
  codigo_profissional?: number | null;
  codigo_clinica?: number | null;
  codigo_especializacao?: number | null;
  codigo_animal?: number | null;
  data_hora: string;
  modalidade: Modalidade;
  tipo_atendimento?: string;
  observacoes?: string;
  usar_agenda?: boolean;
};

export async function createScheduledAppointment(payload: ScheduledAppointmentPayload) {
  const res = await api.post("/appointments", { ...payload, usar_agenda: true });
  return res.data as AppointmentWithDetails;
}

export async function getAppointmentsByProfessional(codigo_profissional: number, data?: string) {
  const res = await api.get(`/appointments/professional/${codigo_profissional}`, { params: { data } });
  return res.data as AppointmentWithDetails[];
}

export type AppointmentAction = "confirm" | "start" | "finish" | "no-show" | "cancel";

export async function changeAppointment(codigo: number, action: AppointmentAction, motivo?: string) {
  const res = await api.patch(`/appointments/${codigo}/${action}`, motivo ? { motivo } : {});
  return res.data as AppointmentWithDetails;
}

export async function getAppointmentNotes(codigo: number) {
  const res = await api.get(`/appointments/${codigo}/notes`);
  return res.data as AppointmentNote[];
}

export async function addAppointmentNote(codigo: number, texto: string) {
  const res = await api.post(`/appointments/${codigo}/notes`, { texto });
  return res.data as AppointmentNote;
}

// ============================================================
// ANIMALS
// ============================================================
export async function getAnimals() {
  const res = await api.get("/animals");
  return res.data as Animal[];
}

export async function createAnimal(payload: Partial<Animal>) {
  const res = await api.post("/animals", payload);
  return res.data as Animal;
}

export async function updateAnimal(codigo: number, payload: Partial<Animal>) {
  const res = await api.put(`/animals/${codigo}`, payload);
  return res.data as Animal;
}

export async function deleteAnimal(codigo: number) {
  const res = await api.delete(`/animals/${codigo}`);
  return res.data;
}

export async function addVaccine(codigoAnimal: number, payload: { nome: string; aplicada_em: string; proxima_dose?: string }) {
  const res = await api.post(`/animals/${codigoAnimal}/vaccines`, payload);
  return res.data as Vaccine;
}

// ============================================================
// UPA
// ============================================================
export async function getUpaUnits() {
  const res = await api.get("/upa/units");
  return res.data as UpaUnit[];
}

export async function getUpaQueue(unitId: number) {
  const res = await api.get(`/upa/${unitId}/queue`);
  return res.data as UpaQueue;
}

export async function joinUpaQueue(unitId: number, sintomas?: string) {
  const res = await api.post(`/upa/${unitId}/queue`, { sintomas });
  return res.data as UpaQueueEntry;
}

export async function getMyUpaQueue() {
  const res = await api.get("/upa/queue/mine");
  return res.data as UpaQueueEntry[];
}

export async function getUpaProtocol(protocol: string) {
  const res = await api.get(`/upa/queue/${encodeURIComponent(protocol)}`);
  return res.data as UpaQueueEntry;
}

export async function updateUpaQueueStatus(id: number, payload: { status?: UpaQueueStatus; setor?: string }) {
  const res = await api.patch(`/upa/queue/${id}/status`, payload);
  return res.data as UpaQueueEntry;
}

export async function updateUpaRisk(id: number, classificacao_risco: RiskLevel) {
  const res = await api.patch(`/upa/queue/${id}/risk`, { classificacao_risco });
  return res.data as UpaQueueEntry;
}

export async function callNextUpa(unitId: number, etapa: "triagem" | "atendimento") {
  const res = await api.post(`/upa/${unitId}/queue/call-next`, { etapa });
  return res.data as UpaQueueEntry;
}

// ============================================================
// TELEMEDICINE
// ============================================================
export async function getTelemedicineProviders() {
  const res = await api.get("/telemedicine/providers");
  return res.data as TelemedicineProvider[];
}

export async function getTelemedicineSlots(tipo: "clinica" | "profissional", id: number, data: string, especializacao?: number) {
  const res = await api.get(`/telemedicine/providers/${id}/availability`, { params: { tipo, data, especializacao } });
  return res.data as Slot[];
}

export async function getRoomStatus(appointmentId: number) {
  const res = await api.get(`/telemedicine/rooms/${appointmentId}`);
  return res.data as RoomStatus;
}

export async function joinRoom(appointmentId: number) {
  const res = await api.post(`/telemedicine/rooms/${appointmentId}/join`);
  return res.data as { meetingUrl: string; roomId: string; fecha_em: string };
}

export async function finishRoom(appointmentId: number) {
  const res = await api.post(`/telemedicine/rooms/${appointmentId}/finish`);
  return res.data;
}

// ============================================================
// APROVAÇÃO DE CADASTROS (prefeitura)
// ============================================================
export async function getMyApproval() {
  const res = await api.get("/approvals/me");
  return res.data as MyApproval;
}

export async function resubmitApproval(dados: Record<string, unknown>) {
  const res = await api.post("/approvals/me/resubmit", dados);
  return res.data as MyApproval;
}

export async function listApprovals(status: ApprovalStatus, tipo?: ApprovalType) {
  const res = await api.get("/approvals", { params: { status, tipo } });
  return res.data as { itens: ApprovalItem[]; contagem: Record<ApprovalStatus, number> };
}

export async function getPrefeituraDashboard(de: string, ate: string) {
  const res = await api.get("/dashboard", { params: { de, ate } });
  return res.data as PrefeituraDashboard;
}

export async function decideApproval(tipo: ApprovalType, codigo: number, decisao: "aprovado" | "reprovado", motivo?: string) {
  const res = await api.patch(`/approvals/${tipo}/${codigo}`, { decisao, motivo });
  return res.data as ApprovalItem;
}

export default api;