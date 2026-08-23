# TASK CARD 01 — Layer 1 骨架:双档宇宙定义器 + 数据接入 + 筛选管道外壳

> 若 repo templates/ 存在 TEMPLATE_IMPLEMENT,以该范本字段重排本卡后执行。开工前按 CLAUDE.md 启动序列输出 LOADED 行。

## GOAL

`npm run screen -- --profile standard`(或 `small_spec` / `both`)一条命令跑通:全美股宇宙 → 宪法闸门 → 双档过滤 → 输出结构化清单 JSON。本卡零评分逻辑,只建骨架与数据地基。

## CONTEXT

* /constitution 四份文件为冻结法律,先读
* 本 repo = Atlas 应用层(Layer 1),**禁止任何 LLM 调用**(宪法双层红线)
* 数据管线模式参考 Stock Research Cockpit:yahoo-finance2 npm 为主源,keys 走 .env
* 运行为按需触发(备忘录四),无定时任务

## SCOPE

1. **骨架**:TypeScript + Node CLI(无 UI 框架),目录 src/universe, src/data, src/screen, src/report, src/ledger, output/, config/
2. **Module 2 双档宇宙定义器**(src/universe):
   * NASDAQ 官方 symbol directory(nasdaqlisted.txt + otherlisted.txt,免费无 key)取 NYSE+NASDAQ 全量
   * 宪法禁入闸:OTC、ETF/ETN、杠杆反向基金、权证、优先股、SPAC(名称与行业启发式)
   * 档位闸(config/profiles.json 可调):
     STANDARD:市值 ≥ $300M,日均成交额 ≥ $5M
     SMALL_SPEC:市值 $50M 至 $300M,日均成交额 ≥ $1M,输出打 `speculative: true`
3. **Module 4 数据接入**(src/data):
   * yahoo-finance2 封装:quote / 历史 OHLCV(≥ 260 交易日)/ profile / 机构持股比例
   * 分批抓取器:批大小与延迟可配、指数退避、断点续跑(checkpoint JSON)、单标的失败不阻塞
   * 每条数据附时间戳 + 三态标签([可得]/[不可得])
4. **管道外壳**(src/screen):宇宙 → 抓取 → 档位过滤 → 输出;检测器留 IDetector 接口空实现
5. **输出**:output/screen_run_{timestamp}.json:run 元数据(时间戳/档位/宇宙规模/闸门通过数/失败清单)+ 通过标的数组
6. **账本占位**(src/ledger):append-only JSONL 写入函数与 schema,不接逻辑

## CONSTRAINTS

* 禁入资产不得出现在任何输出;缺数据显式标注,零编造
* 单档全量运行 ≤ 90 分钟;中断可从 checkpoint 续
* 零付费依赖;.env.example 列全部 key 位
* 不建本卡范围外目录

## DONE-WHEN

* [ ] 三种 profile 参数均完整跑通
* [ ] STANDARD 档输出 ≥ 1500 只;BOTH 档 ≥ 2000 只
* [ ] 抽查 10 只:无 OTC/ETF/低于闸门标的;SMALL_SPEC 条目带 speculative 标记
* [ ] 中断重跑从 checkpoint 续,不重复抓取
* [ ] 分 commit:骨架 / universe / data / screen / ledger

## MUST-NOT

* 任何评分、指标计算、LLM、UI、定时任务

## 熔断

同一卡点失败 2 次 → 停止,输出五栏升级包。
