import React from "react";
import { Platform } from "react-native";

const NativeStackLibrary = require("@react-navigation/native-stack");
const createNativeStackNavigator = NativeStackLibrary.createNativeStackNavigator;

import LoginScreen from "../screens/LoginScreen";
import RegisterPatient from "../screens/RegisterPatient";
import RegisterClinic from "../screens/RegisterClinic";
import PatientMenu from "../screens/PatientMenu";
import PatientEditScreen from "../screens/PatientEditScreen";
import ClinicMenu from "../screens/ClinicMenu";
import ClinicEditScreen from "../screens/ClinicEditScreen";
import ClinicList from "../screens/ClinicList";
import ClinicDetailsScreen from "../screens/ClinicDetailsScreen";
import SpecializationsScreen from "../screens/SpecializationsScreen";
import AppointmentsScreen from "../screens/AppointmentsScreen";
import BookAppointmentScreen from "../screens/BookAppointmentScreen";
import ClinicPatientsScreen from "../screens/ClinicPatientsScreen";
import ClinicAgendaScreen from "../screens/ClinicAgendaScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ClinicReportsScreen from "../screens/ClinicReportsScreen";
import PatientDocumentsScreen from "../screens/PatientDocumentsScreen";
import ClinicDocumentsScreen from "../screens/ClinicDocumentsScreen";
import RegisterProfessional from "../screens/RegisterProfessional";
import ProfessionalMenu from "../screens/ProfessionalMenu";
import ProviderAgendaScreen from "../screens/ProviderAgendaScreen";
import AvailabilityScreen from "../screens/AvailabilityScreen";
import ClinicProfessionalsScreen from "../screens/ClinicProfessionalsScreen";
import UpaStaffScreen from "../screens/UpaStaffScreen";
import PetsScreen from "../screens/PetsScreen";
import SplashScreen from "../screens/SplashScreen";
import AwaitingApprovalScreen from "../screens/AwaitingApprovalScreen";
import ApprovalsScreen from "../screens/ApprovalsScreen";
import PrefeituraDashboardScreen from "../screens/PrefeituraDashboardScreen";
import WebScreen from "../components/WebScreen";
import {
  ServicesHome,
  UpaServiceScreen,
  PsychologyServiceScreen,
  VeterinaryServiceScreen,
  TelemedicineServiceScreen,
} from "../screens/ServiceScreens";

export type RootStackParamList = {
  // Retoma a sessão salva e decide a tela inicial
  Splash: undefined;
  Login: undefined;
  RegisterPatient: undefined;
  RegisterClinic: undefined;
  PatientMenu: { patient: any } | undefined;
  PatientEdit: { patient: any };
  ClinicMenu: { clinic: any } | undefined;
  ClinicEdit: { clinic: any } | undefined;
  ClinicList: { patient?: any };
  ClinicDetails: { clinicId: number; patient?: any };
  SpecializationsScreen: { clinicCode?: number };
  Appointments: { patient: any };
  BookAppointment: { clinic: any; patient: any };
  ClinicPatients: { clinic: any };
  ClinicAgenda: { clinic: any };
  Notifications: { patient: any };
  ClinicReports: { clinic: any };
  PatientDocuments: { patient: any };
  ClinicDocuments: { clinic: any };
  // patient ausente = visitante (pode consultar, mas não agendar)
  ServicesHome: { patient?: any } | undefined;
  UpaService: { patient?: any } | undefined;
  PsychologyService: { patient?: any } | undefined;
  VeterinaryService: { patient?: any } | undefined;
  TelemedicineService: { patient?: any } | undefined;
  Pets: { patient: any };
  RegisterProfessional: undefined;
  ProfessionalMenu: { professional: any };
  // Agenda e horários servem ao profissional e à clínica (com ou sem um profissional dela)
  ProviderAgenda: { professional?: any; clinic?: any };
  Availability: { professional?: any; clinic?: any; professionalId?: number };
  ClinicProfessionals: { clinic: any };
  UpaStaff: { unitId: number; unitName?: string; clinic?: any };
  // Clínica/profissional com cadastro em análise ou reprovado pela prefeitura
  AwaitingApproval: { role: "clinica" | "profissional"; user: any };
  // Prefeitura: o dashboard é a tela inicial; a aprovação abre a partir dele
  PrefeituraDashboard: { admin: any };
  Approvals: { admin: any };
};

const Stack = createNativeStackNavigator();

function webScreen(Component: React.ComponentType<any>) {
  if (Platform.OS !== "web") {
    return Component;
  }

  return function ResponsiveWebScreen(props: any) {
    return (
      <WebScreen navigation={props.navigation} routeName={props.route?.name}>
        <Component {...props} />
      </WebScreen>
    );
  };
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerTitleAlign: "center",
        headerShown: Platform.OS !== "web",
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={webScreen(LoginScreen)} />
      <Stack.Screen name="RegisterPatient" component={webScreen(RegisterPatient)} options={{ title: "Cadastrar Paciente" }} />
      <Stack.Screen name="RegisterClinic" component={webScreen(RegisterClinic)} options={{ title: "Cadastrar Clínica" }} />
      <Stack.Screen name="PatientMenu" component={webScreen(PatientMenu)} options={{ title: "Menu Paciente" }} />
      <Stack.Screen name="PatientEdit" component={webScreen(PatientEditScreen)} options={{ title: "Editar Perfil" }} />
      <Stack.Screen name="ClinicMenu" component={webScreen(ClinicMenu)} options={{ title: "Menu Clínica" }} />
      <Stack.Screen name="ClinicEdit" component={webScreen(ClinicEditScreen)} options={{ title: "Editar Clínica" }} />
      <Stack.Screen name="ClinicList" component={webScreen(ClinicList)} options={{ title: "Clínicas" }} />
      <Stack.Screen name="ClinicDetails" component={webScreen(ClinicDetailsScreen)} options={{ title: "Detalhes da Clínica" }} />
      <Stack.Screen name="SpecializationsScreen" component={webScreen(SpecializationsScreen)} options={{ title: "Especializações" }} />
      <Stack.Screen name="Appointments" component={webScreen(AppointmentsScreen)} options={{ title: "Minhas Consultas" }} />
      <Stack.Screen name="BookAppointment" component={webScreen(BookAppointmentScreen)} options={{ title: "Agendar Consulta" }} />
      <Stack.Screen name="ClinicPatients" component={webScreen(ClinicPatientsScreen)} options={{ title: "Pacientes e Consultas" }} />
      <Stack.Screen name="ClinicAgenda" component={webScreen(ClinicAgendaScreen)} options={{ title: "Agenda da Clínica" }} />
      <Stack.Screen name="Notifications" component={webScreen(NotificationsScreen)} options={{ title: "Notificações" }} />
      <Stack.Screen name="ClinicReports" component={webScreen(ClinicReportsScreen)} options={{ title: "Relatórios" }} />
      <Stack.Screen name="PatientDocuments" component={webScreen(PatientDocumentsScreen)} options={{ title: "Meus Documentos" }} />
      <Stack.Screen name="ClinicDocuments" component={webScreen(ClinicDocumentsScreen)} options={{ title: "Documentos dos Pacientes" }} />
      <Stack.Screen name="ServicesHome" component={webScreen(ServicesHome)} options={{ title: "Serviços de atendimento" }} />
      <Stack.Screen name="UpaService" component={webScreen(UpaServiceScreen)} options={{ title: "UPA / SUS" }} />
      <Stack.Screen name="PsychologyService" component={webScreen(PsychologyServiceScreen)} options={{ title: "Psicólogo" }} />
      <Stack.Screen name="VeterinaryService" component={webScreen(VeterinaryServiceScreen)} options={{ title: "Clínica veterinária" }} />
      <Stack.Screen name="TelemedicineService" component={webScreen(TelemedicineServiceScreen)} options={{ title: "Telemedicina" }} />
      <Stack.Screen name="Pets" component={webScreen(PetsScreen)} options={{ title: "Meus Animais" }} />
      <Stack.Screen name="RegisterProfessional" component={webScreen(RegisterProfessional)} options={{ title: "Cadastrar Profissional" }} />
      <Stack.Screen name="ProfessionalMenu" component={webScreen(ProfessionalMenu)} options={{ title: "Menu Profissional" }} />
      <Stack.Screen name="ProviderAgenda" component={webScreen(ProviderAgendaScreen)} options={{ title: "Agenda de Atendimentos" }} />
      <Stack.Screen name="Availability" component={webScreen(AvailabilityScreen)} options={{ title: "Horários" }} />
      <Stack.Screen name="ClinicProfessionals" component={webScreen(ClinicProfessionalsScreen)} options={{ title: "Equipe" }} />
      <Stack.Screen name="UpaStaff" component={webScreen(UpaStaffScreen)} options={{ title: "Fila da UPA" }} />
      <Stack.Screen name="AwaitingApproval" component={webScreen(AwaitingApprovalScreen)} options={{ title: "Análise do Cadastro" }} />
      <Stack.Screen name="PrefeituraDashboard" component={webScreen(PrefeituraDashboardScreen)} options={{ title: "Painel da Prefeitura" }} />
      <Stack.Screen name="Approvals" component={webScreen(ApprovalsScreen)} options={{ title: "Aprovação de Cadastros" }} />
    </Stack.Navigator>
  );
}