/* =========================================================================
   숲결 (Soopgyeol) — 산림치유 맞춤 추천 프로토타입
   data.js : 치유의 숲 12곳 실데이터 + 기상 시나리오 + 권역 이동시간
   -------------------------------------------------------------------------
   · 좌표는 카카오맵 주소 지오코딩 결과(대표 지점)
   · 해발(표고)은 해당 좌표의 DEM 표고(Open-Elevation)와 기관 공개자료를 대조
   · 수종·영급·주요시설은 산림청 숲나들e·한국산림복지진흥원·지자체 공개자료 기준
   · 프로그램 명칭·시간은 기관 공개 프로그램을 바탕으로 정리(일부 시연용 재구성)
   ========================================================================= */

const FORESTS = [
  {
    id: 'daslim',
    name: '국립산림치유원 다스림',
    short: '다스림',
    region: '경상',
    sido: '경북',
    sigungu: '영주시 봉현면·예천군 효자면',
    address: '경북 영주시 봉현면 테라피로 209',
    lat: 36.8578, lng: 128.4726,
    operator: '국립',
    org: '한국산림복지진흥원',
    phone: '054-639-3400',
    homepage: 'https://www.sooperang.go.kr',
    area: '중심시설지구 142ha / 전체 2,889ha',
    elevation: { base: 440, range: '해발 300~900m' },
    terrain: '보통',
    terrainNote: '백두대간 능선~계곡, 숲길 9개 코스(마실길은 경사 8% 이하)',
    access: '근교형',
    barrierFree: true,
    barrierNote: '마실치유숲길 데크로드 경사 8% 이하, 휠체어·유모차 동행 가능',
    forestType: '혼효림',
    species: [
      { name: '소나무', pct: 30 },
      { name: '상수리나무', pct: 25 },
      { name: '굴참나무', pct: 20 },
      { name: '잣나무', pct: 12 },
      { name: '기타 활엽수', pct: 13 }
    ],
    ageClass: 'IV~VI영급 장령림',
    canopy: '상',
    factors: ['피톤치드', '음이온', '경관', '열쾌적성', '수(水)치유'],
    feature: '백두대간 산림자원을 활용한 국내 유일의 산림복지단지형 치유원. 숙박·수치유센터·건강증진센터를 갖춰 기상 변화에 대한 실내 대체 폭이 가장 넓다.',
    shelter: 95,
    indoorFacilities: '수(水)치유센터, 건강증진센터, 명상실, 세미나실',
    seasons: '연중 운영(프로그램별 상이)',
    purpose: { stress: 90, sleep: 88, respiratory: 86, family: 88, vitality: 92 },
    cautions: [
      '단지가 영주(주치골)와 예천(문필봉) 두 지구로 나뉘어 있어 프로그램 장소를 예약 시 확인해야 한다.',
      '수치유 프로그램은 수영복·수영모 지참이 필요하고 임산부·전자기기 이식자는 이용이 제한된다.'
    ],
    programs: [
      {
        name: '숲해먹(2시간)',
        target: '전연령·가족', minutes: 120, difficulty: '낮음', setting: '실외',
        activities: '산림치유지도사와 숲길 걷기 + 해먹 이완, 맑은 공기와 경관 감상',
        tags: ['stress', 'sleep', 'family', 'vitality'],
        indoorAlt: '싱잉볼 명상(실내)'
      },
      {
        name: '싱잉볼 명상(60분)',
        target: '전연령', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '싱잉볼 공명에 집중해 심신을 안정시키는 명상',
        tags: ['sleep', 'stress'],
        indoorAlt: null
      },
      {
        name: '수(水)치유 아쿠아테라피(120분)',
        target: '성인', minutes: 120, difficulty: '보통', setting: '실내',
        activities: '아쿠아로빅·바데풀 등 수압과 부력을 이용한 혈액순환·피로회복',
        tags: ['vitality', 'stress'],
        indoorAlt: null
      },
      {
        name: '숲마실 트레킹(120분)',
        target: '성인·직장인', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '산림청 100대 명품숲길 마실치유숲길(약 5.9km) 해설 트레킹',
        tags: ['vitality', 'stress'],
        indoorAlt: '건강장비체험(실내)'
      }
    ]
  },

  {
    id: 'saneum',
    name: '산음 치유의 숲',
    short: '산음',
    region: '수도권',
    sido: '경기',
    sigungu: '양평군 단월면',
    address: '경기 양평군 단월면 윗고북길 33-39 (산음리 산84)',
    lat: 37.5870, lng: 127.5853,
    operator: '국립',
    org: '산림청 국립산음자연휴양림',
    phone: '031-774-7687',
    homepage: 'https://www.foresttrip.go.kr',
    area: '산음자연휴양림 내, 고도 200~1,000m',
    elevation: { base: 343, range: '해발 200~1,000m' },
    terrain: '보통',
    terrainNote: '9갈래 계곡과 지그재그 데크로드, 지형 기복이 커 지형요법에 적합',
    access: '근교형',
    barrierFree: true,
    barrierNote: '치유숲길 데크로드 중심, 매표소~치유센터 완만 구간',
    forestType: '혼효림',
    species: [
      { name: '낙엽송', pct: 28 },
      { name: '잣나무', pct: 22 },
      { name: '상수리나무', pct: 18 },
      { name: '자작나무', pct: 12 },
      { name: '기타 활엽수', pct: 20 }
    ],
    ageClass: 'III~V영급',
    canopy: '상',
    factors: ['피톤치드', '음이온', '경관', '계곡수'],
    feature: '국내 1호 치유의 숲. 해발 200~1,000m의 고도 분포와 계곡 지형을 활용해 기후요법·운동요법을 함께 적용할 수 있다.',
    shelter: 62,
    indoorFacilities: '건강증진센터, 숲속체조실, 자연치유정원',
    seasons: '4~11월 예약제·당일 프로그램(동절기 축소)',
    purpose: { stress: 94, sleep: 86, respiratory: 90, family: 84, vitality: 88 },
    cautions: [
      '계곡을 끼고 있어 비가 온 뒤에는 데크가 미끄럽고 계곡물이 불어날 수 있다.',
      '당일 프로그램은 오전 10:30·오후 2시 2회로 시간을 맞춰야 한다.'
    ],
    programs: [
      {
        name: '해오름숲(2030 직장인)',
        target: '2030 직장인', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '숲 오리엔테이션, 하늘경보기, 숲속 오감 체험, 음이온 소리명상',
        tags: ['stress', 'vitality'],
        indoorAlt: '건강증진센터 실내 명상'
      },
      {
        name: '화목의숲(가족)',
        target: '가족', minutes: 120, difficulty: '낮음', setting: '실외',
        activities: '소원아 소원아, 맨발 체험, 꽃편지 쓰기, 숲속 오감놀이',
        tags: ['family', 'stress'],
        indoorAlt: '숲속체조실 실내 프로그램'
      },
      {
        name: '응원의숲(돌봄 종사자·환자 가족)',
        target: '돌봄 종사자·암 환자 가족', minutes: 120, difficulty: '낮음', setting: '실내외',
        activities: '지그재그 데크 산책, 음이온 소리명상, 호흡·이완 중심 진행',
        tags: ['stress', 'respiratory', 'sleep'],
        indoorAlt: '실내 호흡·이완 명상'
      }
    ]
  },

  {
    id: 'daegwallyeong',
    name: '국립대관령치유의숲',
    short: '대관령',
    region: '강원',
    sido: '강원',
    sigungu: '강릉시 성산면',
    address: '강원 강릉시 성산면 대관령옛길 127-42',
    lat: 37.7077, lng: 128.7988,
    operator: '국립',
    org: '한국산림복지진흥원',
    phone: '033-642-8650',
    homepage: 'https://www.sooperang.go.kr',
    area: '224ha(중심시설지구 759.69㎡)',
    elevation: { base: 290, range: '해발 290~700m' },
    terrain: '보통',
    terrainNote: '대관령 옛길을 따라 완만한 능선, 숲향기숲길·데크로드 조성',
    access: '근교형',
    barrierFree: true,
    barrierNote: '숲향기숲길 데크로드로 흙길을 거치지 않고 관통 가능',
    forestType: '침엽수림',
    species: [
      { name: '금강송', pct: 62 },
      { name: '참나무류', pct: 22 },
      { name: '편백', pct: 16 }
    ],
    ageClass: 'V~VI영급(수령 90년생 이상)',
    canopy: '상',
    factors: ['피톤치드(솔향)', '경관', '음이온', '차광'],
    feature: '수령 90년생 이상 금강송이 뿜어내는 솔 향이 가득한 숲. 산포암폭포와 금강송 전망대, 명상치유움막을 갖췄다.',
    shelter: 66,
    indoorFacilities: '치유센터(건강측정실), 명상치유움막',
    seasons: '사전예약제 상시 운영',
    purpose: { stress: 90, sleep: 88, respiratory: 92, family: 80, vitality: 84 },
    cautions: [
      '대관령 특성상 여름에도 아침 기온이 크게 떨어지고 바람이 강하다.',
      '숙박·식당을 운영하지 않아 당일 프로그램으로 이용해야 한다.'
    ],
    programs: [
      {
        name: '솔향기 숲길 명상(90분)',
        target: '전연령', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '금강송 숲길을 천천히 걸으며 솔 향에 집중하는 호흡 명상',
        tags: ['stress', 'respiratory', 'sleep'],
        indoorAlt: '명상치유움막 명상'
      },
      {
        name: '금강송 전망대 숲길 걷기(120분)',
        target: '성인', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '숲향기숲길~금강송 전망대~산포암폭포를 잇는 경관 트레킹',
        tags: ['vitality', 'stress'],
        indoorAlt: '치유센터 건강측정·실내 명상'
      },
      {
        name: '명상치유움막 프로그램(60분)',
        target: '전연령', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '움막 안에서의 소리·호흡 명상, 스트레스 지표 측정',
        tags: ['sleep', 'stress'],
        indoorAlt: null
      }
    ]
  },

  {
    id: 'cheongtaesan',
    name: '청태산 치유의 숲',
    short: '청태산',
    region: '강원',
    sido: '강원',
    sigungu: '횡성군 둔내면',
    address: '강원 횡성군 둔내면 청태산로 777',
    lat: 37.5372, lng: 128.2867,
    operator: '국립',
    org: '한국산림복지진흥원(국립횡성숲체원)',
    phone: '033-340-6300',
    homepage: 'https://www.sooperang.go.kr',
    area: '치유숲길 23km, 숲체원 30ha',
    elevation: { base: 849, range: '해발 700~1,050m' },
    terrain: '산악',
    terrainNote: '청태산 자락 고지대, 잣나무·낙엽송림 사이 23km 숲길',
    access: '산악형',
    barrierFree: true,
    barrierNote: '자작나무숲 구간 데크로드(무장애), 숲체원 진입로 완만',
    forestType: '침엽수림',
    species: [
      { name: '잣나무', pct: 45 },
      { name: '낙엽송', pct: 35 },
      { name: '자작나무', pct: 12 },
      { name: '기타 활엽수', pct: 8 }
    ],
    ageClass: 'IV~V영급',
    canopy: '상',
    factors: ['피톤치드', '음이온', '경관(하늘숲길)', '열쾌적성(고지대)'],
    feature: '해발 850m 청태산의 잣나무·낙엽송림. 늘솔길 하늘숲길과 숙박형 숲체원이 결합해 여름철 열쾌적성이 뛰어나다.',
    shelter: 90,
    indoorFacilities: '산림치유센터(열치유실·물치유실·명상치유실), 숙박동·식당',
    seasons: '연중(숙박 연계 프로그램)',
    purpose: { stress: 88, sleep: 92, respiratory: 94, family: 82, vitality: 86 },
    cautions: [
      '해발 850m 고지대로 기온이 도심보다 4~5℃ 낮고 바람이 강하다.',
      '숲길 경사가 있는 구간이 있어 보행 약자는 무장애 데크 구간을 선택해야 한다.'
    ],
    programs: [
      {
        name: '스트레스 타파 숲명상(120분)',
        target: '성인·직장인', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '잣나무 숲길 걷기, 풍욕, 숲명상, 스트레스 지수 측정',
        tags: ['stress', 'sleep'],
        indoorAlt: '열치유실·명상치유실 프로그램'
      },
      {
        name: '늘솔길 잣나무 숲길 걷기(90분)',
        target: '전연령·가족', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '하늘로 뻗은 잣나무 숲길 산책, 오감 체험, 자작나무숲 데크',
        tags: ['family', 'respiratory', 'vitality'],
        indoorAlt: '산림치유센터 실내 체험'
      },
      {
        name: '열·물치유실 프로그램(60분)',
        target: '성인', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '온열 이완과 물치유를 이용한 근육 이완·피로 회복',
        tags: ['sleep', 'vitality'],
        indoorAlt: null
      }
    ]
  },

  {
    id: 'jangseong',
    name: '장성 편백 치유의 숲',
    short: '장성 편백',
    region: '전라',
    sido: '전남',
    sigungu: '장성군 서삼면',
    address: '전남 장성군 서삼면 추암로 716 (축령산)',
    lat: 35.3688, lng: 126.7315,
    operator: '공립',
    org: '장성군(치유의 숲 안내센터)',
    phone: '061-393-1777',
    homepage: 'https://www.jangseong.go.kr',
    area: '치유의 숲 378ha / 축령산 편백숲 1,150ha',
    elevation: { base: 421, range: '해발 200~620m' },
    terrain: '완만',
    terrainNote: '축령산 7부 능선을 비스듬히 가로지르는 임도, 경사 완만',
    access: '근교형',
    barrierFree: true,
    barrierNote: '산소길·편백 칩로드·습지데크, 어린이·노인 동반 가능',
    forestType: '침엽수림',
    species: [
      { name: '편백', pct: 58 },
      { name: '삼나무', pct: 30 },
      { name: '낙엽송', pct: 6 },
      { name: '참나무류', pct: 6 }
    ],
    ageClass: 'V~VI영급(수령 50~70년생)',
    canopy: '상',
    factors: ['피톤치드(편백향)', '차광', '경관', '음이온'],
    feature: '국내 최대 규모 편백 인공조림지. 편백·삼나무가 전체 수종의 88%를 차지하고 4개 테마 숲길 10.2km가 조성되어 있다.',
    shelter: 60,
    indoorFacilities: '안내센터, 전망대 2개소, 습지데크',
    seasons: '연중(입장 무료)',
    purpose: { stress: 93, sleep: 90, respiratory: 88, family: 86, vitality: 80 },
    cautions: [
      '편백숲 그늘은 강하지만 조림지 특성상 비 온 뒤 칩로드가 질척해진다.',
      '축령산 내 도로는 차량 통행이 금지되어 주차장에서 도보로 진입한다.'
    ],
    programs: [
      {
        name: '하늘숲길 편백 명상(90분)',
        target: '전연령', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '편백 숲 사이 하늘바라기 쉼터에서의 누워서 명상, 향기 호흡',
        tags: ['stress', 'sleep', 'respiratory'],
        indoorAlt: '안내센터 편백 향 테라피'
      },
      {
        name: '산소길 건강 걷기(120분)',
        target: '성인', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '23.6km 산소길 중 4개 구간을 골라 걷는 경사 완만 트레킹',
        tags: ['vitality', 'stress'],
        indoorAlt: '안내센터 실내 프로그램'
      },
      {
        name: '편백 향 테라피·족욕(60분)',
        target: '시니어·가족', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '편백 정유 향 테라피와 족욕으로 말초 혈액순환 이완',
        tags: ['sleep', 'family', 'stress'],
        indoorAlt: null
      }
    ]
  },

  {
    id: 'seogwipo',
    name: '서귀포 치유의 숲',
    short: '서귀포',
    region: '제주',
    sido: '제주',
    sigungu: '서귀포시 호근동',
    address: '제주 서귀포시 산록남로 2271',
    lat: 33.2919, lng: 126.5279,
    operator: '공립',
    org: '서귀포시(산림휴양관리소)',
    phone: '064-760-3067',
    homepage: 'https://www.seogwipo.go.kr/healing',
    area: '국유림 174ha',
    elevation: { base: 447, range: '해발 320~760m' },
    terrain: '보통',
    terrainNote: '시오름 일대 사면, 숲길 0.6~2.1km로 짧게 조성',
    access: '근교형',
    barrierFree: true,
    barrierNote: '노고록 무장애 나눔길(경사 5~8도), 휠체어 이용 가능한 혼디족욕장',
    forestType: '혼효림',
    species: [
      { name: '편백', pct: 38 },
      { name: '삼나무', pct: 30 },
      { name: '동백나무', pct: 14 },
      { name: '난대 활엽수', pct: 18 }
    ],
    ageClass: 'VI영급 이상(평균 60년생)',
    canopy: '상',
    factors: ['피톤치드', '음이온', '경관(한라산 조망)', '차광'],
    feature: '해발 320~760m에 난대림·온대림·한대림이 함께 분포하는 유일한 치유의 숲. 평균 수령 60년 이상 편백숲과 동백숲이 있다.',
    shelter: 82,
    indoorFacilities: '방문자센터, 힐링치유센터, 힐링하우스, 숲속요가교실',
    seasons: '연중(하절기 08:00~16:00 / 동절기 09:00~16:00, 예약제)',
    purpose: { stress: 92, sleep: 86, respiratory: 88, family: 90, vitality: 84 },
    cautions: [
      '입장은 온라인 사전예약제이며 기상특보 시 입산이 통제된다.',
      '운동화 또는 등산화 착용 필수(슬리퍼·구두 입장 제한).'
    ],
    programs: [
      {
        name: '가멍오멍 숲길 걷기(해설, 120분)',
        target: '전연령', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '놀멍·쉬멍·오고생이 숲길을 해설사와 걷는 제주 숲길 탐방',
        tags: ['stress', 'family', 'vitality'],
        indoorAlt: '힐링치유센터 실내 프로그램'
      },
      {
        name: '노고록 무장애 나눔길(60분)',
        target: '시니어·가족·교통약자', minutes: 60, difficulty: '낮음', setting: '실외',
        activities: '경사 5~8도 데크 산책, 편백숲 쉼팡, 혼디족욕장',
        tags: ['family', 'sleep'],
        indoorAlt: '힐링하우스 휴식'
      },
      {
        name: '숲속 요가·명상(60분)',
        target: '성인', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '숲속요가교실에서의 호흡 요가와 바디스캔 명상',
        tags: ['sleep', 'stress', 'respiratory'],
        indoorAlt: null
      }
    ]
  },

  {
    id: 'jecheon',
    name: '국립제천치유의숲',
    short: '제천',
    region: '충청',
    sido: '충북',
    sigungu: '제천시 청풍면',
    address: '충북 제천시 청풍면 학현소야로 590',
    lat: 37.0128, lng: 128.2447,
    operator: '국립',
    org: '한국산림복지진흥원',
    phone: '043-653-0246',
    homepage: 'https://www.sooperang.go.kr',
    area: '61.3ha',
    elevation: { base: 526, range: '해발 250~700m' },
    terrain: '보통',
    terrainNote: '청풍호를 낀 산지, 치유숲길 4곳(건강·음이온·숲내음·자작나무)',
    access: '근교형',
    barrierFree: true,
    barrierNote: '치유센터 주변 데크로드, 일부 숲길은 계단 구간 포함',
    forestType: '활엽수림',
    species: [
      { name: '참나무류(신갈·굴참)', pct: 55 },
      { name: '소나무', pct: 25 },
      { name: '자작나무', pct: 10 },
      { name: '기타 활엽수', pct: 10 }
    ],
    ageClass: 'IV영급',
    canopy: '중',
    factors: ['피톤치드', '음이온', '한방 약초 향', '경관(청풍호)'],
    feature: '한방 약초원과 풍부한 수계를 함께 활용하는 국립 치유의 숲. 사상체질·한방차 테라피 등 실내 비중이 높다.',
    shelter: 88,
    indoorFacilities: '치유센터(세미나실·족욕·차 테라피실), 약초원',
    seasons: '사전예약제 상시(단체 프로그램 중심)',
    purpose: { stress: 88, sleep: 82, respiratory: 84, family: 84, vitality: 86 },
    cautions: [
      '단체(10인 이상) 중심 운영이라 개인은 상시프로그램 시간을 확인해야 한다.',
      '약초원·한방차 프로그램은 계절에 따라 재료가 달라진다.'
    ],
    programs: [
      {
        name: '사상체질차테라피(60분)',
        target: '일반', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '사상체질 테스트 + 한방온열족욕 + 체질별 차 시음 (7,000원/인)',
        tags: ['sleep', 'stress', 'family'],
        indoorAlt: null
      },
      {
        name: '활인심방숲테라피(120분)',
        target: '전연령', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '힐링트레킹 + 활인심방(동양 고전 기반 심신 수련) (10,000원/인)',
        tags: ['stress', 'vitality'],
        indoorAlt: '치유센터 실내 차 테라피'
      },
      {
        name: '한방힐링숲테라피(180분)',
        target: '전연령', minutes: 180, difficulty: '보통', setting: '실내외',
        activities: '힐링트레킹 + 활인심방 + 한방차테라피 (16,000원/인)',
        tags: ['respiratory', 'sleep', 'stress'],
        indoorAlt: '실내 약초·차 테라피로 전환'
      }
    ]
  },

  {
    id: 'daeunsan',
    name: '국립대운산치유의숲',
    short: '대운산',
    region: '경상',
    sido: '울산',
    sigungu: '울주군 온양읍',
    address: '울산 울주군 온양읍 대운상대길 225-92',
    lat: 35.3902, lng: 129.2362,
    operator: '국립',
    org: '한국산림복지진흥원',
    phone: '052-237-8600',
    homepage: 'https://www.sooperang.go.kr',
    area: '25ha',
    elevation: { base: 126, range: '해발 130~500m' },
    terrain: '보통',
    terrainNote: '대운산 청량한 계곡을 따라 풀향기길·바람뜰치유길·명품숲길',
    access: '근교형',
    barrierFree: true,
    barrierNote: '무장애데크길, 물치유욕장·황토마당·하늘정원',
    forestType: '혼효림',
    species: [
      { name: '편백', pct: 34 },
      { name: '굴참나무', pct: 30 },
      { name: '산철쭉', pct: 12 },
      { name: '산딸나무', pct: 10 },
      { name: '기타 활엽수', pct: 14 }
    ],
    ageClass: 'IV영급',
    canopy: '중',
    factors: ['피톤치드', '음이온(계곡)', '경관', '황토'],
    feature: '대운산 계곡을 낀 소규모 집중형 치유의 숲. 물치유욕장·황토마당 등 감각 자극 시설과 호흡기 특화 프로그램이 강점.',
    shelter: 90,
    indoorFacilities: '나눔힐링센터(세미나실·온열치유실), 황토마당',
    seasons: '사전예약제 상시',
    purpose: { stress: 84, sleep: 86, respiratory: 92, family: 88, vitality: 84 },
    cautions: [
      '계곡 물치유 시설은 기온이 낮은 날 이용이 제한될 수 있다.',
      '온열치유(건식 반신욕)는 임산부·전자기기 이식자는 이용 불가.'
    ],
    programs: [
      {
        name: '숲·숨·쉼(120분)',
        target: '전연령', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '호흡기 건강을 위한 걷기 자세·체조·명상·차 테라피',
        tags: ['respiratory', 'stress', 'sleep'],
        indoorAlt: '나눔힐링센터 실내 호흡 명상'
      },
      {
        name: '소담길(120분)',
        target: '가족', minutes: 120, difficulty: '낮음', setting: '실외',
        activities: '우드코스터로 소원표 만들기, 소원나무 꾸미기, 맨발걷기',
        tags: ['family', 'stress'],
        indoorAlt: '온기드림(실내 공예)'
      },
      {
        name: '온열치유·아로마(60분)',
        target: '성인·시니어', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '건식 반신욕기 체험과 아로마 스프레이 만들기',
        tags: ['sleep', 'vitality'],
        indoorAlt: null
      }
    ]
  },

  {
    id: 'chilgok',
    name: '국립칠곡숲체원(유학산 숲)',
    short: '칠곡',
    region: '경상',
    sido: '경북',
    sigungu: '칠곡군 석적읍',
    address: '경북 칠곡군 석적읍 유학로 532',
    lat: 36.0639, lng: 128.4660,
    operator: '국립',
    org: '한국산림복지진흥원',
    phone: '054-977-8773',
    homepage: 'https://www.sooperang.go.kr',
    area: '30ha(숲속 호수 포함)',
    elevation: { base: 240, range: '해발 240~700m' },
    terrain: '보통',
    terrainNote: '유학산 자락, 다누리길 1.5km 무장애 데크 포함 3km 숲길',
    access: '근교형',
    barrierFree: true,
    barrierNote: '다누리길 무장애 데크로드 1.5km(호수를 끼고 순환)',
    forestType: '혼효림',
    species: [
      { name: '소나무', pct: 32 },
      { name: '참나무류', pct: 34 },
      { name: '낙엽송', pct: 14 },
      { name: '기타 활엽수', pct: 20 }
    ],
    ageClass: 'III~IV영급',
    canopy: '중',
    factors: ['피톤치드', '음이온(호수)', '경관', '수변'],
    feature: '숲속에 호수를 낀 전국 유일의 숲체원. 무장애 데크로드와 숙박·대강당을 갖춰 가족·단체 시연에 적합하다.',
    shelter: 88,
    indoorFacilities: '대강당·회의실·식당·숙박동, 유아숲체험원',
    seasons: '연중(숙박 연계)',
    purpose: { stress: 82, sleep: 80, respiratory: 84, family: 92, vitality: 80 },
    cautions: [
      '숲체험·산림교육 중심 시설로 산림치유 전문 프로그램은 별도 예약이 필요하다.',
      '호수 주변은 안전요원 없이 수변 접근이 제한된다.'
    ],
    programs: [
      {
        name: '다누리길 무장애 숲길 산책(90분)',
        target: '시니어·가족·교통약자', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '호수를 끼고 도는 1.5km 무장애 데크로드 산책과 숲해설',
        tags: ['family', 'stress', 'sleep'],
        indoorAlt: '대강당 실내 숲해설'
      },
      {
        name: '숲속탐험대 Forest Go(180분)',
        target: '청소년', minutes: 180, difficulty: '보통', setting: '실내외',
        activities: '스마트폰 미션 수행형 숲 탐험, 조별 협동 활동',
        tags: ['vitality', 'family'],
        indoorAlt: '실내 미션형 프로그램'
      },
      {
        name: '오감빙고 숲해설(120분)',
        target: '가족', minutes: 120, difficulty: '낮음', setting: '실외',
        activities: '오감을 활용한 빙고 미션과 숲해설',
        tags: ['family', 'stress'],
        indoorAlt: '실내 자연물 공예'
      }
    ]
  },

  {
    id: 'yesan',
    name: '국립예산치유의숲',
    short: '예산',
    region: '충청',
    sido: '충남',
    sigungu: '예산군 예산읍',
    address: '충남 예산군 예산읍 치유숲길 203-31',
    lat: 36.7032, lng: 126.8596,
    operator: '국립',
    org: '한국산림복지진흥원',
    phone: '041-339-8930',
    homepage: 'https://www.sooperang.go.kr',
    area: '134ha(중심시설지구 877.69㎡)',
    elevation: { base: 156, range: '해발 160~410m' },
    terrain: '완만',
    terrainNote: '관모산·용굴산 사이 골짜기, 둘레길 1,285m·하늘데크길 154m',
    access: '도심형',
    barrierFree: true,
    barrierNote: '완만한 둘레길과 데크로드, 읍내에서 차로 5분',
    forestType: '혼효림',
    species: [
      { name: '소나무', pct: 40 },
      { name: '상수리·굴참나무', pct: 34 },
      { name: '기타 활엽수', pct: 26 }
    ],
    ageClass: 'IV영급',
    canopy: '중',
    factors: ['피톤치드(솔향)', '음이온', '경관', '차광'],
    feature: '예산읍내에서 차로 5분, 소나무·참나무가 70% 이상인 낮고 깊은 숲. 접근성이 가장 뛰어난 도심형 치유의 숲.',
    shelter: 84,
    indoorFacilities: '치유센터(강당·체험실), 건강측정',
    seasons: '사전예약제 상시',
    purpose: { stress: 86, sleep: 84, respiratory: 90, family: 88, vitality: 82 },
    cautions: [
      '해발 300~400m의 낮은 산으로 한여름에는 습도가 높게 느껴질 수 있다.',
      '대중교통으로는 터미널에서 3km 도보·택시 이동이 필요하다.'
    ],
    programs: [
      {
        name: '숲속 명상(싱잉볼, 90분)',
        target: '가족·5인 이상', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '면역증진 스트레칭과 싱잉볼 명상, 솔향기 숲길 걷기',
        tags: ['sleep', 'stress', 'respiratory'],
        indoorAlt: '치유센터 실내 명상'
      },
      {
        name: '숲속 오감힐링(120분)',
        target: '가족', minutes: 120, difficulty: '낮음', setting: '실내외',
        activities: '오일테라피·티테라피·자연교감 활동',
        tags: ['family', 'stress', 'sleep'],
        indoorAlt: '실내 오일·티테라피'
      },
      {
        name: '비움숲(직장인, 120분)',
        target: '직장인', minutes: 120, difficulty: '보통', setting: '실외',
        activities: '산림욕 체조, 트리허그, 둘레길 걷기로 긴장 이완',
        tags: ['stress', 'vitality'],
        indoorAlt: '실내 이완 체조'
      }
    ]
  },

  {
    id: 'hwasun',
    name: '만연산 치유의 숲',
    short: '만연산',
    region: '전라',
    sido: '전남',
    sigungu: '화순군 화순읍',
    address: '전남 화순군 화순읍 진각로 357-44',
    lat: 35.0848, lng: 126.9820,
    operator: '공립',
    org: '화순군',
    phone: '061-379-5896',
    homepage: 'https://www.hwasun.go.kr',
    area: '120ha',
    elevation: { base: 206, range: '해발 205~610m' },
    terrain: '완만',
    terrainNote: '경사 9% 이하 무계단 오감연결길 3.1km + 치유숲길 3.3km',
    access: '근교형',
    barrierFree: true,
    barrierNote: '오감연결길 전 구간 무계단·야자매트·데크, 유모차·휠체어 가능',
    forestType: '혼효림',
    species: [
      { name: '소나무', pct: 36 },
      { name: '참나무류', pct: 30 },
      { name: '삼나무', pct: 22 },
      { name: '수국·야생화', pct: 12 }
    ],
    ageClass: 'III~IV영급',
    canopy: '상',
    factors: ['피톤치드', '음이온', '경관', '차광'],
    feature: '계단이 하나도 없는 무장애 숲길(오감연결길 3.1km)과 삼나무 치유숲길을 함께 갖춘 공립 치유의 숲. 프로그램이 무료다.',
    shelter: 86,
    indoorFacilities: '치유의 숲 센터(치유체험실·자가검진실·족욕·VR)',
    seasons: '화~일 10:00~17:00 (월요일 휴무)',
    purpose: { stress: 88, sleep: 82, respiratory: 84, family: 90, vitality: 86 },
    cautions: [
      '매주 월요일과 1월 1일, 설·추석 당일은 센터를 운영하지 않는다.',
      '프로그램은 5일 전까지 예약해야 하고 만연탐방지원센터에 집결한다.'
    ],
    programs: [
      {
        name: '오감연결길 걷기(90분)',
        target: '전연령', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '보고·듣고·맡고·맛보고·만지며 걷는 무계단 3.1km 숲길',
        tags: ['family', 'stress', 'vitality'],
        indoorAlt: '치유센터 실내 프로그램'
      },
      {
        name: '숲하고 나하고 너나들이(90분)',
        target: '가족·단체', minutes: 90, difficulty: '낮음', setting: '실외',
        activities: '계절 변화를 따라 함께 걷는 탐방형 산림치유(3~50명)',
        tags: ['family', 'stress'],
        indoorAlt: '실내 자연물 공예'
      },
      {
        name: '치유센터 명상·요가·족욕(60분)',
        target: '시니어·성인', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '명상·요가, 편백 큐브 족욕, 자가 건강측정 (무료)',
        tags: ['sleep', 'stress', 'family'],
        indoorAlt: null
      }
    ]
  },

  {
    id: 'namhae',
    name: '남해 편백 치유의 숲',
    short: '남해 편백',
    region: '경상',
    sido: '경남',
    sigungu: '남해군 삼동면',
    address: '경남 남해군 삼동면 금암로 658 (국립남해편백자연휴양림)',
    lat: 34.7521, lng: 128.0201,
    operator: '국립',
    org: '산림청 국립남해편백자연휴양림',
    phone: '055-867-7881',
    homepage: 'https://www.foresttrip.go.kr',
    area: '편백림 중심(휴양림 내)',
    elevation: { base: 197, range: '해발 200~450m' },
    terrain: '보통',
    terrainNote: '내산저수지를 낀 편백 숲길, 완만한 산책로 중심',
    access: '산악형',
    barrierFree: true,
    barrierNote: '산림복합체험센터 주변 데크·일부 구간 무장애',
    forestType: '침엽수림',
    species: [
      { name: '편백', pct: 62 },
      { name: '삼나무', pct: 18 },
      { name: '활엽수', pct: 20 }
    ],
    ageClass: 'V영급',
    canopy: '상',
    factors: ['피톤치드(편백)', '차광', '음이온', '경관'],
    feature: '편백 향이 가득한 남해 내산저수지 숲. 숙박과 체험센터를 함께 갖춰 1박 2일 치유 일정에 적합하다.',
    shelter: 76,
    indoorFacilities: '산림복합체험센터(VR·공예실), 숙박동',
    seasons: '연중(3~11월 프로그램, 화요일 휴무)',
    purpose: { stress: 90, sleep: 88, respiratory: 86, family: 84, vitality: 78 },
    cautions: [
      '대중교통 접근이 어려워 승용차 이용이 사실상 필수다.',
      '편백숲 아토피 체험은 초등 대상으로 운영된다.'
    ],
    programs: [
      {
        name: '편백숲의 보물(120분)',
        target: '가족', minutes: 120, difficulty: '낮음', setting: '실외',
        activities: '편백 숲에서의 다양한 체험·교감 활동, 숲 이해 프로그램',
        tags: ['family', 'stress', 'respiratory'],
        indoorAlt: '산림복합체험센터 실내 체험'
      },
      {
        name: '편백 숲에서 배우며(60분)',
        target: '일반·가족', minutes: 60, difficulty: '낮음', setting: '실외',
        activities: '대표 수종 편백 알아보기, 피톤치드 향 체험',
        tags: ['family', 'respiratory'],
        indoorAlt: '실내 수종 해설'
      },
      {
        name: '나무결 꾸미기·편백 그린체험(60분)',
        target: '가족·초등', minutes: 60, difficulty: '낮음', setting: '실내',
        activities: '나무결 꾸미기 공예, 편백 건물 속 자유놀이(아토피 그린)',
        tags: ['family', 'sleep'],
        indoorAlt: null
      }
    ]
  }
];

/* 권역 간 차량 이동시간(시간, 편도·대표값) — 거리/이동 편의성 계산용 */
const TRAVEL_HOURS = {
  '수도권': { '수도권': 0.7, '강원': 1.8, '충청': 1.7, '경상': 3.5, '전라': 3.4, '제주': 2.6 },
  '강원':   { '수도권': 1.8, '강원': 1.1, '충청': 2.3, '경상': 3.2, '전라': 3.8, '제주': 3.2 },
  '충청':   { '수도권': 1.7, '강원': 2.3, '충청': 1.0, '경상': 2.6, '전라': 2.4, '제주': 3.1 },
  '전라':   { '수도권': 3.4, '강원': 3.8, '충청': 2.4, '전라': 1.2, '경상': 3.0, '제주': 3.3 },
  '경상':   { '수도권': 3.5, '강원': 3.2, '충청': 2.6, '전라': 3.0, '경상': 1.4, '제주': 3.4 },
  '제주':   { '수도권': 2.6, '강원': 3.2, '충청': 3.1, '전라': 3.3, '경상': 3.4, '제주': 0.8 }
};

/* 빠른 시나리오 프리셋 */
const SCENARIOS = {
  clear: {
    key: 'clear', label: '맑고 쾌적', sub: '봄·가을', icon: '☀️',
    temp: 19, humidity: 50, pm: 'good', rain: false, wind: 2
  },
  hot: {
    key: 'hot', label: '여름 고온다습', sub: '한낮 31℃', icon: '🔥',
    temp: 31, humidity: 82, pm: 'normal', rain: false, wind: 2
  },
  dust: {
    key: 'dust', label: '미세먼지 나쁨·건조', sub: 'PM2.5 76㎍/㎥', icon: '😷',
    temp: 14, humidity: 28, pm: 'bad', rain: false, wind: 3
  },
  rain: {
    key: 'rain', label: '비·강풍', sub: '실내 대체', icon: '🌧️',
    temp: 16, humidity: 90, pm: 'normal', rain: true, wind: 9
  }
};

const PURPOSES = {
  stress: {
    key: 'stress', label: '스트레스·번아웃 회복', icon: '🌿',
    desc: '교감신경 흥분을 낮추고 부교감을 회복하는 이완 중심',
    factors: { '음이온': 7, '경관': 6, '피톤치드': 4, '차광': 4, '열쾌적성': 5, '계곡수': 4, '수(水)치유': 4, '황토': 2, '한방 약초 향': 3, '수변': 2, '경관(청한산 조망)': 0, '경관(하늘숲길)': 3, '경관(청풍호)': 3, '경관(한라산 조망)': 4, '열쾌적성(고지대)': 4, '피톤치드(솔향)': 3, '피톤치드(편백향)': 5, '피톤치드(편백)': 5, '음이온(계곡)': 5, '음이온(호수)': 3 }
  },
  sleep: {
    key: 'sleep', label: '수면·심신 이완', icon: '🌙',
    desc: '각성도를 낮추고 야간 수면의 질을 끌어올리는 안정 중심',
    factors: { '피톤치드': 7, '음이온': 6, '차광': 4, '피톤치드(편백향)': 7, '피톤치드(솔향)': 5, '음이온(계곡)': 5, '음이온(호수)': 3, '경관': 3, '열쾌적성': 3, '열쾌적성(고지대)': 3, '수(水)치유': 3, '한방 약초 향': 3, '황토': 2, '계곡수': 3, '수변': 2 }
  },
  respiratory: {
    key: 'respiratory', label: '호흡기·면역 케어', icon: '🫁',
    desc: '피톤치드·음이온 노출을 늘리고 미세먼지 노출은 줄이는 방향',
    factors: { '피톤치드': 11, '음이온': 6, '음이온(계곡)': 7, '피톤치드(솔향)': 8, '피톤치드(편백향)': 7, '피톤치드(편백)': 7, '음이온(호수)': 3, '경관': 2, '차광': 2, '열쾌적성': 2, '열쾌적성(고지대)': 3, '한방 약초 향': 4, '수(水)치유': 2 }
  },
  family: {
    key: 'family', label: '가족·시니어 가벼운 산책', icon: '👨‍👩‍👧',
    desc: '짧은 이동·무장애 데크·낮은 난이도를 우선',
    factors: { '경관': 6, '차광': 5, '피톤치드': 3, '음이온': 2, '수변': 4, '수(水)치유': 2, '황토': 2, '음이온(호수)': 4, '경관(한라산 조망)': 4, '경관(청풍호)': 3, '경관(하늘숲길)': 3, '피톤치드(솔향)': 2, '피톤치드(편백향)': 3, '피톤치드(편백)': 2, '열쾌적성': 3 }
  },
  vitality: {
    key: 'vitality', label: '활력·집중력 회복', icon: '⚡',
    desc: '짧은 시간에 각성과 순환을 끌어올리는 활동 중심',
    factors: { '경관': 7, '피톤치드': 5, '음이온': 4, '음이온(계곡)': 5, '열쾌적성(고지대)': 5, '열쾌적성': 4, '경관(하늘숲길)': 5, '경관(한라산 조망)': 5, '계곡수': 4, '수(水)치유': 6, '수변': 3, '황토': 3, '피톤치드(솔향)': 4, '피톤치드(편백향)': 4, '피톤치드(편백)': 4, '차광': 2, '한방 약초 향': 2 }
  }
};

const REGIONS = ['수도권', '강원', '충청', '전라', '경상', '제주'];

const WALK_PREFS = {
  barrier: { key: 'barrier', label: '무장애·완만한 길', short: '무장애·완만', icon: '♿', desc: '데크로드·평지 위주, 계단 회피' },
  normal: { key: 'normal', label: '보통 산책', short: '보통 산책', icon: '🚶', desc: '1~2시간 완만한 숲길' },
  trek: { key: 'trek', label: '트레킹 가능', short: '트레킹', icon: '🥾', desc: '경사·장거리 코스도 가능' }
};

const PM_LEVELS = {
  good: { key: 'good', label: '좋음', value: '0~15㎍/㎥' },
  normal: { key: 'normal', label: '보통', value: '16~35㎍/㎥' },
  bad: { key: 'bad', label: '나쁨', value: '36㎍/㎥ 이상' }
};

/* =========================================================================
   2027 연구계획 대응 메타데이터 (연구설계 5장 '프로토타입 대조와 반영')
   -------------------------------------------------------------------------
   · 서비스 1차 범위: 2026 효과측정 자료의 운영기관 16개 전체(2026-11-15 연구책임자 결정)
   · 16개 기관의 정확한 명단은 2026 통합데이터와 대조하기 전이다.
     진흥원 소속기관정보(공공데이터포털 15061976) 16행 중 프로그램 운영시설 후보 13곳(F02~F14)을
     '효과측정 기관 후보'로 두고, 나머지 3곳은 '미확인'으로 남긴다(임의로 채우지 않음).
   · facilityId는 연구설계/시설좌표_검수본.csv의 ID다.
   ========================================================================= */

const SERVICE_SCOPE = {
  target: 16,              // 1차 범위 기관 수(효과측정 자료 보유 기관)
  candidates: 13,          // 진흥원 소속기관 중 프로그램 운영시설 후보(F02~F14)
  unknown: 3,              // 명단 대조 전이라 특정하지 않은 기관 수
  note: '2026 통합데이터의 운영기관 16개와 진흥원 소속기관 목록의 대응은 착수 시 확인'
};

/* 근거 수준(연구설계 5장: 효과측정 자료 있음 / 유사 시설로 추정 / 학습 범위 밖) */
const EVIDENCE_LEVELS = {
  measured: {
    key: 'measured', label: '효과측정 기관 후보', short: '측정기관 후보',
    desc: '한국산림복지진흥원 소속 프로그램 운영시설로, 2026 효과측정 자료 보유 기관 후보입니다. 명단 대조는 착수 시 확인합니다.'
  },
  similar: {
    key: 'similar', label: '유사 시설로 추정', short: '유사 시설 추정',
    desc: '효과측정 자료 보유 기관이 아닌 것으로 보이는 시설입니다. 최종 서비스에서는 시설 프로필이 비슷한 기관의 결과로 추정합니다.'
  },
  pending: {
    key: 'pending', label: '시설 프로필 구축 전', short: '프로필 구축 전',
    desc: '1차 범위 기관이지만 임상·지형·프로그램 정보를 아직 정리하지 않아 점수를 계산하지 않습니다.'
  }
};

/* 피톤치드 근거 수준
   진흥원 누리집 '피톤치드 측정결과' 게시판(https://fowi.or.kr/user/bbs/bbsList.do?bbsManageId=61)
   게시물 137건(2019-04-09 게시, 2018년 측정으로 추정). 측정값은 아직 서비스에 반영하지 않았다. */
const PHYTONCIDE_EVIDENCE = {
  posted: '진흥원 공개 측정자료 게시 확인(2018년 측정 추정, 1회성). 측정값은 아직 반영하지 않았습니다.',
  none: '이 시설의 공개 측정자료는 확인하지 못했습니다. 수종에서 기대되는 인자로만 표시합니다.',
  common: '피톤치드·음이온 농도와 치유 효과의 관계는 본 연구에서 아직 추정하지 않았습니다.'
};

/* 프로토타입 12곳 ↔ 진흥원 소속기관 ID, 근거 수준, 피톤치드 공개자료 여부 */
const FACILITY_META = {
  daslim:        { facilityId: 'F02', evidence: 'measured', phyto: 'posted' },
  saneum:        { facilityId: null,  evidence: 'similar',  phyto: 'none' },
  daegwallyeong: { facilityId: 'F09', evidence: 'measured', phyto: 'posted' },
  cheongtaesan:  { facilityId: 'F03', evidence: 'measured', phyto: 'posted',
                   mapNote: '청태산 치유의 숲을 국립횡성숲체원(F03)과 같은 시설로 보았음(좌표 차 약 160m, 대응 확인 필요)' },
  jangseong:     { facilityId: null,  evidence: 'similar',  phyto: 'none',
                   mapNote: '축령산 장성 편백 치유의 숲(공립)은 국립장성숲체원(F05)과 다른 시설' },
  seogwipo:      { facilityId: null,  evidence: 'similar',  phyto: 'none' },
  jecheon:       { facilityId: 'F12', evidence: 'measured', phyto: 'none' },
  daeunsan:      { facilityId: 'F10', evidence: 'measured', phyto: 'posted' },
  chilgok:       { facilityId: 'F04', evidence: 'measured', phyto: 'posted' },
  yesan:         { facilityId: 'F13', evidence: 'measured', phyto: 'none' },
  hwasun:        { facilityId: null,  evidence: 'similar',  phyto: 'none' },
  namhae:        { facilityId: null,  evidence: 'similar',  phyto: 'posted',
                   mapNote: '피톤치드 게시물은 국립남해편백자연휴양림 기준' }
};
FORESTS.forEach((f) => Object.assign(f, FACILITY_META[f.id] || { facilityId: null, evidence: 'similar', phyto: 'none' }));

/* 1차 범위 중 시설 프로필을 아직 만들지 않은 6곳
   이름·주소·좌표만 공공데이터포털 15061976(연구설계/시설좌표_검수본.csv)에서 옮겼다.
   F11 좌표는 2026-11-15 카카오맵 기준 갱신값. 권역은 주소로 분류.
   임상·지형·표고·프로그램은 비워 둔다(자료 구축 후 입력). */
const PENDING_FACILITIES = [
  { facilityId: 'F05', name: '국립장성숲체원', region: '전라', address: '전라남도 장성군 북이면 방장로 353', lat: 35.443961, lng: 126.751375, phyto: 'posted' },
  { facilityId: 'F06', name: '국립청도숲체원', region: '경상', address: '경상북도 청도군 운문면 운문로 755', lat: 35.649103, lng: 129.027947, phyto: 'posted' },
  { facilityId: 'F07', name: '국립대전숲체원', region: '충청', address: '대전광역시 유성구 성북로 154번길 748', lat: 36.324217, lng: 127.291183, phyto: 'none' },
  { facilityId: 'F08', name: '국립양평치유의숲', region: '수도권', address: '경기도 양평군 양동면 황거길 262-10', lat: 37.461006, lng: 127.718225, phyto: 'posted' },
  { facilityId: 'F11', name: '국립김천치유의숲', region: '경상', address: '경상북도 김천시 증산면 수도길 1237-89', lat: 35.851374, lng: 128.002227, phyto: 'none' },
  { facilityId: 'F14', name: '국립곡성치유의숲', region: '전라', address: '전라남도 곡성군 곡성읍 청계동로 519', lat: 35.310436, lng: 127.248889, phyto: 'none' }
].map((p) => Object.assign(p, { evidence: 'pending' }));

/* 치유 목적별 근거 유형(연구설계 5장 보완 1)
   스트레스: 효과측정 자료(스트레스 척도)로 만드는 2027 예측모형의 대상
   그 외: 진흥원 자료에 해당 척도가 확인되지 않아 문헌 근거(D12)와 프로그램 태그로 점수를 만들 예정 */
const PURPOSE_EVIDENCE = {
  stress:      { key: 'model',      label: '효과측정 자료 기반', desc: '2027 예측모형(스트레스 감소) 적용 대상' },
  sleep:       { key: 'literature', label: '문헌 근거 기반',     desc: '문헌 근거와 프로그램 태그로 산정 예정' },
  respiratory: { key: 'literature', label: '문헌 근거 기반',     desc: '문헌 근거와 프로그램 태그로 산정 예정' },
  family:      { key: 'literature', label: '문헌 근거 기반',     desc: '문헌 근거와 프로그램 태그로 산정 예정' },
  vitality:    { key: 'literature', label: '문헌 근거 기반',     desc: '문헌 근거와 프로그램 태그로 산정 예정' }
};

/* 근거 없이 정한 규칙 계수 — 화면에 '시연값'으로 표시한다.
   2027 과업에서 반응곡선(D9)·예측모형 결과로 교체할 대상(연구설계 5장 보완 2·3). */
const DEMO_PARAMS = [
  { name: '종합 가중치 W·R·S·P', value: '0.32 · 0.18 · 0.22 · 0.28', plan: '효과 층은 모형 예측값으로 대체, 조절 막대는 기관 시연용으로 유지' },
  { name: '열쾌적 구간', value: '18~23℃(중심 21℃), 1℃당 4.2점 감점, 26℃ 초과·5℃ 미만 추가 감점', plan: '반응곡선 추정 후 교체. 문헌 메타분석에서는 기온-효과 관계가 확인되지 않음' },
  { name: '습도 기준', value: '55% 중심, 78% 이상 다습 추가 감점', plan: '반응곡선 추정 후 교체' },
  { name: 'PM2.5 등급 점수', value: '좋음 100 · 보통 72 · 나쁨 28', plan: '반응곡선 추정 후 교체' },
  { name: '기상 하위 비중', value: '열쾌적 0.40 · 습도 0.14 · 대기 0.26 · 강수·강풍 0.20', plan: '모형 기여도로 교체' },
  { name: '실내 대체 역량(shelter)', value: '시설별 0~100 큐레이션 값', plan: '실내 시설 목록(D5) 조사 후 산출 규칙 명세화' },
  { name: '임상×목적 친화도, 치유 인자 가점', value: '행렬 76~96, 인자별 0~11점', plan: '문헌 근거(D12)로 교체' },
  { name: '시설별 목적 프로파일', value: '시설×목적 78~94 큐레이션 값', plan: '스트레스는 모형 예측값, 그 외 목적은 문헌 근거로 교체' }
];

/* 표고 보정 기온감률: 연구설계 3.4절의 표준 기온감률(제안값, 계절·역전층에 따라 달라지는 근사) */
const LAPSE_RATE = 0.65;   // ℃ / 100 m
