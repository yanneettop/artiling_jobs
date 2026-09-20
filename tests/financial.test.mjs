import test from 'node:test'
import assert from 'node:assert/strict'

const quoteTotal = items => items.filter(item => item.is_included).reduce((sum,item)=>sum+item.quantity*item.unit_price,0)
const outstanding = (projectValue,payments) => Math.max(0,projectValue-payments.filter(p=>p.status==='PAID').reduce((sum,p)=>sum+p.amount,0))

test('quote total includes only included line items and has no VAT',()=>{
  assert.equal(quoteTotal([{quantity:2,unit_price:800,is_included:true},{quantity:1,unit_price:250,is_included:false},{quantity:1,unit_price:400,is_included:true}]),2000)
})
test('outstanding value uses only explicitly paid records',()=>{
  assert.equal(outstanding(5000,[{amount:1500,status:'PAID'},{amount:3500,status:'UPCOMING'}]),3500)
})
