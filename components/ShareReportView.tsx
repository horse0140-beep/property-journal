import { type ReactNode } from "react";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import type {
  PropertyShareSnapshot,
  ShareApplianceItem,
  ShareDocItem,
  ShareGalleryItem,
  ShareMaintenanceItem,
  ShareRepairItem,
  ShareTimelineItem,
  ShareWarrantyItem,
} from "@/lib/shareSnapshot";

function dash(value: string | undefined | null): string {
  const s = (value ?? "").trim();
  return s || "—";
}

function formatCreatedAt(value: unknown): string {
  if (value == null || value === "") return "—";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

type Props = {
  snapshot: PropertyShareSnapshot;
  propertyLabel?: string;
  createdAt?: string | null;
  heroHeight?: number;
  previewBanner?: boolean;
};

/**
 * Renders only sections that are permitted and have content.
 * Empty / disabled sections are omitted entirely (no titles, no empty cards).
 */
export function ShareReportView({
  snapshot,
  propertyLabel,
  createdAt,
  heroHeight = 200,
  previewBanner = false,
}: Props) {
  const s = snapshot.permissions?.sections;
  const showBasic = s?.basicPropertyInfo !== false;
  const showAddress = Boolean(snapshot.fullAddress?.trim() || snapshot.address?.trim());
  const showDetails =
    showBasic ||
    showAddress ||
    Boolean(
      snapshot.propertyType ||
        snapshot.yearBuilt ||
        snapshot.squareFootage ||
        snapshot.bedrooms ||
        snapshot.bathrooms ||
        snapshot.lotSize
    );

  const facts: { label: string; value: string }[] = [];
  if (showAddress && snapshot.fullAddress?.trim()) {
    facts.push({ label: "Full address", value: dash(snapshot.fullAddress) });
  }
  if (showBasic) {
    if (snapshot.propertyType?.trim()) {
      facts.push({ label: "Property type", value: dash(snapshot.propertyType) });
    }
    if (snapshot.yearBuilt?.trim()) {
      facts.push({ label: "Year built", value: dash(snapshot.yearBuilt) });
    }
    if (snapshot.squareFootage?.trim()) {
      facts.push({
        label: "Square footage",
        value: `${snapshot.squareFootage.trim()} sq ft`,
      });
    }
    if (snapshot.bedrooms?.trim()) {
      facts.push({ label: "Bedrooms", value: dash(snapshot.bedrooms) });
    }
    if (snapshot.bathrooms?.trim()) {
      facts.push({ label: "Bathrooms", value: dash(snapshot.bathrooms) });
    }
    if (snapshot.lotSize?.trim()) {
      facts.push({ label: "Lot size", value: dash(snapshot.lotSize) });
    }
  }

  const summaryCards: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }[] = [];
  if (snapshot.counts.maintenance > 0) {
    summaryCards.push({
      label: "Maintenance Tasks",
      value: snapshot.counts.maintenance,
      icon: "construct-outline",
    });
  }
  if (snapshot.counts.repairs > 0) {
    summaryCards.push({ label: "Repairs", value: snapshot.counts.repairs, icon: "hammer-outline" });
  }
  if (snapshot.counts.appliances > 0) {
    summaryCards.push({
      label: "Appliances",
      value: snapshot.counts.appliances,
      icon: "hardware-chip-outline",
    });
  }
  if (snapshot.counts.documents > 0) {
    summaryCards.push({
      label: "Documents",
      value: snapshot.counts.documents,
      icon: "document-text-outline",
    });
  }
  if (snapshot.counts.photos > 0) {
    summaryCards.push({ label: "Photos", value: snapshot.counts.photos, icon: "images-outline" });
  }
  if (snapshot.counts.warranties > 0) {
    summaryCards.push({
      label: "Warranties",
      value: snapshot.counts.warranties,
      icon: "shield-checkmark-outline",
    });
  }
  if (snapshot.counts.upcomingMaintenance > 0) {
    summaryCards.push({
      label: "Upcoming Maintenance",
      value: snapshot.counts.upcomingMaintenance,
      icon: "calendar-outline",
    });
  }

  const contact = snapshot.ownerContact;
  const showContact =
    Boolean(contact?.email?.trim() || contact?.phone?.trim()) && s?.ownerContact !== false;

  return (
    <View>
      {previewBanner ? (
        <View
          style={{
            backgroundColor: "#FEF3C7",
            borderWidth: 1,
            borderColor: "#F59E0B",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <Text style={{ color: "#92400E", fontWeight: "800" }}>Preview Shared Report</Text>
          <Text style={{ color: "#92400E", fontSize: 12, marginTop: 4 }}>
            This is exactly what recipients will see with your current selections.
          </Text>
        </View>
      ) : null}

      {snapshot.photoUri ? (
        <Image
          source={{ uri: snapshot.photoUri }}
          style={{
            width: "100%",
            height: heroHeight,
            borderRadius: 14,
            backgroundColor: colors.bgSection,
            marginBottom: 16,
          }}
          resizeMode="cover"
          accessibilityLabel="Property photo"
        />
      ) : showBasic || showAddress ? (
        <View
          style={{
            width: "100%",
            height: 140,
            borderRadius: 14,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="home-outline" size={40} color={colors.primary} />
        </View>
      ) : null}

      <Text
        style={{
          fontSize: 24,
          fontWeight: "900",
          color: colors.textPrimary,
          textAlign: "left",
        }}
      >
        {snapshot.nickname || propertyLabel || "Shared property"}
      </Text>
      <Text style={{ color: colors.textMuted, marginTop: 4, fontWeight: "600" }}>
        Read-only Share
      </Text>
      {createdAt ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
          Created {formatCreatedAt(createdAt)}
        </Text>
      ) : null}

      {showDetails && facts.length > 0 ? (
        <Section title="Property Details">
          {facts.map((row) => (
            <FactRow key={row.label} label={row.label} value={row.value} />
          ))}
        </Section>
      ) : null}

      {summaryCards.length > 0 ? (
        <Section title="Summary">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                icon={card.icon}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {snapshot.ownerMessage?.trim() ? (
        <Section title="Owner Message">
          <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
            {snapshot.ownerMessage}
          </Text>
        </Section>
      ) : null}

      {showContact ? (
        <Section title="Owner Contact">
          {contact?.email ? (
            <FactRow label="Email" value={contact.email} />
          ) : null}
          {contact?.phone ? (
            <FactRow label="Phone" value={contact.phone} />
          ) : null}
        </Section>
      ) : null}

      {snapshot.timeline.length > 0 ? <TimelineSection items={snapshot.timeline} /> : null}
      {snapshot.recentRepairs.length > 0 ? (
        <RepairsSection items={snapshot.recentRepairs} />
      ) : null}
      {snapshot.maintenanceHistory.length > 0 ? (
        <MaintenanceListSection
          title="Maintenance History"
          items={snapshot.maintenanceHistory}
          mode="history"
        />
      ) : null}
      {snapshot.upcomingMaintenance.length > 0 ? (
        <MaintenanceListSection
          title="Upcoming Maintenance"
          items={snapshot.upcomingMaintenance}
          mode="upcoming"
        />
      ) : null}
      {snapshot.appliances.length > 0 ? (
        <AppliancesSection items={snapshot.appliances} />
      ) : null}
      {snapshot.gallery.length > 0 ? <GallerySection items={snapshot.gallery} /> : null}
      {snapshot.documents.length > 0 || snapshot.warranties.length > 0 ? (
        <DocumentsSection documents={snapshot.documents} warranties={snapshot.warranties} />
      ) : null}

      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          textAlign: "center",
          marginTop: 28,
          lineHeight: 18,
        }}
      >
        Shared via Property Journal · This is a read-only preview
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 14,
      }}
    >
      <Text style={[styles.cardTitle, { marginBottom: 12 }]}>{title}</Text>
      {children}
    </View>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: "700",
          fontSize: 13,
          flex: 1.2,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        width: "47%",
        minWidth: 140,
        flexGrow: 1,
        backgroundColor: colors.bgSection,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.primary, marginTop: 8 }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
        {label}
      </Text>
    </View>
  );
}

function TimelineSection({ items }: { items: ShareTimelineItem[] }) {
  return (
    <Section title="Property Timeline">
      {items.map((item, index) => (
        <View
          key={`${item.kind}-${item.date}-${item.title}-${index}`}
          style={{
            flexDirection: "row",
            gap: 10,
            paddingVertical: 10,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderBottomColor: colors.borderLight,
          }}
        >
          <View
            style={{
              marginTop: 2,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: item.kind === "repair" ? colors.warning : colors.primary,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {dash(item.date)}
              {item.detail ? ` · ${item.detail}` : ""}
              {` · ${item.kind === "repair" ? "Repair" : "Maintenance"}`}
            </Text>
          </View>
        </View>
      ))}
    </Section>
  );
}

function RepairsSection({ items }: { items: ShareRepairItem[] }) {
  return (
    <Section title="Recent Repairs">
      {items.map((item, index) => (
        <View
          key={`${item.id ?? item.title}-${item.date}-${index}`}
          style={{
            paddingVertical: 10,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderBottomColor: colors.borderLight,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
            {[item.date, item.category, item.cost ? `$${item.cost}` : null, item.contractor]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function MaintenanceListSection({
  title,
  items,
  mode,
}: {
  title: string;
  items: ShareMaintenanceItem[];
  mode: "history" | "upcoming";
}) {
  return (
    <Section title={title}>
      {items.map((item, index) => (
        <View
          key={`${item.id ?? item.title}-${index}`}
          style={{
            paddingVertical: 10,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderBottomColor: colors.borderLight,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
            {mode === "history"
              ? `Completed ${dash(item.lastCompleted)}`
              : `Due ${dash(item.nextDue)}`}
            {item.status ? ` · ${item.status}` : ""}
            {item.category ? ` · ${item.category}` : ""}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function AppliancesSection({ items }: { items: ShareApplianceItem[] }) {
  return (
    <Section title="Appliance Inventory">
      {items.map((item, index) => (
        <View
          key={`${item.id ?? item.name}-${index}`}
          style={{
            flexDirection: "row",
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderBottomColor: colors.borderLight,
          }}
        >
          {item.photoUri ? (
            <Image
              source={{ uri: item.photoUri }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                backgroundColor: colors.bgSection,
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                backgroundColor: colors.bgSection,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="hardware-chip-outline" size={22} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{item.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
              {[
                item.brand ? `Manufacturer: ${item.brand}` : null,
                item.model ? `Model: ${item.model}` : null,
                item.serial ? `Serial: ${item.serial}` : null,
                item.installYear ? `Install year: ${item.installYear}` : null,
                item.condition ? `Condition: ${item.condition}` : null,
                item.warrantyExpires ? `Warranty: ${item.warrantyExpires}` : null,
              ]
                .filter(Boolean)
                .join("\n")}
            </Text>
          </View>
        </View>
      ))}
    </Section>
  );
}

function GallerySection({ items }: { items: ShareGalleryItem[] }) {
  return (
    <Section title="Property Photo Gallery">
      <View style={{ gap: 14 }}>
        {items.map((item, index) => (
          <View key={`${item.id ?? item.uri}-${index}`}>
            <Image
              source={{ uri: item.uri }}
              style={{
                width: "100%",
                height: 180,
                borderRadius: 12,
                backgroundColor: colors.bgSection,
              }}
              resizeMode="cover"
            />
            <Text style={{ color: colors.textPrimary, fontWeight: "600", marginTop: 8 }}>
              {item.caption || "Photo"}
            </Text>
            {item.date ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {item.date}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </Section>
  );
}

function DocumentsSection({
  documents,
  warranties,
}: {
  documents: ShareDocItem[];
  warranties: ShareWarrantyItem[];
}) {
  return (
    <Section title="Documents and Warranties">
      {documents.length > 0 ? (
        <View style={{ marginBottom: warranties.length ? 14 : 0 }}>
          <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>
            DOCUMENTS
          </Text>
          {documents.map((doc, index) => (
            <View
              key={`${doc.id ?? doc.title}-${index}`}
              style={{
                paddingVertical: 8,
                borderBottomWidth: index === documents.length - 1 ? 0 : 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{doc.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {[
                  doc.category,
                  doc.uploadDate ? `Uploaded ${doc.uploadDate}` : null,
                  doc.expiresDate ? `Expires ${doc.expiresDate}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {warranties.length > 0 ? (
        <View>
          <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>
            WARRANTIES
          </Text>
          {warranties.map((w, index) => (
            <View
              key={`${w.id ?? w.title}-${index}`}
              style={{
                paddingVertical: 8,
                borderBottomWidth: index === warranties.length - 1 ? 0 : 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{w.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {[w.source, w.expiresDate ? `Expires ${w.expiresDate}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  );
}
