# 시군구 경계: vuski/admdongkor ver20251231 HangJeongDong geojson을 dl/adm.geojson에 받아 실행
# 사용: python3 build_sigungu_boundary.py data/region_health.json data/sigungu_boundary.json
import json,sys
from shapely.geometry import shape,mapping
from shapely.ops import unary_union
adm=json.load(open('dl/adm.geojson'))
rh=json.load(open(sys.argv[1]))['regions']
groups={}
for f in adm['features']:
    p=f['properties'];groups.setdefault((p['sidonm'],p['sggnm']),[]).append(shape(f['geometry']))
keys=set(groups)
out=[];miss=[]
for sido,v in rh.items():
    for g in v['sigungu']:
        parts=[k for k in keys if k[0]==sido and (k[1]==g or k[1].replace(' ','').startswith(g.replace(' ','')) )]
        # avoid '고성군' prefix issues: exact first
        ex=[k for k in parts if k[1]==g]
        if ex: parts=ex
        if not parts: miss.append((sido,g));continue
        geom=unary_union([s for k in parts for s in groups[k]]).simplify(0.006,preserve_topology=True)
        def rnd(o):
            if isinstance(o,(list,tuple)):
                if o and isinstance(o[0],(int,float)): return [round(o[0],3),round(o[1],3)]
                return [rnd(x) for x in o]
            return o
        m=mapping(geom)
        c=geom.representative_point()
        out.append({"type":"Feature","properties":{"sido":sido,"sigungu":g,"lat":round(c.y,4),"lng":round(c.x,4),"parts":[k[1] for k in parts]},"geometry":{"type":m['type'],"coordinates":rnd(m['coordinates'])}})
print('miss',miss,file=sys.stderr)
print(len(out),file=sys.stderr)
json.dump({"type":"FeatureCollection","_meta":{"source":"통계청 SGIS 행정동 경계(공공누리 제1유형) 기반 vuski/admdongkor ver20251231(CC BY 4.0)을 시군구로 병합·단순화(허용오차 0.006°). 경계는 표시용 근사.","url":"https://github.com/vuski/admdongkor"},"features":out},open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
