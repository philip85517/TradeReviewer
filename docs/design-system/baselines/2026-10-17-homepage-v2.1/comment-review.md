# 首页 V2.1 评论逐条响应清单

本清单从 V1 `reviews/2026-10-16/HOME-DOC.json` 转录 39 条评论，保留原始 comment ID 与原文。它是用户可读的设计响应索引，不改变 JSON 中的评论状态、历史或回复。V2 的旧 R4 结论已被独立复审撤销。V2.1 保留评论原文，按12项修订重审；最终静态复核：36条PASS、C18待决定、C34/C38排除；39条均可追溯。当前状态以本版 acceptance.html 为准。C18 的 D01 待决定，C34/C38 窄屏用户排除。静态规范不代表产品运行通过。

## C01 · comment-5fe2b31bff9f42be8db7975a6925bea1

**原文：** 其中这里的“持仓照看*复盘总结*持续进化“ 这几个描述就非常low，我理解就算要写，也应该是一些类似slogan的提示，布局的位置也非常乱，为什么放在标题下，让整体的布局整体往下偏了一行，要么就去掉，把珍贵的空间让给其他部分

**设计响应：** HP01 去掉标题下整行口号，页头只保留“我的交易室”、范围、更新时间；必要解释收进 `i` tooltip。64px 单行页头把空间还给今年表现和当前持仓。

**锚点与图稿：** [HP01](visual-design.md#chapter-HP01)、[home-1440.svg](images/home-1440.svg)、[home-1280.svg](images/home-1280.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C02 · comment-dba0c8a8f6d74738ae079dcc0d8ed43a

**原文：** 这部分的设计布局思路是认可的

**设计响应：** HP01 保留当前状态与已完成交易上下分区，但 V2 将今年表现置于首屏、当前持仓仍指向最新时点，历史已平仓独立按平仓日归年。

**锚点与图稿：** [HP01](visual-design.md#chapter-HP01)、[home-1440.svg](images/home-1440.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C03 · comment-63a32f7e6aae48e7832a5992175f0be3

**原文：** 但按照现在这块的盈亏提示版本中的切分，有一个交叉的逻辑：
1）当年/近1月/近1周的盈亏。需要把近3个月去掉，应该看的可能性很低。（包含已完成的交易和当时的持仓盈亏）所以这应当是这几个时间周期内，每日当时实际持仓值的盈亏计算。
2）这里的设计里，没有体现为实现盈亏的设计逻辑，以及缺失了“截止这个时间段实际盈亏的设计”，总市值这个名字是否应该是”总资产“？

**设计响应：** HP02 删除近 3 月快捷项，明确 Asia/Shanghai 自然年/月/周边界；公式为期间已实现 + 期末浮盈 − 期初浮盈。HP02/HP04 规定图点详情显示每日实际持仓估值、当日浮盈和期间结果；当前持仓市值与当前浮盈始终为最新值。没有现金/负债覆盖时不称总资产。

**锚点与图稿：** [HP02](visual-design.md#chapter-HP02)、[HP04](visual-design.md#chapter-HP04)、[chart-hover.svg](images/chart-hover.svg)、[history.svg](images/history.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C04 · comment-cb5e9d60cddd4ad7bad03533d01e3afd

**原文：** 这里应该是把收益拆成“当年收益”，与“历年收益”这两个部分吧，前部分更多是最近时效性的数据的展现
已交易的内容放在下方，今年以前的已经的盈亏，只会在分年滚动之后才会更新，我们也明确下，假如交易跨年（买入和卖出不在同一年；当然做空也一样），以实际平仓的时间和金额为准划分归属的年份。

**设计响应：** HP02 将今年表现与历年已平仓分区；跨年、做空和部分平仓均按实际平仓日归年，并给出“成本100/期初浮盈20/本年卖130”示例，说明期间表现 10 与历史平仓 30 不可相加。历史补录/撤销/修正可重算并显示更新时间。

**锚点与图稿：** [HP02](visual-design.md#chapter-HP02)、[history.svg](images/history.svg)、[home-1440.svg](images/home-1440.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C05 · comment-12e46f52d45140f1bf2ae9d2dd267167

**原文：** 这里带来的负担就是，太复杂了
对于知晓当前全市场收益来讲，默认是CNY就可以了；
何时需要有港币，人民币，美元的区分，应当是在第一部分中，有一个市场切换的tab时，才会涉及到；
这里在设计的时候没有考虑到按市场进行切换，而是粗暴的将币种展现出来，因此出现这个问题，这是明确的一个需要调整的视觉缺陷问题

**设计响应：** HP03 让市场 tab 决定单位：全部/A 股为 CNY、港股为 HKD、美股为 USD；全部视图只显示 CNY，不在每行重复市场和币种。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[market-all.svg](images/market-all.svg)、[market-us.svg](images/market-us.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C06 · comment-9316fcd7d4104861a1202184b59afdb7

**原文：** 这个名词太抽象了，是否时一些公共的功能切换组件？

**设计响应：** HP03 将“性质”改为可见的 `实盘⌄` 公共选择器，并与 `全部账户⌄` 并列，写明当前值和模拟盘运行选择。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[controls.svg](images/controls.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C07 · comment-a6c985fa9b44498abacd85e3e0905535

**原文：** 没看懂这句话啥意思

**设计响应：** HP03 把抽象说明改成“实盘/模拟盘”“全部账户”和市场 tab 等可见当前值；长解释只在 `i` tooltip 中出现。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[controls.svg](images/controls.svg)、[market-all.svg](images/market-all.svg)。

**补充复验证据：** [scope-menu.svg](images/scope-menu.svg)、[account-menu.svg](images/account-menu.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C08 · comment-70f0a14cbc5147b0809afdd5c36c0840

**原文：** 应该是公共组件变化之后，实际展现的条件会如何发生变更

**设计响应：** HP03 定义公共控件联动：市场同步历史区、单位、贡献；期间只作用今年 KPI/期间曲线/当前期间贡献；当前持仓始终最新；scope 请求成功后整体原子替换。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[market-all.svg](images/market-all.svg)、[market-us.svg](images/market-us.svg)、[filter-applied.svg](images/filter-applied.svg)。

**补充复验证据：** [scope-menu.svg](images/scope-menu.svg)、[account-menu.svg](images/account-menu.svg)、[market-all.svg](images/market-all.svg)、[market-a.svg](images/market-a.svg)、[market-hk.svg](images/market-hk.svg)、[market-us.svg](images/market-us.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C09 · comment-a37dcd2dcf5646ebbcc2c2a37c728fa4

**原文：** 同样这种异常的情形，应该有配套的异常说明的交互规范来进行规范，视觉设计来落地验收，否则最后的实现上，会有很多实现上的问题，也不能进行验收

一句话：明确异常时的展现形式和规范，并充分纳入到视觉设计和交互设计上来，不要这么宽松的验收条件

**设计响应：** HP07 将 loading、updating、stale、no-fx、partial、error 分开规定尺寸、颜色、文字、tooltip、重试和 reduced-motion；错误用小图标和浮层，不在主界面打印日志。

**锚点与图稿：** [HP07](visual-design.md#chapter-HP07)、[state-loading.svg](images/state-loading.svg)、[state-error.svg](images/state-error.svg)。

**补充复验证据：** [cold-error.svg](images/cold-error.svg)、[retry-result.svg](images/retry-result.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C10 · comment-d999bc50ed734b55a3ff82427ef62f31

**原文：** 以这个为准

**设计响应：** HP02 以用户认可的收益分拆和跨年平仓日口径作为 V2 指标基准，并明确更新可重算。

**锚点与图稿：** [HP02](visual-design.md#chapter-HP02)、[history.svg](images/history.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C11 · comment-b3987837bd054a098e7d2f09e255be42

**原文：** 如之前的评论，这块的空间还需要设计，控件还可以再压缩；尤其例如“性质”再加上一个下拉框，明显浪费空间，标题是不需要的；完全可以是“实盘”再一个下拉箭头切换；“全部账户”下拉箭头切换，节约空间，等等。搜索框完全可以是点击后出来的浮层，除了未来扩展快捷提示外，还可以加上一些底纹热门cache选择的推荐空间

**设计响应：** HP01/HP03 使用 64px 单行页头，实盘与全部账户直接显示当前值；全局搜索点击图标后展开局部浮层，可放最近/热门缓存，不推动 KPI。

**锚点与图稿：** [HP01](visual-design.md#chapter-HP01)、[HP03](visual-design.md#chapter-HP03)、[search-open.svg](images/search-open.svg)。

**补充复验证据：** [scope-menu.svg](images/scope-menu.svg)、[account-menu.svg](images/account-menu.svg)、[search-open.svg](images/search-open.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C12 · comment-ae78d0af9fb947ad91f9a68856df2fc5

**原文：** 没看懂这句话啥意思

**设计响应：** HP03 用具体的“点击搜索图标→浮层→结果身份→选择/关闭”分镜替代抽象描述。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[search-open.svg](images/search-open.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C13 · comment-d38f4c7d8bff491695bdae098f505c1b

**原文：** 筛选这个功能框和组件要重新设计

**设计响应：** HP03 将筛选改为图标+计数徽标+anchored popover，条件提交、清除附加条件和恢复默认分开。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[filter-open.svg](images/filter-open.svg)、[filter-applied.svg](images/filter-applied.svg)。

**补充复验证据：** [filter-reset.svg](images/filter-reset.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C14 · comment-2a343d21700f4564adc777e0fc04cbc5

**原文：** 筛选这块的功能块太违和，交互插入的内容会使得界面布局不够稳定

**设计响应：** 筛选浮层绝对定位，不插入页头流式布局；打开、应用、关闭均不推动 KPI 和表格。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[filter-open.svg](images/filter-open.svg)、[filter-applied.svg](images/filter-applied.svg)。

**补充复验证据：** [filter-reset.svg](images/filter-reset.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C15 · comment-ceccde8414c64f058caf6d8013fb157f

**原文：** 这里的市场，应当可以与”持仓照看“结合起来，不同的市场，应当有不同的tab页可以用来切换

**设计响应：** HP03 固定全部/A 股/港股/美股四个市场 tab；市场同时作用今年表现、当前持仓、历史区、贡献和单位。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[market-all.svg](images/market-all.svg)、[market-us.svg](images/market-us.svg)。

**补充复验证据：** [market-all.svg](images/market-all.svg)、[market-a.svg](images/market-a.svg)、[market-hk.svg](images/market-hk.svg)、[market-us.svg](images/market-us.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C16 · comment-dc7fc3f7da0d413ea8c4098395fd9e99

**原文：** 1）货币应当与tab中的市场切换结合，这样的话功能层次是被隔离开的，不会有这么多汇率的内容在里面，功能设计能够正交
2）图表中缺少线的效果绘制说明，也没说清楚横轴/纵轴各是什么，以及数据缺失的情况或者未更新的情况，当数据在后台更新时，这里的展现策略和刷新策略是什么，这些都是缺少的内容

**设计响应：** HP03 规定市场决定单一币种；HP04 规定期间净盈亏横轴、纵轴、线宽、网格、图例、缺口和更新策略；HP07 规定后台保留旧数据并原子替换。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[HP04](visual-design.md#chapter-HP04)、[chart-hover.svg](images/chart-hover.svg)、[chart-gap.svg](images/chart-gap.svg)、[state-updating.svg](images/state-updating.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C17 · comment-55a717a1d5dd4546b35cf63a95764790

**原文：** 这张图片中
1）持仓照看的背景图层是否有问题？本来就这么小的空间，还要再花啦好几层，是否这个背景看起来不协调，而且还有点重复
2）资产分布这块应该和左侧的持仓总览是一整块的，为啥会并行地切换成两块，按照之前的评论，当你区分不同市场的时候，这个资产分布似乎就没必要了，例如切换到总览的时候，才需要有不同资产的分布的展现需要，所以当左侧进行不断切换的时候，右边假如固定的话，而且固定占用这么大的区间的话，太浪费空间
所以这里的资产分布一定是个低频的查看；其次是固定展现也是有很大的问题，浪费了宝贵的空间。
3）这里的建议：需要思考右侧资产分布是否有存在的必要？这里唯一的功能是，左侧总体的收益和亏损的时候，直到是哪个市场贡献的（但一般我认为都会直接看到后面的股票盈利贡献了，这里的功能是不是比较鸡肋？假如鸡肋的话，我们按照简洁设计的需要，不额外加这种功能

**设计响应：** HP01 移除右侧固定资产分布和重复背景层；HP06 用全宽期间/历史贡献回答市场贡献，资产分布不进入首页默认布局。

**锚点与图稿：** [HP01](visual-design.md#chapter-HP01)、[HP06](visual-design.md#chapter-HP06)、[home-1440.svg](images/home-1440.svg)、[contribution-10.svg](images/contribution-10.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C18 · comment-ca5c477118e842959062a8e70414b131

**原文：** 1. 这里的效果图需要有线的效果和交互规范
2.右侧的资产分布参考上面的说明
3.缺失和说明的问题只需要判断是否影响理解和信息密度，界面是否会让人抓不到头脑
4. 历史持仓日期（选择日期查看）这个功能是干啥？没太看懂，类似与回到某一个时间点去进行回放？这个功能需要判断下是否有存在的必要，按照使用的频次和设计的目的去判断，还原告知我之后，我们再进行确认是否要保留

**设计响应：** HP04 定义线、轴、缺口、hover/focus 和更新；HP01/HP06 移除默认资产分布。D01 只提出图点详情二级“查看该日敞口”，明确不是回放；频次无证据，保留/移除待用户确认。

**锚点与图稿：** [HP04](visual-design.md#chapter-HP04)、[chart-hover.svg](images/chart-hover.svg)、[chart-gap.svg](images/chart-gap.svg)、[snapshot-options.svg](images/snapshot-options.svg)。

**状态：** PENDING_DECISION：D01 去留仍待用户决策；其他设计响应已复核，不代表已批准保留。

## C19 · comment-2d2439b9668247c0a54abbfa80287292

**原文：** ”持仓历史正在更新“这个功能需要有有动态效果，什么样的动效认为是在更新，更新过程中不应该影响使用时的展示（应该是后台驱动）；

**设计响应：** HP07 规定更新状态环 1.2s、旧数据继续可读、成功整组替换、失败保留旧数据；reduce-motion 时静态显示。

**锚点与图稿：** [HP07](visual-design.md#chapter-HP07)、[state-updating.svg](images/state-updating.svg)、[motion.svg](images/motion.svg)。

**补充复验证据：** [retry-result.svg](images/retry-result.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C20 · comment-f6d3fd3cbdb349d8ad12da2f79839760

**原文：** 持仓查看这里：
1）还需增加更新的动效（异步的），保证前向的数据更新不要导致界面功能的不稳定，以及展示布局的不稳定
2）这里的持仓总览部分要重新检查，应当以最上方的才是主图，这里的功能不符合

**设计响应：** HP01 把今年表现主图置于首屏前段，HP04 保持当前持仓最新语义；HP07 用异步更新状态而不是整页重排。

**锚点与图稿：** [HP01](visual-design.md#chapter-HP01)、[HP04](visual-design.md#chapter-HP04)、[state-updating.svg](images/state-updating.svg)、[home-1440.svg](images/home-1440.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C21 · comment-c8088f2c965e47e58c1de3235eae7f5c

**原文：** 这里的交互分镜更表明了这里的设计功能和布局有多糟糕，功能分层的思路，控件的布局，均很差，需要重新设计

**设计响应：** HP03 以公共范围→市场 tab→期间→局部搜索/筛选的层级重排控件；HP04/HP07 分开日期草稿、图点详情和更新状态。

**锚点与图稿：** [HP03](visual-design.md#chapter-HP03)、[HP04](visual-design.md#chapter-HP04)、[filter-open.svg](images/filter-open.svg)、[chart-hover.svg](images/chart-hover.svg)。

**补充复验证据：** [scope-menu.svg](images/scope-menu.svg)、[account-menu.svg](images/account-menu.svg)、[search-selected.svg](images/search-selected.svg)、[filter-reset.svg](images/filter-reset.svg)、[local-search.svg](images/local-search.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C22 · comment-3e12746336dc49c3b9e1cbb9dd6152c3

**原文：** 1. 这里的布局，同样浪费空间严重，排版严重有问题
2.整体的问题与之前的图的问题类似，说明文字应该用更轻量级的空间，哪怕是悬浮后的一个浮层文字显示也应该更好，主页面上不应该嵌入这种说明类的控件
3. 这里的展示信息重复：
    例如A股*沪市，CNY，这些信息都应该是只展示一份即可；例如这个持仓的tab，可以切换美股/港股/A股，这个切换的tab自然带有市场信息；同时CNY这个字段或者HKD这些字段，就应该加到持仓市值（CNY）标题中，同样¥，或者$ 也可以放到标题中，这样整体字段，行列都能拉齐；
4. 对于最近记录这列，图片都能给到，为啥写的文字这么怪，要么写暂无记录，要么写21天前已留存0份快照。这个字段是否有存在必要？或者应该是给到一个持仓累积多少天会表有意义
5. 看图*记录这种标签按钮名字是否要改成类似“查看”这些？需要统一入口的语义
6. 上一页/下一页，每页究竟有多少行宽能比较好保证每次翻页固定的体验（交互控件稳定，不会因为切换市场高低突然发生差异；
7. 其次是股票代号和名称，不同的市场股票名字长度不一致，这里的分列的设计，文字的展示需要再设计一下，用不同的案例，或者极端的case来重新设计字体/展示形式等，我个人建议可以考虑全称可以固定长度截断悬浮展现全称。这里的详情也很诡异，就是用来干啥的，是否有必要，交互形式不好，需要重新设计

**设计响应：** HP05 使用轻量 tooltip、市场 tab 单一单位、`持仓天数`与`当前浮盈`列、统一“查看”图标、8 行固定槽位/48px 行高和分页；取消最近记录/行内展开，长名省略后 hover/focus 显示全称。

**锚点与图稿：** [HP05](visual-design.md#chapter-HP05)、[holdings-0.svg](images/holdings-0.svg)、[holdings-20.svg](images/holdings-20.svg)、[holdings-50.svg](images/holdings-50.svg)。

**补充复验证据：** [holdings-extreme.svg](images/holdings-extreme.svg)、[holding-detail.svg](images/holding-detail.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C23 · comment-219740552831434f91eabe90aaf05dde

**原文：** 展开这种形式太差了，悬浮全称也比这个好，毕竟全称查看这个频次很低

**设计响应：** HP05 删除行内展开，使用省略号和 hover/focus 全称 tooltip，保持表格高度稳定。

**锚点与图稿：** [HP05](visual-design.md#chapter-HP05)、[holdings-10.svg](images/holdings-10.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C24 · comment-a8505250b9724bdb8cb2dc8a29d96e65

**原文：** 这个交互和特定情况需要重新review设计

**设计响应：** HP05 将特定情况拆成 0 持仓、搜索无结果、缺价、负数量、长名和分页状态；CSV(0) 在当前无行时禁用，因为没有可导出的持仓集合，tooltip 明确原因。

**锚点与图稿：** [HP05](visual-design.md#chapter-HP05)、[holdings-0.svg](images/holdings-0.svg)、[holdings-5.svg](images/holdings-5.svg)、[state-partial.svg](images/state-partial.svg)。

**补充复验证据：** [local-search.svg](images/local-search.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C25 · comment-f830b8c091604c36ae25f86d8ee7325e

**原文：** 这个没看懂，重试这种动作理论应该是在其它地方操作的，而且应该是异步的，不应该打扰主的用户动线

**设计响应：** HP07 把重试限制在错误 tooltip/异常浮层内，异步执行、防重复触发，成功后移除错误状态，不把按钮放进主浏览路径。

**锚点与图稿：** [HP07](visual-design.md#chapter-HP07)、[state-error.svg](images/state-error.svg)、[motion.svg](images/motion.svg)。

**补充复验证据：** [retry-result.svg](images/retry-result.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C26 · comment-8a2a3160fb1142f2a89622df06492763

**原文：** 分页的控件/字体大小/分页固定行数/分列宽度这种还需要拿不同的例子来进行交互和展示分镜的设计

**设计响应：** HP05 固定表头 40px、行 48px、分页 48px、8 行槽位，提供 0/5/10/20/50 五组图稿和不同市场的列宽/长名样本。

**锚点与图稿：** [HP05](visual-design.md#chapter-HP05)、[holdings-0.svg](images/holdings-0.svg)、[holdings-5.svg](images/holdings-5.svg)、[holdings-10.svg](images/holdings-10.svg)、[holdings-20.svg](images/holdings-20.svg)、[holdings-50.svg](images/holdings-50.svg)。

**补充复验证据：** [local-search.svg](images/local-search.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C27 · comment-0bb5c5810ec8449bb1ae830b4c971c21

**原文：** 这个入口的位置布局非常局促和别扭；尤其是左侧的标题和下面的文字，尤其感觉布局的形态不合适；
我在想这些交互的按钮，进入的一些功能键，能否使用规范化的icon去进行代替，而不要用文字+button的方式去进行，这样会导致整个布局不稳定

**设计响应：** HP06 使用图标+tooltip/aria-label 作为交易库日期检索、待复盘队列和贡献入口；交易库路由、徽标、来源返回路径已固定，减少首页文字按钮。

**锚点与图稿：** [HP06](visual-design.md#chapter-HP06)、[controls.svg](images/controls.svg)、[home-1440.svg](images/home-1440.svg)。

**补充复验证据：** [home-1280.svg](images/home-1280.svg)、[library-handoff.svg](images/library-handoff.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C28 · comment-5420e4ed6991497f8884e7d3bef042c2

**原文：** 日历究竟怎么设计能帮助定位怎样的问题呢？这里的设计初衷和希望达到的交互分镜是怎样的，主要满足用户哪些需求？

**设计响应：** HP06 明确日历日期检索移到交易库，日期入口带入 `date`、市场和 scope；首页不再承担低频日历面板。日期检索进入交易库的路径与返回恢复由 journey-history 分镜定义；本条不依赖 D01。

**锚点与图稿：** [HP06](visual-design.md#chapter-HP06)、[journey-history.svg](images/journey-history.svg)、[journey-library.svg](images/journey-library.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C29 · comment-9f71c475c7ce4def83bc56a7ea555a73

**原文：** 贡献盈亏的展现，这样挤在中间，能够看清楚么？同时这是一个向下扩展的内容，假如持仓书来给你一朵，这个就没法自然看清了，这块的交互要考虑动效，尤其是需要向下扩展时的动效结果要进行一个参考

**设计响应：** HP06 让贡献分析独占全宽，按绝对贡献排序，0/5/10/20/50 分组提供图稿；逐 10 行展开，200ms 动画，保留已有行的视口位置；按钮随列表末尾下移，不用 scrollTop 补偿。键盘展开聚焦首个新增行，收起前移回保留行。

**锚点与图稿：** [HP06](visual-design.md#chapter-HP06)、[contribution-0.svg](images/contribution-0.svg)、[contribution-20.svg](images/contribution-20.svg)、[contribution-50.svg](images/contribution-50.svg)、[motion.svg](images/motion.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C30 · comment-6f8fa76e3c07421abe88804919b56265

**原文：** 这个交互上至少在初始化网页时，要有一个兜底值，不然整个界面看起来会像个半成品，至少要告知用户更新/修正，但整体功能要保证一个体验

**设计响应：** HP07 规定固定尺寸首载骨架、同 scope 缓存、更新时间/修正提示和旧数据保留；不将未加载、0 和失败混为一态。

**锚点与图稿：** [HP07](visual-design.md#chapter-HP07)、[state-loading.svg](images/state-loading.svg)、[state-stale.svg](images/state-stale.svg)。

**补充复验证据：** [cold-error.svg](images/cold-error.svg)、[retry-result.svg](images/retry-result.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C31 · comment-0110489e956b4502a6f77a9041c20b81

**原文：** 最上方的几个数据卡片，要保证小字的简洁可读性，非必要不加文字，文字要有必要的辅助解释作用，同时也要考虑行宽，不能占用太多面积，宁可详细的说明可以悬浮的时候说明，卡片上要简洁一致；
同时历史已平仓的盈亏，尤其是和最上方持仓部分也要保持尽量一致

其次中间的三个豆腐块：
1）已完成的折线图，要设计好看的横轴/纵轴是什么？像这边的示例，左侧空了好大的地方，是什么原因导致的？是否需要背景有小网格，方便看每个点附近的具体值？是否要有tab切换不同市场的卡片和汇总的卡片，这里的交互分镜和UI设计要重新设计层次布局
2）中间的盈亏贡献分解有用，但卡在中间，导致盈亏的扩展横向无法扩展；纵向又会带歪并行的两块组件。这块的交互以及展现形式要重新进行逻辑组织，说明必要的按什么维度进行盈亏组织，能让用户获取什么信息，切换那几个视角看？当持仓数量为0/5/10/20/50的时候展示效果是怎样的？该怎么取舍等
3）盈亏日历是否需要存在？存在的目的是什么？当我们的交易横跨很久，这里的日历能展现的增益信息是什么？盈亏日里是否应该加到今年的持仓收益信息中是否会更好
4）最后下方的待复盘的列表，是否有必要在这里展示？是否应该在交易库中进行设计和展示就行了？然后假如有新增加的未复盘，在交易库的左侧icon做设计显示数量即可

**设计响应：** HP02 采用简洁 KPI+tooltip；HP04 完整定义期间曲线轴、网格、图例；HP06 让贡献独占全宽并区分当前期间/历史已平仓，提供五种量级；日历和待复盘固定迁移交易库，左侧显示 queue 徽标。

**锚点与图稿：** [HP02](visual-design.md#chapter-HP02)、[HP04](visual-design.md#chapter-HP04)、[HP06](visual-design.md#chapter-HP06)、[history.svg](images/history.svg)、[contribution-10.svg](images/contribution-10.svg)。

**补充复验证据：** [market-all.svg](images/market-all.svg)、[market-a.svg](images/market-a.svg)、[market-hk.svg](images/market-hk.svg)、[market-us.svg](images/market-us.svg)、[contribution-history.svg](images/contribution-history.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C32 · comment-9dedf8667c7f4e7e8d3cb82697899056

**原文：** 日历假如直接索引的这个方式固然好，但假如是为了复盘进入更简单的话，是否直接放到交易库中，作为一种交易检索的入口会更好？

**设计响应：** HP06 已确定将日期入口迁移交易库，不是待确认删除。路由为 `/trades?date=YYYY-MM-DD&market=<market>&scope=<scope>&accounts=<accounts>`，带入日期、市场和当前范围；直开/刷新保持参数，返回首页保留来源和滚动位置。

**锚点与图稿：** [HP06](visual-design.md#chapter-HP06)、[controls.svg](images/controls.svg)。

**补充复验证据：** [library-handoff.svg](images/library-handoff.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C33 · comment-8a6e8786134148fd971fb3acebaf1405

**原文：** 如上面的评论，这块的功能可能放交易库更合适

**设计响应：** HP06 将待复盘队列固定迁移交易库，首页入口使用队列图标和数量徽标；路由为 `/trades?queue=pending-review&market=<market>&scope=<scope>&accounts=<accounts>`，0 隐藏数字但保留可访问名称，99 以上为 `99+`。直开与刷新保持 URL 参数；返回首页恢复来源期间、筛选和滚动位置。

**锚点与图稿：** [HP06](visual-design.md#chapter-HP06)、[controls.svg](images/controls.svg)、[home-1440.svg](images/home-1440.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C34 · comment-8b244c80874848bea381e6606793a2d4

**原文：** 窄屏我们暂不介入开发和设计

**设计响应：** HP09 明确本轮只验收 1440×1000 与 1280×800 桌面；窄屏排除，不以桌面缩放代替窄屏设计。

**锚点与图稿：** [HP09](visual-design.md#chapter-HP09)、[home-1280.svg](images/home-1280.svg)。

**状态：** 用户排除：本轮不设计窄屏；不记为 PASS。

## C35 · comment-e27443bc26514dc9a56012e22c5baa1d

**原文：** 这里的ICON还是太简单了，用了这么大的按钮，里面放了几个文字，感觉不够紧凑，浪费复盘的屏幕控件

**设计响应：** HP08 规定图标+tooltip+aria-label、36px 桌面命中区、统一状态和紧凑控件；文字说明移入浮层，交易库/日期/队列入口不用大号文字按钮。

**锚点与图稿：** [HP08](visual-design.md#chapter-HP08)、[controls.svg](images/controls.svg)、[tokens.svg](images/tokens.svg)。

**补充复验证据：** [controls-states.svg](images/controls-states.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C36 · comment-594abc302d064b8a82e621a760654f9b

**原文：** 这里的各种加载错误的效果，首先兜底的方案没设计好，让整个网页产生类似一种中间产品的感觉；其次，各种加载错误的各种展现效果，更像是在主界面打日志的感觉，哪怕要展现错误日志，也可以用小的icon 比如！，有数据错误，然后悬浮展示细节说明等方式来进行设计，现在的展示非常丑陋

**设计响应：** HP07 把加载/错误改为固定尺寸骨架、状态徽标、小警告图标和 tooltip；详细原因在浮层，旧有效数据继续显示，主界面不堆日志。

**锚点与图稿：** [HP07](visual-design.md#chapter-HP07)、[state-loading.svg](images/state-loading.svg)、[state-error.svg](images/state-error.svg)。

**补充复验证据：** [cold-error.svg](images/cold-error.svg)、[retry-result.svg](images/retry-result.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C37 · comment-03a13792f0bd4c04b4f89efb686f0333

**原文：** 设计的字体，搜索网页上，Tradingview等专业交易网页是如何设计的，如何让字母/数字等更好的辨识，这块的设计仍然需要使用更细致的控件设计和样式来进行举例，包括这里的动态效果和视觉项，除了文字以外，需要逐个通过具体例子直接渲染好的图文并貌的形式来进行对比和展示，并详细说明为何选择这个尺寸，以及为何选择这种颜色和字体，以及为何要选择这种交互动效，优点和缺点，候选的有哪些，最后的取舍后为何选择这种

**设计响应：** HP08 记录系统栈、固定 Web 无衬线、全等宽三候选，以同一字号和数字样本对比；选择系统栈+tabular nums，不虚构 TradingView 字体；tokens/controls/motion 图稿逐项展示颜色、尺寸、状态和动效。

**锚点与图稿：** [HP08](visual-design.md#chapter-HP08)、[tokens.svg](images/tokens.svg)、[controls.svg](images/controls.svg)、[motion.svg](images/motion.svg)。

**补充复验证据：** [tokens.svg](images/tokens.svg)、[motion.svg](images/motion.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## C38 · comment-369b47f8693b4a1188d5509d5210616f

**原文：** 窄屏不考虑设计也不考虑实现

**设计响应：** HP09 将窄屏列为本轮范围外，验收仅覆盖 1440×1000 与 1280×800 桌面。

**锚点与图稿：** [HP09](visual-design.md#chapter-HP09)、[home-1440.svg](images/home-1440.svg)、[home-1280.svg](images/home-1280.svg)。

**状态：** 用户排除：本轮不设计窄屏；不记为 PASS。

## C39 · comment-900bcc95d00a4046a0bd592fa23ec316

**原文：** 验收规则我觉着很明确：
1. 上面从最小粒度的字体/控件的形式出发，定好样式的例子，判断实现的效果是否一致
2. 尺寸是否一致
3. 各种功能控件点击使用后的交互分镜是否一致
一句话，尽可能将基础的控件细节，甚至字体都落入到文档中，包括动态效果的分镜分解，验收的时候逐个实现的单元都需要找到对应的规范，进行对比验收，一致才可以；假如没有的话甚至要在实现前列出来，通知设计方重新补齐达成一致后才能继续开发

**设计响应：** HP09 规定视觉、交互、数据和持久化四道独立门槛；HP08 提供 11 类原子控件的尺寸与 default/hover/focus/pressed/disabled/loading/empty/error 矩阵、图稿来源和键盘路径；每个实现单元必须有 token、图号、前后态和异常证据。

**锚点与图稿：** [HP08](visual-design.md#chapter-HP08)、[HP09](visual-design.md#chapter-HP09)、[tokens.svg](images/tokens.svg)、[controls.svg](images/controls.svg)、[motion.svg](images/motion.svg)、[snapshot-options.svg](images/snapshot-options.svg)。

**补充复验证据：** [controls-states.svg](images/controls-states.svg)、[scope-menu.svg](images/scope-menu.svg)、[account-menu.svg](images/account-menu.svg)、[search-selected.svg](images/search-selected.svg)、[filter-reset.svg](images/filter-reset.svg)、[local-search.svg](images/local-search.svg)、[cold-error.svg](images/cold-error.svg)、[retry-result.svg](images/retry-result.svg)。

**状态：** PASS（静态设计响应）；产品运行未实施，不作为产品验收结果。

## 最终审查边界

39 条评论已逐项重审：36 PASS、1 PENDING_DECISION、2 EXCLUDED；C18 的 D01 仍待决定，C34/C38 用户排除。不得沿用已撤销的 V2 R4 PASS 数字；[验收记录](acceptance.html)区分设计稿、文档阅读器与后续产品验收。

原 V1 评论未改状态或原文。这里只记录 V2 设计响应，不把产品尚未实施的功能标为运行通过。
