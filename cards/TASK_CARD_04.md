# TASK CARD 04 — 第四桶:机构蓄势代理(Form 4 / 持股趋势 / 做空余额)

> LOADED 确认后执行。前置:CARD 03 验收通过。

## GOAL

实现 Detector D 机构蓄势代理桶,全部使用修正案一法定免费源。13F 增量解析**不在本卡**(独立 CARD 04b,无限期后置)。

## SCOPE

1. **Form 4 内部人抓取**(src/data/insiders):
   * SEC EDGAR 每日索引拉取 Form 4 filing 清单(官方免费,注意 SEC 要求的 User-Agent 与 10 req/s 限速)
   * 解析买入交易(P 代码公开市场买入),按 ticker 聚合近 90 日
   * 集群判定:近 90 日 ≥ 2 名不同内部人公开市场买入 = `insider_cluster: true`
   * 简化优先:只解析买入方向与人数金额,不做全字段解析
2. **持股趋势**(yahoo institutionOwnership):机构持股比例近两期方向(上升/下降/持平/不可得)
3. **做空余额**(src/data/short):FINRA 官方双周做空余额文件,计算 SI 变化率与 days to cover;数据延迟显式标注
4. **借券费率**:可空字段,无免费稳定源时直接 `[不可得]`(备忘录三 S4)
5. **Detector D 判定**(≥ 2 项满足,阈值进 config):
   * insider_cluster 为真
   * 机构持股比例连续上升
   * 做空余额显著下降(≥ 15%)或高做空 + 价格企稳(逼空雏形:SI ≥ 15% 流通盘且价格 ≥ SMA 50)
   * 价格量能特征配合(OBV 20 日斜率为正)
6. 机构证据全部带滞后天数标注,并入 flags

## DONE-WHEN

* [ ] 抽查 3 只 insider_cluster 标的,EDGAR 网页人工核对属实
* [ ] SI 数据与 FINRA 发布对得上,滞后天数正确
* [ ] EDGAR 抓取遵守限速,全量运行无 403/429 封禁
* [ ] Detector D 有非零命中且判定日志可读

## MUST-NOT

* 13F 解析;任何付费源;虚构机构数据(宪法级违规)

## 熔断

同卡点失败 2 次 → 停止,升级包。EDGAR 解析是本项目最重工程件,卡死优先降范围(如只解析最近 30 日)而非硬撑。
