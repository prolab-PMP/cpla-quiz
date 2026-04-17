/**
 * AI 상세해설 생성용 enrichment 모듈
 * 문제/보기/정답/기존해설/키워드 → 구조화된 3~5문장 상세해설 생성
 *
 * 섹션: 【정답 분석】 → 【오답 분석】 → 【관련 법령/개념】 → 【학습 포인트】
 */

// ============ 과목별 키워드 → 법령/조문 매핑 ============
const KEYWORD_LAW = {
  // 노동법1 (근로기준법 · 산업안전보건법 · 최저임금법 · 근로자퇴직급여보장법 · 남녀고용평등법)
  '근로계약':           { law: '근로기준법', art: '제15조~제22조', note: '근로계약의 체결·명시·위반·손해배상 예정 금지 등' },
  '근로시간':           { law: '근로기준법', art: '제50조~제63조', note: '법정근로시간(주40)·연장근로(주12)·유연근무제' },
  '연장근로':           { law: '근로기준법', art: '제53조·제56조', note: '주12시간 한도 · 50% 가산임금' },
  '야간근로':           { law: '근로기준법', art: '제56조', note: '오후10시~오전6시 · 50% 가산임금' },
  '휴일':               { law: '근로기준법', art: '제55조', note: '주휴일·법정공휴일 유급 보장' },
  '휴가':               { law: '근로기준법', art: '제60조~제62조', note: '연차유급휴가 산정·소멸·대체' },
  '연차':               { law: '근로기준법', art: '제60조', note: '1년 80% 이상 출근 시 15일, 3년 이상 2년마다 1일 가산(최대 25일)' },
  '해고':               { law: '근로기준법', art: '제23조~제28조', note: '정당이유·30일 전 예고·서면통지·부당해고 구제' },
  '경영상해고':         { law: '근로기준법', art: '제24조', note: '긴박경영상 필요·해고회피노력·합리공정 기준·협의' },
  '정리해고':           { law: '근로기준법', art: '제24조', note: '긴박경영상 필요+회피노력+공정기준+50일 전 협의' },
  '임금':               { law: '근로기준법', art: '제43조~제49조', note: '통화·직접·전액·정기지급 4대 원칙' },
  '통상임금':           { law: '근로기준법 시행령', art: '제6조', note: '정기성·일률성·고정성을 갖춘 임금 총액' },
  '평균임금':           { law: '근로기준법', art: '제2조 제1항 제6호', note: '산정사유 발생일 이전 3개월 임금총액 / 총일수' },
  '최저임금':           { law: '최저임금법', art: '전반', note: '매년 고시 · 위반 시 3년 이하 징역 또는 2천만원 이하 벌금' },
  '퇴직금':             { law: '근로자퇴직급여 보장법', art: '제4조·제8조', note: '1년 이상 근로·30일분 이상 평균임금' },
  '퇴직급여':           { law: '근로자퇴직급여 보장법', art: '전반', note: 'DB·DC·개인형퇴직연금' },
  '산업안전':           { law: '산업안전보건법', art: '전반', note: '사업주·근로자 의무, 작업중지권, 도급인 책임' },
  '산업안전보건법':     { law: '산업안전보건법', art: '전반', note: '안전보건체계·위험성평가·MSDS 등' },
  '산업재해':           { law: '산업재해보상보험법', art: '전반', note: '업무상 재해 인정·요양·휴업·장해·유족 급여' },
  '남녀고용평등':       { law: '남녀고용평등과 일·가정 양립 지원에 관한 법률', art: '전반', note: '차별금지·모성보호·육아휴직' },
  '육아휴직':           { law: '남녀고용평등법', art: '제19조', note: '만 8세 이하 자녀 1년 이내 사용, 급여는 고용보험에서 지급' },
  '기간제':             { law: '기간제 및 단시간근로자 보호 등에 관한 법률', art: '전반', note: '총 2년 초과 시 무기계약 간주' },
  '파견':               { law: '파견근로자 보호 등에 관한 법률', art: '전반', note: '허용업무·기간 2년·직접고용 의무' },
  '차별':               { law: '기간제법/파견법/남녀고용평등법', art: '차별금지 조항', note: '비교대상·불리처우·합리이유 3요소' },
  '직장내괴롭힘':       { law: '근로기준법', art: '제76조의2~제76조의3', note: '사용자 조치의무·불이익처분 금지' },
  '명예고용평등감독관':{ law: '남녀고용평등법', art: '제24조', note: '임의 위촉 · 의무 아님' },
  '직업안정법':         { law: '직업안정법', art: '전반', note: '직업소개·근로자모집·근로자공급' },
  '취업규칙':           { law: '근로기준법', art: '제93조~제97조', note: '10인 이상 작성·신고, 불이익 변경은 과반수 동의' },

  // 노동법2 (노동조합 및 노동관계조정법 · 노동위원회법 · 근참법 · 공무원노조)
  '노동조합':           { law: '노동조합 및 노동관계조정법', art: '제2조·제5조', note: '자주성·민주성·목적성 요건' },
  '단체교섭':           { law: '노조법', art: '제29조~제30조', note: '교섭권 배타성·성실교섭의무' },
  '교섭단위':           { law: '노조법', art: '제29조의3', note: '사업/사업장 단위 · 분리결정 사유' },
  '교섭창구단일화':     { law: '노조법', art: '제29조의2', note: '2011년 도입, 공동교섭대표단·자율단일화·과반수' },
  '단체협약':           { law: '노조법', art: '제31조~제36조', note: '서면·쌍방서명날인·유효기간 최장 3년' },
  '쟁의행위':           { law: '노조법', art: '제37조~제46조', note: '조정전치·찬반투표·정당성 요건' },
  '쟁의조정':           { law: '노조법', art: '제53조~제61조', note: '조정(10일)·중재·긴급조정' },
  '부당노동행위':       { law: '노조법', art: '제81조~제90조', note: '불이익취급·반조합계약·단교거부·지배개입·보복' },
  '노동위원회':         { law: '노동위원회법', art: '전반', note: '공익·근로자·사용자 3자 구성, 심판·조정 권한' },
  '근로자참여':         { law: '근로자참여 및 협력증진에 관한 법률', art: '전반', note: '노사협의회 설치(30인 이상)' },
  '노사협의회':         { law: '근참법', art: '제4조·제12조', note: '3개월마다 정기회의' },

  // 민법
  '법률행위':           { law: '민법', art: '제103조~제146조', note: '의사능력·법률행위 목적·방식' },
  '의사표시':           { law: '민법', art: '제107조~제113조', note: '진의 아닌 표시·통정허위·착오·사기·강박' },
  '착오':               { law: '민법', art: '제109조', note: '중요부분 착오 + 중과실 없을 때 취소 가능' },
  '대리':               { law: '민법', art: '제114조~제136조', note: '본인 → 대리인 → 상대방 · 현명주의' },
  '표현대리':           { law: '민법', art: '제125조·제126조·제129조', note: '수권표시·권한초과·소멸후 3유형' },
  '무권대리':           { law: '민법', art: '제130조~제136조', note: '본인 추인 시 유효 · 철회권·거절권' },
  '무효':               { law: '민법', art: '제137조~제138조', note: '소급 무효 · 일부무효 · 전환' },
  '취소':               { law: '민법', art: '제140조~제146조', note: '취소권자·추인·제척기간(3년/10년)' },
  '계약':               { law: '민법', art: '제527조~제553조', note: '청약·승낙·동시이행·위험부담' },
  '채권':               { law: '민법', art: '제373조~제526조', note: '특정물·종류·금전·이자·선택채권' },
  '채무불이행':         { law: '민법', art: '제390조~제399조', note: '이행지체·이행불능·불완전이행' },
  '물권':               { law: '민법', art: '제185조~제372조', note: '물권법정주의·공시원칙·우선적효력' },
  '점유':               { law: '민법', art: '제192조~제210조', note: '사실상 지배·자주/타주·선의/악의' },
  '소유권':             { law: '민법', art: '제211조~제278조', note: '전면적 지배권 · 사용·수익·처분' },
  '시효':               { law: '민법', art: '제162조~제184조', note: '소멸시효(일반10년)·취득시효(20년)' },
  '불법행위':           { law: '민법', art: '제750조~제766조', note: '고의/과실·위법성·인과관계·손해' },

  // 사회보험법 (국민연금·건강보험·고용보험·산재보험)
  '국민연금':           { law: '국민연금법', art: '전반', note: '18~59세 가입·노령/장애/유족연금' },
  '건강보험':           { law: '국민건강보험법', art: '전반', note: '직장가입자·지역가입자·요양급여' },
  '고용보험':           { law: '고용보험법', art: '전반', note: '실업급여·고용안정·직업능력개발 3개 사업' },
  '실업급여':           { law: '고용보험법', art: '제40조~제52조', note: '수급요건·구직급여일수 120~270일' },
  '산재보험':           { law: '산업재해보상보험법', art: '전반', note: '업무상재해 인정기준·보험급여 8종' },
  '업무상재해':         { law: '산재보험법', art: '제37조', note: '업무수행성·업무기인성' },
  '노인장기요양':       { law: '노인장기요양보험법', art: '전반', note: '65세 이상 또는 노인성질환 장기요양등급' },

  // 경영학
  '마케팅':             { law: null, art: null, note: 'STP 전략·4P 마케팅믹스·시장세분화·포지셔닝' },
  '시장세분화':         { law: null, art: null, note: '인구통계·지리·심리·행동 변수 · Segment→Target→Position' },
  '포지셔닝':           { law: null, art: null, note: '지각도(Perceptual Map)·차별화·가치제안' },
  '마케팅믹스':         { law: null, art: null, note: '4P: Product, Price, Place, Promotion' },
  '브랜드':             { law: null, art: null, note: '브랜드자산(Aaker): 인지도·연상·지각품질·충성도' },
  '가격':               { law: null, art: null, note: '원가기준·경쟁기준·가치기준 가격결정' },
  '가격전략':           { law: null, art: null, note: '스키밍·침투가격·심리적가격·번들링' },
  '제품수명주기':       { law: null, art: null, note: '도입·성장·성숙·쇠퇴 4단계별 전략' },
  '조직':               { law: null, art: null, note: '기능/사업부/매트릭스/네트워크 구조' },
  '리더십':             { law: null, art: null, note: '특성·행동·상황·변혁적/거래적 리더십' },
  '변혁적리더':         { law: null, art: null, note: 'Bass: 카리스마·영감·지적자극·개별배려' },
  '동기부여':           { law: null, art: null, note: '내용이론(욕구)·과정이론(기대·공정성·목표)' },
  '욕구단계':           { law: null, art: null, note: 'Maslow: 생리→안전→사회→존경→자아실현' },
  '기대이론':           { law: null, art: null, note: 'Vroom: V(가치)×I(도구성)×E(기대) = 동기' },
  '호손실험':           { law: null, art: null, note: '인간관계론 출발 · 사회적 요인의 생산성 영향' },
  '과학적관리법':       { law: null, art: null, note: 'Taylor: 시간·동작연구·표준화·성과급' },
  'Y이론':             { law: null, art: null, note: 'McGregor: 인간은 자율·책임 지향적' },
  '재무':               { law: null, art: null, note: '자본구조·자본예산·배당정책·위험관리' },
  '자본':               { law: null, art: null, note: '자기자본·타인자본·WACC' },
  '현재가치':           { law: null, art: null, note: 'PV = FV / (1+r)^n' },
  '순현가':             { law: null, art: null, note: 'NPV > 0 → 투자 타당 · 할인율에 민감' },
  '포트폴리오':         { law: null, art: null, note: 'Markowitz: 분산투자로 체계적위험만 남음' },
  '증권시장선':         { law: null, art: null, note: 'SML: E(R) = Rf + β[E(Rm)-Rf]' },
  'CAPM':              { law: null, art: null, note: '체계적위험(β)만이 수익률 결정' },
  '재고':               { law: null, art: null, note: 'EOQ 경제적주문량·ABC분석·JIT' },
  '경제적주문량':       { law: null, art: null, note: 'EOQ = √(2DS/H)' },
  'BCG매트릭스':       { law: null, art: null, note: '성장률×점유율: Star/Cash Cow/Question Mark/Dog' },
  '제품시장매트릭스':   { law: null, art: null, note: 'Ansoff: 시장침투/제품개발/시장개발/다각화' },
  '빅데이터':           { law: null, art: null, note: '3V: Volume·Velocity·Variety (+ Veracity·Value)' },
  '경영정보시스템':     { law: null, art: null, note: 'TPS→MIS→DSS→EIS 계층' },
  '감가상각':           { law: null, art: null, note: '정액법·정률법·생산량비례법' },
  '유형자산':           { law: null, art: null, note: '취득원가·감가상각·손상·재평가' },
  '회계':               { law: null, art: null, note: '재무회계·원가회계·관리회계' },
  '유동비율':           { law: null, art: null, note: '유동자산/유동부채 · 200% 이상 양호' },

  // 경제학
  '수요공급':           { law: null, art: null, note: '균형가격/균형수량·가격탄력성·세금귀착' },
  '가격탄력성':         { law: null, art: null, note: '탄력적(>1)·단위탄력적(=1)·비탄력적(<1)' },
  '완전경쟁':           { law: null, art: null, note: '다수·동질·자유진입·완전정보 → P=MC=AC' },
  '독점':               { law: null, art: null, note: 'MR=MC에서 생산·사중손실 발생' },
  '과점':               { law: null, art: null, note: 'Cournot·Bertrand·Stackelberg·담합 모형' },
  '노동시장':           { law: null, art: null, note: '임금=VMPL · 노동수요 탄력성' },
  '노동수요':           { law: null, art: null, note: '파생수요 · 임금탄력성 결정요인' },
  '노동공급':           { law: null, art: null, note: '소득효과·대체효과 후방굴절 가능' },
  '실업':               { law: null, art: null, note: '마찰적·구조적·경기적·자연실업률' },
  '인플레이션':         { law: null, art: null, note: '수요견인·비용인상·피셔방정식' },
  '필립스곡선':         { law: null, art: null, note: '단기 우하향 · 장기 수직(자연실업률)' },
  'GDP':               { law: null, art: null, note: '생산·소득·지출 접근 · 삼면등가' },
  '승수':               { law: null, art: null, note: '1/(1-MPC) · 한계소비성향과 역관계' },
  '환율':               { law: null, art: null, note: '구매력평가·이자율평가·환율제도' },
  '통화정책':           { law: null, art: null, note: '기준금리·공개시장운영·지급준비제도' },
  '정부지출':           { law: null, art: null, note: '재정정책 · 총수요 확대 · 구축효과' },
  '소비자이론':         { law: null, art: null, note: '효용극대화 · MU/P 균등법칙' },
  '생산함수':           { law: null, art: null, note: '규모의 경제·한계생산체감·기술진보' },
  '콥더글러스':         { law: null, art: null, note: 'Q = A·K^α·L^β · 동차함수' },
  '공공재':             { law: null, art: null, note: '비경합성·비배제성 → 무임승차' },
  '외부효과':           { law: null, art: null, note: '사회적비용≠사적비용 · 피구세·코즈정리' },
  '게임이론':           { law: null, art: null, note: '내쉬균형·죄수의 딜레마·순차게임' },
  '기대효용':           { law: null, art: null, note: '위험회피·위험중립·위험선호' }
};

// ============ 과목 분류 ============
function subjectCategory(subject) {
  if (['노동법1', '노동법2', '민법', '사회보험법'].includes(subject)) return 'law';
  if (['경영학', '경제학'].includes(subject)) return 'theory';
  return 'other';
}

// ============ 과목별 기본 법령/이론 틀 ============
const DEFAULT_LAW_BY_SUBJECT = {
  '노동법1':   '근로기준법 · 산업안전보건법 · 최저임금법 · 근로자퇴직급여보장법 · 남녀고용평등법',
  '노동법2':   '노동조합 및 노동관계조정법 · 노동위원회법 · 근로자참여 및 협력증진에 관한 법률',
  '민법':       '민법 총칙 · 채권 · 물권',
  '사회보험법': '국민연금법 · 국민건강보험법 · 고용보험법 · 산업재해보상보험법',
  '경영학':     '경영학 일반 · 조직 · 인사 · 마케팅 · 재무 · 생산 · 회계',
  '경제학':     '미시경제학 · 거시경제학 · 노동경제학'
};

// ============ 문제 유형 감지 ============
function detectQuestionType(qtext) {
  const t = (qtext || '').replace(/\s/g, '');
  if (/옳지않은|틀린|잘못된|아닌것|해당하지않는|옳지아니한/.test(t)) return 'negative';
  if (/가장적절|가장옳|가장타당|가장바른/.test(t)) return 'best';
  if (/옳은것|맞는것|타당한것|바른것|해당하는것|적절한것/.test(t)) return 'positive';
  if (/설명으로/.test(t)) return 'positive';
  return 'unknown';
}

// ============ 보기 정리 헬퍼 ============
function cleanOption(text) {
  if (!text) return '';
  return String(text).replace(/^[①-⑤⓵-⓹]\s*|^\d+[\.\)]\s*/, '').trim();
}

// ============ 보기별 요약 (짧게) ============
function summarizeOption(text, maxLen = 45) {
  const cleaned = cleanOption(text);
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen) + '…';
}

// ============ 메인 enrichment 함수 ============
function generateEnrichedExplanation(q) {
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5]
    .map(o => o || '').filter(o => String(o).trim());
  const correctNum = parseInt(q.correct_answer);
  const correctText = cleanOption(opts[correctNum - 1] || '');
  const qtype = detectQuestionType(q.question_text);
  const cat = subjectCategory(q.subject);
  const existingExp = (q.explanation || '').trim();
  const keyword = (q.keyword || '').trim();
  const keywords = keyword.split(/[,·\/]/).map(k => k.trim()).filter(Boolean);

  let out = '';

  // ====== 【정답 분석】 ======
  out += '【정답 분석】\n';
  if (qtype === 'negative') {
    out += `정답은 ${correctNum}번입니다. 문제가 "옳지 않은 것"을 요구하므로, ${correctNum}번 보기가 해당 법령·이론의 원칙과 부합하지 않는 설명입니다.`;
  } else if (qtype === 'positive') {
    out += `정답은 ${correctNum}번입니다. ${correctNum}번 보기가 관련 법령·이론의 내용을 정확히 반영하고 있는 반면, 나머지 보기에는 세부적인 오류가 포함되어 있습니다.`;
  } else if (qtype === 'best') {
    out += `정답은 ${correctNum}번입니다. 나머지 보기도 부분적으로 관련된 내용일 수 있으나, ${correctNum}번이 가장 정확하고 포괄적인 설명입니다.`;
  } else {
    out += `정답은 ${correctNum}번입니다. ${correctText ? '핵심은 "' + summarizeOption(correctText, 70) + '" 입니다.' : ''}`;
  }
  if (existingExp) {
    out += ` 핵심 포인트는 「${existingExp}」로 요약할 수 있습니다.`;
  }
  out += '\n\n';

  // ====== 【오답 분석】 ======
  out += '【오답 분석】\n';
  const wrongNums = [];
  for (let i = 0; i < opts.length; i++) {
    if ((i + 1) !== correctNum) wrongNums.push(i + 1);
  }
  if (qtype === 'negative') {
    out += `${wrongNums.join('·')}번 보기는 모두 해당 법령·이론과 일치하는 올바른 설명이므로 "옳지 않은 것"에 해당하지 않습니다. 각 보기의 세부 문언이 실제 조문·이론과 부합하는지 하나씩 대조하며 학습하는 것이 이 유형의 핵심입니다.`;
  } else if (qtype === 'positive') {
    out += `${wrongNums.join('·')}번 보기는 법령·이론의 세부 내용이나 적용 범위에 오류가 있어 정답이 될 수 없습니다. 특히 숫자(기간·비율·연령)나 요건(누가·언제·어떤 경우)의 미세한 차이를 놓치지 않는 것이 중요합니다.`;
  } else if (qtype === 'best') {
    out += `${wrongNums.join('·')}번 보기는 부분적으로 맞는 내용이지만 정확성이나 완결성에서 ${correctNum}번에 미치지 못합니다.`;
  } else {
    out += `${wrongNums.join('·')}번 보기는 관련 법령·이론과 일치하지 않거나 범위를 벗어나므로 정답이 될 수 없습니다.`;
  }
  out += '\n\n';

  // ====== 【관련 법령/개념】 ======
  if (cat === 'law') {
    out += '【관련 법령·조문】\n';
    const related = [];
    const seenLaws = new Set();
    for (const k of keywords) {
      const m = KEYWORD_LAW[k];
      if (m && m.law) {
        const key = m.law + (m.art || '');
        if (!seenLaws.has(key)) {
          seenLaws.add(key);
          related.push(`• ${k}${m.law ? ' → ' + m.law : ''}${m.art ? ' ' + m.art : ''}${m.note ? ' (' + m.note + ')' : ''}`);
        }
      }
    }
    if (related.length) {
      out += related.join('\n');
    } else {
      out += `이 문제는 ${DEFAULT_LAW_BY_SUBJECT[q.subject] || q.subject} 영역의 내용을 다루고 있습니다.`;
      if (keywords.length) out += ` 핵심 키워드는 "${keywords.join(', ')}"이며, 관련 조항을 확인하세요.`;
    }
    out += '\n\n';
  } else if (cat === 'theory') {
    out += '【핵심 개념】\n';
    const concepts = [];
    for (const k of keywords) {
      const m = KEYWORD_LAW[k];
      if (m && m.note) concepts.push(`• ${k}: ${m.note}`);
    }
    if (concepts.length) {
      out += concepts.join('\n');
    } else if (keywords.length) {
      out += `관련 개념: ${keywords.join(', ')}`;
    } else {
      out += `${DEFAULT_LAW_BY_SUBJECT[q.subject] || q.subject} 영역의 문제입니다.`;
    }
    out += '\n\n';
  }

  // ====== 【학습 포인트】 ======
  out += '【학습 포인트】\n';
  if (qtype === 'negative') {
    out += '"옳지 않은 것" 유형은 5개 보기 중 하나의 오류를 찾는 문제이므로, 각 보기의 세부 문언(주체·요건·숫자·예외)을 정확히 대조해야 합니다. 평소 조문·교과서의 정확한 표현을 암기하고, 빈번히 함정이 되는 숫자와 예외규정을 별도로 정리해 두세요.';
  } else if (qtype === 'positive') {
    out += '"옳은 것" 유형은 정확한 설명을 찾는 문제이므로, 나머지 4개 보기에서 무엇이 잘못되었는지를 빠르게 파악하는 훈련이 필요합니다. 보기 간 비교를 통해 함정 포인트를 체크하고, 출제빈도가 높은 키워드 중심으로 법조문을 반복 학습하세요.';
  } else if (qtype === 'best') {
    out += '"가장 적절한 것" 유형은 상대적 우수성을 판단해야 합니다. 보기를 모두 읽은 뒤 정확성·포괄성·최신성을 기준으로 순위를 매겨 선택하세요.';
  } else {
    out += '이 유형은 관련 법령·이론의 핵심 내용을 정확히 알고 있는지 확인하는 문제입니다. 키워드와 연결되는 조문·개념을 체계적으로 정리해두면 유사 문제에도 대응할 수 있습니다.';
  }

  return out;
}

module.exports = { generateEnrichedExplanation, detectQuestionType, subjectCategory, KEYWORD_LAW };
