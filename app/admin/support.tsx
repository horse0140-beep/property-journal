import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AdminField, AdminSelect } from "@/components/admin/AdminField";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { colors, styles } from "@/constants/theme";
import {
  createSupportTicket,
  deleteSupportTicket,
  fetchSupportTickets,
  updateSupportTicket,
} from "@/services/supportService";
import type { SupportTicket, TicketPriority, TicketStatus } from "@/types/admin";

const STATUS_OPTIONS: { label: string; value: TicketStatus }[] = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_OPTIONS: { label: string; value: TicketPriority }[] = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

function statusVariant(status: TicketStatus): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "open") return "danger";
  if (status === "in_progress") return "warning";
  if (status === "resolved") return "success";
  return "muted";
}

function priorityVariant(priority: TicketPriority): "success" | "warning" | "danger" | "info" | "muted" {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "normal") return "info";
  return "muted";
}

function emptyForm() {
  return {
    user_email: "",
    subject: "",
    message: "",
    status: "open" as TicketStatus,
    priority: "normal" as TicketPriority,
    admin_notes: "",
  };
}

export default function AdminSupportScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupportTicket | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setTickets(await fetchSupportTickets());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(ticket: SupportTicket) {
    setEditing(ticket);
    setForm({
      user_email: ticket.user_email,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      priority: ticket.priority,
      admin_notes: ticket.admin_notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.user_email.trim() || !form.subject.trim() || !form.message.trim()) {
      Alert.alert("Validation", "Email, subject, and message are required.");
      return;
    }

    const payload = {
      user_email: form.user_email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
      status: form.status,
      priority: form.priority,
      admin_notes: form.admin_notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateSupportTicket(editing.id, payload);
      } else {
        await createSupportTicket(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save ticket");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(ticket: SupportTicket) {
    Alert.alert("Delete Ticket", `Remove "${ticket.subject}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSupportTicket(ticket.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete ticket");
          }
        },
      },
    ]);
  }

  async function quickResolve(ticket: SupportTicket) {
    try {
      await updateSupportTicket(ticket.id, { status: "resolved" });
      await load();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to resolve ticket");
    }
  }

  const q = search.toLowerCase().trim();
  const filtered = tickets.filter((t) => {
    const matchesSearch =
      !q ||
      t.user_email.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q) ||
      t.status.includes(q) ||
      t.priority.includes(q);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader
          title="Support Tickets"
          subtitle={`${openCount} open · ${tickets.length} total`}
          rightAction={{ label: "+ Add", onPress: openCreate }}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <View style={{ position: "relative" }}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textMuted}
              style={{ position: "absolute", left: 14, top: 15, zIndex: 1 }}
            />
            <TextInput
              style={[styles.input, { paddingLeft: 42 }]}
              placeholder="Search email, subject, message…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setStatusFilter(opt.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: statusFilter === opt.value ? colors.primary : colors.bgSection,
                  borderWidth: 1,
                  borderColor: statusFilter === opt.value ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: statusFilter === opt.value ? "#fff" : colors.textSecondary,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
            }
          >
            {error ? <AdminErrorCard message={error} onRetry={load} /> : null}

            {filtered.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No support tickets</Text>
                <Text style={styles.emptyStateText}>
                  {search || statusFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Customer requests will appear here."}
                </Text>
              </View>
            ) : (
              filtered.map((ticket) => (
                <Card key={ticket.id}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { flex: 1, marginRight: 8 }]}>{ticket.subject}</Text>
                    <AdminBadge label={ticket.status} variant={statusVariant(ticket.status)} />
                  </View>
                  <Text style={styles.muted}>{ticket.user_email}</Text>
                  <Text style={[styles.bodyText, { marginTop: 8 }]} numberOfLines={3}>
                    {ticket.message}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <AdminBadge label={ticket.priority} variant={priorityVariant(ticket.priority)} />
                    <AdminBadge label={new Date(ticket.created_at).toLocaleDateString()} variant="muted" />
                  </View>
                  {ticket.admin_notes ? (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: colors.bgSection, borderRadius: 10 }}>
                      <Text style={styles.label}>Admin Notes</Text>
                      <Text style={styles.bodyText}>{ticket.admin_notes}</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    {(ticket.status === "open" || ticket.status === "in_progress") && (
                      <Pressable
                        onPress={() => quickResolve(ticket)}
                        style={[styles.secondaryButton, { flex: 1, marginTop: 0, borderColor: colors.success }]}
                      >
                        <Text style={[styles.secondaryButtonText, { color: colors.success }]}>Resolve</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => openEdit(ticket)} style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(ticket)}
                      style={[styles.secondaryButton, { flex: 1, marginTop: 0, borderColor: colors.danger }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <AdminFormModal
          visible={modalOpen}
          title={editing ? "Edit Ticket" : "New Ticket"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={saving}
          saveLabel={editing ? "Update Ticket" : "Create Ticket"}
        >
          <AdminField
            label="User Email"
            value={form.user_email}
            onChangeText={(v) => setForm((f) => ({ ...f, user_email: v }))}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="user@example.com"
          />
          <AdminField
            label="Subject"
            value={form.subject}
            onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))}
            placeholder="Issue summary"
          />
          <AdminField
            label="Message"
            value={form.message}
            onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
            multiline
            placeholder="Full message from user"
          />
          <AdminSelect
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, status: v as TicketStatus }))}
          />
          <AdminSelect
            label="Priority"
            value={form.priority}
            options={PRIORITY_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, priority: v as TicketPriority }))}
          />
          <AdminField
            label="Admin Notes"
            value={form.admin_notes}
            onChangeText={(v) => setForm((f) => ({ ...f, admin_notes: v }))}
            multiline
            placeholder="Internal notes"
          />
        </AdminFormModal>
      </Screen>
    </AdminGate>
  );
}
