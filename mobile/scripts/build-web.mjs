// 웹 화면 파일을 mobile/www 로 복사하고 config.js의 platform·apiBase를 앱용으로 바꾼다.
// 사용: node scripts/build-web.mjs [--api https://api.example.kr] [--platform android|ios]
// 웹과 앱이 같은 화면·같은 엔진 파일을 쓰도록, 복사만 하고 코드를 고치지 않는다.
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const root = join(here, '..');
const out = join(here, 'www');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const apiBase = arg('--api', '');
const platform = arg('--platform', 'app');

const FILES = ['index.html', 'region.html', 'manifest.webmanifest', 'style.css', 'region.css', 'app.js', 'data.js', 'region.js'];
const DIRS = ['engine', 'data', 'icons'];
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of FILES) if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f));
for (const d of DIRS) cpSync(join(root, d), join(out, d), { recursive: true });
writeFileSync(join(out, 'config.js'),
  `/* mobile/scripts/build-web.mjs 가 만든 앱용 설정 */\nwindow.SOOP_CONFIG = { apiBase: ${JSON.stringify(apiBase)}, apiTimeoutMs: 8000, platform: ${JSON.stringify(platform)} };\n`);
console.log(`복사 완료 → ${out} (apiBase=${apiBase || '기기 안 계산'}, platform=${platform})`);
