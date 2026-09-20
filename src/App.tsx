import { useEffect, useMemo, useState } from 'react'
import { StoreProvider } from './data/store'
import { Shell } from './components/Shell'
import { Login } from './components/Login'
import { Dashboard } from './pages/Dashboard'
import { Leads } from './pages/Leads'
import { LeadDetail, NotFound } from './pages/LeadDetail'
import { QuotesPage } from './pages/QuotesPage'
import { Jobs } from './pages/Jobs'
import { JobDetail } from './pages/JobDetail'
import { CalendarPage, DocumentsPage, MaterialsPage, PaymentsPage, SettingsPage, TasksPage } from './pages/Operations'

function useHash(){const read=()=>location.hash.slice(1)||'/dashboard';const [hash,setHash]=useState(read);useEffect(()=>{const handler=()=>setHash(read());addEventListener('hashchange',handler);return()=>removeEventListener('hashchange',handler)},[]);return hash}
function Router(){const hash=useHash();const [path,queryString='']=hash.split('?');const query=useMemo(()=>new URLSearchParams(queryString),[queryString]);let page;if(path==='/dashboard'||path==='/')page=<Dashboard/>;else if(path==='/leads')page=<Leads query={query}/>;else if(path.startsWith('/leads/'))page=<LeadDetail id={path.split('/')[2]}/>;else if(path==='/quotes')page=<QuotesPage query={query}/>;else if(path==='/jobs')page=<Jobs query={query}/>;else if(path.startsWith('/jobs/'))page=<JobDetail id={path.split('/')[2]}/>;else if(path==='/tasks')page=<TasksPage/>;else if(path==='/calendar')page=<CalendarPage/>;else if(path==='/payments')page=<PaymentsPage/>;else if(path==='/materials')page=<MaterialsPage/>;else if(path==='/documents')page=<DocumentsPage/>;else if(path==='/settings')page=<SettingsPage/>;else page=<NotFound type="page"/>;return <Shell path={path} onLogout={()=>{sessionStorage.removeItem('artiling-auth');location.reload()}}>{page}</Shell>}
export default function App(){const [authed,setAuthed]=useState(()=>sessionStorage.getItem('artiling-auth')==='yes');if(!authed)return <Login onLogin={()=>{sessionStorage.setItem('artiling-auth','yes');setAuthed(true)}}/>;return <StoreProvider><Router/></StoreProvider>}
