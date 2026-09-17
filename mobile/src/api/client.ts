import { Clinic, Patient, Specialization, Appointment, AppointmentWithDetails, AppointmentStatus, Document, DocumentWithDetails } from "../types";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = "https://backend-psi-steel-82.vercel.app";

const TOKEN_KEY = '@clinica:token';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

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
  (error) => {
    console.log('Request failed:', error.config?.url, error.message);
    return Promise.reject(error);
  }
);

// ============================================================
// Helpers de token
// ============================================================
export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// ============================================================
// AUTH
// ============================================================
export async function authLogin(email: string, senha: string, role: "paciente" | "clinica") {
  const res = await api.post("/auth/login", { email, senha, role });
  const data = res.data;

  // Salva o JWT automaticamente para os próximos requests
  if (data?.session?.access_token) {
    await saveToken(data.session.access_token);
  }

  return data; // { user, session }
}

export async function authRegister(role: "paciente" | "clinica", payload: any) {
  const res = await api.post("/auth/register", { role, payload });
  const data = res.data;

  // Salva o JWT se o register retornar sessão
  if (data?.session?.access_token) {
    await saveToken(data.session.access_token);
  }

  return data; // { user, session }
}

export async function authLogout(): Promise<void> {
  await clearToken();
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

export async function getClinics(specialization?: string, atendeUnimed?: boolean) {
  const params: any = {};
  if (specialization) params.specialization = specialization;
  if (atendeUnimed !== undefined) params.atende_unimed = atendeUnimed;
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

export default api;