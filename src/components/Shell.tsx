import { useEffect, useState, type ReactNode } from 'react'
import { Briefcase, CalendarBlank, CaretDown, ClipboardText, Coins, FileText, Gear, House, ListChecks, Package, Quotes, SignOut, UsersThree, X } from '@phosphor-icons/react'

const nav=[
  ['Dashboard','/dashboard',House],['Leads','/leads',UsersThree],['Quotes','/quotes',Quotes],['Jobs','/jobs',Briefcase],['Calendar','/calendar',CalendarBlank],['Materials','/materials',Package],['Payments','/payments',Coins],['Tasks','/tasks',ListChecks],['Documents','/documents',FileText],['Settings','/settings',Gear]
] as const

export function Shell({path,children,onLogout}:{path:string;children:ReactNode;onLogout:()=>void}){
 const [mobileOpen,setMobileOpen]=useState(false)
 useEffect(()=>setMobileOpen(false),[path])
 return <div className="app-shell">
   <a className="skip-link" href="#main">Skip to content</a>
   <aside className={`sidebar ${mobileOpen?'open':''}`}>
     <div className="brand"><div className="brand-mark">A</div><div><strong>ARTILING</strong><span>JOBS</span></div><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={20}/></button></div>
     <nav>{nav.map(([name,to,Icon])=><a key={to} href={`#${to}`} className={path===to||path.startsWith(`${to}/`)?'active':''}><Icon size={19} weight={path===to||path.startsWith(`${to}/`)?'fill':'regular'}/><span>{name}</span></a>)}</nav>
     <div className="sidebar-foot"><button className="account"><span className="avatar">IK</span><span><strong>Ioannis K.</strong><small>Administrator</small></span><CaretDown size={14}/></button><button className="logout" onClick={onLogout}><SignOut size={17}/>Sign out</button></div>
   </aside>
   {mobileOpen&&<button className="scrim" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>} 
   <div className="workspace"><header className="topbar"><button className="menu-button" onClick={()=>setMobileOpen(true)}><span/><span/></button><div className="top-context"><span>Artiling Studio</span><b>Operations</b></div><a className="quick-create" href="#/leads?new=1"><ClipboardText size={17}/>New lead</a></header><main id="main">{children}</main></div>
   <nav className="mobile-nav">{nav.slice(0,5).map(([name,to,Icon])=><a key={to} href={`#${to}`} className={path===to||path.startsWith(`${to}/`)?'active':''}><Icon size={20}/><span>{name}</span></a>)}</nav>
 </div>
}
