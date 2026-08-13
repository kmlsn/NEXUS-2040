import hashlib, json
from pathlib import Path
MASK=(1<<64)-1
def next32(state, inc):
 old=state; state=(old*6364136223846793005+inc)&MASK; x=(((old>>18)^old)>>27)&0xffffffff; r=(old>>59)&31; return state,((x>>r)|(x<<((-r)&31)))&0xffffffff
def values(formula,content,seed,stream,n):
 digest=hashlib.sha256(f"{formula}|{content}|{seed}|{stream}".encode()).digest(); s=int.from_bytes(digest[:8],'little'); st=int.from_bytes(digest[8:16],'little'); inc=((st<<1)|1)&MASK; state=0; state,_=next32(state,inc); state=(state+s)&MASK; state,_=next32(state,inc); result=[]
 for _ in range(n): state,value=next32(state,inc); result.append(value)
 return result
fixture=json.loads((Path(__file__).parents[1]/'packages/simulation/fixtures/pcg32-v1.json').read_text())
for item in fixture['cases']: assert values(fixture['formula_version'],fixture['content_version'],int(item['master_seed']),item['stream_id'],len(item['uint32']))==item['uint32']
print('PASS: Python PCG32 validates the shared fixture.')
