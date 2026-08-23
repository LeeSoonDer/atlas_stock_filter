# TASK CARD 05 — 选取器 + 观察哨 + 双 Payload 生成 + HTML 周报 + 前向账本接线

> LOADED 确认后执行。前置:CARD 04 验收通过。本卡完成 = Atlas Layer 1 全功能可用。

## GOAL

一次运行产出:候选 ≤ 5 + 观察哨 ≤ 10 + ATLAS PAYLOAD + ATLAS DISSENT PAYLOAD + 自包含 HTML 报告 + 账本写入。

## SCOPE

1. **FMP 二次充实**(src/data/enrich):候选与观察哨确定后(≤ 15 只),调 FMP 补充估值比率与双源价格校验,双源偏差 > 2% 打 `price_mismatch` 旗标。全宇宙阶段禁用 FMP(备忘录四 E17)
2. **选取器**(src/screen/select):
   * 四桶各按桶内强度分排序
   * 轮询选取(A→B→C→D→A…)至候选满 5 或桶空;多桶命中标的归其强度分最高的桶,只占一席
   * 观察哨:挤压蓄势桶未入选者优先,其余桶临界未达标者(距阈值 ≤ 10%)补足,至多 10
   * 观察哨状态机:后续运行中,观察哨标的命中任一桶完整条件 → 标记 `promoted`,优先进候选
3. **ATLAS PAYLOAD 生成**(src/report/payload):按 Radar 输入契约组装批量包:run 元数据 + 环境快照 + 板块异动摘要(修正案八)+ 每候选全旗标、event_window、关键价位(近期枢轴高低、SMA 20/50/200 值、ATR%)、三态标注、滞后天数。纯文本块,复制即用
4. **ATLAS DISSENT PAYLOAD 生成**:每候选仅含机会桶 + 一句设想陈述(由桶类型模板化生成,如"该标的处于波动挤压后的蓄势末段,存在向上重定价条件")+ 摘要卡骨架。**严禁**携带旗标细节与任何推理性文字(隔离铁律)
5. **HTML 报告**(src/report/html):单文件自包含(内嵌 CSS 与 SVG 迷你图),结构:
   * 环境快照横幅
   * 板块异动横幅(修正案八):footprint_anomaly 板块置顶呈现,只显示密度事实,零方向性文字
   * 候选卡片区:每候选一卡,桶徽章、核心旗标语义化呈现(数字旁配语义词:RSI 27 超卖)、90 日价格 sparkline(SVG)、SMALL_SPEC 投机警示条、event_window 事件窗口高亮(⚡类型+日期+距今天数)
   * 观察哨表格(紧凑,含 promoted 高亮)
   * 账本被动区:已到期待回填与已触发无效化条目清单(仅列出,无提醒机制)
   * 设计:遵守 repo 内 P4_DESIGN_SPEC(若已复制入 repo),否则极简终端风,禁止 AI-slop(紫渐变/卡片套卡片)
6. **账本接线**(src/ledger):
   * 每次运行:全部候选与观察哨 append 入 JSONL(宪法前向结果追踪:全量归档,永不删除)
   * 每条:ticker、日期、档位、桶、旗标快照、状态(candidate/watchlist/promoted)
   * `npm run ledger:backfill -- --ticker X` 交互式回填:结果(重定价发生/无效化触发/到期无事)、实际经过天数
   * `npm run ledger:stats`:按桶死亡率与命中率汇总(月度复盘用)

## DONE-WHEN

* [ ] 全流程一条命令跑通,五件产出齐全
* [ ] PAYLOAD 实贴 Atlas Radar 可产出合规辩护状(人工验证一次)
* [ ] DISSENT PAYLOAD 检查:零旗标细节泄漏
* [ ] HTML 报告浏览器打开,渲染正常,sparkline 可见
* [ ] 连续两次运行,账本 append 正确,观察哨升格逻辑触发可验证
* [ ] ledger:stats 输出四桶汇总

## MUST-NOT

* LLM 调用;提醒/通知系统;删除或修改历史账本条目

## 熔断

同卡点失败 2 次 → 停止,升级包。
