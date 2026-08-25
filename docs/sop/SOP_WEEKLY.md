# SOP — 每次筛选周期操作流程(目标 ≤ 60 分钟)

> 按需触发,每周至少一次,多跑不限。数据以运行时点为准。

## 第 1 步:跑筛选(挂机 30 至 90 分钟,无需盯)

```powershell
cd C:\Users\SD\Desktop\atlas
npm run screen -- --profile both    # 或 standard / small_spec
```

产出:output/runs/{今天日期}/ 下 JSON + HTML 报告 + 两份 payload 文本(同一天多跑一次会自动加时间后缀,互不覆盖);output/latest.html 始终指向最新一次报告。

## 第 2 步:看报告(5 分钟)

浏览器打开 HTML 报告:
* 先看环境快照横幅(逆风环境下对全部候选心理减半)
* 扫候选卡片:桶徽章 + 语义化旗标 + sparkline
* 扫观察哨表:重点看 `promoted` 高亮(埋伏标的发动了)
* 瞄一眼账本被动区:有到期条目就记到月度复盘

## 第 3 步:Radar 推理(10 分钟)

1. 复制 ATLAS PAYLOAD 全文
2. 贴入 Atlas Radar Project 新对话
3. 收辩护状(每候选一份 + 尾部 JSON 块)
4. 全文存入本次运行的日期文件夹:output/runs/{date}/brief.md(与同次运行的 PAYLOAD/报告并排存放,方便对照)

## 第 4 步:Red Team 攻击(10 分钟)

1. 复制 ATLAS DISSENT PAYLOAD 全文
2. 贴入 Atlas Red Team Project **新对话**(永远新对话,不续旧)
3. 收裁决:注意四级分级——`NO EFFECTIVE ATTACK` 是好消息不是敷衍;`MATERIAL RISK` 才需要你把 Radar 确信度打折
4. 存入本次运行的日期文件夹:output/runs/{date}/dissent.md(与同次运行的 DISSENT PAYLOAD 并排存放,方便对照)
5. 看清单级盲区审计那一段,有意思就记一笔

## 第 5 步:人类裁决(10 分钟,系统的宪法闸门)

逐候选三选一:
* **送 Cockpit**:只把 ticker 交给 Stock Research v5 走完整深研(不贴 Atlas 辩护状,保持独立起点)
* **降观察哨**:有兴趣但证据不熟,等下次运行
* **弃**:红队 THESIS BROKEN 或你直觉不过

裁决没有配额,五弃零送是合法结果。空清单周期也是合法产出——系统没找到东西时诚实说没有,好过硬凑。

## 铁律回顾

* Atlas 止步于"值得注意"。买不买、买多少、何时卖,永远在系统外,由你 + Cockpit 深研 + 你的仓位纪律决定
* 跳过红队一次 = 给自己记一次纪律违约。连续跳过两周期 → 启动 CARD 08(MCP 自动化),用工程消灭摩擦而不是消灭纪律
