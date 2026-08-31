# TASK CARD 08 — 防御闸(立即执行:信用熔断 + 最低股价闸)

> 丢给 Claude Code。LOADED 确认后开工。前置:CARD 01 至 06 已上线。授权:第五号修正案(修正案十四、十七最低股价闸部分)。
> **本卡为立即执行卡** — 纯防御性,不改变筛选逻辑,不需要运行基线即可判断价值。

## GOAL

给系统装两道防御闸:信用环境熔断(保护 SMALL_SPEC)+ 最低股价闸(排除交易摩擦标的)。

## SCOPE

### Part A — 信用环境熔断(src/screen/credit_regime)

1. FRED 拉取高收益债 OAS(序列 `BAMLH0A0HYM2`,FRED 已在数据源,复用现有 client)
2. 计算三态判定(阈值进 `config/credit.json`):
   * `loose`:OAS < 350bp 且近两周下行
   * `tight`:OAS > 450bp,**或** 近两周发散上行 > 50bp
   * `neutral`:其余
3. **收紧态强制行为**:
   * SMALL_SPEC 档自动禁用(即使用户命令行指定 `--profile both` 或 `small_spec`,也强制跳过并在终端与报告中说明原因)
   * 报告顶部渲染红色信用收紧警示条
   * 全部候选的 `risk_level` 自动上调一级
4. 判定结果并入 run 元数据与 payload 的环境快照

### Part B — 最低股价闸(src/universe 扩展)

1. STANDARD 档:收盘价 ≥ $5
2. SMALL_SPEC 档:收盘价 ≥ $1
3. 阈值进 `config/profiles.json`,与现有市值/成交额闸并列

## DONE-WHEN

* [ ] FRED OAS 拉取成功,三态判定输出正确(可用历史值人工验证:2020年3月应判 tight)
* [ ] 人工构造 tight 状态测试:SMALL_SPEC 确实被禁用且有明确说明
* [ ] 股价闸生效:抽查通过标的无低于对应档位阈值者
* [ ] 报告与 payload 均含 credit_regime 字段

## MUST-NOT

* 用信用数据做任何市场方向预测(只读当前状态调整系统行为)
* 改动任何桶的判定逻辑
* LLM 调用

## 熔断

同卡点失败 2 次 → 停止,升级包。FRED 序列取数失败时降级为 `unknown` 态并正常运行(不阻塞),但报告需标注信用数据不可得。
