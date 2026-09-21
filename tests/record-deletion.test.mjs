import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteRecord } from '../functions/_shared/repository.js'

function fakeDatabase(value) {
  const records = new Map(value ? [[`documents:${value.id}`, { data: JSON.stringify(value), version: 1 }]] : [])
  const activity = []
  return {
    records,
    activity,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (!sql.includes('SELECT data, version')) return null
              return records.get(`${args[0]}:${args[1]}`) || null
            },
            async run() {
              if (sql.includes('DELETE FROM records')) records.delete(`${args[0]}:${args[1]}`)
              if (sql.includes('INSERT INTO activity_log')) activity.push({ action: 'DELETED', recordId: args[4], oldValue: JSON.parse(args[5]) })
            },
          }
        },
      }
    },
    async batch(statements) {
      for (const statement of statements) await statement.run()
    },
  }
}

test('deleting a record also writes a deletion audit entry', async () => {
  const document = { id: 'document-1', title: 'Site drawing' }
  const db = fakeDatabase(document)
  const deleted = await deleteRecord(db, { name: 'Ioannis', type: 'human' }, 'documents', document.id)
  assert.deepEqual(deleted, document)
  assert.equal(db.records.size, 0)
  assert.deepEqual(db.activity, [{ action: 'DELETED', recordId: document.id, oldValue: document }])
})

test('deleting a missing record is a no-op', async () => {
  const db = fakeDatabase()
  assert.equal(await deleteRecord(db, { name: 'Ioannis', type: 'human' }, 'documents', 'missing'), null)
  assert.equal(db.activity.length, 0)
})
