import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { requireRole } from "@/lib/auth";

export default async function PatientAssistantPage() {
  await requireRole("patient");
  return <ChatAssistant viewerRole="patient" />;
}
