/**
 * 실제 Anthropic Claude API로 AI 상세해설을 (재)생성하는 스크립트.
 *
 * 사용법:
 *   1) .env 에 ANTHROPIC_API_KEY=sk-ant-... 추가
 *   2) node scripts/generate-ai-real.js              # 빈 것만
 *      node scripts/generate-ai-real.js overwrite    # 전체 덮어쓰기
 *      node scripts/generate-ai-real.js test         # 랜덤 5개만 (품질 확인용)
 *
 * 비용 추정: claude-haiku 기준 2,130문제 ≈ $5~10, sonnet ≈ $50~100
 * 소요시간: Rate limit 고려 병렬 5개 호출 시 약 15~30분
 *
 * 주의: fetch 가능한 Node 18+ 필요.
 */

require('dotenv').config();
const { getWrapper, save } = require('../database');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';  // 저렴한 모델 기본
const CONCURRENCY = parseInt(process.env.AI_CONCURRENCY || '5');
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

if (!API_KEY) {
  console.error('오류: ANTHROPIC_API_KEY 환경변수가 없습니다. .env 파일에 설정하세요.');
  console.error('예: ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const SYSTEM_PROMPT = `당신은 공인노무사 1차 시험 전문 강사입니다. 주어진 문제에 대해 한국어로 정확하고 구조화된 상세해설을 작성합니다.

형식은 반드시 다음과 같이 【섹션】 형태로 출력하세요:

【정답 분석】
정답이 왜 정답인지 법령·조문·이론에 근거해 2~3문장으로 설명. 필요 시 핵심 개념을 명시.

【오답 분석】
각 오답 보기가 왜 틀렸는지 번호별로 간결히 설명(보기별 1문장).

【관련 법령·조문】 (노동법/민법/사회보험법인 경우) 또는 【핵심 개념】 (경영학/경제학인 경우)
해당 문제와 직결되는 법조문(법률명 제X조) 또는 핵심 이론을 구체적으로 나열.

【학습 포인트】
이 유형의 문제를 풀 때 주의할 점과 관련 함정을 1~2문장.

답변은 반드시 한국어 · 평서체 · 4개 섹션 모두 포함. 불필요한 서두/마무리 없이 【섹션】부터 시작.`;

function buildUserPrompt(q) {
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5]
    .map((o, i) => o ? `${i + 1}. ${String(o).replace(/^[①-⑤⓵-⓹]\s*|^\d+[\.\)]\s*/, '').trim()}` : null)
    .filter(Boolean);
  return `[과목] ${q.subject}
[년도] ${q.year}
[문제]
${q.question_text}

[보기]
${opts.join('\n')}

[정답] ${q.correct_answer}번
[키워드] ${q.keyword || '없음'}
[기존 간단 해설] ${q.explanation || '없음'}

위 정보를 바탕으로 상세해설을 작성하세요.`;
}

async function callClaude(q) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(q) }]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.substring(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function processBatch(items, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const myIdx = idx++;
      const item = items[myIdx];
      try {
        const text = await callClaude(item);
        results.push({ id: item.id, text, ok: true });
      } catch (err) {
        results.push({ id: item.id, error: err.message, ok: false });
      }
    }
  }
  await Promise.all(Array(concurrency).fill(0).map(() => worker()));
  return results;
}

async function main() {
  const mode = process.argv[2] || 'missing';
  console.log(`=== Anthropic API 기반 AI 해설 생성 ===`);
  console.log(`모델: ${MODEL} · 동시성: ${CONCURRENCY} · 모드: ${mode}`);

  const db = await getWrapper();
  try { db.exec("ALTER TABLE questions ADD COLUMN ai_explanation TEXT DEFAULT ''"); } catch {}

  let sql;
  if (mode === 'test') {
    sql = "SELECT * FROM questions ORDER BY RANDOM() LIMIT 5";
  } else if (mode === 'overwrite') {
    sql = "SELECT * FROM questions ORDER BY id";
  } else {
    sql = "SELECT * FROM questions WHERE ai_explanation IS NULL OR ai_explanation = '' OR ai_explanation NOT LIKE '%【정답 분석%' ORDER BY id";
  }
  const questions = db.prepare(sql).all();
  console.log(`대상: ${questions.length}문제`);
  if (questions.length === 0) { console.log('처리할 문제가 없습니다.'); process.exit(0); }

  const update = db.prepare("UPDATE questions SET ai_explanation = ? WHERE id = ?");
  const chunkSize = 50;
  let success = 0, fail = 0;
  const start = Date.now();

  for (let i = 0; i < questions.length; i += chunkSize) {
    const chunk = questions.slice(i, i + chunkSize);
    const results = await processBatch(chunk, CONCURRENCY);
    for (const r of results) {
      if (r.ok && r.text) {
        update.run(r.text, r.id);
        success++;
      } else {
        console.error(`  Q${r.id} 실패: ${r.error || 'empty'}`);
        fail++;
      }
    }
    save();
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`진행 ${i + chunk.length}/${questions.length}  (성공 ${success} · 실패 ${fail} · ${elapsed}s)`);
  }

  console.log(`\n=== 완료 · 성공 ${success} · 실패 ${fail} ===`);

  if (mode === 'test') {
    const samples = db.prepare("SELECT id, subject, year, question_number, ai_explanation FROM questions WHERE id IN (" + questions.map(q => q.id).join(',') + ")").all();
    console.log('\n=== 샘플 ===');
    samples.forEach(s => {
      console.log(`\n--- Q${s.id} ${s.year} ${s.subject} #${s.question_number} ---`);
      console.log(s.ai_explanation);
    });
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
