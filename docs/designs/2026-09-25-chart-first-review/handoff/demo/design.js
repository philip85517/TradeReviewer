(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  if (new URLSearchParams(location.search).has('board')) document.body.classList.add('capture-board');
  const base = {entry:56, stop:52, target:68, qty:1000};
  let plan = {...base}, retained = {...base}, mode = 'quantity', armed = null, timer, holdingDay = 69;
  const reviews = {68:{early:'是',reason:'风险收缩',adherence:'偏离'},74:{early:'未评价',reason:'未记录',adherence:'未评价'}};
  let decision = 68;
  const numeric = el => el.value.trim() === '' ? null : Number(el.value);
  const cash = v => Number.isFinite(v) ? '¥'+v.toLocaleString('zh-CN',{maximumFractionDigits:2}) : '待补充';
  const price = v => Number.isFinite(v) ? v.toFixed(2) : '待补充';
  const riskOf = p => [p.entry,p.stop,p.qty].every(v=>Number.isFinite(v)&&v>0)&&p.stop<p.entry ? (p.entry-p.stop)*p.qty : null;
  const rrOf = p => [p.entry,p.stop,p.target].every(v=>Number.isFinite(v)&&v>0)&&p.stop<p.entry&&p.target>p.entry ? (p.target-p.entry)/(p.entry-p.stop) : null;
  function toast(message){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.append(el)}el.textContent=message;el.hidden=false;clearTimeout(timer);timer=setTimeout(()=>el.hidden=true,2800)}
  const anchors=[[1,41.5],[10,45],[18,58],[24,66.5],[30,57],[35,46.5],[40,49],[45,51],[50,53],[55,55],[60,56],[64,60],[68,64],[69,63],[72,62],[74,61],[77,64],[80,66]];
  const closes=Array.from({length:80},(_,i)=>{const d=i+1,exact=anchors.find(a=>a[0]===d);if(exact)return exact[1];const j=anchors.findIndex(a=>a[0]>d),a=anchors[j-1],b=anchors[j];return a[1]+(b[1]-a[1])*(d-a[0])/(b[0]-a[0])+Math.sin(d*1.85)*.55});
  function renderChart(svg){
    const main=!!svg.closest('.chart-column'), rect=svg.getBoundingClientRect();
    const W=main&&rect.width>0?rect.width:1120,H=main?(innerWidth<=1000?230:500):560;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    const compact=main&&W<600,reveal=Number(svg.dataset.reveal||60),phase=svg.dataset.phase||(reveal===60?'pre-entry':reveal===80?'post-review':'holding');
    const p=svg.closest('#stage1')?plan:main?retained:base;
    const L=compact?18:58,R=compact?84:108,T=compact?20:26,PB=H-(compact?50:92),plotEnd=W-R;
    const x=d=>L+(d-1)/79*(plotEnd-L),y=v=>T+(76-v)/40*(PB-T);
    let grid='';
    [40,48,56,64,72].forEach(v=>grid+=`<line class="gridline" x1="${L}" x2="${plotEnd}" y1="${y(v)}" y2="${y(v)}"/><text class="axis price-axis" x="${plotEnd+12}" y="${y(v)+4}">${v.toFixed(2)}</text>`);
    (compact?[1,30,60,80]:[1,10,20,30,40,50,60,70,80]).forEach(d=>grid+=`<line class="gridline" x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${PB}" opacity=".5"/><text class="axis" x="${x(d)}" y="${H-9}" text-anchor="middle">D${String(d).padStart(2,'0')}</text>`);
    grid+=`<text class="axis" x="${plotEnd+12}" y="15">CNY</text><line x1="${x(reveal)+3}" x2="${x(reveal)+3}" y1="${T}" y2="${H-29}" stroke="#b1c294" stroke-dasharray="4 6" opacity=".6"/>`;
    if(!compact&&reveal<80)grid+=`<text class="axis" x="${Math.min(x(reveal)+12,plotEnd-91)}" y="${H-30}">后续尚未揭示</text>`;
    $('.chart-grid',svg).innerHTML=grid;
    let marks='';
    if(rrOf(p)!==null)marks+=`<rect x="${x(60)}" y="${y(p.target)}" width="${x(80)-x(60)}" height="${y(p.entry)-y(p.target)}" fill="#bed89b" opacity=".065"/><rect x="${x(60)}" y="${y(p.entry)}" width="${x(80)-x(60)}" height="${y(p.stop)-y(p.entry)}" fill="#ddae74" opacity=".05"/>`;
    const cw=Math.max(1.2,Math.min(6.4,(plotEnd-L)/79*.57));
    closes.forEach((c,i)=>{if(i>=reveal)return;const d=i+1,o=i?closes[i-1]:41.1,col=c>=o?'#26a69a':'#ef5350',vol=(compact?7:12)+((i*13)%(compact?15:27));marks+=`<g data-bar="${d}"><line x1="${x(d)}" x2="${x(d)}" y1="${y(Math.max(o,c)+.7)}" y2="${y(Math.min(o,c)-.7)}" stroke="${col}"/><rect x="${x(d)-cw/2}" y="${Math.min(y(o),y(c))}" width="${cw}" height="${Math.max(1,Math.abs(y(o)-y(c)))}" fill="${col}"/><rect x="${x(d)-cw/2}" y="${H-28-vol}" width="${cw}" height="${vol}" fill="${col}" opacity=".3"/></g>`});
    marks+=`<path d="M${x(35)},${y(45.5)} L${x(63)},${y(57.2)} M${x(35)},${y(49.5)} L${x(63)},${y(61.2)}" fill="none" stroke="#8cbdff" stroke-width="1.6" opacity=".8"/>`;
    [['入场',p.entry,'entry'],['止损',p.stop,'stop'],['目标',p.target,'target']].forEach(([label,value,key])=>{if(!Number.isFinite(value))return;const py=y(value);marks+=`<line class="plan-line" data-price="${value}" x1="${x(35)}" x2="${plotEnd}" y1="${py}" y2="${py}" stroke="#f3ba2f" stroke-dasharray="5 5" opacity=".85"/><g class="price-tag" data-field="${key}"><rect x="${plotEnd+4}" y="${py-10}" width="${R-7}" height="20" fill="#293b32" rx="3"/><text class="price-label" data-price-label="${value}" x="${plotEnd+8}" y="${py+4}" fill="#f3ba2f" font-size="${compact?10:12}">${label} ${value.toFixed(2)}</text></g>`});
    [{d:60,v:56,t:'买入 1,000',dy:23},{d:68,v:64,t:'减仓 600',dy:35},{d:74,v:61,t:'清仓 400',dy:28}].forEach(e=>{if(phase==='pre-entry'||e.d>reveal)return;const px=x(e.d),py=y(e.v);marks+=`<polygon data-execution-day="${e.d}" points="${px},${py-5} ${px+5},${py} ${px},${py+5} ${px-5},${py}" fill="#8cbdff" stroke="#d6e6ff"/>`;if(!compact)marks+=`<text x="${px-8}" y="${py+e.dy}" text-anchor="end" fill="#8cbdff" font-size="12">${e.t} · ${e.v.toFixed(2)}</text>`});
    $('.series',svg).innerHTML=marks;
    function card(cx,cy,w,title,lines,foot,accent,opacity=1){return `<g opacity="${opacity}"><rect x="${cx}" y="${cy}" width="${w}" height="111" rx="5" fill="#151e2b" stroke="#243145"/><line x1="${cx+1}" x2="${cx+w-1}" y1="${cy+1}" y2="${cy+1}" stroke="${accent}" stroke-width="2"/><text x="${cx+12}" y="${cy+24}" fill="${accent}" font-size="13" font-weight="600">${title}</text>${lines.map((line,i)=>`<text x="${cx+12}" y="${cy+48+i*21}" fill="#e7edf6" font-size="12">${line}</text>`).join('')}<text x="${cx+12}" y="${cy+96}" fill="#adbbcf" font-size="12">${foot}</text></g>`}
    let notes='';
    if(!compact){
      notes=card(L+8,22,222,'01 · 入场前判断',['低点抬高，仍视为通道回踩。','等价格确认，再按计划控制风险。'],'复盘补记 · 入场前观察','#8cbdff',phase==='pre-entry'?1:.55);
      const nx=Math.max(L+242,Math.min(plotEnd-280,L+(plotEnd-L)*.43));
      if(phase==='pre-entry')notes+=card(nx,28,270,'先定条件，再看后续',['入场 / 止损 / 目标与右栏联动。','有想法直接在图上用 Text 记录。'],'D60 · 实际买入尚未揭示','#f3ba2f');
      else if(phase==='holding')notes+=card(nx,28,270,'02 · 持仓心态',reveal>=68?['担心利润回吐，先记录心态。','D68 减仓已揭示，保留原计划。']:['买入已揭示，继续观察走势。','先记录当下想法，不急于评价。'],`D${reveal} · 复盘补记`,'#f3ba2f');
      else notes+=card(nx,28,270,'03 · 理性复盘',['分批退出，回看每次执行。','偏离原目标，合理性单独评价。'],'复盘阶段 · 原计划保留','#8cbdff');
    }
    $('.annotations',svg).innerHTML=notes;
  }
  window.renderDesignChart=renderChart;
  const toolMarkup="<button aria-label=\"选择\" title=\"选择\" data-tool=\"0\" class=\"selected\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m4 3 7.5 18 2.5-7 7-2.5L4 3Z\"/></svg></button><button aria-label=\"Text 文字\" title=\"Text 文字\" data-tool=\"1\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 4h16M12 4v16M8 20h8\"/></svg></button><button aria-label=\"趋势线\" title=\"趋势线\" data-tool=\"2\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m3 17 6-6 4 4 8-11M15 4h6v6\"/></svg></button><button aria-label=\"水平线\" title=\"水平线\" data-tool=\"3\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12h18\"/></svg></button><button aria-label=\"平行通道\" title=\"平行通道\" data-tool=\"4\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 17 21 5M3 22 21 10\"/></svg></button><button aria-label=\"盈亏比\" title=\"盈亏比\" data-tool=\"5\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 3v18h17M8 16l4-5 4 2 5-7M8 7h5\"/></svg></button><button aria-label=\"矩形\" title=\"矩形\" data-tool=\"6\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"1.5\"/></svg></button><button aria-label=\"撤销\" title=\"撤销\" data-tool=\"7\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14\" transform=\"translate(0 -2)\"/></svg></button><button aria-label=\"更多工具\" title=\"更多工具\" data-tool=\"more\"><svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"5\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/></svg></button>";
  const planMarkup=`<div class="side-head"><div><small>01 / 买入之前</small><h3>买入前计划</h3></div><button data-close-side aria-label="关闭买入前计划">×</button></div><p class="side-kicker">边看趋势 · 复盘补记草稿</p><div class="side-fields"><label class="wide">计划入场价<input id="entryField" type="number" value="56" step="0.01"></label><label>初始止损价<input id="stopField" type="number" value="52" step="0.01"></label><label>止盈目标价<input id="targetField" type="number" value="68" step="0.01"></label></div><div class="record-modes"><button data-mode="quantity" class="active">按数量</button><button data-mode="amount">按金额</button><button data-mode="ratio">按仓位 %</button></div><div class="side-fields"><label class="wide"><span id="sizeLabel">计划数量（股）</span><input id="sizeInput" type="number" value="1000"></label></div><details class="capital-details"><summary>参考资金与来源 <b id="capitalSummary">¥200,000</b></summary><div class="side-fields"><label class="wide">参考资金（CNY）<input id="capitalInput" type="number" value="200000"></label><label class="wide">资金来源<select id="capitalSource"><option value="manual">手填参考资金 · D60</option><option value="unknown">未知／未提供</option></select></label></div></details><div class="side-metrics"><div><span>计划仓位</span><b id="positionResult">28% · ¥56,000</b></div><div><span>初始风险</span><b id="riskValue">¥4,000 · 2%</b></div><div><span>预期收益 ∶ 风险</span><b id="rrValue">3.00R · 3∶1</b></div></div>`;
  const holdingMarkup=`<div class="side-head"><div><small>02 / 持有之中</small><h3>原计划与当前状态</h3></div><button data-close-side aria-label="关闭持仓侧栏">×</button></div><p class="side-kicker">计划只读，心态直接写在图上</p><div class="side-summary" id="holdingSummary"></div><div class="side-note">此时只记录新事实与心态。执行是否合理，留到事后复盘判断。</div>`;
  const reviewMarkup=`<div class="side-head"><div><small>03 / 事后评价</small><h3>执行复盘</h3></div><button data-close-side aria-label="关闭执行复盘">×</button></div><p class="side-kicker">原计划与真实成交只读</p><div class="side-summary" id="reviewSummary"></div><div class="review-fields"><label>选择退出决策<select id="decisionSelect"><option value="68">D68 · 减仓 600 股 @ 64.00</option><option value="74">D74 · 清仓 400 股 @ 61.00</option></select></label></div><div class="rowlabel">是否早于原计划退出条件？</div><div class="choices" data-review="early">${['是','否','不确定','未评价'].map(t=>`<button>${t}</button>`).join('')}</div><div class="review-fields"><label>退出原因<select id="reasonSelect">${['未记录','计划内分批','结构失效','风险收缩','情绪影响','资金需求','其他'].map(t=>`<option>${t}</option>`).join('')}</select></label><label id="otherReasonLabel" hidden>补充原因<input id="otherReason" placeholder="简短说明，其余写在图上"></label></div><div class="rowlabel">相对原计划的执行</div><div class="choices" data-review="adherence">${['按计划','偏离','无原计划','未评价'].map(t=>`<button>${t}</button>`).join('')}</div><p class="side-foot">“提前”不等于“错误”；每次退出分别记录。</p>`;
  function setupWorkspace(id,markup,open){
    const ws=$('#'+id+' .workspace');ws.classList.remove('has-sidebar');
    const chartWrap=$('.chart-wrap',ws);$$('.annot,.connector,.popover',chartWrap).forEach(el=>el.remove());$$('.drawer,.stage-side',ws).forEach(el=>el.remove());
    const body=document.createElement('div');body.className='work-body';const column=document.createElement('div');column.className='chart-column';chartWrap.before(body);column.append(chartWrap);body.append(column);
    const side=document.createElement('aside');side.className='phase-sidebar';side.dataset.phaseSidebar=id;side.innerHTML=markup;body.append(side);
    const svg=$('.chart',ws);svg.dataset.phase=id==='stage1'?'pre-entry':id==='stage2'?'holding':'post-review';
    $('.drawbar',ws).innerHTML=toolMarkup;
    const names={stage1:'买入前计划',stage2:'持仓侧栏',stage3:'执行复盘'};
    const control=id==='stage1'?'<div class="metric-strip"><button data-plan-focus="entryField">入场 <b id="entryChip">56.00</b></button><button data-plan-focus="stopField">止损 <b id="stopChip">52.00</b></button><button data-plan-focus="targetField">目标 <b id="targetChip">68.00</b></button><span id="rrChip">3.00R</span></div>':id==='stage2'?'<span id="holdingStatus">截止 D69 · 当前持仓 400 股</span>':'<span>净盈亏 <b>+¥6,760</b> · 费用 ¥40 · <b id="actualR">+1.69R</b></span>';
    $('.bottom-tools',ws).innerHTML=control+`<div class="workspace-actions"><button data-toggle-side aria-label="打开${names[id]}">${names[id]}</button>${id!=='stage3'?'<button data-next>下一根 →</button><button data-snapshot>留存快照</button>':'<button data-go="export">三图一表 →</button>'}</div>`;
    function toggle(force){const on=force===undefined?side.hidden:force;side.hidden=!on;ws.classList.toggle('side-open',on);$('[data-toggle-side]',ws).setAttribute('aria-expanded',String(on));requestAnimationFrame(()=>renderChart(svg));}
    $('[data-close-side]',side).addEventListener('click',()=>toggle(false));$('[data-toggle-side]',ws).addEventListener('click',()=>toggle());ws.openSide=()=>toggle(true);toggle(open);
  }
  setupWorkspace('stage1',planMarkup,true);setupWorkspace('stage2',holdingMarkup,false);setupWorkspace('stage3',reviewMarkup,true);
  function updatePlan(){
    plan.entry=numeric($('#entryField'));plan.stop=numeric($('#stopField'));plan.target=numeric($('#targetField'));
    const size=numeric($('#sizeInput')),capital=$('#capitalSource').value==='unknown'?null:numeric($('#capitalInput'));
    plan.qty=size>0?(mode==='quantity'?size:mode==='amount'&&plan.entry>0?size/plan.entry:mode==='ratio'&&capital>0&&plan.entry>0?capital*size/100/plan.entry:null):null;
    const amount=Number.isFinite(plan.entry)&&Number.isFinite(plan.qty)?plan.entry*plan.qty:null,risk=riskOf(plan),rr=rrOf(plan);
    ['entry','stop','target'].forEach(k=>$('#'+k+'Chip').textContent=price(plan[k]));
    $('#rrChip').textContent=rr===null?'R 待补充':rr.toFixed(2)+'R';
    $('#rrValue').textContent=rr===null?'待补充／检查价格方向':rr.toFixed(2)+'R · '+rr.toFixed(2)+'∶1';
    $('#positionResult').textContent=(capital>0&&amount!==null?(amount/capital*100).toFixed(1)+'%':'比例待补充')+' · '+cash(amount);
    $('#riskValue').textContent=cash(risk)+(capital>0&&risk!==null?' · '+(risk/capital*100).toFixed(1)+'%':'');
    $('#capitalSummary').textContent=cash(capital);renderChart($('#stage1 .chart'));
  }
  $$('#stage1 input,#stage1 select').forEach(el=>el.addEventListener('input',updatePlan));
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{const cap=numeric($('#capitalInput'));const values={quantity:plan.qty,amount:plan.qty*plan.entry,ratio:cap>0?plan.qty*plan.entry/cap*100:null};mode=b.dataset.mode;$$('[data-mode]').forEach(el=>el.classList.toggle('active',el===b));$('#sizeLabel').textContent={quantity:'计划数量（股）',amount:'计划金额（CNY）',ratio:'计划仓位（%）'}[mode];$('#sizeInput').value=Number.isFinite(values[mode])?Number(values[mode].toFixed(4)):'';updatePlan()}));
  function updateReadOnly(){
    $('#stage2 .chart').dataset.reveal=holdingDay;
    const r=riskOf(retained),pr=`${price(retained.entry)} / ${price(retained.stop)} / ${price(retained.target)}`;
    $('#holdingSummary').innerHTML=`<span>原计划 · 入场 / 止损 / 目标</span><b>${pr}</b><span>已留存计划 · 初始数量</span><b>${retained.qty??'待补充'} 股 · 风险 ${cash(r)}</b><span>当前已知成交</span><b>D60 买入 1,000 @ 56.00</b>${holdingDay>=68?'<b>D68 减仓 600 @ 64.00</b>':''}${holdingDay>=74?'<b>D74 清仓 400 @ 61.00</b>':''}`;
    $('#stage2 .stage-caption .number').textContent=`04 / HOLDING PSYCHOLOGY · REVEAL D${holdingDay}`;$('#stage2 .stage-caption p').textContent=`截止 D${holdingDay}，只展示当前已揭示成交；原计划只读，心态直接记录在图上。`;$('#stage2 .stage-caption .pill').textContent=`阶段 2 / 3 · D${holdingDay}`;
    $('#holdingStatus').textContent=`截止 D${holdingDay} · 当前持仓 ${holdingDay>=74?0:holdingDay>=68?400:1000} 股`;
    const actual=r>0?(6760/r).toFixed(2)+'R':'R 待核算';$('#actualR').textContent=actual;
    $('#reviewSummary').innerHTML=`<span>原计划 · 入场 / 止损 / 目标</span><b>${pr}</b><span>初始数量 / 风险基准</span><b>${retained.qty??'待补充'} 股 / ${cash(r)}</b><span>实际入场 · D60</span><b>1,000 股 @ 56.00</b><span>最终净盈亏 / 实际 R</span><b>+¥6,760 / ${actual}</b>`;
  }
  function updateReview(){const data=reviews[decision];$$('[data-review]').forEach(group=>$$('button',group).forEach(b=>{const on=b.textContent===data[group.dataset.review];b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}));$('#reasonSelect').value=data.reason;$('#otherReasonLabel').hidden=data.reason!=='其他';$('#otherReason').value=data.other||'';}
  $('#decisionSelect').addEventListener('change',e=>{decision=Number(e.target.value);updateReview()});
  $$('[data-review]').forEach(group=>group.addEventListener('click',e=>{if(e.target.tagName!=='BUTTON')return;reviews[decision][group.dataset.review]=e.target.textContent;updateReview()}));
  $('#reasonSelect').addEventListener('change',e=>{reviews[decision].reason=e.target.value;updateReview()});$('#otherReason').addEventListener('input',e=>reviews[decision].other=e.target.value);
  function go(id){location.hash=id;}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go);const p=e.target.closest('[data-plan-focus]');if(p){$('#stage1 .workspace').openSide();$('#'+p.dataset.planFocus).focus()}const tag=e.target.closest('#stage1 .price-tag');if(tag){$('#stage1 .workspace').openSide();$('#'+tag.dataset.field+'Field').focus()}});
  function next(id){if(id==='stage1'){holdingDay=61;$('#stage2 .chart').dataset.reveal='61';updateReadOnly();go('stage2');return;}if(id==='stage2'){holdingDay=Math.min(80,holdingDay+1);$('#stage2 .chart').dataset.reveal=holdingDay;renderChart($('#stage2 .chart'));updateReadOnly();}}
  $$('[data-next]').forEach(b=>b.addEventListener('click',()=>next(b.closest('.view').id)));
  $$('[data-snapshot]').forEach(b=>b.addEventListener('click',()=>{if(b.closest('#stage1')){retained={...plan};updateReadOnly()}toast('已留存本页演示快照；刷新恢复，未写入数据库。')}));
  function arm(id){armed=id;toast('点击图表空白处，直接写下想法。');}
  $$('[data-tool]').forEach(b=>b.addEventListener('click',()=>b.dataset.tool==='1'?arm(b.closest('.view').id):toast('此处展示工具位置；完整绘图能力留待产品实现。')));
  $$('.chart-wrap').forEach(host=>host.addEventListener('click',e=>{if(!armed||host.closest('.view')?.id!==armed||e.target.closest('button,.price-tag'))return;const r=host.getBoundingClientRect(),note=document.createElement('div');note.className='user-note';note.style.left=Math.max(5,Math.min(e.clientX-r.left,r.width-270))+'px';note.style.top=Math.max(5,Math.min(e.clientY-r.top,r.height-100))+'px';note.innerHTML='<div contenteditable="true" role="textbox" aria-label="图上复盘文字">在这里写下当前想法…</div><small>复盘补记 · 当前阶段 · 仅本页暂存</small>';host.append(note);note.firstElementChild.focus();armed=null;}));
  document.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Escape'){armed=null;const view=$(location.hash||'#stage1'),close=view?.querySelector('.phase-sidebar:not([hidden]) [data-close-side]');if(close)close.click();return}if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;const id=location.hash.slice(1);if(e.key==='ArrowRight'&&['stage1','stage2'].includes(id)){e.preventDefault();next(id)}if(e.key.toLowerCase()==='t'&&['stage1','stage2','stage3'].includes(id)){e.preventDefault();arm(id)}});
  const record=$('#record .workspace');record.innerHTML=`<div class="wtop"><strong>同一主图，两个录入时点</strong><span class="subtle">字段跟随阶段，不离开价格趋势</span></div><div class="record-stage-map">${[['stage1','01 · 买入前计划','pre-entry',60,'入场 / 止损 / 目标 · 数量或仓位 · 预期 R','打开买入前计划 →'],['stage3','03 · 事后执行复盘','post-review',80,'逐次退出 · 是否提前 / 原因 / 执行符合度','打开执行复盘 →']].map(([id,title,phase,day,text,button])=>`<article><h3>${title}</h3><svg class="chart" data-phase="${phase}" data-reveal="${day}" aria-label="${title}趋势"><g class="chart-grid"></g><g class="series"></g><g class="annotations"></g></svg><p>${text}</p><button data-go="${id}">${button}</button></article>`).join('')}</div>`;
  $('#record .stage-caption h3').textContent='计划在买入前定，执行在事后评。';$('#record .stage-caption p').textContent='两组字段各归其位；录入侧栏始终与对应阶段主图并排。';
  $('#stage1 .legend').innerHTML='<strong>并排录入，不挡价格</strong><ol><li>① 在右栏填写计划；入场、止损、目标即时同步图线。</li><li>② 价格轴位于图表右缘，侧栏在轴外另占一列，中间留白分隔。</li><li>③ 下一根进入持仓；事后评价另在阶段 3 录入，原计划独立保留。</li></ol>';
  $('#stage2 .legend').innerHTML='<strong>持仓阶段：保留当下</strong><ol><li>实际成交按揭示边界逐步出现，原计划独立保留。</li><li>继续按下一根推进；图上 Text 记录当时心态。</li><li>执行评价在事后阶段填写，此时不先下结论。</li></ol>';
  $('#record .legend').innerHTML='<strong>两部分结构记录</strong><ol><li>入场前只记录计划条件和预期风险，不出现执行评价。</li><li>持仓期间以图上 Text 为主，原计划只读，保留当下心态。</li><li>事后逐次选择退出并评价，实际成交来自原始记录。</li></ol>';
  if(window.buildSupportingBoards)window.buildSupportingBoards(renderChart);
  function route(){const id=location.hash.slice(1)||'stage1';$$('.nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+id));if(id==='stage1')$('#stage1 .chart').dataset.reveal='60';updateReadOnly();requestAnimationFrame(()=>$$('#'+id+' .chart').forEach(renderChart));}
  updatePlan();updateReview();updateReadOnly();
  $$('.chart').forEach(renderChart);if(!location.hash)location.hash='stage1';addEventListener('hashchange',route);route();
  const ro=new ResizeObserver(()=>{const view=$(location.hash||'#stage1');if(view)$$('.chart',view).forEach(renderChart)});$$('.chart-column').forEach(el=>ro.observe(el));
})();
