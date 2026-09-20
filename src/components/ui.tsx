import type { ReactNode } from 'react'
import { ArrowRight, CalendarBlank, CheckCircle, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { date, money } from '../lib/format'
import { label } from '../lib/constants'

export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode}){
  return <header className="page-header"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="page-description">{description}</p>}</div>{actions&&<div className="header-actions">{actions}</div>}</header>
}
export function Button({children,variant='primary',icon,onClick,type='button',disabled=false}:{children:ReactNode;variant?:'primary'|'secondary'|'quiet'|'danger';icon?:ReactNode;onClick?:()=>void;type?:'button'|'submit';disabled?:boolean}){
  return <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled}>{icon}{children}</button>
}
export function LinkButton({children,to,variant='primary',icon}:{children:ReactNode;to:string;variant?:'primary'|'secondary'|'quiet';icon?:ReactNode}){
  return <a className={`button ${variant}`} href={`#${to}`}>{icon}{children}</a>
}
export function Badge({value,tone}:{value:string;tone?:string}){ return <span className={`badge ${tone||value.toLowerCase()}`}><i />{label(value)}</span> }
export const StatusBadge=({value}:{value:string})=><Badge value={value}/>
export const PriorityBadge=({value}:{value:string})=><Badge value={value} tone={`priority-${value.toLowerCase()}`}/>
export const HealthBadge=({value}:{value:string})=><Badge value={value} tone={`health-${value.toLowerCase()}`}/>
export const Money=({value,compact=false}:{value:number;compact?:boolean})=><span className="money">{money(value,compact)}</span>
export const DateDisplay=({value}:{value:string|null|undefined})=><time>{date(value)}</time>

export function MetricCard({label:cardLabel,value,detail,to,tone='neutral'}:{label:string;value:string|number;detail:string;to:string;tone?:string}){
 return <a className={`metric-card ${tone}`} href={`#${to}`}><span>{cardLabel}</span><strong>{value}</strong><small>{detail}</small><ArrowRight size={16}/></a>
}
export function EmptyState({title,description,action}:{title:string;description:string;action?:ReactNode}){
 return <div className="empty-state"><div className="empty-mark"><CheckCircle size={24}/></div><h3>{title}</h3><p>{description}</p>{action}</div>
}
export function Toolbar({search,onSearch,children}:{search:string;onSearch:(value:string)=>void;children?:ReactNode}){
 return <div className="toolbar"><label className="search"><MagnifyingGlass size={18}/><input aria-label="Search" placeholder="Search records" value={search} onChange={e=>onSearch(e.target.value)}/></label><div className="filter-row">{children}</div></div>
}
export function Select({value,onChange,children,label:ariaLabel='Filter'}:{value:string;onChange:(value:string)=>void;children:ReactNode;label?:string}){
 return <select aria-label={ariaLabel} value={value} onChange={e=>onChange(e.target.value)}>{children}</select>
}
export function Panel({title,subtitle,action,children,className=''}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode;className?:string}){
 return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>
}
export function Modal({title,description,onClose,children,wide=false}:{title:string;description?:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title}><header><div><p className="eyebrow">Artiling Jobs</p><h2>{title}</h2>{description&&<p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>
}
export function Field({label:fieldLabel,children,hint,className=''}:{label:string;children:ReactNode;hint?:string;className?:string}){
 return <label className={`field ${className}`}><span>{fieldLabel}</span>{children}{hint&&<small>{hint}</small>}</label>
}
export function FormActions({onCancel,submit='Save',disabled=false}:{onCancel:()=>void;submit?:string;disabled?:boolean}){
 return <div className="form-actions"><Button variant="quiet" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={disabled}>{submit}</Button></div>
}
export function DateChip({value}:{value:string|null}){return value?<span className="date-chip"><CalendarBlank size={15}/>{date(value,{day:'2-digit',month:'short'})}</span>:null}
export const AddIcon=()=> <Plus size={17} weight="bold"/>

export function Tabs({items,active,onChange}:{items:string[];active:string;onChange:(item:string)=>void}){
 return <div className="tabs" role="tablist">{items.map(item=><button key={item} className={active===item.split(' · ')[0]?'active':''} onClick={()=>onChange(item)}>{item}</button>)}</div>
}
export function KeyValue({label:fieldLabel,children}:{label:string;children:ReactNode}){return <div className="key-value"><span>{fieldLabel}</span><strong>{children||'—'}</strong></div>}
