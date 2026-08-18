import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { getCaregiverChatSubjects } from "@/lib/chat/context";

export default async function CaregiverAssistantPage() {
  const patients = await getCaregiverChatSubjects();
  return <ChatAssistant viewerRole="caregiver" caregiverPatients={patients} />;
}
