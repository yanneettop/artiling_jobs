import { useState } from 'react'
import { ArrowRight, LockKey } from '@phosphor-icons/react'
import { Button, Field } from './ui'

export function Login({onLogin}:{onLogin:()=>void}){
 const [email,setEmail]=useState('ioannis@artilingstudio.co.uk'); const [password,setPassword]=useState('artiling')
 return <main className="login-page"><section className="login-brand"><div className="login-lockup"><span>A</span><strong>ARTILING STUDIO</strong></div><div><p>Private operations workspace</p><h1>Every project,<br/>clearly in view.</h1><small>Leads, quotations, fabrication and delivery — held in one calm, precise workspace.</small></div><footer>Artiling Jobs · Internal use only</footer></section><section className="login-form-wrap"><form className="login-form" onSubmit={e=>{e.preventDefault();if(email&&password)onLogin()}}><div className="login-icon"><LockKey size={23}/></div><p className="eyebrow">Secure access</p><h2>Welcome back</h2><p>Sign in to continue to Artiling Jobs.</p><Field label="Email address"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></Field><Field label="Password"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={4}/></Field><Button type="submit">Sign in <ArrowRight size={17}/></Button><small className="prototype-note">Phase 1 authentication boundary. Connect your identity provider before production.</small></form></section></main>
}
