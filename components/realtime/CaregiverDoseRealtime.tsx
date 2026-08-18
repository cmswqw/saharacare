"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { formatDoseTimestamp, getTodayBounds } from "@/lib/dose-config";
import { createClient } from "@/lib/supabase/client";

type RealtimePatient = {
  patientId: string;
  fullName: string;
  doses: Array<{
    id: string;
    medicationName: string;
  }>;
};

type DoseChangePayload = {
  eventType: "INSERT" | "UPDATE";
  commit_timestamp: string;
  new: Record<string, unknown>;
};

type DoseChangeRow = {
  id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  takenAt: string | null;
};

const MAX_PATIENTS_PER_FILTER = 100;
const EVENT_MEMORY_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 75;

function parseDoseChange(value: Record<string, unknown>): DoseChangeRow | null {
  if (
    typeof value.id !== "string"
    || typeof value.patient_id !== "string"
    || typeof value.scheduled_at !== "string"
    || typeof value.status !== "string"
    || (value.taken_at !== null && typeof value.taken_at !== "string")
  ) {
    return null;
  }

  return {
    id: value.id,
    patientId: value.patient_id,
    scheduledAt: value.scheduled_at,
    status: value.status,
    takenAt: value.taken_at,
  };
}

function chunkPatientIds(patientIds: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < patientIds.length; index += MAX_PATIENTS_PER_FILTER) {
    chunks.push(patientIds.slice(index, index + MAX_PATIENTS_PER_FILTER));
  }
  return chunks;
}

export function CaregiverDoseRealtime({ patients }: { patients: RealtimePatient[] }) {
  const router = useRouter();
  const { language, t, toast } = useApp();
  const patientsRef = useRef(patients);
  const seenEventsRef = useRef(new Map<string, number>());
  const refreshTimerRef = useRef<number | null>(null);
  const patientIds = [...new Set(patients.map((patient) => patient.patientId))].sort();
  const subscriptionKey = patientIds.join(",");

  patientsRef.current = patients;

  useEffect(() => {
    if (!subscriptionKey) return;

    const supabase = createClient();
    const authorizedPatientIds = new Set(subscriptionKey.split(","));
    let isActive = true;
    const channels = chunkPatientIds([...authorizedPatientIds]).map((chunk, index) => {
      const filter = chunk.length === 1
        ? `patient_id=eq.${chunk[0]}`
        : `patient_id=in.(${chunk.join(",")})`;
      let connectionWarningShown = false;

      const handleChange = (payload: DoseChangePayload) => {
        const row = parseDoseChange(payload.new);
        if (!row || !authorizedPatientIds.has(row.patientId)) return;

        const { start, end } = getTodayBounds();
        const scheduledTime = new Date(row.scheduledAt).getTime();
        if (
          !Number.isFinite(scheduledTime)
          || scheduledTime < new Date(start).getTime()
          || scheduledTime >= new Date(end).getTime()
        ) {
          return;
        }

        const now = Date.now();
        const eventKey = `${payload.eventType}:${payload.commit_timestamp}:${row.id}`;
        if (seenEventsRef.current.has(eventKey)) return;

        seenEventsRef.current.set(eventKey, now);
        for (const [key, seenAt] of seenEventsRef.current) {
          if (now - seenAt > EVENT_MEMORY_MS) seenEventsRef.current.delete(key);
        }

        if (row.status === "taken" && row.takenAt) {
          const patient = patientsRef.current.find((item) => item.patientId === row.patientId);
          const dose = patient?.doses.find((item) => item.id === row.id);
          const patientName = patient?.fullName.trim().split(/\s+/)[0] || t("yourPatient");
          const medicationName = dose?.medicationName ?? t("scheduledMedicine");
          toast(
            t("patientTookMedicine", {
              patient: patientName,
              medicine: medicationName,
              time: formatDoseTimestamp(row.takenAt, language),
            }),
            "success",
          );
        }

        if (refreshTimerRef.current !== null) {
          window.clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = window.setTimeout(() => {
          startTransition(() => router.refresh());
          refreshTimerRef.current = null;
        }, REFRESH_DEBOUNCE_MS);
      };

      return supabase
        .channel(`caregiver-dose-records-${index}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "dose_records", filter },
          handleChange,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "dose_records", filter },
          handleChange,
        )
        .subscribe((status) => {
          if (!isActive) return;
          if (status === "SUBSCRIBED") {
            connectionWarningShown = false;
          } else if (
            (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
            && !connectionWarningShown
          ) {
            connectionWarningShown = true;
            toast(t("liveDoseUnavailable"), "warning");
          }
        });
    });

    return () => {
      isActive = false;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [language, router, subscriptionKey, t, toast]);

  return null;
}
