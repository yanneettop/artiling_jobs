import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { seed } from './seed'
import type { Activity, Database } from '../types'
import { isoNow, uid } from '../lib/format'

const STORAGE_KEY='artiling-jobs-phase1-v1'
type Collection = Exclude<keyof Database,'settings'>
type StoreApi = {
  db:Database
  add:<K extends Collection>(collection:K, value:Database[K][number])=>void
  update:<K extends Collection>(collection:K, id:string, changes:Partial<Database[K][number]>)=>void
  remove:<K extends Collection>(collection:K, id:string)=>void
  replace:(database:Database)=>void
  patchSettings:(changes:Partial<Database['settings']>)=>void
  log:(activity:Omit<Activity,'id'|'created_at'|'created_by'>)=>void
  reset:()=>void
}
const StoreContext=createContext<StoreApi|null>(null)

function load():Database {
  try { const raw=localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as Database : structuredClone(seed) }
  catch { return structuredClone(seed) }
}

export function StoreProvider({children}:{children:ReactNode}) {
  const [db,setDb]=useState<Database>(load)
  const commit=(next:Database)=>{ setDb(next); localStorage.setItem(STORAGE_KEY,JSON.stringify(next)) }
  const mutate=(updater:(current:Database)=>Database)=>setDb(current=>{const next=updater(current);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next})
  const api=useMemo<StoreApi>(()=>({
    db,
    add:(collection,value)=>mutate(current=>({...current,[collection]:[...(current[collection] as unknown[]),value]} as Database)),
    update:(collection,id,changes)=>mutate(current=>({...current,[collection]:(current[collection] as Array<{id:string}>).map(item=>item.id===id?{...item,...changes,updated_at:isoNow()}:item)} as Database)),
    remove:(collection,id)=>mutate(current=>({...current,[collection]:(current[collection] as Array<{id:string}>).filter(item=>item.id!==id)} as Database)),
    replace:commit,
    patchSettings:(changes)=>mutate(current=>({...current,settings:{...current.settings,...changes}})),
    log:(activity)=>mutate(current=>({...current,activities:[{...activity,id:uid('activity'),created_at:isoNow(),created_by:'Ioannis'},...current.activities]})),
    reset:()=>commit(structuredClone(seed))
  }),[db])
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
export function useStore(){ const value=useContext(StoreContext); if(!value) throw new Error('StoreProvider is missing'); return value }
