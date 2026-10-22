(function () {
  const $ = s => document.querySelector(s);
  const cents = n => Math.round(n * 100) / 100;
  const money = n => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const signed = n => Math.abs(n) < 0.005 ? '0.00' : `${n > 0 ? '+' : ''}${money(n)}`;
  const compact = n => {
    if (Math.abs(n) < 0.005) return '0.00';
    const a = Math.abs(n);
    if (a >= 1e8) return `${n > 0 ? '+' : ''}${(n / 1e8).toFixed(2)}亿`;
    if (a >= 1e4) return `${n > 0 ? '+' : ''}${(n / 1e4).toFixed(2)}万`;
    return signed(n);
  };
  const base = {
    normal: {
      A股: [['贵州茅台',5200,1800,'long'],['中证500ETF',3800,1220,'long'],['宁德时代',-1600,900,'long'],['招商银行',2100,-300,'long'],['比亚迪',-1100,-420,'long'],['平安银行',980,260,'long'],['紫金矿业',-760,340,'long'],['隆基绿能',620,-180,'long'],['中国平安',-450,-220,'long'],['海天味业',300,120,'long'],['做空样本',-900,200,'short']],
      港股: [['腾讯控股',-400,-200,'long'],['美团',-900,380,'short'],['小米集团',800,120,'long']],
      美股: [['NVDA',3640,3360,'long'],['Apple',1200,-640,'short'],['MSFT',-880,520,'ipo'],['Amazon',900,240,'long']]
    },
    edge: {
      A股: [['微利样本',0.08,-0.03,'long'],['零贡献',0,0,'long'],['正负混合',0.02,-0.01,'long'],['负正混合',-0.03,0.01,'long']],
      港股: [['零回合',0,0,'long'],['缺少估值',null,240,'long']],
      美股: [['微小损失',-0.04,0.01,'long'],['微小盈利',0.05,-0.02,'long']]
    },
    extreme: {
      A股: [['极大已实现',128000000,-42000000,'long'],['极大浮盈',42000000,18000000,'long'],['极值异号',-68000000,22000000,'long']],
      港股: [['大额亏损',-68000000,-12000000,'long'],['大额盈利',42000000,-18000000,'long']],
      美股: [['大额盈利',42000000,18000000,'long'],['负值异号',-26000000,9000000,'long']]
    }
  };
  const openState = { '贵州茅台':true,'中证500ETF':false,'宁德时代':true,'招商银行':true,'比亚迪':false,'平安银行':true,'紫金矿业':true,'隆基绿能':false,'中国平安':true,'海天味业':true,'做空样本':true,'腾讯控股':false,'美团':true,'小米集团':true,'NVDA':true,'Apple':false,'MSFT':true,'Amazon':true };
  const state = { mode:'current', fixture:'normal', palette:'proposed', category:'long', sort:'desc', openOnly:false, market:'all', scopeBeforeDrill:'all', drill:null, page:1, memory:{ current:{category:'long',sort:'desc',openOnly:false,drill:null,page:1}, historical:{category:'long',sort:'desc',openOnly:false,drill:null,page:1} }, detail:null };

  function sourceRows() {
    const rows = [];
    Object.entries(base[state.fixture]).forEach(([market, items]) => items.forEach(([name,r,f,category]) => rows.push({market,name,r,f,category,open:openState[name] === true})));
    return rows.filter(x => x.category === state.category && (state.market === 'all' || x.market === state.market) && (!state.openOnly || x.open));
  }
  function modeRows(forDrill = state.drill) {
    const effectiveMarket = forDrill || state.drill || (state.market !== 'all' ? state.market : null);
    const directMarket = !forDrill && !!effectiveMarket;
    const rows = effectiveMarket ? sourceRows().filter(x => x.market === effectiveMarket) : sourceRows();
    if (!forDrill && !directMarket) {
      const grouped = {};
      rows.forEach(x => { const g = grouped[x.market] || (grouped[x.market] = {name:x.market,market:x.market,r:0,f:0,unknownR:false,unknownF:false}); if (x.r === null) g.unknownR = true; else g.r += x.r; if (x.f === null) g.unknownF = true; else g.f += x.f; });
      const groupedRows = Object.values(grouped).map(x => ({...x,r:x.unknownR?null:cents(x.r),f:x.unknownF?null:cents(x.f)}));
      return order(state.mode === 'historical' ? groupedRows.map(x => ({...x,f:0})) : groupedRows);
    }
    return order(rows.map(x => ({...x,f:state.mode === 'historical' ? 0 : x.f})));
  }
  function order(rows) { return rows.sort((a,b) => { const av=(a.r??0)+(a.f??0), bv=(b.r??0)+(b.f??0); return state.sort === 'desc' ? bv-av : av-bv; }); }
  function color(value,type) { if (state.palette === 'legacy' && type === 'floating' && value >= 0) return '#6ca8ff'; return value > 0 ? '#53d7a0' : value < 0 ? '#ef7f89' : '#a8b6cb'; }
  function segment(row,value,type,max,offsets) {
    if (value === null) return null;
    const width = Math.abs(value) / max * 46, positive = value >= 0, offset = positive ? offsets.pos : offsets.neg;
    const style = positive ? `left:calc(50% + ${offset}%);width:${width}%` : `right:calc(50% + ${offset}%);width:${width}%`;
    const c = color(value,type), label = type === 'realized' ? '已实现（实心）' : '浮盈变化（中空）';
    if (positive) offsets.pos += width; else offsets.neg += width;
    return `<span tabindex="0" role="img" aria-label="${row} ${label} ${value === 0 ? '零' : signed(value)+' CNY'}" class="segment ${type === 'floating' ? 'hollow' : ''} ${value === 0 ? 'zero' : ''}" style="${style};color:${c};${type === 'realized' ? `background:${c};` : ''}" data-tooltip="${label}：${value === 0 ? '0.00' : signed(value)} CNY"></span>`;
  }
  function render() {
    document.querySelectorAll('.bar-tooltip').forEach(x => x.remove());
    const all = modeRows(), totals = state.drill ? modeRows(false) : all;
    const max = Math.max(1, ...all.map(x => { const r=x.r??0, f=x.f??0; return r*f >= 0 ? Math.abs(r)+Math.abs(f) : Math.max(Math.abs(r),Math.abs(f)); }));
    const isSymbolView=Boolean(state.drill||state.market!=='all'), pageRows = isSymbolView ? all.slice((state.page-1)*8,state.page*8) : all;
    $('#bars').innerHTML = pageRows.map(x => { const offsets={pos:0,neg:0}; const realized=segment(x.name,x.r,'realized',max,offsets); const floating=state.mode==='current' ? segment(x.name,x.f,'floating',max,offsets) : ''; const total=x.r===null||x.f===null?null:cents(x.r+x.f); return `<div class="bar-row"><div class="name"><button data-open="${x.name}" data-market="${x.market}" aria-label="打开${x.name}交易详情">${x.name}</button></div><div class="plot" data-row="${x.name}" data-open="${x.name}" data-market="${x.market}">${realized||''}${floating||''}</div><div class="sum ${total===null?'unknown':total>0?'positive':total<0?'negative':'neutral'}">${total===null?'不可计算':compact(total)}</div></div>`; }).join('') || '<div class="unknown">没有符合当前分类与筛选的贡献</div>';
    const parts=totals.reduce((a,x)=>({r:x.r===null?null:(a.r===null?null:a.r+x.r),f:x.f===null?null:(a.f===null?null:a.f+x.f)}),{r:0,f:0}), total=parts.r===null||parts.f===null?null:cents(parts.r+parts.f);
    $('#row-label').textContent=(state.drill||state.market!=='all')?'标的':'市场'; $('#total').className='total '+(total===null?'neutral':total>0?'positive':total<0?'negative':'neutral'); $('#crumbs').hidden=!state.drill; if(state.drill) $('#crumb-market').textContent=state.drill+' · 标的明细'; $('#floating-legend').textContent=state.mode==='historical'?'仅已实现（历史模式）':'浮盈变化（中空）'; $('.legend-hollow').hidden=state.mode==='historical'; $('.legend-hollow').style.borderColor=state.palette==='legacy'?'#6ca8ff':'var(--green)'; $('#contribution-title').textContent=state.mode==='historical'?'历史已平仓贡献':'当前期间贡献'; $('#total').textContent=total===null?'不可计算':compact(total)+' CNY'; $('#foot-total').textContent=(state.drill?'市场全量合计 ':'全量合计 ')+(total===null?'不可计算':compact(total)+' CNY'); $('#foot-breakdown').textContent='已实现 '+(parts.r===null?'不可计算':signed(parts.r))+' · '+(state.mode==='current'?'浮盈变化 '+(parts.f===null?'不可计算':signed(parts.f)):'历史仅统计已平仓');
    let pager=$('#pager'); if(!pager){pager=document.createElement('div');pager.id='pager';pager.className='pager';$('.module-foot').before(pager);} const pages=isSymbolView?Math.max(1,Math.ceil(all.length/8)):1; pager.innerHTML=isSymbolView?`<button id="prev-page" ${state.page===1?'disabled':''}>上一页</button><span>${state.page} / ${pages} · ${all.length} 项</span><button id="next-page" ${state.page===pages?'disabled':''}>下一页</button>`:''; if($('#prev-page'))$('#prev-page').onclick=()=>{state.page--;render();$('#bars button[data-open]')?.focus()}; if($('#next-page'))$('#next-page').onclick=()=>{state.page++;render();$('#bars button[data-open]')?.focus()};
    syncControls(); bindTooltips(); document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{ if(base[state.fixture][b.dataset.open]){state.scopeBeforeDrill=state.market;state.drill=b.dataset.open;state.page=1;remember();render();} else openDetail(b.dataset.open,b.dataset.market,b); }));
  }
  function bindTooltips(){ document.querySelectorAll('.segment').forEach(el=>{ const show=()=>{document.querySelectorAll('.bar-tooltip').forEach(x=>x.remove());const t=document.createElement('div');t.className='bar-tooltip';t.innerHTML=`<strong>${el.parentElement.dataset.row}</strong>${el.dataset.tooltip}<br><span class="muted">${el.classList.contains('hollow')?'中空 = 期末浮盈 − 期初浮盈':'实心 = 期间已实现贡献'}</span>`;document.body.appendChild(t);const r=el.getBoundingClientRect();t.style.left=Math.min(r.left,innerWidth-300)+'px';t.style.top=Math.max(8,r.top-82)+'px';};const hide=()=>document.querySelectorAll('.bar-tooltip').forEach(x=>x.remove());el.addEventListener('mouseenter',show);el.addEventListener('focus',show);el.addEventListener('mouseleave',hide);el.addEventListener('blur',hide);}); }
  function syncControls(){document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===state.mode)));document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===state.category)));$('#sort').value=state.sort;$('#open-only').checked=state.openOnly;$('#open-only').disabled=state.mode==='historical';$('#market-scope').value=state.market;syncSelectLabels();$('#period-copy').textContent=state.mode==='historical'?'历史统计范围 · 2026 · 仅已平仓':'当前表现日期 · 2026-01-01 — 2026-10-15 · 已实现 + 浮盈变化';$('#contribution-title').textContent=state.mode==='historical'?'历史已平仓贡献':'当前期间贡献';}
  function syncSelectLabels(){['sort','market-scope'].forEach(id=>{const s=$('#'+id),c=s.parentElement,t=c.querySelector('.custom-select-trigger');if(!t)return;const label=s.options[s.selectedIndex].text;t.querySelector('.custom-select-label').textContent=label;t.setAttribute('aria-label',s.getAttribute('aria-label')+'：'+label);c.querySelectorAll('.custom-select-option').forEach((o,i)=>o.setAttribute('aria-selected',String(i===s.selectedIndex)));});}
  function remember(){state.memory[state.mode]={category:state.category,sort:state.sort,openOnly:state.openOnly,drill:state.drill,page:state.page};}
  function openDetail(name,market,trigger){state.detail={name,market,trigger};const item=sourceRows().find(x=>x.name===name&&x.market===market);$('#detail-title').textContent=name+' · 详情连接占位';$('#detail-copy').textContent=`${market} · ${state.mode==='historical'?'历史已平仓':'当前期间'} · 已实现 ${item.r===null?'不可计算':signed(item.r)}${state.mode==='historical'?'':' · 浮盈变化 '+(item.f===null?'不可计算':signed(item.f))}`;$('#detail-trades').innerHTML='<table><tbody><tr><th>贡献读数</th><th>金额</th></tr><tr><td>期间已实现</td><td>'+ (item.r===null?'不可计算':signed(item.r)) +'</td></tr>'+ (state.mode==='historical'?'':'<tr><td>浮盈变化</td><td>'+(item.f===null?'不可计算':signed(item.f))+'</td></tr>') +'</tbody></table>';$('#detail').hidden=false;$('#close-detail').focus();}
  function closeDetail(){if(!state.detail)return;const name=state.detail.name,market=state.detail.market;state.detail=null;$('#detail').hidden=true;render();const restored=document.querySelector(`button[data-open="${CSS.escape(name)}"][data-market="${CSS.escape(market)}"]`);if(restored)restored.focus();}
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{remember();state.mode=b.dataset.mode;Object.assign(state,state.memory[state.mode]);render();})); document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;state.page=1;remember();render();})); $('#palette').addEventListener('change',e=>{state.palette=e.target.value;render();}); $('#fixture').addEventListener('change',e=>{state.fixture=e.target.value;state.drill=null;state.scopeBeforeDrill='all';state.page=1;Object.values(state.memory).forEach(m=>{m.drill=null;m.page=1});render();}); $('#sort').addEventListener('change',e=>{state.sort=e.target.value;state.page=1;remember();render();}); $('#open-only').addEventListener('change',e=>{if(state.mode==='historical')return;state.openOnly=e.target.checked;state.page=1;remember();render();}); $('#market-scope').addEventListener('change',e=>{state.market=e.target.value;state.drill=null;state.scopeBeforeDrill='all';state.page=1;Object.values(state.memory).forEach(m=>{m.drill=null;m.page=1});render();}); $('#back-market').addEventListener('click',()=>{state.scopeBeforeDrill='all';state.drill=null;state.page=1;remember();render();}); $('#close-detail').addEventListener('click',closeDetail); document.addEventListener('keydown',e=>{if($('#detail').hidden)return;if(e.key==='Escape'){e.preventDefault();closeDetail();}}); render();
}());
