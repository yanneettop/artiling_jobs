import { ArrowUpRight, CalendarBlank, Warning } from '@phosphor-icons/react'
import { ACTIVE_JOB_STATUSES, ACTIVE_LEAD_STATUSES, label } from '../lib/constants'
import { useStore } from '../data/store'
import { date, money, relativeDue } from '../lib/format'
import { EmptyState, HealthBadge, MetricCard, PageHeader, Panel, StatusBadge } from '../components/ui'

export function Dashboard(){
 const {db}=useStore(); const today=new Date().toISOString().slice(0,10)
 const todayLabel=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())
 const client=(id:string)=>db.clients.find(c=>c.id===id)
 const attention=db.leads.filter(l=>ACTIVE_LEAD_STATUSES.includes(l.status)&&(l.priority==='HIGH'||(l.next_action_due&&l.next_action_due<=today))).slice(0,5)
 const activeJobs=db.jobs.filter(j=>ACTIVE_JOB_STATUSES.includes(j.status)).slice(0,4)
 const upcoming=db.events.filter(e=>e.start_at.slice(0,10)>=today).sort((a,b)=>a.start_at.localeCompare(b.start_at)).slice(0,5)
 const outstanding=db.payments.filter(p=>!['PAID','CANCELLED'].includes(p.status)).reduce((sum,p)=>sum+p.amount,0)
 const metrics=[
  ['New Leads',db.leads.filter(l=>l.status==='NEW').length,'Awaiting first response','/leads?filter=NEW','neutral'],
  ['Needs Attention',attention.length,'Overdue or high priority','/leads?filter=attention','alert'],
  ['Ready to Quote',db.leads.filter(l=>l.status==='READY_TO_QUOTE').length,'Pricing complete','/leads?filter=READY_TO_QUOTE','warm'],
  ['Quotes Sent',db.quotes.filter(q=>q.status==='SENT').length,'Awaiting decisions','/quotes?filter=SENT','neutral'],
  ['Active Jobs',activeJobs.length,'Across production','/jobs?filter=active','neutral'],
  ['In Fabrication',db.jobs.filter(j=>j.status==='IN_FABRICATION').length,'On workshop floor','/jobs?filter=IN_FABRICATION','dark'],
  ['Upcoming Visits',upcoming.filter(e=>['SITE_VISIT','TEMPLATE_VISIT','INSTALLATION'].includes(e.event_type)).length,'Next 30 days','/calendar','neutral'],
  ['Outstanding',money(outstanding,true),'Confirmed not paid','/payments?filter=open','money']
 ]
 const pipeline=['NEW','INFO_NEEDED','READY_TO_PRICE','QUOTE_SENT','WAITING_FOR_CLIENT','APPROVED']
 return <>
  <PageHeader eyebrow={todayLabel} title="Good morning, Ioannis" description="A clear view of what needs action across the studio." />
  <section className="metrics-grid">{metrics.map(([l,v,d,to,t])=><MetricCard key={l} label={String(l)} value={v} detail={String(d)} to={String(to)} tone={String(t)}/>)}</section>
  <div className="dashboard-grid">
   <Panel title="Needs attention" subtitle="Work that is overdue or holding progress" action={<a href="#/leads?filter=attention" className="text-link">View all <ArrowUpRight/></a>}>
    {attention.length?<div className="attention-list">{attention.map(l=><a href={`#/leads/${l.id}`} className="attention-item" key={l.id}><div className="attention-icon"><Warning size={18}/></div><div className="attention-main"><strong>{client(l.client_id)?.name}</strong><span>{l.project_title}</span></div><div className="attention-reason"><small>Reason</small><span>{l.waiting_for_detail||label(l.status)}</span></div><div className="attention-action"><small>Next action</small><span>{l.next_action}</span></div><div className={`due ${l.next_action_due&&l.next_action_due<today?'overdue':''}`}>{relativeDue(l.next_action_due)}</div></a>)}</div>:<EmptyState title="Nothing needs attention" description="There are no overdue or high-priority leads."/>}
   </Panel>
   <Panel title="Pipeline" subtitle="Live leads by commercial stage">
    <div className="pipeline">{pipeline.map((status,i)=>{const count=db.leads.filter(l=>l.status===status).length;return <a href={`#/leads?filter=${status}`} key={status}><span className="pipeline-order">0{i+1}</span><div><strong>{label(status)}</strong><small>{count} {count===1?'lead':'leads'}</small></div><b>{count}</b></a>})}</div>
   </Panel>
   <Panel title="Active jobs" subtitle="Confirmed work moving through the studio" className="wide-panel" action={<a href="#/jobs" className="text-link">All jobs <ArrowUpRight/></a>}>
    {activeJobs.length?<div className="table-wrap"><table><thead><tr><th>Client / project</th><th>Status</th><th>Health</th><th>Target</th><th>Next action</th></tr></thead><tbody>{activeJobs.map(j=><tr key={j.id} onClick={()=>location.hash=`/jobs/${j.id}`}><td><strong>{client(j.client_id)?.name}</strong><span>{j.project_title}</span></td><td><StatusBadge value={j.status}/></td><td><HealthBadge value={j.health}/></td><td>{date(j.target_completion_date)}</td><td>{j.next_action||'—'}</td></tr>)}</tbody></table></div>:<EmptyState title="No active jobs" description="Converted leads will appear here."/>}
   </Panel>
   <Panel title="Upcoming" subtitle="Visits, deliveries and deadlines">
    {upcoming.length?<div className="upcoming-list">{upcoming.map(e=><div key={e.id}><div className="calendar-tile"><b>{date(e.start_at,{day:'2-digit'})}</b><span>{date(e.start_at,{month:'short'})}</span></div><div><strong>{e.title}</strong><span>{label(e.event_type)} · {e.location}</span></div></div>)}</div>:<EmptyState title="No upcoming events" description="New calendar events will appear here."/>}
   </Panel>
  </div>
 </>
}
