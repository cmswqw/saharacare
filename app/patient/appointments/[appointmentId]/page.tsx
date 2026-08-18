import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { MedicalSharePanel } from "@/components/appointments/MedicalSharePanel";
import { Button } from "@/components/ui/Button";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { getAppointment } from "@/lib/data/appointments";

export default async function PatientAppointmentPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const result = await getAppointment(appointmentId);
  if (!result.data) notFound();
  return <div className="space-y-6"><Button asChild variant="ghost"><Link href="/patient/appointments"><ArrowLeft /><TranslatedText translationKey="backToAppointments" /></Link></Button><AppointmentCard appointment={result.data} /><MedicalSharePanel appointment={result.data} share={result.share} /></div>;
}
