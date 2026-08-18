import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { DoctorMedicalFiles } from "@/components/medical-files/DoctorMedicalFiles";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocalizedDateTime } from "@/components/ui/LocalizedDateTime";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { getAppointment } from "@/lib/data/appointments";

export default async function DoctorAppointmentPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const result = await getAppointment(appointmentId);
  if (!result.data) notFound();
  return <div className="space-y-6"><Button asChild variant="ghost"><Link href="/doctor"><ArrowLeft /><TranslatedText translationKey="backToAppointments" /></Link></Button><AppointmentCard appointment={result.data} viewer="doctor" />{result.share && result.share.files.length > 0 ? <><Card className="flex items-center gap-3 p-4 font-bold text-muted"><Clock3 className="text-primary" /><TranslatedText translationKey="accessExpires" values={{ date: "" }} /><LocalizedDateTime value={result.share.expires_at} includeTime /></Card><DoctorMedicalFiles share={result.share} /></> : <Card className="border-dashed p-10 text-center"><h2 className="text-2xl font-extrabold"><TranslatedText translationKey="noActiveMedicalFiles" /></h2><p className="mt-2 text-muted"><TranslatedText translationKey="noActiveMedicalFilesHelp" /></p></Card>}</div>;
}
