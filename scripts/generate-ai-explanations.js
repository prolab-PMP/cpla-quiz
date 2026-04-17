/**
 * 모든 문제에 대해 AI 상세해설 생성 후 DB 업데이트
 * 사용: node scripts/generate-ai-explanations.js
 *
 * 현재 구현: 구조화된 템플릿 기반 (오프라인, 즉시, 무료)
 * 업그레이드: scripts/generate-ai-real.js 에서 Anthropic API 사용
 */

const path = require('path');
const { getWrapper, save } = require('../database');
const { generateEnrichedExplanation } = require('./enrichment');

async function main() {
  console.log('=== AI 상세해설 일괄 생성 시작 ===');
  const db = await getWrapper();

  // Ensure column exists
  try { db.exec("ALTER TABLE questions ADD COLUMN ai_explanation TEXT DEFAULT ''"); }
  catch (e) { /* already exists */ }

  const mode = process.argv[2] || 'all';  // 'all' | 'missing' | 'overwrite'
  let sql = "SELECT * FROM questions";
  if (mode === 'missing') {
    sql += " WHERE ai_explanation IS NULL OR ai_explanation = ''";
  }
  sql += " ORDER BY id";

  const questions = db.prepare(sql).all();
  console.log(`대상 문제 수: ${questions.length}  (모드: ${mode})`);

  const update = db.prepare("UPDATE questions SET ai_explanation = ? WHERE id = ?");

  let processed = 0;
  const start = Date.now();
  for (const q of questions) {
    try {
      const ai = generateEnrichedExplanation(q);
      update.run(ai, q.id);
    } catch (err) {
      console.error(`Q${q.id} 처리 실패:`, err.message);
    }
    processed++;
    if (processed % 200 === 0 || processed === questions.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  진행: ${processed}/${questions.length}  (${elapsed}s)`);
    }
  }

  save();
  console.log('=== 완료 ===');
  console.log(`생성된 해설 수: ${processed}`);

  // 샘플 확인
  const sample = db.prepare("SELECT id, year, subject, question_number, ai_explanation FROM questions WHERE ai_explanation IS NOT NULL AND ai_explanation != '' ORDER BY RANDOM() LIMIT 3").all();
  console.log('\n=== 샘플 해설 (랜덤 3개) ===');
  for (const s of sample) {
    console.log(`\n--- [Q${s.id}] ${s.year} ${s.subject} #${s.question_number} ---`);
    console.log(s.ai_explanation);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
