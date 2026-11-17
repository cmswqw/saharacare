import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const source=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
test("appointments hosts shared helper; assistant links to verified-subject experience",()=>{
  assert.match(source('components/appointments/PatientAppointmentsView.tsx'),/id="booking-helper"[\s\S]*<BookingGuidance/);
  assert.match(source('components/appointments/CaregiverAppointmentsSection.tsx'),/patientId=\{patient.id\}/);
  const assistant=source('components/chat/ChatAssistant.tsx');
  assert.match(assistant,/\/patient\/appointments#booking-helper/);
  assert.match(assistant,/\/caregiver\/patient\/\$\{selectedPatientId\}#booking-helper/);
  assert.doesNotMatch(assistant,/<BookingGuidance/);
});
test("mobile helper uses server urgency, accessible progress/retry and existing booking form",()=>{
  const helper=source('components/chat/BookingGuidance.tsx');
  assert.doesNotMatch(helper,/getBookingUrgencyFloor|booking-safety/);
  assert.match(helper,/role="status"/); assert.match(helper,/role="alert"/);
  assert.match(helper,/bookingRetry/); assert.match(helper,/<AppointmentRequestForm/);
  assert.match(helper,/sponsorship_label_ne/);
});
