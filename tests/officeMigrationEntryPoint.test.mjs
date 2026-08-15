import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path){return readFileSync(new URL(path,import.meta.url),'utf8')}

test('Office migration rehearsal page is declared as a production Vite entry',()=>{
  assert.match(source('../vite.config.ts'),/office-migration\.html/)
  assert.match(source('../office-migration.html'),/office-migration-main\.tsx/)
})

test('Office migration rehearsal is explicitly dry-run and uses the shared simulator',()=>{
  const page=source('../src/OfficeMigrationPage.tsx')
  assert.match(page,/simulateOfficeMigration/)
  assert.match(page,/No workspace changes are applied/)
  assert.match(page,/formulaTranslation/)
  assert.match(page,/importedReview/)
  assert.match(page,/exportReview/)
})
