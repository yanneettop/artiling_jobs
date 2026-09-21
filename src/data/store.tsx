import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CloudArrowUp, Database as DatabaseIcon, SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { seed } from './seed'
import type { Activity, Database } from '../types'
import { isoNow, uid } from '../lib/format'

const STORAGE_KEY='artiling-jobs-phase1-v1'
type Collection = Exclude<keyof Database,'settings'>
type SyncStatus = 'loading'|'local-only'|'synced'|'saving'|'error'
type StoreApi = {
  db:Database
  syncStatus:SyncStatus
  syncError:string
  add:<K extends Collection>(collection:K, value:Database[K][number])=>void
  update:<K extends Collection>(collection:K, id:string, changes:Partial<Database[K][number]>)=>void
  remove:<K extends Collection>(collection:K, id:string)=>Promise<void>
  replace:(database:Database)=>void
  patchSettings:(changes:Partial<Database['settings']>)=>void
  log:(activity:Omit<Activity,'id'|'created_at'|'created_by'>)=>void
  refresh:()=>Promise<void>
}
const StoreContext=createContext<StoreApi|null>(null)

function loadLocal():Database {
  try { const raw=localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as Database : structuredClone(seed) }
  catch { return structuredClone(seed) }
}

function persistLocal(database:Database){localStorage.setItem(STORAGE_KEY,JSON.stringify(database))}

async function requestJson<T>(url:string, init?:RequestInit):Promise<T>{
  const response=await fetch(url,{credentials:'same-origin',...init,headers:{'content-type':'application/json',...(init?.headers||{})}})
  const body=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error((body as {error?:string}).error||`Request failed (${response.status})`)
  return body as T
}

function changedRecords(previous:Database,next:Database){
  const changes:Array<{collection:Collection;value:{id:string}}>=[]
  for(const collection of Object.keys(next) as Array<keyof Database>){
    if(collection==='settings')continue
    const before=new Map((previous[collection] as Array<{id:string}>).map(value=>[value.id,JSON.stringify(value)]))
    for(const value of next[collection] as Array<{id:string}>){
      if(before.get(value.id)!==JSON.stringify(value))changes.push({collection,value})
    }
  }
  return changes
}

export function StoreProvider({children}:{children:ReactNode}) {
  const [db,setDb]=useState<Database>(loadLocal)
  const dbRef=useRef(db)
  const [syncStatus,setSyncStatus]=useState<SyncStatus>('loading')
  const [syncError,setSyncError]=useState('')
  const [needsBootstrap,setNeedsBootstrap]=useState(false)
  const pending=useRef(0)

  const applyDatabase=useCallback((database:Database)=>{
    dbRef.current=database
    setDb(database)
    persistLocal(database)
  },[])

  const refresh=useCallback(async()=>{
    if(pending.current>0)return
    try{
      const payload=await requestJson<{initialized:boolean;state:Database}>('/api/state')
      if(payload.initialized){applyDatabase(payload.state);setNeedsBootstrap(false);setSyncStatus('synced');setSyncError('')}
      else{setNeedsBootstrap(true);setSyncStatus('local-only')}
    }catch(error){setSyncStatus('error');setSyncError(error instanceof Error?error.message:'Could not reach Cloudflare storage')}
  },[applyDatabase])

  useEffect(()=>{
    void refresh()
    const interval=window.setInterval(()=>void refresh(),30000)
    const onFocus=()=>void refresh()
    window.addEventListener('focus',onFocus)
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',onFocus)}
  },[refresh])

  const syncChanges=useCallback(async(previous:Database,next:Database)=>{
    const records=changedRecords(previous,next)
    const settingsChanged=JSON.stringify(previous.settings)!==JSON.stringify(next.settings)
    if(!records.length&&!settingsChanged)return
    pending.current+=1;setSyncStatus('saving');setSyncError('')
    try{
      await Promise.all([
        ...records.map(({collection,value})=>requestJson(`/api/records/${collection}/${encodeURIComponent(value.id)}`,{method:'PUT',body:JSON.stringify(value)})),
        ...(settingsChanged?[requestJson('/api/settings',{method:'PUT',body:JSON.stringify(next.settings)})]:[]),
      ])
      setSyncStatus('synced')
    }catch(error){setSyncStatus('error');setSyncError(error instanceof Error?error.message:'Cloud save failed')}
    finally{pending.current=Math.max(0,pending.current-1)}
  },[])

  const commit=useCallback((next:Database)=>{
    const previous=dbRef.current
    applyDatabase(next)
    if(!needsBootstrap)void syncChanges(previous,next)
  },[applyDatabase,needsBootstrap,syncChanges])
  const mutate=useCallback((updater:(current:Database)=>Database)=>commit(updater(dbRef.current)),[commit])

  const bootstrap=async()=>{
    setSyncStatus('saving');setSyncError('')
    try{
      await requestJson('/api/bootstrap',{method:'POST',body:JSON.stringify(dbRef.current)})
      setNeedsBootstrap(false);setSyncStatus('synced')
    }catch(error){
      const message=error instanceof Error?error.message:'Migration failed'
      if(message==='Database is already initialized'){setNeedsBootstrap(false);await refresh();return}
      setSyncStatus('error');setSyncError(message)
    }
  }

  const api=useMemo<StoreApi>(()=>({
    db,syncStatus,syncError,
    add:(collection,value)=>mutate(current=>({...current,[collection]:[...(current[collection] as unknown[]),value]} as Database)),
    update:(collection,id,changes)=>mutate(current=>({...current,[collection]:(current[collection] as Array<{id:string}>).map(item=>item.id===id?{...item,...changes,updated_at:isoNow()}:item)} as Database)),
    remove:async(collection,id)=>{
      if(!needsBootstrap)await requestJson(`/api/records/${collection}/${encodeURIComponent(id)}`,{method:'DELETE'})
      mutate(current=>({...current,[collection]:(current[collection] as Array<{id:string}>).filter(item=>item.id!==id)} as Database))
    },
    replace:commit,
    patchSettings:(changes)=>mutate(current=>({...current,settings:{...current.settings,...changes}})),
    log:(activity)=>mutate(current=>({...current,activities:[{...activity,id:uid('activity'),created_at:isoNow(),created_by:'Ioannis'},...current.activities]})),
    refresh,
  }),[db,syncStatus,syncError,mutate,commit,refresh,needsBootstrap])

  if(syncStatus==='loading')return <main className="storage-gate"><SpinnerGap className="spin" size={30}/><h1>Connecting to Artiling Jobs</h1><p>Loading the shared Cloudflare workspace…</p></main>
  if(needsBootstrap)return <main className="storage-gate"><DatabaseIcon size={34}/><p className="eyebrow">One-time migration</p><h1>Move this browser’s data to Cloudflare</h1><p>This will copy the records currently stored in this browser into the shared D1 database. Grok and the web app will then work from the same source.</p>{syncError&&<div className="storage-error"><WarningCircle/> {syncError}</div>}<button className="button primary" onClick={()=>void bootstrap()} disabled={syncStatus==='saving'}>{syncStatus==='saving'?<><SpinnerGap className="spin"/> Moving data…</>:<><CloudArrowUp/> Move data securely</>}</button><small>No data is uploaded until you press this button.</small></main>
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
export function useStore(){ const value=useContext(StoreContext); if(!value) throw new Error('StoreProvider is missing'); return value }
