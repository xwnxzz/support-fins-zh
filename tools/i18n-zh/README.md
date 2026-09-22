# -*- coding: utf-8 -*-
"""汉化工具（support-fins 简体中文版）

- `apply-zh-CN.py`      把界面文案替换为简体中文（精确匹配，可重放）
- `extract-en-strings.py` 盘点 web/ 各模块里所有含英文字母的字符串字面量，用于查漏

用法（在仓库根目录执行）：

    python tools/i18n-zh/extract-en-strings.py     # 输出 _strings.txt 到仓库根目录
    python tools/i18n-zh/apply-zh-CN.py            # 对英文原版应用汉化

## 替换脚本的设计

`apply-zh-CN.py` 里的每条规则都是「原文精确片段 -> 译文」，并且**要求原文在该文件中
恰好出现一次**：

- 出现 0 次（写错、或代码已汉化/已变动）→ 整体中止，一个字节都不写；
- 出现多次（会误伤逻辑常量）→ 同样中止。

所以它对已汉化的代码重跑会报一片「0 matches」并停下，这是有意的保护，不是故障。
要重放：先用 `git checkout <上游提交> -- web/ nginx.conf` 还原英文原版，再运行。

新增/修改界面文案时，请同步补一条规则，保持这个脚本能完整重放整个汉化。
"""
