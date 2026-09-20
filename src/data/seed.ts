import type { Database } from '../types'
import { isoDate } from '../lib/format'

const now = new Date().toISOString()

export const seed:Database = {
  clients: [
    {id:'c1',name:'Amelia Hart',company:'Hart & Rowe Interiors',email:'amelia@hartrowe.example',phone:'07700 900241',preferred_contact:'Email',billing_address:'18 Elder Street, London E1 6BT',notes:'Designer coordinating for private client.',created_at:now,updated_at:now},
    {id:'c2',name:'Marcus Chen',company:'Northline Architecture',email:'marcus@northline.example',phone:'07700 900628',preferred_contact:'Phone',billing_address:'44 Clerkenwell Road, London EC1M 5PQ',notes:'',created_at:now,updated_at:now},
    {id:'c3',name:'Elena Rossi',company:'',email:'elena.rossi@example.com',phone:'07700 900817',preferred_contact:'WhatsApp',billing_address:'7 Tredegar Square, London E3 5AD',notes:'',created_at:now,updated_at:now},
    {id:'c4',name:'Theo Bennett',company:'Fieldwork Studio',email:'theo@fieldwork.example',phone:'07700 900319',preferred_contact:'Email',billing_address:'102 Lower Clapton Road, London E5 0QR',notes:'',created_at:now,updated_at:now}
  ],
  leads: [
    {id:'l1',client_id:'c1',project_title:'Elder Street powder room',project_type:'BESPOKE_PORCELAIN_SINK',description:'Floating porcelain sink for a compact ground-floor powder room.',lead_source:'Designer referral',status:'READY_TO_QUOTE',priority:'HIGH',project_address:'18 Elder Street, London',postcode:'E1 6BT',waiting_for:'ARTAN',waiting_for_detail:'Confirm fabrication price',next_action:'Review fabrication allowance and prepare quote',next_action_owner:'Ioannis',next_action_due:isoDate(0),last_client_contact_at:isoDate(-2),last_artiling_contact_at:isoDate(-2),artans_review_required:true,created_at:isoDate(-12),updated_at:now,won_at:null,lost_at:null,lost_reason:''},
    {id:'l2',client_id:'c2',project_title:'Clerkenwell double vanity',project_type:'VANITY_AND_SINK',description:'Bookmatched double vanity and porcelain cladding.',lead_source:'Website',status:'INFO_NEEDED',priority:'NORMAL',project_address:'61 Britton Street, London',postcode:'EC1M 5UG',waiting_for:'CLIENT',waiting_for_detail:'Final tap specification and wall build-up',next_action:'Chase tap details',next_action_owner:'Ioannis',next_action_due:isoDate(-1),last_client_contact_at:isoDate(-5),last_artiling_contact_at:isoDate(-4),artans_review_required:false,created_at:isoDate(-9),updated_at:now,won_at:null,lost_at:null,lost_reason:''},
    {id:'l3',client_id:'c3',project_title:'Tredegar wet room',project_type:'WET_ROOM',description:'Large-format porcelain wet room with mitred niches.',lead_source:'Instagram',status:'QUOTE_SENT',priority:'NORMAL',project_address:'7 Tredegar Square, London',postcode:'E3 5AD',waiting_for:'CLIENT',waiting_for_detail:'Quote decision',next_action:'Follow up on quotation',next_action_owner:'Ioannis',next_action_due:isoDate(3),last_client_contact_at:isoDate(-1),last_artiling_contact_at:isoDate(-1),artans_review_required:false,created_at:isoDate(-24),updated_at:now,won_at:null,lost_at:null,lost_reason:''},
    {id:'l4',client_id:'c4',project_title:'Clapton feature wall',project_type:'FEATURE_WALL',description:'Vein-matched fireplace feature wall.',lead_source:'Trade partner',status:'NEW',priority:'LOW',project_address:'102 Lower Clapton Road, London',postcode:'E5 0QR',waiting_for:'NOTHING',waiting_for_detail:'',next_action:'Arrange initial design call',next_action_owner:'Ioannis',next_action_due:isoDate(4),last_client_contact_at:null,last_artiling_contact_at:null,artans_review_required:false,created_at:isoDate(-1),updated_at:now,won_at:null,lost_at:null,lost_reason:''},
    {id:'l5',client_id:'c2',project_title:'Islington stair cladding',project_type:'PORCELAIN_STAIRS',description:'Porcelain stair treads and risers.',lead_source:'Repeat client',status:'WON',priority:'HIGH',project_address:'12 Canonbury Park South, London',postcode:'N1 2JP',waiting_for:'SUPPLIER',waiting_for_detail:'Slab allocation',next_action:'Confirm slab batch',next_action_owner:'Artan',next_action_due:isoDate(1),last_client_contact_at:isoDate(-3),last_artiling_contact_at:isoDate(-2),artans_review_required:false,created_at:isoDate(-42),updated_at:now,won_at:isoDate(-16),lost_at:null,lost_reason:''},
    {id:'l6',client_id:'c3',project_title:'Victoria Park shower room',project_type:'LARGE_FORMAT_TILING',description:'Large-format porcelain shower room with fabricated niche returns.',lead_source:'Repeat client',status:'WON',priority:'NORMAL',project_address:'26 Lauriston Road, London',postcode:'E9 7HA',waiting_for:'NOTHING',waiting_for_detail:'',next_action:'Installation site check',next_action_owner:'Ioannis',next_action_due:isoDate(3),last_client_contact_at:isoDate(-3),last_artiling_contact_at:isoDate(-2),artans_review_required:false,created_at:isoDate(-37),updated_at:now,won_at:isoDate(-8),lost_at:null,lost_reason:''}
  ],
  specifications: [
    {id:'s1',lead_id:'l1',quantity:1,width_mm:1000,depth_mm:500,height_mm:150,basin_width_mm:700,basin_depth_mm:320,mounting_type:'WALL_MOUNTED',slope_type:'FRONT_TO_REAR',drain_type:'CONCEALED_REAR_LINEAR',tap_arrangement:'WALL_MOUNTED',tap_holes:0,vanity_required:false,drawer_configuration:'',cladding_required:false,splashback_required:true,overflow_required:false,reinforcement_required:true,material_supply_type:'ARTILING_SUPPLY',finish:'Beige limestone-effect porcelain',special_requirements:'Vein continuation across front apron.',technical_notes:'Confirm wall structure before template.',updated_at:now},
    {id:'s2',lead_id:'l2',quantity:1,width_mm:1600,depth_mm:520,height_mm:180,basin_width_mm:560,basin_depth_mm:340,mounting_type:'VANITY_MOUNTED',slope_type:'CUSTOM',drain_type:'CONCEALED_REAR_LINEAR',tap_arrangement:'DECK_MOUNTED',tap_holes:2,vanity_required:true,drawer_configuration:'Four drawers, oak fronts',cladding_required:true,splashback_required:true,overflow_required:false,reinforcement_required:true,material_supply_type:'CLIENT_SUPPLY',finish:'Calacatta Viola effect',special_requirements:'Bookmatch across basins.',technical_notes:'Awaiting tap cut sheets.',updated_at:now}
  ],
  quotes: [
    {id:'q1',lead_id:'l3',job_id:null,quote_number:'Q-2026-014',version:1,status:'SENT',quote_date:isoDate(-5),valid_until:isoDate(25),subtotal:8460,vat:0,total:8460,artans_review_status:'APPROVED',artans_reviewed_at:isoDate(-6),revision_reason:'',parent_quote_id:null,client_notes:'Includes fabrication, delivery and installation.',internal_notes:'Allow two installation days.',created_at:isoDate(-7),updated_at:isoDate(-5)},
    {id:'q2',lead_id:'l5',job_id:'j1',quote_number:'Q-2026-011',version:2,status:'ACCEPTED',quote_date:isoDate(-18),valid_until:isoDate(12),subtotal:12480,vat:0,total:12480,artans_review_status:'APPROVED',artans_reviewed_at:isoDate(-19),revision_reason:'Added landing return.',parent_quote_id:null,client_notes:'',internal_notes:'',created_at:isoDate(-20),updated_at:isoDate(-16)},
    {id:'q3',lead_id:'l6',job_id:'j2',quote_number:'Q-2026-012',version:1,status:'ACCEPTED',quote_date:isoDate(-10),valid_until:isoDate(20),subtotal:8460,vat:0,total:8460,artans_review_status:'NOT_REQUIRED',artans_reviewed_at:null,revision_reason:'',parent_quote_id:null,client_notes:'',internal_notes:'',created_at:isoDate(-12),updated_at:isoDate(-8)}
  ],
  quoteItems: [
    {id:'qi1',quote_id:'q1',category:'PORCELAIN_MATERIAL',description:'Porcelain slab material — Calacatta Viola',quantity:3,unit_price:980,total:2940,is_optional:false,is_included:true,client_note:'',internal_note:'',sort_order:0},
    {id:'qi2',quote_id:'q1',category:'FABRICATION',description:'Wet room fabrication package',quantity:1,unit_price:3620,total:3620,is_optional:false,is_included:true,client_note:'',internal_note:'',sort_order:1},
    {id:'qi3',quote_id:'q1',category:'INSTALLATION',description:'Specialist installation',quantity:1,unit_price:1900,total:1900,is_optional:false,is_included:true,client_note:'',internal_note:'',sort_order:2},
    {id:'qi4',quote_id:'q2',category:'FABRICATION',description:'Stair tread and riser fabrication',quantity:1,unit_price:7680,total:7680,is_optional:false,is_included:true,client_note:'',internal_note:'',sort_order:0},
    {id:'qi5',quote_id:'q2',category:'INSTALLATION',description:'Template, delivery and installation',quantity:1,unit_price:4800,total:4800,is_optional:false,is_included:true,client_note:'',internal_note:'',sort_order:1},
    {id:'qi6',quote_id:'q3',category:'FABRICATION',description:'Shower room fabrication and installation',quantity:1,unit_price:8460,total:8460,is_optional:false,is_included:true,client_note:'',internal_note:'',sort_order:0}
  ],
  jobs: [
    {id:'j1',lead_id:'l5',client_id:'c2',project_title:'Islington stair cladding',project_type:'PORCELAIN_STAIRS',status:'IN_FABRICATION',health:'AMBER',health_reason:'Slab batch confirmation due',project_address:'12 Canonbury Park South, London',postcode:'N1 2JP',accepted_quote_id:'q2',project_value:12480,start_date:isoDate(-14),target_completion_date:isoDate(18),actual_completion_date:null,waiting_for:'SUPPLIER',next_action:'Confirm slab allocation',next_action_owner:'Artan',created_at:isoDate(-16),updated_at:now,completed_at:null},
    {id:'j2',lead_id:'l6',client_id:'c3',project_title:'Victoria Park shower room',project_type:'LARGE_FORMAT_TILING',status:'INSTALLATION_BOOKED',health:'GREEN',health_reason:'',project_address:'26 Lauriston Road, London',postcode:'E9 7HA',accepted_quote_id:'q3',project_value:8460,start_date:isoDate(-2),target_completion_date:isoDate(8),actual_completion_date:null,waiting_for:'NOTHING',next_action:'Installation site check',next_action_owner:'Ioannis',created_at:isoDate(-3),updated_at:now,completed_at:null}
  ],
  tasks: [
    {id:'t1',lead_id:'l2',quote_id:null,job_id:null,title:'Chase tap specification',description:'Need model and projection before final basin drawing.',owner:'Ioannis',priority:'HIGH',status:'TODO',due_at:isoDate(-1),completed_at:null,created_at:isoDate(-4),updated_at:now},
    {id:'t2',lead_id:null,quote_id:null,job_id:'j1',title:'Confirm slab batch',description:'Check shade and available quantity with supplier.',owner:'Artan',priority:'HIGH',status:'IN_PROGRESS',due_at:isoDate(1),completed_at:null,created_at:isoDate(-2),updated_at:now},
    {id:'t3',lead_id:'l1',quote_id:null,job_id:null,title:'Prepare fabrication allowance',description:'Review technical details for quote.',owner:'Ioannis',priority:'NORMAL',status:'TODO',due_at:isoDate(0),completed_at:null,created_at:isoDate(-2),updated_at:now}
  ],
  events: [
    {id:'e1',lead_id:null,job_id:'j2',event_type:'INSTALLATION',title:'Victoria Park shower room installation',start_at:`${isoDate(5)}T08:00:00`,end_at:`${isoDate(6)}T17:00:00`,location:'26 Lauriston Road, London E9 7HA',assigned_to:'Installation team',status:'BOOKED',notes:'Parking arranged.',created_at:now,updated_at:now},
    {id:'e2',lead_id:'l1',job_id:null,event_type:'SITE_VISIT',title:'Elder Street site measure',start_at:`${isoDate(2)}T10:30:00`,end_at:`${isoDate(2)}T11:30:00`,location:'18 Elder Street, London E1 6BT',assigned_to:'Ioannis',status:'PROPOSED',notes:'Confirm wall build-up.',created_at:now,updated_at:now}
  ],
  payments: [
    {id:'p1',job_id:'j1',payment_type:'DEPOSIT',amount:3744,due_date:isoDate(-15),paid_date:isoDate(-14),status:'PAID',reference:'BANK-2408',invoice_document_id:null,notes:'30% deposit',created_at:now,updated_at:now},
    {id:'p2',job_id:'j1',payment_type:'FINAL_PAYMENT',amount:8736,due_date:isoDate(16),paid_date:null,status:'UPCOMING',reference:'',invoice_document_id:null,notes:'Due before installation',created_at:now,updated_at:now},
    {id:'p3',job_id:'j2',payment_type:'DEPOSIT',amount:2538,due_date:isoDate(-2),paid_date:null,status:'OVERDUE',reference:'',invoice_document_id:null,notes:'30% deposit',created_at:now,updated_at:now}
  ],
  materials: [
    {id:'m1',name:'Calacatta Viola',manufacturer:'Atlas Concorde',supplier:'MK Tiles',style_category:'Marble effect',finish:'Polished',colour:'White / burgundy',slab_width_mm:1600,slab_height_mm:3200,product_url:'',supplier_reference:'AC-CV-12',cost:860,availability_status:'LOW_STOCK',availability_checked_at:isoDate(-2),sample_available:true,notes:'Confirm shade before allocation.',created_at:now,updated_at:now},
    {id:'m2',name:'Jura Beige',manufacturer:'Laminam',supplier:'Stone & Surface',style_category:'Limestone effect',finish:'Matt',colour:'Warm beige',slab_width_mm:1620,slab_height_mm:3240,product_url:'',supplier_reference:'LM-JB-01',cost:720,availability_status:'AVAILABLE',availability_checked_at:isoDate(-4),sample_available:true,notes:'',created_at:now,updated_at:now}
  ],
  documents: [
    {id:'d1',client_id:null,lead_id:'l1',quote_id:null,job_id:null,material_id:null,payment_id:null,category:'CLIENT_REFERENCE',title:'Powder room concept pack',file_url:'',file_name:'elder-street-concept.pdf',mime_type:'application/pdf',notes:'Metadata only — storage adapter not configured.',uploaded_at:isoDate(-10),uploaded_by:'Ioannis'}
  ],
  notes: [
    {id:'n1',lead_id:'l1',job_id:null,category:'TECHNICAL',content:'Wall construction appears to be metal stud; reinforcement must be confirmed before fabrication.',is_pinned:true,created_by:'Ioannis',created_at:isoDate(-3),updated_at:isoDate(-3)}
  ],
  activities: [
    {id:'a1',client_id:'c1',lead_id:'l1',quote_id:null,job_id:null,action:'LEAD_CREATED',description:'Lead created',old_value_json:null,new_value_json:{status:'NEW'},created_by:'Ioannis',created_at:isoDate(-12)},
    {id:'a2',client_id:'c2',lead_id:'l5',quote_id:'q2',job_id:'j1',action:'LEAD_CONVERTED',description:'Lead converted to job',old_value_json:null,new_value_json:{job_id:'j1'},created_by:'Ioannis',created_at:isoDate(-16)}
  ],
  settings:{company_name:'Artiling Studio',email:'info@artilingstudio.co.uk',phone:'020 8050 4727',address:'London, United Kingdom',quote_valid_days:30,default_payment_terms:'30% deposit, balance before installation'}
}
