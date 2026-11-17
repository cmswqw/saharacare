// Test transport ONLY: fixed synthetic Auth, real PostgreSQL roles/RPCs/data.
// Not a replacement Supabase client, JWT verifier or PostgREST compatibility test.
export function localSupabaseAdapter(db,patientId,metrics) {
  const json=value=>JSON.parse(JSON.stringify(value));
  const definitions={
    get_directory_specialties:{},
    get_directory_matches:{requested_specialty_ids:'text[]',requested_provider_type:'text',requested_provider_id:'uuid'},
    get_directory_booking_slots:{provider_id:'uuid',affiliation_id:'uuid',specialty_id:'text',appointment_date:'date',requested_patient_id:'uuid'},
    get_available_appointment_slots:{target_doctor_id:'uuid',appointment_date:'date'},
    book_appointment:{appointment_patient_id:'uuid',appointment_doctor_id:'uuid',appointment_starts_at:'timestamptz',appointment_facility:'text',appointment_purpose:'text',appointment_note:'text',booking_review:'jsonb'},
    reschedule_appointment:{target_appointment_id:'uuid',replacement_starts_at:'timestamptz'},
    cancel_appointment:{target_appointment_id:'uuid'},
  };
  const rowsRPC=new Set(['get_directory_specialties','get_directory_matches','get_available_appointment_slots']);
  return {
    auth:{getUser:async()=>({data:{user:{id:patientId}},error:null})},
    async rpc(name,args={}) {
      if(!Object.hasOwn(definitions,name))throw Error('Unsupported fixture RPC');
      metrics.rpcs.push(name);
      if(name==='get_directory_matches'&&metrics.failDirectoryOnce){metrics.failDirectoryOnce=false;return {data:null,error:{code:'08006',message:'Simulated local transport outage'}};}
      if(name==='get_directory_booking_slots'&&metrics.failSlotsOnce){metrics.failSlotsOnce=false;return {data:null,error:{code:'08006',message:'Simulated local transport outage'}};}
      const fields=Object.keys(args);if(fields.some(key=>!Object.hasOwn(definitions[name],key)))throw Error('Unsupported fixture RPC argument');
      const values=fields.map(key=>definitions[name][key]==='jsonb'?JSON.stringify(args[key]):args[key]);
      const params=fields.map((key,index)=>`"${key}" => $${index+1}::${definitions[name][key]}`).join(',');
      try {
        const query=rowsRPC.has(name)?`select * from public."${name}"(${params})`:`select public."${name}"(${params}) as value`;
        const result=await db.query(query,values);
        const data=rowsRPC.has(name)?result.rows.map(row=>({...row,...(row.fee_amount!=null?{fee_amount:Number(row.fee_amount)}:{})})):result.rows[0].value;
        return {data:json(data),error:null};
      }catch(error){return {data:null,error:{code:error.code,message:error.message}};}
    },
    from(table) {
      if(!['profiles','appointments'].includes(table))throw Error(`Unexpected fixture table ${table}`);
      const filters=[];let single=false;let ordering='';
      const query={
        select:()=>query,
        eq:(key,value)=>{if(!['id','role','account_status','patient_id','doctor_id'].includes(key))throw Error('Unsupported filter');filters.push([key,value]);return query;},
        order:(key)=>{if(!['starts_at','full_name'].includes(key))throw Error('Unsupported order');ordering=key;return query;},
        maybeSingle:()=>{single=true;return execute();},
        then:(resolve,reject)=>execute().then(resolve,reject),
      };
      async function execute(){
        const where=filters.length?' where '+filters.map(([key],i)=>`a."${key}"=$${i+1}`).join(' and '):'';
        const sql=table==='appointments'
          ? `select a.*,jsonb_build_object('full_name',d.full_name) as doctor,jsonb_build_object('full_name',p.full_name) as patient,jsonb_build_object('full_name',c.full_name) as creator from public.appointments a left join public.profiles d on d.id=a.doctor_id left join public.profiles p on p.id=a.patient_id left join public.profiles c on c.id=a.created_by`
          : 'select a.* from public.profiles a';
        try {const result=await db.query(sql+where+(ordering?` order by a."${ordering}"`:''),filters.map(([,value])=>value));
          const data=json(result.rows.map(row=>({...row,...(row.booked_fee_amount!=null?{booked_fee_amount:Number(row.booked_fee_amount)}:{})})));
          return {data:single?data[0]??null:data,error:null};
        }catch(error){return {data:null,error:{code:error.code,message:error.message}};}
      }
      return query;
    },
  };
}
