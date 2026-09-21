import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarBlank, Clock, PencilSimple, Warning } from '@phosphor-icons/react'
import { useStore } from '../data/store'
import { ACTIVE_LEAD_STATUSES, label } from '../lib/constants'
import { isoDate, relativeDue } from '../lib/format'
import type { Lead } from '../types'
import { Button, EmptyState, Field, FormActions, Modal, PageHeader, PriorityBadge, Select, StatusBadge, Toolbar } from '../components/ui'
import '../followups.css'

type FollowUpGroup = 'OVERDUE'|'TODAY'|'NEXT_7_DAYS'|'UNSCHEDULED'|'LATER'

function groupFor(lead:Lead,today:string,nextWeek:string):FollowUpGroup{
  if(!lead.next_action_due)return 'UNSCHEDULED'
  if(lead.next_action_due<today)return 'OVERDUE'
  if(lead.next_action_due===today)return 'TODAY'
  if(lead.next_action_due<=nextWeek)return 'NEXT_7_DAYS'
  return 'LATER'
}

function daysSince(value:string|null){
  if(!value)return null
  return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000))
}

const GROUP_LABELS:Record<FollowUpGroup,string>={OVERDUE:'Overdue',TODAY:'Today',NEXT_7_DAYS:'Next 7 days',UNSCHEDULED:'No date',LATER:'Later'}

export function FollowUps(){
 const {db,update,log}=useStore();const [search,setSearch]=useState('');const [filter,setFilter]=useState('ACTIONABLE');const [editing,setEditing]=useState<Lead|null>(null)
 const today=isoDate();const nextWeek=isoDate(7)
 const active=db.leads.filter(lead=>!lead.archived_at&&ACTIVE_LEAD_STATUSES.includes(lead.status))
 const rows=useMemo(()=>active.map(lead=>({lead,client:db.clients.find(client=>client.id===lead.client_id),group:groupFor(lead,today,nextWeek)})).filter(row=>{
   const text=`${row.client?.name||''} ${row.client?.company||''} ${row.lead.project_title} ${row.lead.next_action} ${row.lead.waiting_for_detail}`.toLowerCase()
   const matchesFilter=filter==='ALL'||filter==='ACTIONABLE'&&['OVERDUE','TODAY'].includes(row.group)||filter==='WAITING_CLIENT'&&row.lead.waiting_for==='CLIENT'||filter===row.group
   return matchesFilter&&text.includes(search.toLowerCase())
 }).sort((a,b)=>(a.lead.next_action_due||'9999').localeCompare(b.lead.next_action_due||'9999')),[active,db.clients,filter,search,today,nextWeek])
 const counts={overdue:active.filter(lead=>groupFor(lead,today,nextWeek)==='OVERDUE').length,today:active.filter(lead=>groupFor(lead,today,nextWeek)==='TODAY').length,week:active.filter(lead=>groupFor(lead,today,nextWeek)==='NEXT_7_DAYS').length,waiting:active.filter(lead=>lead.waiting_for==='CLIENT').length}
 const save=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(!editing)return
  const data=new FormData(event.currentTarget);const changes={next_action:String(data.get('next_action')),next_action_owner:String(data.get('next_action_owner')),next_action_due:String(data.get('next_action_due'))||null}
  update('leads',editing.id,changes)
  log({client_id:editing.client_id,lead_id:editing.id,quote_id:null,job_id:null,action:'FOLLOW_UP_SCHEDULED',description:`Follow-up scheduled: ${changes.next_action}`,old_value_json:{next_action:editing.next_action,next_action_owner:editing.next_action_owner,next_action_due:editing.next_action_due},new_value_json:changes})
  setEditing(null)
 }
 const groups=(['OVERDUE','TODAY','NEXT_7_DAYS','UNSCHEDULED','LATER'] as FollowUpGroup[]).map(group=>({group,items:rows.filter(row=>row.group===group)})).filter(section=>section.items.length)
 return <>
  <PageHeader eyebrow="Client follow-up" title="Follow-up Center" description="One place to see who needs a response, what is blocking progress and what happens next." actions={<Button icon={<CalendarBlank/>} onClick={()=>setFilter('ACTIONABLE')}>Show today</Button>}/>
  <section className="followup-metrics">
   <button className={filter==='OVERDUE'?'active':''} onClick={()=>setFilter('OVERDUE')}><span>Overdue</span><strong>{counts.overdue}</strong><small>Needs action now</small></button>
   <button className={filter==='TODAY'?'active':''} onClick={()=>setFilter('TODAY')}><span>Due today</span><strong>{counts.today}</strong><small>Planned for today</small></button>
   <button className={filter==='NEXT_7_DAYS'?'active':''} onClick={()=>setFilter('NEXT_7_DAYS')}><span>Next 7 days</span><strong>{counts.week}</strong><small>Coming up</small></button>
   <button className={filter==='WAITING_CLIENT'?'active':''} onClick={()=>setFilter('WAITING_CLIENT')}><span>Waiting on client</span><strong>{counts.waiting}</strong><small>Across all dates</small></button>
  </section>
  <Toolbar search={search} onSearch={setSearch}><Select value={filter} onChange={setFilter} label="Follow-up view"><option value="ACTIONABLE">Action now</option><option value="WAITING_CLIENT">Waiting on client</option><option value="OVERDUE">Overdue</option><option value="TODAY">Today</option><option value="NEXT_7_DAYS">Next 7 days</option><option value="UNSCHEDULED">No date</option><option value="LATER">Later</option><option value="ALL">All follow-ups</option></Select><span className="result-count">{rows.length} leads</span></Toolbar>
  {groups.length?<div className="followup-board">{groups.map(section=><section key={section.group} className={`followup-section ${section.group.toLowerCase()}`}><header><div><span>{section.group==='OVERDUE'?<Warning/>:<Clock/>}</span><h2>{GROUP_LABELS[section.group]}</h2></div><b>{section.items.length}</b></header><div>{section.items.map(({lead,client})=>{const waitingDays=daysSince(lead.last_artiling_contact_at);return <article className="followup-card" key={lead.id}><div className="followup-card-main"><div className="followup-client"><span>{client?.name?.split(' ').map(part=>part[0]).join('').slice(0,2)||'—'}</span><div><strong>{client?.name||'Unknown client'}</strong><small>{lead.project_title}</small></div></div><div className="followup-badges"><StatusBadge value={lead.status}/><PriorityBadge value={lead.priority}/></div><p>{lead.next_action||'No next action set'}</p><dl><div><dt>Waiting for</dt><dd>{label(lead.waiting_for)}{lead.waiting_for_detail?` — ${lead.waiting_for_detail}`:''}</dd></div><div><dt>Owner</dt><dd>{lead.next_action_owner||'Unassigned'}</dd></div><div><dt>Timing</dt><dd className={lead.next_action_due&&lead.next_action_due<today?'is-overdue':''}>{lead.next_action_due?relativeDue(lead.next_action_due):'Not scheduled'}</dd></div>{lead.waiting_for==='CLIENT'&&<div><dt>Since our last contact</dt><dd>{waitingDays===null?'Unknown':`${waitingDays} days`}</dd></div>}</dl></div><footer><Button variant="quiet" icon={<PencilSimple/>} onClick={()=>setEditing(lead)}>Plan follow-up</Button><a className="button secondary" href={`#/leads/${lead.id}`}>Open lead <ArrowRight/></a></footer></article>})}</div></section>)}</div>:<EmptyState title="Nothing in this view" description="No active leads match the selected follow-up filter."/>}
  {editing&&<Modal title="Plan follow-up" description={`${db.clients.find(client=>client.id===editing.client_id)?.name||'Client'} · ${editing.project_title}`} onClose={()=>setEditing(null)}><form className="form-grid" onSubmit={save}><Field label="Next action" className="span-2"><textarea name="next_action" required defaultValue={editing.next_action}/></Field><Field label="Owner"><input name="next_action_owner" required defaultValue={editing.next_action_owner||'Ioannis'}/></Field><Field label="Due date"><input name="next_action_due" type="date" required defaultValue={editing.next_action_due||isoDate(3)}/></Field><div className="span-2"><FormActions onCancel={()=>setEditing(null)} submit="Save follow-up"/></div></form></Modal>}
 </>
}
