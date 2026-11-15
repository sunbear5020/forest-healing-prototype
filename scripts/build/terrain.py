"""시설 고정층(지형) 요약: 수치지형도 기반 5 m DEM(EPSG:5186, 시설 중심 10x10 km)에서
시설 좌표 반경 0.5 km·1 km 안의 표고·경사·사면방위를 요약한다.
입력: DEM 폴더(F코드_기관명.tif), 시설좌표_검수본.csv
출력: data/terrain.json
사용: python scripts/build/terrain.py <DEM폴더> <시설좌표csv> <출력json>
"""
import sys, json, csv, glob, os
import numpy as np, rasterio
from pyproj import Transformer

dem_dir, coord_csv, out = sys.argv[1:4]
fac = {r['facility_id']: r for r in csv.DictReader(open(coord_csv, encoding='utf-8-sig'))}
tr = Transformer.from_crs('EPSG:4326', 'EPSG:5186', always_xy=True)
res = {}
for p in sorted(glob.glob(os.path.join(dem_dir, 'F*.tif'))):
    fid = os.path.basename(p).split('_')[0]
    r = fac[fid]
    with rasterio.open(p) as ds:
        z = ds.read(1).astype('float64'); nod = ds.nodata
        if nod is not None: z[z == nod] = np.nan
        z[(z < -100) | (z > 3000)] = np.nan
        t = ds.transform; px = t.a
        x, y = tr.transform(float(r['경도']), float(r['위도']))
        rows, cols = np.indices(z.shape)
        X = t.c + (cols + 0.5) * t.a; Y = t.f + (rows + 0.5) * t.e
        d = np.hypot(X - x, Y - y)
    gy, gx = np.gradient(z, px)          # 행 방향 = 남쪽(-y), 열 방향 = 동쪽
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    aspect = (np.degrees(np.arctan2(-gx, gy)) + 360) % 360  # 0=북, 시계방향(경사 하강 방향)
    out_r = {'facility_id': fid, 'name': r['기관'], 'dem': 'NGII 수치지형도 1:5000 TIN→5 m', }
    for rad in (500, 1000):
        m = (d <= rad) & np.isfinite(z) & np.isfinite(slope)
        s = slope[m]; zz = z[m]; a = aspect[m & (slope > 2)]
        south = np.mean((a >= 135) & (a <= 225)) if a.size else None
        out_r[f'r{rad}'] = {
            'valid_pct': round(100 * m.sum() / max(1, (d <= rad).sum()), 1),
            'elev_mean': round(float(np.nanmean(zz)), 1), 'elev_min': round(float(np.nanmin(zz)), 1),
            'elev_max': round(float(np.nanmax(zz)), 1),
            'slope_mean_deg': round(float(np.mean(s)), 1), 'slope_p50_deg': round(float(np.median(s)), 1),
            'gentle_pct_lt8deg': round(100 * float(np.mean(s < 8)), 1),   # 약 14% 경사
            'steep_pct_gt25deg': round(100 * float(np.mean(s > 25)), 1),
            'south_aspect_pct': None if south is None else round(100 * float(south), 1),
        }
    ci = np.unravel_index(np.nanargmin(d), d.shape)
    out_r['point_elev'] = round(float(z[ci]), 1)
    res[fid] = out_r
    print(fid, out_r['point_elev'], out_r['r1000']['slope_mean_deg'], out_r['r1000']['gentle_pct_lt8deg'])
json.dump({'_meta': {'source': '국토지리정보원 수치지형도(1:5,000 등고선·표고점) → TIN → 5 m DEM, 사용자 실험실 구축(2026-11-15)',
                     'method': '시설 좌표 반경 0.5/1 km 셀 요약. 경사는 중앙차분. 8°≈14%(완만), 25° 초과=급경사.',
                     'caveat': '시설 좌표는 대표점(센터)이며 숲길 전체를 대표하지 않음. F04·F05 등 일부 도엽 결손.'},
           'facilities': res}, open(out, 'w'), ensure_ascii=False, indent=1)
