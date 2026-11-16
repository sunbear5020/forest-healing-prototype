// 숲결 API 서버용 자료 적재: data/*.json + data.js(FORESTS·TRAVEL_HOURS)를 읽어
// engine/context.js의 같은 조립 규칙으로 ctx를 만든다. 브라우저 loader.js와 결과가 같아야 한다.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const Engine = require('../engine/soopgyeol-engine.js');
export const SoopContext = require('../engine/context.js');
export const ProgramModel = require('../engine/program-model.js');

function readJSON(path, required) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { if (required) throw new Error(`${path} 읽기 실패: ${e.message}`); return null; }
}

// data.js는 브라우저 전역 const 선언 파일이라 격리된 vm 문맥에서 두 값만 꺼낸다.
function readProtoGlobals(dataJsPath) {
  try {
    const sb = {}; vm.createContext(sb);
    vm.runInContext(readFileSync(dataJsPath, 'utf8') + ';this.FORESTS=FORESTS;this.TRAVEL_HOURS=TRAVEL_HOURS;', sb, { timeout: 2000 });
    return { protoForests: sb.FORESTS || [], travelHours: sb.TRAVEL_HOURS || null };
  } catch (e) {
    return { protoForests: [], travelHours: null, error: e.message };
  }
}

export function allFiles(dataDir) {
  return SoopContext.FILES.concat(SoopContext.LAZY_FILES).map((f) => join(dataDir, f.file));
}

// 자료 파일 최종 수정 시각 서명(바뀌면 다시 읽기)
export function filesSignature(dataDir, dataJs) {
  return allFiles(dataDir).concat([dataJs]).map((p) => { try { return statSync(p).mtimeMs; } catch { return 0; } }).join(',');
}

export function loadContext({ dataDir = join(ROOT, 'data'), dataJs = join(ROOT, 'data.js') } = {}) {
  const raw = {};
  for (const f of SoopContext.FILES) raw[f.key] = readJSON(join(dataDir, f.file), !!f.required);
  for (const f of SoopContext.LAZY_FILES) raw[f.key] = readJSON(join(dataDir, f.file), false);  // 서버는 처음부터 다 읽는다
  const g = readProtoGlobals(dataJs);
  const ctx = SoopContext.build(raw, g, { programModel: ProgramModel });
  if (!ctx.parks) ctx.parks = [];
  return { ctx, raw, warnings: g.error ? [`data.js 읽기 실패: ${g.error}`] : [] };
}
