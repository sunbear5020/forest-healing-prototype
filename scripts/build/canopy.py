"""수관(나무) 피복률 계산: ESA WorldCover 10 m v200(2021) 'Tree cover'(class 10) 비율.
점 좌표 주변 원(반경 r) 안의 셀 비율을 센다. 공원은 면적 A로 원형 근사(r=sqrt(A/π), 최소 30 m).
사용: from canopy import TreeCover; tc=TreeCover(tile_dir); tc.frac(lat,lng,r_m) -> (tree, built, water, valid)
출처: ESA WorldCover 10m 2021 v200, https://esa-worldcover.org (CC BY 4.0)
"""
import os, math, numpy as np, rasterio
from rasterio.windows import Window

class TreeCover:
    def __init__(self, tile_dir):
        self.ds = {}
        for f in os.listdir(tile_dir):
            if f.endswith('.tif'):
                n = f.replace('.tif', '')            # 예: N36E126
                lat0, lon0 = int(n[1:3]), int(n[4:7])
                self.ds[(lat0, lon0)] = rasterio.open(os.path.join(tile_dir, f))
    def frac(self, lat, lng, r_m):
        key = (int(lat // 3 * 3), int(lng // 3 * 3))
        ds = self.ds.get(key)
        if ds is None: return None
        res = ds.transform.a
        dy = r_m / 111320.0; dx = r_m / (111320.0 * math.cos(math.radians(lat)))
        row0, col0 = ds.index(lng - dx, lat + dy); row1, col1 = ds.index(lng + dx, lat - dy)
        row0, col0 = max(row0, 0), max(col0, 0)
        row1, col1 = min(row1, ds.height - 1), min(col1, ds.width - 1)
        if row1 < row0 or col1 < col0: return None
        a = ds.read(1, window=Window(col0, row0, col1 - col0 + 1, row1 - row0 + 1))
        rr, cc = np.indices(a.shape)
        cy = (a.shape[0] - 1) / 2; cx = (a.shape[1] - 1) / 2
        m_y = (rr - cy) * res * 111320.0; m_x = (cc - cx) * res * 111320.0 * math.cos(math.radians(lat))
        inside = (m_x ** 2 + m_y ** 2) <= r_m ** 2
        v = a[inside]; v = v[v > 0]
        if v.size == 0: return None
        return dict(tree=round(100 * float(np.mean(v == 10)), 1), built=round(100 * float(np.mean(v == 50)), 1),
                    water=round(100 * float(np.mean(v == 80)), 1), green=round(100 * float(np.mean(np.isin(v, [10, 20, 30, 90, 95]))), 1),
                    n=int(v.size))
