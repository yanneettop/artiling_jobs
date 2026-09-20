export const money = (value:number, compact=false) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:compact?0:2,maximumFractionDigits:compact?0:2}).format(value)
export const date = (value:string|null|undefined, options:Intl.DateTimeFormatOptions={day:'2-digit',month:'short',year:'numeric'}) => value ? new Intl.DateTimeFormat('en-GB',options).format(new Date(value)) : '—'
export const relativeDue = (value:string|null) => {
  if (!value) return ''
  const days = Math.ceil((new Date(value).getTime()-Date.now())/86400000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}
export const uid = (prefix:string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`
export const isoNow = () => new Date().toISOString()
export const isoDate = (offsetDays=0) => { const d=new Date(); d.setDate(d.getDate()+offsetDays); return d.toISOString().slice(0,10) }
