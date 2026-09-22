# -*- coding: utf-8 -*-
"""Apply the Simplified-Chinese (zh-CN) localization to the support-fins web app.

Run from anywhere; the repo root is derived from this file's location.
Replaying against already-localized sources aborts by design (see README.md here).

Every rule is an exact source-text match; the script aborts unless each `old`
occurs exactly the expected number of times, so a stale/typo rule can never
silently half-apply. Paths are resolved relative to this file.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".."))

RULES = {}

# --------------------------------------------------------------- index.html
RULES["web/index.html"] = [
    ('<html lang="en">', '<html lang="zh-CN">'),
    ('<title>Support Fins</title>', '<title>支撑鳍 Support Fins — 一键生成可掰断支撑</title>'),
    ('<div id="spinner" aria-live="polite"><span class="ring"></span>generating supports…</div>',
     '<div id="spinner" aria-live="polite"><span class="ring"></span>正在生成支撑…</div>'),
    ('<span class="brand"><img src="favicon.svg" alt="" class="brand-mark">Support&nbsp;Fins</span>',
     '<span class="brand" title="Support Fins — 打印免支撑"><img src="favicon.svg" alt="" '
     'class="brand-mark">支撑鳍&nbsp;Support&nbsp;Fins</span>'),
    ('    Open STL / 3MF<input type="file" id="file" accept=".stl,.3mf" hidden>',
     '    打开 STL / 3MF<input type="file" id="file" accept=".stl,.3mf" hidden>'),
    ('    Build volume\n', '    成型空间\n'),
    ('aria-label="width">×<input', 'aria-label="宽度">×<input'),
    ('aria-label="depth">×<input', 'aria-label="深度">×<input'),
    ('aria-label="height">mm', 'aria-label="高度">mm'),
    ('  <label class="field" title="Surface angle from the plate below which a face needs support.">\n'
     '    Overhang\n',
     '  <label class="field" title="相对底板低于此角度的表面需要支撑。">\n'
     '    悬垂角\n'),
    ('<button class="btn" id="fins-toggle">Add fins</button>',
     '<button class="btn" id="fins-toggle">添加支撑鳍</button>'),
    ('<button class="btn" id="export">Export STL</button>',
     '<button class="btn" id="export">导出 STL</button>'),
    ('<button class="btn" id="export-3mf" title="Opens oriented and support-free in Bambu Studio, '
     'OrcaSlicer, or PrusaSlicer. Bambu/PrusaSlicer may note \'no config, geometry only\' — expected; '
     'the part still comes in correct.">Export 3MF</button>',
     '<button class="btn" id="export-3mf" title="在 Bambu Studio、OrcaSlicer、PrusaSlicer 中打开时'
     '已按此朝向摆好且无需支撑。Bambu/PrusaSlicer 可能提示“无配置文件，仅载入几何”——这是正常的，'
     '零件本身完全正确。">导出 3MF</button>'),
    ('     title="Source code on GitHub. Runs entirely in your browser; no file ever leaves your machine."\n'
     '     aria-label="Support Fins on GitHub">',
     '     title="GitHub 上的源代码。全部在浏览器内运行，文件不会离开你的电脑。"\n'
     '     aria-label="在 GitHub 上查看 Support Fins">'),
    ('     title="Support Fins is free and open source — buy me a coffee on Ko-fi.">☕&nbsp;Ko-fi</a>',
     '     title="Support Fins 免费开源 —— 可以在 Ko-fi 上请作者喝杯咖啡。">☕&nbsp;Ko-fi</a>'),
    ('    <dt>File</dt>             <dd id="s-name">—</dd>\n'
     '    <dt>Triangles</dt>        <dd id="s-tris">—</dd>\n'
     '    <dt>Size</dt>             <dd id="s-bbox">—</dd>\n'
     '    <dt>Volume</dt>           <dd id="s-fit">—</dd>',
     '    <dt>文件</dt>             <dd id="s-name">—</dd>\n'
     '    <dt>三角面</dt>           <dd id="s-tris">—</dd>\n'
     '    <dt>尺寸</dt>             <dd id="s-bbox">—</dd>\n'
     '    <dt>成型空间</dt>         <dd id="s-fit">—</dd>'),
    ('    <dt><i class="sw sw-over"></i>Overhangs</dt> <dd id="s-over">—</dd>\n'
     '    <dt>Area</dt>                                <dd id="s-overarea">—</dd>\n'
     '    <dt><i class="sw sw-bed"></i>Bed&nbsp;contact</dt> <dd id="s-bed">—</dd>\n'
     '    <dt><i class="sw sw-fin"></i>Fins</dt>       <dd><span id="s-fins">—</span><button\n'
     '        type="button" class="note-info" id="s-fin-info" hidden\n'
     '        aria-label="How these supports work, and what this pose leaves uncovered">i</button></dd>\n'
     '    <dt><i class="sw sw-pad"></i>Bed&nbsp;pad</dt> <dd id="s-pad">—</dd>\n'
     '    <dt>Analysis</dt>                            <dd id="s-time">—</dd>',
     '    <dt><i class="sw sw-over"></i>悬垂</dt>      <dd id="s-over">—</dd>\n'
     '    <dt>面积</dt>                                <dd id="s-overarea">—</dd>\n'
     '    <dt><i class="sw sw-bed"></i>底面接触</dt>   <dd id="s-bed">—</dd>\n'
     '    <dt><i class="sw sw-fin"></i>支撑鳍</dt>     <dd><span id="s-fins">—</span><button\n'
     '        type="button" class="note-info" id="s-fin-info" hidden\n'
     '        aria-label="这些支撑的工作原理，以及当前朝向未覆盖的部分">i</button></dd>\n'
     '    <dt><i class="sw sw-pad"></i>底盘垫</dt>     <dd id="s-pad">—</dd>\n'
     '    <dt>分析</dt>                                <dd id="s-time">—</dd>'),
    ('  <span class="lbl">Rotate 90°</span>\n'
     '  <button class="btn sm" id="rot-x" aria-label="Rotate 90 degrees about X">X</button>\n'
     '  <button class="btn sm" id="rot-y" aria-label="Rotate 90 degrees about Y">Y</button>\n'
     '  <button class="btn sm" id="rot-z" aria-label="Rotate 90 degrees about Z">Z</button>\n'
     '  <button class="btn sm" id="rot-reset">Reset</button>\n'
     '  <button class="btn sm" id="undo" title="Undo (⌘/Ctrl+Z)" disabled>Undo</button>\n'
     '  <button class="btn sm" id="redo" title="Redo (⇧⌘/Ctrl+Shift+Z)" disabled>Redo</button>',
     '  <span class="lbl">旋转 90°</span>\n'
     '  <button class="btn sm" id="rot-x" aria-label="绕 X 轴旋转 90 度">X</button>\n'
     '  <button class="btn sm" id="rot-y" aria-label="绕 Y 轴旋转 90 度">Y</button>\n'
     '  <button class="btn sm" id="rot-z" aria-label="绕 Z 轴旋转 90 度">Z</button>\n'
     '  <button class="btn sm" id="rot-reset">复位</button>\n'
     '  <button class="btn sm" id="undo" title="撤销 (⌘/Ctrl+Z)" disabled>撤销</button>\n'
     '  <button class="btn sm" id="redo" title="重做 (⇧⌘/Ctrl+Shift+Z)" disabled>重做</button>'),
    ('  <p class="hint">Drag the rings to turn it, or:</p>',
     '  <p class="hint">拖动圆环旋转零件，或者：</p>'),
    ('  <button class="btn sm" id="lay-face"\n'
     '          title="Click this, then click a face to set it flat on the bed. Off by default so a '
     'stray click can\'t re-lay the part.">Lay a face flat</button>',
     '  <button class="btn sm" id="lay-face"\n'
     '          title="先点这里，再点零件上的某个面，就能让该面平贴底板。默认关闭，避免误点打乱摆放。">'
     '以面贴平</button>'),
    ('    <label class="check layers-toggle" title="Show the horizontal print layers around the part.">\n'
     '      <input type="checkbox" id="show-layers">Show layers\n',
     '    <label class="check layers-toggle" title="显示零件周围的水平打印层线。">\n'
     '      <input type="checkbox" id="show-layers">显示层线\n'),
    ('      <button class="btn sm" id="suggest-orient">Suggest orientation</button>\n'
     '      <button class="disclosure" id="suggest-toggle" hidden aria-expanded="true"\n'
     '              aria-label="Collapse suggestions" title="Collapse">&rsaquo;</button>',
     '      <button class="btn sm" id="suggest-orient">推荐摆放方向</button>\n'
     '      <button class="disclosure" id="suggest-toggle" hidden aria-expanded="true"\n'
     '              aria-label="收起推荐结果" title="收起">&rsaquo;</button>'),
    ('    <p class="loadfx-lede"><strong>Strength arrow</strong>: which way is it loaded?</p>\n'
     '    <div class="strength-pad" role="group" aria-label="Load direction">\n'
     '      <button class="btn sm" id="load-up"    aria-label="Load points up">↑</button>\n'
     '      <button class="btn sm" id="load-down"  aria-label="Load points down">↓</button>\n'
     '      <button class="btn sm" id="load-left"  aria-label="Load points left">←</button>\n'
     '      <button class="btn sm" id="load-right" aria-label="Load points right">→</button>\n'
     '      <button class="btn sm" id="load-front" aria-label="Load points toward you">⊙ front</button>\n'
     '      <button class="btn sm" id="load-back"  aria-label="Load points away from you">⊗ back</button>',
     '    <p class="loadfx-lede"><strong>受力箭头</strong>：零件主要往哪个方向受力？</p>\n'
     '    <div class="strength-pad" role="group" aria-label="受力方向">\n'
     '      <button class="btn sm" id="load-up"    aria-label="受力朝上">↑</button>\n'
     '      <button class="btn sm" id="load-down"  aria-label="受力朝下">↓</button>\n'
     '      <button class="btn sm" id="load-left"  aria-label="受力朝左">←</button>\n'
     '      <button class="btn sm" id="load-right" aria-label="受力朝右">→</button>\n'
     '      <button class="btn sm" id="load-front" aria-label="受力朝向自己">⊙ 前</button>\n'
     '      <button class="btn sm" id="load-back"  aria-label="受力远离自己">⊗ 后</button>'),
    ('    <button class="btn sm" id="load-clear" hidden>Clear</button>',
     '    <button class="btn sm" id="load-clear" hidden>清除</button>'),
    ('    <button class="btn sm" id="load-suggest" hidden>Turn to the strongest printable pose</button>',
     '    <button class="btn sm" id="load-suggest" hidden>转到可打印的最强朝向</button>'),
    ('  <label class="fld" id="material-fld" title="The filament you\'ll print in. PETG fuses to '
     'supports much harder than PLA, so PETG loosens the gaps, shrinks the tine bite, and gives the '
     'bed pad a gap instead of a bite. PLA keeps the tighter grip.">\n    Material\n',
     '  <label class="fld" id="material-fld" title="你要使用的耗材。PETG 与支撑的粘连远强于 PLA，'
     '所以选 PETG 会加大各处间隙、减小卡齿咬入量，并把底盘垫的咬合改成留缝。PLA 保持更紧的抓附。">\n'
     '    材料\n'),
    ('  <label class="fld">\n    Placement\n    <select id="fin-mode" title="Who places the support.">',
     '  <label class="fld">\n    放置方式\n    <select id="fin-mode" title="由谁来决定支撑的位置。">'),
    ('      <option value="auto">Auto — place supports for me</option>\n'
     '      <option value="draw">Draw — place them by hand</option>',
     '      <option value="auto">自动 — 自动为我放置支撑</option>\n'
     '      <option value="draw">手动 — 我自己放置</option>'),
    ('  <label class="check" title="A tilted part rests on an edge and peels off the plate without one.">\n'
     '    <input type="checkbox" id="bed-pad" checked>Add bed pad',
     '  <label class="check" title="倾斜摆放的零件只靠一条边接触底板，没有底盘垫容易翘边脱落。">\n'
     '    <input type="checkbox" id="bed-pad" checked>添加底盘垫'),
    ('  <label class="check" title="Tines fuse the support to the part so it grips instead of just '
     'propping. Off = plain breakaway wall.">\n'
     '    <input type="checkbox" id="tines" checked>Tines (grip the part)',
     '  <label class="check" title="卡齿把支撑与零件咬合在一起，形成抓附而不只是顶住。关闭 = 单纯的'
     '可掰断支撑墙。">\n'
     '    <input type="checkbox" id="tines" checked>卡齿（咬住零件）'),
    ('  <label class="fld" id="tinegrip-fld"\n'
     '         title="How tightly to space the grip tines. Light = fewest marks (default), a per-wall '
     'floor keeps grip; Firm = dense comb / max grip for a tippy or tall part.">\n'
     '    Tine grip <span class="mut">light ⟶ firm</span>',
     '  <label class="fld" id="tinegrip-fld"\n'
     '         title="卡齿的排列密度。疏 = 痕迹最少（默认），每段墙仍保留最少卡齿以维持抓附；'
     '密 = 密集齿梳、最大抓附，适合头重脚轻或较高的零件。">\n'
     '    卡齿密度 <span class="mut">疏 ⟶ 密</span>'),
    ('  <label class="fld" id="layerh-fld" title="Set this to the layer height you slice at. The grip '
     'tines are one layer tall so they snap off clean; if this doesn\'t match your slicer, the tines '
     'tear and leave marks. Default 0.2mm.">\n'
     '    Layer height <span class="mut">mm</span>',
     '  <label class="fld" id="layerh-fld" title="请填你实际切片用的层高。卡齿正好一层高，因此能干净'
     '掰断；如果这里与实际层高不符，卡齿会被撕裂并留下痕迹。默认 0.2mm。">\n'
     '    层高 <span class="mut">mm</span>'),
    ('  <label class="fld" title="Clearance between a support top and the part. Bigger = cleaner surface '
     '/ easier removal; too big stops holding the overhang. Default 0.2mm.">\n'
     '    Support gap <span class="mut">mm</span>',
     '  <label class="fld" title="支撑顶部与零件之间的间隙。越大 = 表面越干净、越好拆；太大则托不住'
     '悬垂。默认 0.2mm。">\n'
     '    支撑间隙 <span class="mut">mm</span>'),
    ('  <label class="fld" id="padgrip-fld" title="How the bed pad meets a tilted part. Positive = bites '
     'in to hold harder; 0 = flush; negative = a gap that snaps off cleaner (the PETG default, since '
     'PETG welds hard). Default 0.05mm on PLA.">\n'
     '    Pad grip <span class="mut">mm</span>',
     '  <label class="fld" id="padgrip-fld" title="底盘垫与倾斜零件的接触方式。正值 = 咬入更多、抓得'
     '更牢；0 = 齐平；负值 = 留缝，掰断更干净（PETG 因为粘连强而默认留缝）。PLA 默认 0.05mm。">\n'
     '    底盘垫咬合 <span class="mut">mm</span>'),
    ('  <label class="fld" id="coverage-fld"\n'
     '         title="How densely to line a WIDE overhang face with fins. The middle is the anti-sag '
     'default; drag LEFT for fewer fins (a small part can go down to one — the readout warns if a broad '
     'face then risks sagging), RIGHT for more support. Narrow parts are unaffected.">\n'
     '    Wide-face coverage <span class="mut">sparse ⟶ dense</span>',
     '  <label class="fld" id="coverage-fld"\n'
     '         title="在大面积悬垂面上排布支撑鳍的密度。中间是防下垂的默认值；往左拉 = 更少的鳍'
     '（小零件可以只留一个，若宽面有下垂风险读数会提示），往右拉 = 更多支撑。窄零件不受影响。">\n'
     '    宽面覆盖密度 <span class="mut">疏 ⟶ 密</span>'),
    ('  <button class="btn sm" id="augment-toggle" hidden\n'
     '          title="Place extra breakaway walls by hand, on top of the auto-placed ones.">'
     '+ Add walls by hand</button>',
     '  <button class="btn sm" id="augment-toggle" hidden\n'
     '          title="在自动放置的基础上，再手动补几段可掰断支撑墙。">+ 手动添加支撑墙</button>'),
    ('    <p class="draw-hint" id="draw-hint">Click an <strong>overhang face</strong> — it lights\n'
     '      up green when a fin can go there — to stand a support fin against it.</p>\n'
     '    <div class="draw-btns">\n'
     '      <button class="btn sm" id="draw-undo">Undo</button>\n'
     '      <button class="btn sm" id="draw-clear">Clear all</button>',
     '    <p class="draw-hint" id="draw-hint">点击<strong>悬垂面</strong>（可以放支撑鳍时会亮起\n'
     '      绿色）即可在它下方立起一个支撑鳍。</p>\n'
     '    <div class="draw-btns">\n'
     '      <button class="btn sm" id="draw-undo">撤销</button>\n'
     '      <button class="btn sm" id="draw-clear">全部清除</button>'),
    ('    <span class="r-unit">of support material added</span>\n'
     '    <button type="button" class="r-info" id="r-info" aria-label="About this number"',
     '    <span class="r-unit">新增支撑材料</span>\n'
     '    <button type="button" class="r-info" id="r-info" aria-label="关于这个数字"'),
    ('       title="Grams assume PLA and count only the fins + pad the tool adds, printed near-solid, '
     'cross-checked against the builder\'s fin volume. In test prints, breakaway fins used 20–45% less '
     'plastic and printed ~30% faster than slicer supports.">i</button>',
     '       title="克数按 PLA 计算，只统计工具新增的鳍与底盘垫，按接近实心打印，并与生成器的体积交叉'
     '核对。实测中可掰断支撑鳍比切片软件的支撑少用 20–45% 材料，打印快约 30%。">i</button>'),
    ('    <p class="big">Print it support-free, in any slicer</p>\n'
     '    <p class="lede">Rotate a part however it prints best, and Support Fins bakes the\n'
     '      breakaway supports right into the STL. It prints the same on any machine, in any\n'
     '      slicer, with supports turned off.</p>\n'
     '    <ol class="steps">\n'
     '      <li><strong>Open an STL or 3MF.</strong> Drop it anywhere on this page.</li>\n'
     '      <li><strong>Rotate it.</strong> Red marks every surface that needs support.</li>\n'
     '      <li><strong>Export.</strong> Fins come baked in — no slicer supports needed.</li>\n'
     '    </ol>',
     '    <p class="big">任何切片软件里，都能免支撑打印</p>\n'
     '    <p class="lede">按最好打印的方向旋转零件，支撑鳍会把可掰断的支撑直接烧进 STL。\n'
     '      之后在任何机器、任何切片软件里，只要关闭支撑，打印效果都一样。</p>\n'
     '    <ol class="steps">\n'
     '      <li><strong>打开 STL 或 3MF。</strong>把文件拖到本页任意位置即可。</li>\n'
     '      <li><strong>旋转零件。</strong>红色标出所有需要支撑的表面。</li>\n'
     '      <li><strong>导出。</strong>支撑已烧进模型 —— 无需切片软件的支撑。</li>\n'
     '    </ol>'),
    ('    <p class="small">Opening the 3MF, Bambu Studio and PrusaSlicer may note it has\n'
     '      “no config” and load the geometry only — that’s expected. The file is pure\n'
     '      geometry with no slicer profile baked in, so it opens the same in every slicer;\n'
     '      your part comes in correctly oriented and sized. Just slice with supports off.</p>\n'
     '    <p class="small">Nothing is uploaded. The file is read inside this tab and never\n'
     '      leaves your machine.</p>\n'
     '    <p class="kofi-line">Free and open source. If it ever saves you a print,\n'
     '      <a class="kofi" href="https://ko-fi.com/matthewtrahan" target="_blank" rel="noopener">buy\n'
     '      me a coffee&nbsp;☕</a>.</p>',
     '    <p class="small">打开 3MF 时，Bambu Studio 和 PrusaSlicer 可能提示“无配置”并只载入几何\n'
     '      —— 这是正常的。文件是纯几何、没有内置切片配置，因此在任何切片软件里打开都一样；\n'
     '      零件的朝向和尺寸都是正确的，直接关闭支撑切片即可。</p>\n'
     '    <p class="small">不会上传任何东西。文件只在这个标签页内读取，从不离开你的电脑。</p>\n'
     '    <p class="kofi-line">免费开源。如果它帮你省下了一次打印，\n'
     '      <a class="kofi" href="https://ko-fi.com/matthewtrahan" target="_blank" rel="noopener">'
     '请作者喝杯咖啡&nbsp;☕</a>。</p>'),
    ('    <h2 id="picker-title">This 3MF has several objects</h2>\n'
     '    <p class="picker-sub">Pick the one to add fins to. Check more than one to merge\n'
     '      them into a single part.</p>',
     '    <h2 id="picker-title">这个 3MF 包含多个对象</h2>\n'
     '    <p class="picker-sub">选择要添加支撑鳍的对象。勾选多个可把它们合并成一个零件。</p>'),
    ('        <button class="btn" id="picker-cancel">Cancel</button>\n'
     '        <button class="btn primary" id="picker-load">Load</button>',
     '        <button class="btn" id="picker-cancel">取消</button>\n'
     '        <button class="btn primary" id="picker-load">载入</button>'),
]

# ------------------------------------------------------------------- app.js
RULES["web/app.js"] = [
    # canvas aria-label
    ("  'aria-label', 'Interactive 3D preview of the loaded part. Orientation and support '\n"
     "  + 'stats are reported as text in the panel on the left.');",
     "  'aria-label', '已载入零件的交互式 3D 预览。朝向与支撑统计数据以文字形式显示在左侧面板。');"),
    # free-axis readout
    ("  const label = axis.length > 1 ? 'free' : axis;   // 'XYZE' / 'E' are screen-space",
     "  const label = axis.length > 1 ? '自由' : axis;   // 'XYZE' / 'E' are screen-space"),
    # overhang count
    ("  el('s-over').textContent = res.regions.length === 0\n"
     "    ? 'none'\n"
     "    : `${res.regions.length} region${res.regions.length === 1 ? '' : 's'}` +\n"
     "      (dropped ? ` (+${dropped} sliver${dropped === 1 ? '' : 's'})` : '');",
     "  el('s-over').textContent = res.regions.length === 0\n"
     "    ? '无'\n"
     "    : `${res.regions.length} 处` +\n"
     "      (dropped ? `（另有 ${dropped} 处碎小悬垂）` : '');"),
    # small-overhang warning
    ("    warn.textContent = `⚠ ${dropped} small overhang${dropped === 1 ? '' : 's'} `\n"
     "      + `(hole ceilings, slots, bore tops) print unsupported this way up and may come `\n"
     "      + `out rough. Try Suggest orientation to point them up.`;",
     "    warn.textContent = `⚠ ${dropped} 处小悬垂（孔顶、槽顶、内孔上沿）`\n"
     "      + `在当前朝向下得不到支撑，表面可能粗糙。`\n"
     "      + `点“推荐摆放方向”把它们转到朝上。`;"),
    # flat baseline note
    ("    flat.textContent = 'No supports needed this way up.';",
     "    flat.textContent = '这个朝向不需要任何支撑。';"),
    ("    flat.textContent = 'This prints clean lying flat. You only need fins if you’re '\n"
     "      + 'tilting it for strength.';",
     "    flat.textContent = '平放即可打印干净。只有为了强度而倾斜时，'\n"
     "      + '才需要支撑鳍。';"),
    # timing readout
    ("  analysisTiming = `${ms.toFixed(0)} ms · weld ${weldMs.toFixed(0)} ms`;",
     "  analysisTiming = `${ms.toFixed(0)} ms · 焊接 ${weldMs.toFixed(0)} ms`;"),
    # fit check
    ("  fit.textContent = over\n"
     "    ? (added.length ? 'does not fit (with fins)' : 'does not fit')\n"
     "    : 'fits';",
     "  fit.textContent = over\n"
     "    ? (added.length ? '装不下（含支撑鳍）' : '装不下')\n"
     "    : '放得下';"),
    # explainNoFins
    ("    return 'this part touches the plate at a single point, so it has nothing to '\n"
     "         + 'stand on. Turn the bed pad on to seat it, or rotate until it sits '\n"
     "         + 'down on a face or an edge';",
     "    return '零件只以一点接触底板，没有可站立的面。请开启底盘垫把它固定住，'\n"
     "         + '或旋转到让某个面或边稳稳落在底板上';"),
    ("    if (!b.rejected.sites) return 'no overhangs to prop in this orientation';",
     "    if (!b.rejected.sites) return '这个朝向下没有需要支撑的悬垂';"),
    ("      return `${s.wanders} overhang${one ? ' is' : 's are'} bowl-shaped rather than `\n"
     "           + `a ledge — ${one ? 'its' : 'their'} lowest points form a ring, not a `\n"
     "           + 'line, so there is nothing for a wall to follow. Rotate, or switch '\n"
     "           + 'to Draw and place one by hand';",
     "      return `${s.wanders} 处悬垂是碗状而不是一条檐边 —— 它们的最低点围成一个环，`\n"
     "           + '而不是一条线，支撑墙无从沿着它生长。请旋转零件，'\n"
     "           + '或切到“手动”模式自己放一段';"),
    ("      return 'every wall that reaches these overhangs would fuse to the '\n"
     "           + 'part — rotate, or switch to Draw and place one by hand';",
     "      return '所有能够到这些悬垂的支撑墙都会与零件熔在一起 —— '\n"
     "           + '请旋转零件，或切到“手动”模式自己放一段';"),
    ("      return 'no run of these overhangs is long enough to stand a wall under — '\n"
     "           + 'the part is in the way, or they sit too close to the plate';",
     "      return '这些悬垂中没有足够长的一段可以立支撑墙 —— '\n"
     "           + '要么被零件本身挡住，要么离底板太近';"),
    ("      return 'the overhangs here are too small or too low to be worth a wall';",
     "      return '这里的悬垂太小或太低，不值得做一段支撑墙';"),
    ("      return 'the contact lines here collapse to a point — nothing to sweep along';",
     "      return '这里的接触线缩成了一点 —— 没有可以扫掠的路径';"),
    ("    return 'no overhang here can take a prop in this orientation';",
     "    return '这个朝向下没有任何悬垂能放支撑柱';"),
    ("      ? 'nothing flat and wide enough to stand a fin against — curved or '\n"
     "        + 'finely faceted surfaces have no flat face to grip'\n"
     "      : 'no flat upright face on this part in this orientation';",
     "      ? '没有足够大又平整的面可以立支撑鳍 —— 曲面或细碎的多边形面'\n"
     "        + '没有可抓附的平面'\n"
     "      : '这个朝向下零件上没有可用的竖直平面';"),
    ("      ? `${st.tooHigh} flat face${st.tooHigh === 1 ? '' : 's'} found, but every `\n"
     "        + 'one starts too far up the part — a fin would be mostly bare stilt. '\n"
     "        + 'Rotate so a flat face runs down to the plate'\n"
     "      : 'no usable face in this orientation — try rotating';",
     "      ? `找到了 ${st.tooHigh} 处平面，但它们都从零件过高的位置开始 —— `\n"
     "        + '支撑鳍大半会是空立的高跷。请旋转到有平面一直延伸到底板。'\n"
     "      : '这个朝向下没有可用平面 —— 试试旋转';"),
    ("    return 'the part is in the way of every wall position on the faces it found '\n"
     "         + '— rotate, or switch to Draw and place one by hand';",
     "    return '在找到的这些面上，每个支撑墙位置都被零件本身挡住 '\n"
     "         + '—— 请旋转，或切到“手动”模式自己放一段';"),
    ("  return 'the workable spots would put the fin inside the part — try rotating';",
     "  return '可用的位置都会把支撑鳍埋进零件内部 —— 试试旋转';"),
    # spinner / stale
    ("  el('s-fins').textContent = 'generating supports…';",
     "  el('s-fins').textContent = '正在生成支撑…';"),
    # setFinNote joining
    ("  el('s-fin-note').textContent = lead.length ? lead.join('. ') + '.' : '';\n"
     "  const info = el('s-fin-info');\n"
     "  const text = detail.filter(Boolean).join(' ');",
     "  el('s-fin-note').textContent = lead.length ? lead.join('；') + '。' : '';\n"
     "  const info = el('s-fin-info');\n"
     "  const text = detail.filter(Boolean).join('');"),
    # draw readout
    ("  el('s-pad').textContent = built?.pad ? 'added' : built ? 'not needed' : '—';\n"
     "\n"
     "  const ok = drawnWalls.filter((w) => w.ok);",
     "  el('s-pad').textContent = built?.pad ? '已添加' : built ? '不需要' : '—';\n"
     "\n"
     "  const ok = drawnWalls.filter((w) => w.ok);"),
    ("  box.textContent = ok.length\n"
     "    ? `${ok.length} drawn wall${ok.length === 1 ? '' : 's'}` + (tines ? ` · ${tines} tines` : '')\n"
     "    : 'none yet';",
     "  box.textContent = ok.length\n"
     "    ? `${ok.length} 段手绘支撑墙` + (tines ? ` · ${tines} 个卡齿` : '')\n"
     "    : '暂无';"),
    ("    lead.push('Click two points across an overhang (a line lands right where you '\n"
     "      + 'draw it, red faces included) to lay a breakaway wall under it');",
     "    lead.push('在悬垂上点两个点（连线会正好落在你画的位置，红色面也一样），'\n"
     "      + '就能在它下方铺出一段可掰断的支撑墙');"),
    ("    help.push(tines\n"
     "      ? 'The tines grab onto the part and bend away when you snap the wall off.'\n"
     "      : 'Each wall stops a hair under the part (0.2mm) so it snaps off clean. Turn '\n"
     "        + 'Tines on if you want it to grip the part.');",
     "    help.push(tines\n"
     "      ? '卡齿会咬住零件，掰下支撑墙时随之弯断，不会留下毛刺。'\n"
     "      : '每段墙都在零件下方停住，留 0.2mm 间隙，掰断更干净。'\n"
     "        + '想让它咬住零件，请开启“卡齿”。');"),
    ("    lead.push(`${bad} wall${bad === 1 ? '' : 's'} couldn’t build here`\n"
     "      + `${one?.info?.reason ? ` (${one.info.reason})` : ''}. Undo, or redraw`);",
     "    lead.push(`${bad} 段支撑墙在这里无法生成`\n"
     "      + `${one?.info?.reason ? `（${one.info.reason}）` : ''}，请撤销或重画`);"),
    ("      ? 'this part balances on one point, so the bed pad is holding it. Print with the pad on'\n"
     "      : 'this part balances on one point. Turn the bed pad on to seat it, or rotate until it sits down');\n"
     "  }\n"
     "  setFinNote(lead, help);\n"
     "  if (ms != null) el('s-time').textContent = `${analysisTiming} · pad ${ms.toFixed(0)} ms`;",
     "      ? '零件只靠一点平衡，目前是底盘垫在支撑它，请保持底盘垫开启后再打印'\n"
     "      : '零件只靠一点平衡。请开启底盘垫把它固定住，或旋转到让它稳稳坐下');\n"
     "  }\n"
     "  setFinNote(lead, help);\n"
     "  if (ms != null) el('s-time').textContent = `${analysisTiming} · 底盘垫 ${ms.toFixed(0)} ms`;"),
    # fin readout
    ("  el('s-pad').textContent = built.pad ? 'added' : 'not needed';\n"
     "  const n = built.fins.length;",
     "  el('s-pad').textContent = built.pad ? '已添加' : '不需要';\n"
     "  const n = built.fins.length;"),
    ("    if (b) seg.push(`${b} support fin${b === 1 ? '' : 's'}` + (built.tines ? ` · ${built.tines} tines` : ''));\n"
     "    if (p) seg.push(`${p} prop${p === 1 ? '' : 's'}`);",
     "    if (b) seg.push(`${b} 个支撑鳍` + (built.tines ? ` · ${built.tines} 个卡齿` : ''));\n"
     "    if (p) seg.push(`${p} 个支撑柱`);"),
    ("    autoTxt = n\n"
     "      ? `${n} ${kind === 'prop' ? 'prop' : 'support fin'}${n === 1 ? '' : 's'}`\n"
     "        + (built.mode === 'prop' || !built.tines ? '' : ` · ${built.tines} tines`)\n"
     "      : '';",
     "    autoTxt = n\n"
     "      ? `${n} 个${kind === 'prop' ? '支撑柱' : '支撑鳍'}`\n"
     "        + (built.mode === 'prop' || !built.tines ? '' : ` · ${built.tines} 个卡齿`)\n"
     "      : '';"),
    ("  const drawnTxt = drawnOk ? `${autoTxt ? ' + ' : ''}${drawnOk} drawn` : '';\n"
     "  box.textContent = (autoTxt + drawnTxt) || 'none possible';",
     "  const drawnTxt = drawnOk ? `${autoTxt ? ' + ' : ''}手绘 ${drawnOk} 段` : '';\n"
     "  box.textContent = (autoTxt + drawnTxt) || '无法放置';"),
    ("        help.push(built.tines\n"
     "          ? 'The tines grab onto the part and bend away when you snap the supports off.'\n"
     "          : 'The fins stand a hair off the part (0.2mm) so they pop off. Turn Tines on if you want them to grip.');",
     "        help.push(built.tines\n"
     "          ? '卡齿会咬住零件，掰下支撑时随之弯断，不会留下毛刺。'\n"
     "          : '支撑鳍与零件之间留了 0.2mm 间隙，可以直接掰下。想让它抓附零件请开启“卡齿”。');"),
    ("        help.push('These are plain props, not gripping fins. The overhangs here are '\n"
     "          + 'too shallow or curved to stand a fin against, so there are no tines to add.');",
     "        help.push('这些是普通支撑柱，不是带抓附的支撑鳍。这里的悬垂太平缓或太弯曲，'\n"
     "          + '立不住支撑鳍，所以没有卡齿可加。');"),
    ("        help.push(`The ${p} prop${p === 1 ? '' : 's'} sit under overhangs too shallow `\n"
     "          + 'to grip, so those get no tines.');",
     "        help.push(`这 ${p} 个支撑柱位于过浅、无法咬合的悬垂下方，因此不带卡齿。`);"),
    ("      help.push('Each one stops a hair under the part (0.2mm) so it pops off instead of needing a cut.');",
     "      help.push('每个支撑柱都在零件下方留 0.2mm 间隙，可以直接掰下，无需剪钳。');"),
    ("    lead.push(`plus ${drawnOk} wall${drawnOk === 1 ? '' : 's'} you added by hand`);",
     "    lead.push(`另外还有你手动添加的 ${drawnOk} 段支撑墙`);"),
    ("      lead.push(`${bad} drawn wall${bad === 1 ? '' : 's'} couldn’t attach here`\n"
     "              + (one?.info?.reason ? ` (${one.info.reason})` : ''));",
     "      lead.push(`${bad} 段手绘支撑墙无法附着在这里`\n"
     "              + (one?.info?.reason ? `（${one.info.reason}）` : ''));"),
    ("      ? 'this part balances on one point, so the bed pad is holding it. Print with the pad on'\n"
     "      : 'this part balances on one point with nothing under it. Turn the bed pad on, or rotate until it sits down');",
     "      ? '零件只靠一点平衡，目前是底盘垫在支撑它，请保持底盘垫开启后再打印'\n"
     "      : '零件只靠一点平衡，下方再无其他支撑。请开启底盘垫，或旋转到让它稳稳坐下');"),
    ("    lead.push('coverage is below the anti-sag guide, so a broad overhang may sag '\n"
     "            + 'between supports — nudge the slider right if the surface bows');",
     "    lead.push('覆盖密度低于防下垂建议值，大悬垂面可能在支撑之间下垂 '\n"
     "            + '—— 如果表面出现弯曲，把滑块往右移一点');"),
    ("    help.push(`${built.unserved} overhang${built.unserved === 1 ? ' is' : 's are'} `\n"
     "            + 'too shallow for a fin this way up. Tilt the part steeper so a fin can '\n"
     "            + 'follow it (try Suggest orientation), or add a wall by hand.');",
     "    help.push(`${built.unserved} 处悬垂在当前朝向下太平缓，立不住支撑鳍。`\n"
     "            + '把零件倾斜得更陡，让支撑鳍能贴着它生长（可试“推荐摆放方向”），'\n"
     "            + '或者手动添加一段支撑墙。');"),
    ("    help.push(`${b} overhang${b === 1 ? ' sits' : 's sit'} inside a bore or slot, `\n"
     "            + `where a support would leave a mark you can’t reach. The tool leaves `\n"
     "            + `${b === 1 ? 'it' : 'them'} alone, so turn the hole upward to print `\n"
     "            + `${b === 1 ? 'it' : 'them'} clean.`);",
     "    help.push(`有 ${b} 处悬垂位于内孔或槽内，在那里放支撑会留下你够不到的痕迹。`\n"
     "            + `工具刻意不处理它们：把孔转到朝上，就能干净地打印出来。`);"),
    ("  if (ms != null) el('s-time').textContent = `${analysisTiming} · fins ${ms.toFixed(0)} ms`;",
     "  if (ms != null) el('s-time').textContent = `${analysisTiming} · 支撑 ${ms.toFixed(0)} ms`;"),
    # draw controls hint
    ("  el('draw-hint').innerHTML = 'Click <strong>two points</strong> across an overhang '\n"
     "    + '— straight onto the red faces — to lay a breakaway wall along that line. '\n"
     "    + '<kbd>Esc</kbd> or right-click cancels.';",
     "  el('draw-hint').innerHTML = '在悬垂上点<strong>两个点</strong>'\n"
     "    + '（直接点在红色面上）即可沿这条线铺出一段可掰断的支撑墙。'\n"
     "    + '按 <kbd>Esc</kbd> 或右键可取消。';"),
    # augment toggle
    ("  el('augment-toggle').textContent = drawAugment ? 'Done adding walls' : '+ Add walls by hand';",
     "  el('augment-toggle').textContent = drawAugment ? '完成添加' : '+ 手动添加支撑墙';"),
    # fins toggle
    ("  el('fins-toggle').textContent = finsVisible ? 'Fins on' : 'Add fins';",
     "  el('fins-toggle').textContent = finsVisible ? '支撑鳍已开' : '添加支撑鳍';"),
    # lay face flat button
    ("  el('lay-face').textContent = layPlacing ? 'Click a face to lay it flat — Esc cancels'\n"
     "    : 'Lay a face flat';",
     "  el('lay-face').textContent = layPlacing ? '点击一个面让它贴平 — Esc 取消'\n"
     "    : '以面贴平';"),
    # suggestions
    ("    const roughCaveat = rough ? ` One small spot may print a bit rough.` : '';",
     "    const roughCaveat = rough ? ` 可能有小面积打印略粗糙。` : '';"),
    ("      ? ` It prints tall, though, the weaker direction, so check the Strength arrow if it bears a load.`",
     "      ? ` 不过它打得很高，属于较弱的方向，如承受载荷请看看受力箭头。`"),
    ("    return { tier: 'free', badge: 'No support',\n"
     "      note: `This way up it needs no fins, 0 g.${roughCaveat}${strengthCaveat}` };",
     "    return { tier: 'free', badge: '无需支撑',\n"
     "      note: `这样摆放不需要任何支撑鳍，新增材料 0 g。${roughCaveat}${strengthCaveat}` };"),
    ("    return { tier: 'holeclean', badge: 'Bores clean',\n"
     "      note: `This way up the bores point up, so no support sits inside a hole to scar it `\n"
     "          + `(${fmtGrams(grams)} g of fins, all on the outside).` };",
     "    return { tier: 'holeclean', badge: '孔内干净',\n"
     "      note: `这样摆放时内孔都朝上，没有支撑伸进孔里划伤配合面`\n"
     "          + `（支撑鳍共 ${fmtGrams(grams)} g，全部在外部）。` };"),
    ("    const overs = c.walls === 0 ? 'no fins' : `${c.walls} fin${c.walls === 1 ? '' : 's'}`;",
     "    const overs = c.walls === 0 ? '无需支撑' : `${c.walls} 个支撑鳍`;"),
    ("    const roughTxt = rough ? ` · ${rough} rough` : '';",
     "    const roughTxt = rough ? ` · ${rough} 处粗糙` : '';"),
    ("    const tail = point ? ' · can’t print (on a point)' : roughTxt;\n"
     "    row.innerHTML =\n"
     "      `<span class=\"sr-rank\">${i === 0 ? 'Best' : `#${i + 1}`}</span>` +",
     "    const tail = point ? ' · 无法打印（仅一点接触）' : roughTxt;\n"
     "    row.innerHTML =\n"
     "      `<span class=\"sr-rank\">${i === 0 ? '最佳' : `#${i + 1}`}</span>` +"),
    ("  btn.disabled = true; btn.textContent = 'Ranking…';",
     "  btn.disabled = true; btn.textContent = '正在评估…';"),
    ("      tog.setAttribute('aria-label', 'Collapse suggestions');\n"
     "      tog.title = 'Collapse';",
     "      tog.setAttribute('aria-label', '收起推荐结果');\n"
     "      tog.title = '收起';"),
    ("        el('suggest-note').textContent = confidence === 'none'\n"
     "          ? 'No printable orientation: this part balances on a point at every angle.'\n"
     "          : 'Nothing to suggest for this part.';",
     "        el('suggest-note').textContent = confidence === 'none'\n"
     "          ? '没有任何可打印的朝向：这个零件无论怎么转都只靠一点平衡。'\n"
     "          : '这个零件没有可推荐的方向。';"),
    ("          note.textContent = 'Click a pose to turn the part.';",
     "          note.textContent = '点选一个朝向来旋转零件。';"),
    ("      btn.disabled = false; btn.textContent = 'Suggest orientation';",
     "      btn.disabled = false; btn.textContent = '推荐摆放方向';"),
    ("  tog.setAttribute('aria-label', next ? 'Collapse suggestions' : 'Show suggestions');\n"
     "  tog.title = next ? 'Collapse' : 'Show';",
     "  tog.setAttribute('aria-label', next ? '收起推荐结果' : '展开推荐结果');\n"
     "  tog.title = next ? '收起' : '展开';"),
    # strongest pose note
    ("    note.textContent = 'This is about the strongest printable orientation for this '\n"
     "      + 'load — a better-aligned pose wouldn’t sit on the bed.';",
     "    note.textContent = '对这组受力来说，这已经是可打印的最强朝向了 '\n"
     "      + '—— 更顺层的摆法都无法稳坐在底板上。';"),
    # volume select
    ("volumeSelect.add(new Option('Custom…', 'custom'));",
     "volumeSelect.add(new Option('自定义…', 'custom'));"),
    # picker
    ("    loadBtn.textContent = n > 1 ? `Merge ${n} & load` : 'Load';\n"
     "    hint.textContent = n > 1 ? `${n} selected — merged into one part` : '';",
     "    loadBtn.textContent = n > 1 ? `合并 ${n} 个并载入` : '载入';\n"
     "    hint.textContent = n > 1 ? `已选 ${n} 个 —— 将合并为一个零件` : '';"),
    ("    meta.textContent = `${o.tris.toLocaleString()} tris · ${s[0]}×${s[1]}×${s[2]} mm`;",
     "    meta.textContent = `${o.tris.toLocaleString()} 三角面 · ${s[0]}×${s[1]}×${s[2]} mm`;"),
    # import notes
    ("    notes.push(chosen.length === 1\n"
     "      ? `imported “${chosen[0].name}” of ${objects.length} objects`\n"
     "      : `merged ${chosen.length} of ${objects.length} objects into one part`);\n"
     "  } else if (chosen[0].meshes > 1) {\n"
     "    notes.push(`merged ${chosen[0].meshes} bodies into one part`);\n"
     "  }\n"
     "  if (skipped) notes.push(`ignored ${skipped} support/non-printable ${skipped === 1 ? 'body' : 'bodies'}`);\n"
     "  if (unit && unit !== 'millimeter') notes.push(`converted from ${unit} to mm`);\n"
     "  importNote = notes.length ? `3MF: ${notes.join('; ')}.` : '';",
     "    notes.push(chosen.length === 1\n"
     "      ? `已从 ${objects.length} 个对象中载入“${chosen[0].name}”`\n"
     "      : `已把 ${objects.length} 个对象中的 ${chosen.length} 个合并为一个零件`);\n"
     "  } else if (chosen[0].meshes > 1) {\n"
     "    notes.push(`已把 ${chosen[0].meshes} 个实体合并为一个零件`);\n"
     "  }\n"
     "  if (skipped) notes.push(`已忽略 ${skipped} 个支撑/不可打印实体`);\n"
     "  if (unit && unit !== 'millimeter') notes.push(`已从 ${unit} 换算为毫米`);\n"
     "  importNote = notes.length ? `3MF：${notes.join('；')}。` : '';"),
    # load error alert
    ("    alert(`Could not read ${file.name}:\\n${err.message}`);",
     "    alert(`无法读取 ${file.name}：\\n${err.message}`);"),
]

# ----------------------------------------------------------------- orient.js
RULES["web/orient.js"] = [
    ("      text: 'The load runs along the layers — the strong direction. Good.' };",
     "      text: '受力方向与层线一致 —— 这是最强方向，很好。' };"),
    ("      text: 'The load partly crosses the layers.' };",
     "      text: '受力方向部分穿过层线。' };"),
    ("    text: 'The load pulls straight across the layers — where prints split first.' };",
     "    text: '受力方向垂直穿过层线 —— 这正是打印件最容易开裂的方向。' };"),
]

# ------------------------------------------------------------------- draw.js
RULES["web/draw.js"] = [
    ("    return { ok: false, reason: `wall too short — ${len.toFixed(0)}mm, needs ${PROP.minSpan}mm` };",
     "    return { ok: false, reason: `支撑墙太短 —— ${len.toFixed(0)}mm，至少需要 ${PROP.minSpan}mm` };"),
    ("    return { ok: false, reason: 'no surface found along that line' };",
     "    return { ok: false, reason: '这条线上找不到可附着的表面' };"),
    ("      return { ok: false, reason: 'this overhang sits above another part of the '\n"
     "        + 'model, so a wall standing on the plate can’t reach it — rotate so it '\n"
     "        + 'faces the plate' };",
     "      return { ok: false, reason: '这段悬垂位于模型其他部分的上方，'\n"
     "        + '立在底板上的支撑墙够不到它 —— 请旋转让它朝向底板' };"),
    ("    return { ok: false, reason: 'nothing to hold up there — the line sits at the plate' };",
     "    return { ok: false, reason: '这里没有需要托住的东西 —— 这条线就在底板上' };"),
]

# ------------------------------------------------------------------- fins.js
RULES["web/fins.js"] = [
    ("    return { ok: false, reason: 'aim at a downward / overhang face — a support fin '\n"
     "      + 'holds an overhang up from below, not a vertical side' };",
     "    return { ok: false, reason: '请点朝下的悬垂面 —— 支撑鳍是从下方托住悬垂，'\n"
     "      + '而不是贴在竖直侧面上' };"),
    ("    return { ok: false, reason: 'this face is too small or shallow to stand a fin '\n"
     "      + 'under — tilt it steeper, or pick a broader overhang' };",
     "    return { ok: false, reason: '这个面太小或太平缓，无法在其下方立起支撑鳍 '\n"
     "      + '—— 请把零件倾斜得更陡，或选择一个更大的悬垂面' };"),
]

# ------------------------------------------------------------------- zip.js
RULES["web/zip.js"] = [
    ("throw new Error('ZIP entry is too large to read')",
     "throw new Error('ZIP 条目过大，无法读取')"),
    ("throw new Error('not a ZIP archive (no end-of-central-directory record)')",
     "throw new Error('不是 ZIP 归档（缺少中央目录结束记录）')"),
    ("throw new Error('corrupt ZIP: ZIP64 markers with no ZIP64 record')",
     "throw new Error('ZIP 已损坏：存在 ZIP64 标记但缺少 ZIP64 记录')"),
    ("throw new Error('corrupt ZIP central directory')",
     "throw new Error('ZIP 中央目录已损坏')"),
    ("throw new Error(`corrupt ZIP: ${name} needs a ZIP64 extra field and has none`)",
     "throw new Error(`ZIP 已损坏：${name} 需要 ZIP64 扩展字段，但没有找到`)"),
    ("throw new Error(`corrupt local header for ${name}`)",
     "throw new Error(`${name} 的本地文件头已损坏`)"),
    ("throw new Error(`unsupported ZIP compression method ${method} for ${name}`)",
     "throw new Error(`${name} 使用了不支持的 ZIP 压缩方式 ${method}`)"),
]

# ---------------------------------------------------------------- threemf.js
RULES["web/threemf.js"] = [
    ("throw new Error('no 3D model part found in this 3MF')",
     "throw new Error('这个 3MF 中找不到 3D 模型部件')"),
    ("throw new Error('this 3MF contains no printable mesh geometry')",
     "throw new Error('这个 3MF 中没有任何可打印的网格几何')"),
]


def normalize(old, new, text):
    """Return the rule in the file's own newline convention (the checkout is CRLF)."""
    if text.count(old) == 1:
        return old, new
    if '\r\n' in text and '\n' in old:
        crlf_old = old.replace('\n', '\r\n')
        if text.count(crlf_old) == 1:
            return crlf_old, new.replace('\n', '\r\n')
    return old, new


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    failures = []
    planned = []
    for rel, rules in RULES.items():
        path = os.path.join(ROOT, rel.replace('/', os.sep))
        with open(path, encoding='utf-8', newline='') as fh:
            text = fh.read()
        for old, new in rules:
            old, new = normalize(old, new, text)
            n = text.count(old)
            if n != 1:
                failures.append(f"{rel}: {n} matches for >>>{old[:90]}<<<")
            else:
                planned.append((rel, old, new))
        RULES[rel] = (path, text)

    if failures:
        print("ABORTED - %d rule(s) did not match exactly once:" % len(failures))
        for f in failures:
            print("  " + f)
        return 1

    for rel, (path, text) in RULES.items():
        out = text
        for r, old, new in planned:
            if r == rel:
                out = out.replace(old, new)
        with open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(out)
        print(f"{rel}: {sum(1 for r, _, _ in planned if r == rel)} replacements applied")
    print("OK - %d replacements total" % len(planned))
    return 0


if __name__ == '__main__':
    sys.exit(main())
