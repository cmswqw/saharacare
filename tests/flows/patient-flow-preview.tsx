import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider} from '@/components/providers/AppProvider';
import {PatientAppointmentsView} from '@/components/appointments/PatientAppointmentsView';
import {AppointmentCard} from '@/components/appointments/AppointmentCard';
const params=new URLSearchParams(location.search);
if(params.has('lang'))localStorage.setItem('saharacare-language',params.get('lang')==='ne'?'ne':'en');
void fetch('/fixture-state').then(response=>response.json()).then(data=>{
  const id=location.pathname.split('/').at(-1);
  const detail=data.appointments.find((appointment:{id:string})=>appointment.id===id);
  createRoot(document.getElementById('root')!).render(<AppProvider><main className="mx-auto min-w-0 max-w-4xl p-3 pb-28 sm:p-6">
    {detail?<AppointmentCard appointment={detail}/>:<PatientAppointmentsView appointments={data.appointments} doctors={data.doctors}/>}
  </main></AppProvider>);
});
