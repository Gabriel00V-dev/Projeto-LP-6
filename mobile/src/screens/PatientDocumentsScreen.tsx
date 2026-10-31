import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Linking,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";
import ModernCard from "../components/ModernCard";
import { getDocumentsByPatient, uploadDocument, deleteDocument } from "../api/client";
import { DocumentWithDetails, DocumentType } from "../types";

type Props = {
  navigation: any;
  route: any;
};

const documentTypes: { type: DocumentType; icon: any; label: string }[] = [
  { type: "exame", icon: "flask-outline", label: "Exame" },
  { type: "receita", icon: "receipt-outline", label: "Receita" },
  { type: "laudo", icon: "document-text-outline", label: "Laudo" },
  { type: "atestado", icon: "shield-checkmark-outline", label: "Atestado" },
  { type: "pedido_exame", icon: "clipboard-outline", label: "Pedido" },
  { type: "outro", icon: "document-attach-outline", label: "Outro" },
];

export default function PatientDocumentsScreen({ route }: Props) {
  const patient = route.params?.patient;
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<DocumentType | "all">("all");

  useEffect(() => {
    if (patient?.codigo) {
      loadDocuments();
    }
  }, [patient?.codigo]);

  const loadDocuments = async () => {
    setRefreshing(true);
    try {
      const data = await getDocumentsByPatient(patient.codigo);
      setDocuments(data);
    } catch (error: any) {
      console.error("Erro ao carregar documentos:", error);
      Alert.alert("Erro", "Não foi possível carregar os documentos");
    } finally {
      setRefreshing(false);
    }
  };

  const handleChooseDocumentType = () => {
    const options = documentTypes.map((doc) => ({ 
      text: doc.label, 
      onPress: () => pickDocument(doc.type) 
    }));

    Alert.alert(
      "Tipo de Documento",
      "Qual tipo de documento você deseja enviar?",
      [...options, { text: "Cancelar", style: "cancel" }]
    );
  };

  const pickDocument = async (tipo: DocumentType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      Alert.prompt(
        "Descrição do Documento",
        "Adicione uma descrição (opcional)",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Enviar",
            onPress: async (descricao) => {
              await handleUpload(file.uri, tipo, descricao || "");
            },
          },
        ],
        "plain-text"
      );
    } catch (error) {
      console.error("Erro ao selecionar documento:", error);
      Alert.alert("Erro", "Não foi possível selecionar o documento");
    }
  };

  const handleUpload = async (
    fileUri: string,
    tipo: DocumentType,
    descricao: string
  ) => {
    setUploading(true);
    try {
      await uploadDocument(fileUri, {
        codigo_paciente: patient.codigo,
        tipo_documento: tipo,
        descricao: descricao || undefined,
        enviado_por: "paciente",
      });
      Alert.alert("Sucesso", "Documento enviado com sucesso!");
      loadDocuments();
    } catch (error: any) {
      console.error("Erro ao enviar documento:", error);
      Alert.alert("Erro", "Não foi possível enviar o documento");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (codigo: number) => {
    Alert.alert(
      "Excluir Documento",
      "Tem certeza que deseja excluir este documento?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDocument(codigo);
              Alert.alert("Sucesso", "Documento excluído");
              loadDocuments();
            } catch (error) {
              Alert.alert("Erro", "Não foi possível excluir o documento");
            }
          },
        },
      ]
    );
  };

  const openDocument = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o documento");
    });
  };

  const getDocumentDetails = (tipo: DocumentType) => {
    return documentTypes.find(d => d.type === tipo) || documentTypes[documentTypes.length - 1];
  };

  const filteredDocuments = filter === "all" ? documents : documents.filter((doc) => doc.tipo_documento === filter);

  const renderDocument = ({ item }: { item: DocumentWithDetails }) => {
    const details = getDocumentDetails(item.tipo_documento);
    return (
      <ModernCard key={item.codigo} variant="elevated" style={styles.documentCard}>
        <View style={styles.documentHeader}>
          <View style={[styles.documentIcon, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name={details.icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentType}>{details.label}</Text>
            <Text style={styles.documentDate}>
              {new Date(item.criado_em || "").toLocaleDateString("pt-BR")}
            </Text>
          </View>
          {item.enviado_por === "clinica" && (
            <View style={styles.clinicBadge}>
              <Ionicons name="business-outline" size={12} color={colors.success} />
              <Text style={styles.clinicBadgeText}>Clínica</Text>
            </View>
          )}
        </View>

        {item.descricao && <Text style={styles.documentDescription}>{item.descricao}</Text>}
        {item.clinica_nome && <Text style={styles.documentClinic}>Enviado por: {item.clinica_nome}</Text>}

        <View style={styles.documentActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openDocument(item.url_arquivo)}>
            <Ionicons name="eye-outline" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Ver</Text>
          </TouchableOpacity>
          {item.enviado_por === "paciente" && (
            <TouchableOpacity style={[styles.actionButton, { marginLeft: spacing.sm }]} onPress={() => handleDelete(item.codigo!)}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Excluir</Text>
            </TouchableOpacity>
          )}
        </View>
      </ModernCard>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
        <Text style={styles.headerTitle}>Meus Documentos</Text>
        <Text style={styles.headerSubtitle}>Gerencie seus exames, receitas e laudos</Text>
      </LinearGradient>

      {/* This wrapper View is crucial for the layout */}
      <View style={{ flex: 1 }}>
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, filter === "all" && styles.filterChipActive]}
              onPress={() => setFilter("all")}
            >
              <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>Todos</Text>
            </TouchableOpacity>
            {documentTypes.map((docType) => (
              <TouchableOpacity
                key={docType.type}
                style={[styles.filterChip, filter === docType.type && styles.filterChipActive]}
                onPress={() => setFilter(docType.type)}
              >
                <Text style={[styles.filterText, filter === docType.type && styles.filterTextActive]}>
                  {docType.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          style={{ flex: 1 }} // This flex: 1 is also crucial
          data={filteredDocuments}
          renderItem={renderDocument}
          keyExtractor={(item) => item.codigo!.toString()}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDocuments} tintColor={colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={60} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum Documento Encontrado</Text>
              <Text style={styles.emptySubtext}>
                {filter === "all"
                  ? "Use o botão (+) para adicionar seus documentos"
                  : `Não há documentos do tipo \"${getDocumentDetails(filter).label}\"`}
              </Text>
            </View>
          )}
        />
      </View>

      <TouchableOpacity style={styles.fab} onPress={handleChooseDocumentType} disabled={uploading}>
        {uploading ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={32} color={colors.onPrimary} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: fontSize.md,
    color: colors.onPrimary,
    textAlign: "center",
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 14,
  },
  filterTextActive: {
    color: colors.onPrimary,
  },
  listContentContainer: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: "80%",
  },
  documentCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  documentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentType: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  documentDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  clinicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.success + "20",
  },
  clinicBadgeText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: fontWeight.semibold,
  },
  documentDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginVertical: spacing.md,
  },
  documentClinic: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginBottom: spacing.md,
  },
  documentActions: {
    flexDirection: "row",
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: colors.shadow,
    shadowRadius: 6,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
  },
});
