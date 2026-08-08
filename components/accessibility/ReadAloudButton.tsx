"use client";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export function ReadAloudButton() { const { t, language, toast } = useApp(); function read() { if (!("speechSynthesis" in window)) { toast("Text-to-speech is not available in this browser.", "warning"); return; } window.speechSynthesis.cancel(); const text = document.querySelector("main")?.textContent?.slice(0, 650) ?? "SaharaCare"; const utterance = new SpeechSynthesisUtterance(text); utterance.lang = language === "ne" ? "ne-NP" : "en-US"; window.speechSynthesis.speak(utterance); toast(language === "ne" ? "पृष्ठ पढ्दैछ।" : "Reading this page aloud.", "success"); } return <Button variant="secondary" size="large" className="w-full" onClick={read}><Volume2 />{t("readAloud")}</Button>; }
