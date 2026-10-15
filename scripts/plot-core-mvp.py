"""Standalone scientific plots; no production imports or game artwork changes.
Run with Python/matplotlib, after analyze-core-mvp.mjs finalize.
"""
import json
import os
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(os.environ.get('CORE_MVP_LAB_OUT', 'docs/research/core-mvp'))
CHARTS = OUT / 'charts'
CHARTS.mkdir(exist_ok=True)
data = json.loads((OUT / 'final-comparison.json').read_text(encoding='utf-8'))['comparison']
sample_n = next(iter(data[0]['policies'].values()))['n']
phase_label = 'Holdout' if sample_n == 5000 else f'Preview shortlist (n={sample_n:,})'
sens = json.loads((OUT / 'sensitivity.json').read_text(encoding='utf-8'))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':130})
policies = list(data[0]['policies'])
labels = ['Giữ tiền','Tiết kiệm','Cổ phiếu','Vàng','TP A','TP B','Kinh doanh','Đa dạng','Dự phòng','Novice*']
colors = ['#27647b','#b2643f','#627644','#865785']
names = {c['id']: f"{chr(65+i)}: {len(c['config']['board']['tiles'])} ô / {c['config']['economy']['rules']['laps']} START" for i,c in enumerate(data)}

def save(fig, name):
    fig.savefig(CHARTS / (name+'.png'),bbox_inches='tight')
    fig.savefig(CHARTS / (name+'.svg'),bbox_inches='tight')
    plt.close(fig)

fig, axes = plt.subplots(2,1,figsize=(13,9),sharex=True,layout='constrained')
x=np.arange(len(policies))
for i,c in enumerate(data):
    values=[c['policies'][p]['won'] for p in policies]
    ys=np.array([v['rate']*100 for v in values])
    err=np.array([[v['rate']-v['ci95'][0],v['ci95'][1]-v['rate']] for v in values]).T*100
    err=np.maximum(err,0)  # Wilson endpoint roundoff at zero events.
    axes[0].errorbar(x+(i-1.5)*.13,ys,yerr=err,fmt='o',capsize=2,color=colors[i],label=names[c['id']])
    axes[1].plot(x,[c['policies'][p]['expectedShortfall10']/1e6 for p in policies],'o-',color=colors[i],label=names[c['id']])
axes[0].set(ylabel='Tỷ lệ đạt đích (%) — Wilson 95% CI',title=phase_label+': đạt đích và kết quả nhóm đuôi thấp')
axes[0].legend(ncol=2)
axes[1].axhline(data[0]['config']['economy']['rules']['startingCapital']/1e6,color='#555',ls='--',lw=.8,label='Starting capital')
axes[1].set(ylabel='Nguồn hợp lệ TB của 10% thấp nhất (triệu ₫)',xticks=x,xticklabels=labels)
axes[1].tick_params(axis='x',rotation=30)
fig.text(.01,-.015,f'* Novice synthetic, chưa phải người chơi thật. Mỗi policy/candidate có {sample_n:,} seed. Không chọn winner từ holdout.',fontsize=9)
save(fig,'win-tail-risk')

fig, axes=plt.subplots(len(data),1,figsize=(13,3*len(data)),sharex=True,layout='constrained')
for i,c in enumerate(data):
    vs=[c['policies'][p]['proceeds'] for p in policies]
    med=np.array([v['median']/1e6 for v in vs])
    axes[i].errorbar(x,med,yerr=np.array([[v['median']-v['p10'],v['p90']-v['median']] for v in vs]).T/1e6,fmt='o',capsize=4,color=colors[i])
    axes[i].axhline((c['config']['goal']['amount']+c['config']['goal']['reserve'])/1e6,color='#b2643f',ls='--',label='Goal + reserve')
    axes[i].set(ylabel='Triệu ₫',title=names[c['id']]+' — median / P10–P90 nguồn hợp lệ')
    axes[i].legend(loc='upper left')
axes[-1].set(xticks=x,xticklabels=labels)
axes[-1].tick_params(axis='x',rotation=30)
save(fig,'proceeds')

types=['bank','stocks','course','macro','bonds','personal','business','gold']
tilelabels=['Ngân hàng','Cổ phiếu','Bản thân','Sự kiện','Trái phiếu','Cá nhân','Kinh doanh','Vàng']
matrix=np.array([[100*(1-c['policies']['cash']['opportunities'][t]['never']['rate']) for t in types] for c in data])
fig,ax=plt.subplots(figsize=(12,4),layout='constrained')
im=ax.imshow(matrix,vmin=50,vmax=100,cmap='YlGnBu',aspect='auto')
for i in range(len(data)):
    for j in range(len(types)):ax.text(j,i,f'{matrix[i,j]:.1f}%',ha='center',va='center',color='white' if matrix[i,j]>85 else 'black')
ax.set(xticks=np.arange(8),xticklabels=tilelabels,yticks=np.arange(len(data)),yticklabels=[names[c['id']] for c in data],title='Xác suất gặp ô ít nhất một lần — cash control, RNG engine')
fig.colorbar(im,ax=ax,label='Accessibility (%)')
save(fig,'accessibility')

fig,axes=plt.subplots(1,2,figsize=(13,5),layout='constrained')
for i,c in enumerate(data):
    cash=c['policies']['cash'];roll=cash['rolls']
    axes[0].errorbar(i,roll['mean'],yerr=[[roll['mean']-roll['p10']],[roll['p90']-roll['mean']]],fmt='o',capsize=5,color=colors[i])
    for j,p in enumerate(policies):
        v=c['policies'][p]
        axes[1].scatter(v['rolls']['mean'],v['meaningfulDecisions']['mean'],color=colors[i],marker='x' if p=='novice' else 'o',alpha=.75)
        if p in ['cash','diversified','novice']:axes[1].annotate(labels[j],(v['rolls']['mean'],v['meaningfulDecisions']['mean']),fontsize=7)
axes[0].set(xticks=range(len(data)),xticklabels=[chr(65+i) for i in range(len(data))],ylabel='Lượt gieo: TB / P10–P90',title='Độ dài theo D6; chưa quy đổi thành phút')
axes[1].set(xlabel='Lượt gieo TB',ylabel='Quyết định có ý nghĩa: proxy model',title='Số quyết định phụ thuộc policy và khả năng chi trả')
fig.text(.01,-.02,'Proxy = >1 lựa chọn khả thi, cộng funding có >1 nguồn hợp lệ. Chưa human-test mức hiểu bài học hay độ hấp dẫn.',fontsize=9)
save(fig,'rolls-decisions')

variants=sorted(sens['variants'],key=lambda v:abs(v['againstAnchor']['diversified']['proceeds']['mean']),reverse=True)[:16]
fig,ax=plt.subplots(figsize=(11,8),layout='constrained')
ys=np.arange(len(variants));ms=np.array([v['againstAnchor']['diversified']['proceeds']['mean']/1e6 for v in variants])
err=np.array([[v['againstAnchor']['diversified']['proceeds']['mean']-v['againstAnchor']['diversified']['proceeds']['ci95'][0],v['againstAnchor']['diversified']['proceeds']['ci95'][1]-v['againstAnchor']['diversified']['proceeds']['mean']] for v in variants]).T/1e6
ax.barh(ys,ms,color=['#27647b' if v>=0 else '#b2643f' for v in ms],alpha=.8)
ax.errorbar(ms,ys,xerr=err,fmt='none',ecolor='#222',capsize=2)
ax.axvline(0,color='#444',lw=.8)
ax.set(yticks=ys,yticklabels=[v['factor'] for v in variants],xlabel='Chênh nguồn hợp lệ TB so anchor (triệu ₫), paired 95% CI',title='Sensitivity OFAT — diversified, một kiến trúc N20/H4 cố định')
ax.invert_yaxis()
save(fig,'sensitivity')

tilecolors={'start':'#e9cd71','bank':'#83b8c7','stocks':'#a4c4e0','course':'#afd4aa','macro':'#d9b2cd','bonds':'#bec0d9','personal':'#e8b9a8','business':'#b4c49c','gold':'#e6ce94'}
short={'start':'START','bank':'NGÂN HÀNG','stocks':'CỔ PHIẾU','course':'BẢN THÂN','macro':'SỰ KIỆN','bonds':'TRÁI PHIẾU','personal':'CÁ NHÂN','business':'KINH DOANH','gold':'VÀNG'}
fig,axes=plt.subplots(len(data),1,figsize=(15,len(data)*2.8),layout='constrained')
for i,c in enumerate(data):
    tiles=c['config']['board']['tiles'];ax=axes[i]
    for j,t in enumerate(tiles):
        ax.add_patch(plt.Rectangle((j,0),.94,.7,facecolor=tilecolors[t],edgecolor='#555',linewidth=.7))
        ax.text(j+.47,.45,str(j+1),ha='center',va='center',fontsize=9)
        ax.text(j+.47,.18,short[t],ha='center',va='center',fontsize=6)
    ax.set_xlim(-.2,len(tiles)+.2);ax.set_ylim(-.1,.8);ax.axis('off')
    ax.set_title(names[c['id']]+' · '+c['id'],loc='left',fontsize=11)
fig.suptitle('Thứ tự bàn nghiên cứu: trái → phải → START',fontsize=13)
save(fig,'board-orders')
(CHARTS/'plot-manifest.json').write_text(json.dumps({'matplotlib':matplotlib.__version__,'numpy':np.__version__,'input':'final-comparison.json + sensitivity.json','charts':sorted(p.name for p in CHARTS.glob('*') if p.suffix in ['.png','.svg'])},indent=2),encoding='utf-8')
print('Rendered six chart sets (PNG + SVG).')
