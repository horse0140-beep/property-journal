import { useEffect, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import PropertyDetailContent from "@/components/property/PropertyDetailContent";
import {
  resolveMaintenanceView,
  resolvePropertySection,
} from "@/components/property/propertyDetailConstants";
import { useHomeWise } from "@/context/HomeWiseContext";

function normalizeRouteParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function PropertyViewScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; section?: string | string[]; tab?: string | string[] }>();
  const id = normalizeRouteParam(params.id);
  const section = normalizeRouteParam(params.section);
  const tab = normalizeRouteParam(params.tab);
  const { selectProperty } = useHomeWise();
  const selectPropertyRef = useRef(selectProperty);
  selectPropertyRef.current = selectProperty;
  const syncedPropertyIdRef = useRef<string | null>(null);

  const initialSection = resolvePropertySection(section);
  const initialMaintenanceView =
    section === "appliances" ? "appliances" : resolveMaintenanceView(tab);

  useEffect(() => {
    if (!id || syncedPropertyIdRef.current === id) return;
    syncedPropertyIdRef.current = id;
    selectPropertyRef.current(id);
  }, [id]);

  if (!id) return null;
  return (
    <PropertyDetailContent
      propertyId={id}
      initialSection={initialSection}
      initialMaintenanceView={initialMaintenanceView}
    />
  );
}
