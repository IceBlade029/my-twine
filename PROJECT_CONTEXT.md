# PROJECT_CONTEXT — 项目认知、阶段计划与跨会话记忆

> **本文档是本仓库唯一的跨会话记忆源。**
>
> - 任何新会话、空对话在开始工作前，必须先阅读本文件，再结合 `git log` 与工作树状态同步认知。
> - 任何 agent 完成任何代码、配置、功能或决策更新后，**必须同步更新本文档**，使文档始终反映仓库最新状态。
> - 更新后随改动一起提交；无法归入同一提交时，单独用 `docs:` 提交。
> - 每次会话结束前，必须检查 `git status` 与本文档是否一致。
>
> 最后更新：阶段 10A 已在提交 `c72cde1d` 完成第一片纵向实现，并在用户实测后由提交 `d48a6fad` 修正普通模块展开合同：普通模块默认收起，但每个模块可独立展开/收缩并允许同时展开多个；再次点击自身即可收起，运行记录定位只补充展开目标和祖先，不关闭其他模块。Branch/Switch/Loop 继续保持独立折叠；树线、深层扁平化、条件/动作/错误/隐藏/未命中标签已落地。阶段 10B（分支视觉语法与选择分组）、10C（插入位置与拖拽/键盘移动）、10D（引用视图及完整验收）仍待实现。详细设计契约见 `NARRATIVE_EDITOR_INTERACTION_DESIGN.md`。读取时请以 `git log` 显示的实际 HEAD 为准。

---

## 1. 项目定位

- 本仓库是基于 **Twine 2.12.0 源码**（`twinejs`）的个人定制项目。
- **方向表述：保留 Twine 的故事工作区（节点地图）与 SugarCube 运行时，重做 Passage 创作层。** 不是“给 Twine 增加图形化宏按钮”，而是把 Passage 源码编辑器替换成面向内容创作者的结构化节点编辑器。
- **目的不是维护通用 Twine**，而是彻底改造交互方式，并按个人需求随时增加新功能。
- 只服务于仓库所有者一个人。所有产品、技术、验收判断都以“个人好用”为准。

## 2. 不可妥协的原则

1. **只适配 SugarCube**：编辑器生成、编译、持久化逻辑只针对 SugarCube；不需要兼容其他故事格式。
2. **其他故事格式原样保留**：Harlowe / Snowman / Chapbook 等不删除、不隐藏、不做适配。用户自己不会去点，不必处理。
3. **不需要防呆设计**：单人使用场景下，不为误操作、异常输入、极端边界做防御性设计；除非直接影响用户自己的正常使用流程，否则不主动加保护。
4. **不追求官方/通用兼容性**：不把上游 Twine 的兼容要求、公共用户场景、全套旧测试作为验收标准。
5. **开发主线是 `narrative-editor` 分支**：后续工作继续在该分支上提交推进。
6. **文档必须随更新同步**：本文件是跨会话记忆，任何更新后未同步文档视为未完成。

## 3. Git 历史与当前状态

### 关键提交

| 提交 | 说明 |
| --- | --- |
| `e36c6009` | 上游原版提交（改造前最后的上游状态） |
| `32dfcc58` | **基线空提交**：`chore: establish upstream Twine baseline`，有意创建的改造分界标记 |
| `4729fac7` | **阶段 1–4 的功能提交**：`feat: add visual passage editor and metadata` |
| `88d43ecf` | `chore: sync package-lock version to 2.12.0`（保留并提交 package-lock 版本号同步） |
| `8edad74d` | **阶段 5 的功能提交**：`feat: rebuild visual passage editor as ordered node tree (blocks v2) with simulator and story-states dialog` |
| `75c8eae8` | **阶段 6 的功能提交**：`feat: add list state type with list actions/conditions, and variable + include blocks` |
| `936741b5` | **阶段 6.5 的重构提交**：`refactor: extract unified BlockShell and block-kind metadata registry` |
| `b03d7c66` | **阶段 7 的功能提交**：`feat: add in-place interaction blocks (reveal/append/remove) and back/return choice targets` |
| `0ea5e5df` | **阶段 8 的功能提交**：`feat: add raw SugarCube leaf blocks, variable loop-item source, switch and loop container blocks` |
| `a9db5bf4` | **阶段 9 的功能提交**：`feat: move state init into visible StoryInit passage and recognize SugarCube special passages` |
| `5ed09202` | **首片低代码交互原型**：`feat: vertical-slice prototype - expression AST, module selector, default Chinese, set-variable, and real SugarCube runtime check drawer` |
| `c72cde1d` | **阶段 10A 功能提交**：`feat: add compact visual block tree interactions` |
| `d48a6fad` | **阶段 10A 交互修正**：`fix: allow independent visual block expansion` |

### 约定

- 开发分支：`narrative-editor`。
- 官方历史与 `origin/develop` 不主动修改。
- 本地 git 身份已配置为与功能提交一致：`IceBlade029 <707578197@qq.com>`。
- 是否推送 `origin/narrative-editor` 由用户决定，未经要求不主动 push。

## 4. 阶段计划与完成状态

阶段计划来自用户提供的原始计划文本。**用户已确认阶段 0–4 全部完成**；阶段 1–4 的代码产出集中在提交 `4729fac7`。

### 阶段 0：跑通原版基线（已完成）

计划目标：安装依赖并验证 Web 开发版能运行，创建/编辑/保存故事、节点连线、SugarCube 试玩正常，测试基线明确。

完成情况：
- 依赖安装成功，`npm start` 运行正常。
- 基线空提交 `32dfcc58` 标记改造分界点。
- 阶段 0 由用户人工验证通过。

### 阶段 1：只改编辑器外壳（已完成）

计划目标：
- 将浮动 Passage 编辑器改为右侧停靠面板。
- 保留原来的 CodeMirror。
- 地图与编辑器能够同时操作。
- 验证选择节点、切换节点、关闭面板、撤销行为。

完成情况：
- `addPassageEditors` 从“最多 6 个段落卡片堆叠”简化为**每次只编辑 1 个段落**。
- `PassageEditStack` 改为单个 `DialogCard`。
- 编辑器变为右侧停靠面板（约 `min(34rem, 42vw)`），通过 CSS `:has()` 让主画布让位，地图与编辑器可同时操作。
- `passage-edit-contents.tsx` 保留原 CodeMirror 分支：无 `visual` 的段落仍用源码编辑器。
- 节点双击打开编辑、关闭面板、撤销历史沿用 Twine 现有机制并已验证。

计划文本提到但当前代码未包含的交互（按用户确认阶段 1 已完成，以下视为后续可选新需求，未提出则不做）：
- 单击节点只选中并在右侧显示概要。
- 点击空白处收起右侧面板。
- 右侧面板宽度可拖动。
- 多选节点时右侧显示批量属性。

### 阶段 2：图形化正文和选择（已完成）

计划目标：
- 增加 `StructuredPassageContentV1` 结构化数据。
- 加入正文编辑区、选择列表和目标节点下拉框。
- 将结构化内容编译为 SugarCube `text`。
- 确认地图连线实时更新。
- 加入只读生成源码预览。
- 图形节点与源码节点明确区分，不逆向解析任意 SugarCube。

完成情况：
- 结构化数据类型落地为 `VisualPassageContentV1`（`src/store/stories/stories.types.ts`）：
  - `body`、`bodyCondition?`、`choices`、`version: 1`。
  - `VisualPassageChoice`: `{id, label, targetPassageId, condition?, actions}`。
- `Passage.visual?: VisualPassageContentV1`；有 `visual.version === 1` 为图形节点，否则为源码节点。
- 正文编辑区：纯文本 `textarea`，blur 时提交并重编译。
- 选择列表：选择文字、目标节点下拉框、添加/删除选择。
- `compileVisualPassage()` 编译为 SugarCube 源码；地图连线继续从生成的 `passage.text` 解析，因此更新后连线实时变化。
- “查看生成的 SugarCube 源码”只读预览已实现。
- 新段落默认带空 `visual`，即默认进入图形编辑模式。
- 默认故事格式从 Harlowe 改为 SugarCube。
- 段落空判断、段落卡片摘要均改为优先使用结构化数据。

计划文本提到但当前代码未包含（视为后续可选新需求，未提出则不做）：
- 正文轻量富文本（粗体、斜体、标题、引用、分隔线、图片），当前正文是纯文本。
- 选择的“复制”按钮，当前只有删除。
- “切换到源码节点”按钮，当前无手动入口；源码节点目前来自导入的旧故事或外部修改回退。

### 阶段 3：可靠保存与兼容（已完成）

计划目标：
- 把结构化元数据写入项目 HTML。
- 导入时恢复。
- 识别图形节点与源码节点。
- 处理元数据缺失、版本不匹配和生成文本被外部修改。
- 验证在原版 Twine 和浏览器中仍可运行。

完成情况（`src/util/visual-editor-metadata.ts` + 发布/导入链路）：
- **发布**（`src/util/publish.ts`）：在标准 `<tw-storydata>` 内嵌入额外 metadata：
  ```html
  <script type="application/json" data-narrative-editor>...</script>
  ```
- **导入**（`src/util/import.ts`）：解析 metadata 并恢复各段落的 `visual`；目标段落 ID 通过段落名重新映射。
- **图形/源码节点识别**：`passageUsesVisualEditor()` 按 `visual.version === 1` 判断；无 `visual` 即源码节点。
- **元数据缺失/版本不匹配**：仅恢复 `version === 1`；缺失或不支持时安全退化为源码节点。
- **生成文本被外部修改**：段落文本与 metadata 中的 `generatedText` 不一致时，该段落回退为源码模式，不恢复 `visual`，避免静默覆盖外部编辑。
- 发布产物保持标准 Twine 故事数据，`text` 仍是生成后的 SugarCube 源码；metadata 只是附加脚本，因此故事在浏览器 / SugarCube / 原版 Twine 中仍可运行。
- 测试覆盖：`src/util/__tests__/visual-editor-metadata.test.ts`（round-trip、外部修改回退、版本不匹配）。

### 阶段 4：常用状态操作（已完成）

计划目标：
- 是/否状态、数值状态、文本状态。
- 简单显示条件。
- 点击后设置状态。
- 增加或减少数值。
- 只通过下拉框、开关和数值框完成，不暴露 `$`、`<<if>>` 和操作符语法。

完成情况（`src/dialogs/passage-edit/passage-visual-editor.tsx` + 编译层）：
- 故事级状态列表 `Story.visual.states`，类型 `boolean | number | text`，可增删、命名、设默认值。
- 正文和每个选择都支持显示条件：`equals | notEquals | greaterThan | lessThan`（数值才显示大于/小于）。
- 选择后动作：`set | increase | decrease`（数值才显示加减）。
- 所有条件与动作都通过表单控件编辑，作者不直接接触 `$`、`<<if>>` 语法。
- `compileVisualPassage()` 生成对应的 SugarCube：`$nrp_<id 清洗值>` 变量、`<<if>>` 条件、链接 setter。
- 删除故事状态时，会同步清理各段落中引用该状态的条件/动作并重编译。
- 测试覆盖：`src/util/__tests__/visual-passage.test.ts`、`src/dialogs/passage-edit/__tests__/passage-visual-editor.test.tsx`。

### 其他配套改动

- `src/index.tsx`：改为 `i18nReady.then(...)` 后再渲染 React。
- `src/components/control/card-button.tsx`：为 `react-transition-group` 补充 `nodeRef`。
- `public/locales/en-US.json` / `zh-CN.json`：补齐可视化编辑器文案。

### 阶段 5：可视化编辑器重构（已完成）

> 方向决策（用户拍板）：把「可视化段落编辑器」从「一段 body + 一组 choices」重构为**可视化节点树**，核心目标是解决「条件/动作不可见、作用域不明确」的问题。三项已锁定：**浅树**、**故事状态移到故事级面板**、**段落编辑器底部可折叠模拟器抽屉**。

计划目标：
- 段落内容改为有序**块列表**，唯一容器是「条件分支」，分支内可再嵌套。
- 条件/动作一律**人话渲染**（见下方规则），不再用 `= ≠ > <` 裸符号。
- 故事状态（全局变量）从段落编辑器移出，放到故事级「故事状态」面板。
- 加「实时模拟器」：拨状态值，段落树实时高亮哪些块显示/隐藏。
- 顺带修复上一轮验收发现的致命 bug（init 块被剥、Esc 丢字、空选择静默丢弃、撤销洪水）。

数据模型 v2（`src/store/stories/stories.types.ts`）：
- `VisualPassageContentV2 { version: 2; blocks: VisualBlock[] }`。
- `VisualBlock` 三选一：`text`（text + condition?）、`choice`（label / targetPassageId / condition? / actions[]）、`branch`（branches[]）。
- `VisualBranch { id; condition?; blocks[] }`；`condition === undefined` 表示「否则」分支，必须放最后且最多一个。
- 条件/动作/状态字段（`VisualCondition` / `VisualStateAction` / `VisualStoryState`）保持不变。

编译语义（重写 `src/util/visual-passage.ts` 的 `compileVisualPassage`）：
- 按序遍历 blocks：text → 有 condition 则 `<<if c>>text<</if>>`；choice → `[[label->目标]][setter]`；branch → `<<if c1>>块1<<elseif c2>>块2<<else>>块N<</if>>`，子块递归。
- **修 init bug**：编译时显式传入 owner 段落 id（不再用对象 `===` 找 owner）。
- **空选择不静默**：label/目标为空的 choice 在 UI 标红、编译跳过并提示，而非悄悄消失。

可见性规则：
- 条件句模板：「当【状态名】是 / 不是 / 大于 / 小于 『值』时」，布尔显示「是/否」。
- 动作句模板：「点击后：【状态名】设为 / 加 / 减 『值』」。
- 每个块顶部是「门槛条」；模拟器判定隐藏的块变灰并标注隐藏原因。
- 每次改动即存（防抖）+ 顶部「已保存」指示，Esc 关闭不再丢字。

迁移 v1 → v2：
- 旧 v1 段落自动转：body(+bodyCondition) → 1 个 text 块；每个 choice → 1 个 choice 块，内容零丢失。
- 新段落默认 `{version: 2, blocks: [{kind: 'text', text: ''}]}`；metadata 恢复同步升版。

验收标准（DoD）：
1. `npm run lint` 与 `npx tsc --noEmit` 通过。
2. v1→v2 迁移测试：导入旧数据行为等价、内容不丢。
3. 编译测试：text/choice/branch 组合（含嵌套分支、否则分支、空选择跳过）输出正确。
4. 回归修复：init 块不再被剥；Esc 不丢字；状态编辑不产生撤销洪水。
5. 视觉验收：截图确认「节点树 + 人话条件 + 模拟器高亮」。

已定案的三项交互决策（用户拍板）：
1. **切回源码**：做，首版用**方案 A（单向 + 确认框）**。工具栏加「以源码编辑」，确认后置 `visual = undefined`、`text` 保持当前编译产物，CodeMirror 接管；不提供"切回可视化"。作为「全能力可视化」落地前的逃生舱。
2. **模拟器 vs Play**：并存不打通。模拟器定位纯编辑辅助（拨假想状态、高亮本段显隐、不运行、不执行动作）；Play 继续做真机验证；源码预览退居开发者折叠项。
3. **块排序**：首版做**上/下移按钮 + 分支内就地加块**；拖拽作为后续增强。

完成情况（提交 `8edad74d`，验收通过）：
- 数据/编译：v2 blocks 模型、`migrateVisualContent`（v1→v2 无损、幂等）、`compileVisualPassage(content, story, passageId)` 用显式 id 修复 init 被剥、空选择编译跳过；元数据升 v2、递归处理嵌套 choice、兼容 v1 恢复。
- UI：块树编辑器（text/choice/branch，上/下移/删除/就地加块）、人话条件/动作句、每块门槛条、底部**模拟器抽屉**（拨状态值 → 变灰 + 「hidden because …」）、**故事状态对话框**（工具栏按钮打开，移出编辑器）、**单向「Edit as source」+ 确认框**、即存(防抖)+「Saved」指示（Esc 不再丢字）。
- 消费方同步：`passage-is-empty` 递归判空、`passage-card` 摘要取首个非空文字块、`passageUsesVisualEditor` 兼容 v1/v2。
- 验收：`npm run lint`、`npx tsc --noEmit` 均通过；相关单测 4 套 27/27；视觉验收截图确认节点树 / 人话条件 / 模拟器 / 切源码，且切源码后的编译产物含正确的 `<<if undef>>` 初始化块。

已知小瑕疵（不阻塞，后续再打磨）：
1. 英文条件句措辞偏简（"When Has key is no"），中文版「当【Has key】是『否』时」可读性更好；英文可考虑用 "is set to yes/no"。
2. 模拟器的布尔输入仍是 `true/false` 字面值，而条件值选择已用 yes/no（不一致）。
3. 部分块操作按钮（Add text block / Add branch / Move up / Move down / Delete block）仍是硬编码英文，未进 i18n。

### 阶段 6：list 数据结构 + 变量插入块 + 引用块（已完成）

完成情况（提交 `75c8eae8`，验收通过）：
- **list 状态类型**：`VisualStateType` 加 `list`（默认值 `string[]`）；动作加 `push`/`remove`/`clear`（编译 `$x.push(v)` / `$x.delete(v)` / `$x = []`）；条件加 `includes`/`notIncludes`（编译 `$x.includes(v)` / `!$x.includes(v)`）。
- **状态管理器**：list 默认值用 `ListValueInput` 逐项编辑（增删 item）；类型切换时清理不兼容的动作/条件（`isActionCompatible` / `isConditionCompatible`）。
- **变量插入块**（`kind:'variable'`）：渲染某状态当前值，编译 `<<print $nrp_x>>`；**引用块**（`kind:'include'`）：内联另一段落，编译 `<<include "Passage">>`；两者都支持条件包裹、缺引用时跳过并在 UI 标 incomplete。
- **元数据**：include 块的 `targetPassageId` 按段落名重映射（递归，含嵌套分支）；variable 块的 `stateId` 直接保留。
- **模拟器**：list 状态用逗号分隔输入解析为 `string[]`，`evaluateCondition` 支持 includes/notIncludes。
- 验收：`npm run lint`、`npx tsc --noEmit` 通过；相关单测 4 套 41/41；视觉验收截图确认列表状态编辑器 / Variable 块 / Include 块 / 模拟器列表输入。

### 阶段 6.5：块外壳抽象（BlockShell）（已完成）

> 前置小阶段（用户拍板）：进入阶段 7 之前，先把每个块的「头部 / 工具栏 / 门槛条」抽象成统一的 `BlockShell` 外壳，避免 7/8/9 每加一种块就复制一套头部，从而让末尾的「树形视觉大修」只需改一个外壳 + CSS。用户已确认顺序：**先完成地基与能力层，再大修视觉与交互**。

计划目标（纯重构，无可见视觉变化）：
- 抽出 `BlockShell` 组件，统一承载：图标槽 + 块类型标签 + 条件门槛条（条件句 / hidden 徽章）+ 上移/下移/删除工具栏 + 内容体。
- 建立「块种类元数据注册表」：`kind → {icon, labelKey}`（text/choice/branch/variable/include 各配一个图标）。
- `BlockList` 改用 `BlockShell` 渲染，消除各块头部/工具栏的复制粘贴。
- `BranchEditor` 去掉自带的 `branch-heading`（重复的 "Branch" 标签改由 BlockShell 提供），只保留分支列表 + 条件行 + 嵌套 `BlockList`。
- 埋入 `depth` 参数（BlockShell 设 `data-depth`，分支内嵌套 `depth+1`），为将来的缩进/树线/折叠预留接口，但**本阶段不改变视觉**。
- 验收：`npm run lint` + `npx tsc --noEmit` + 相关单测保持通过；视觉上编辑器渲染不变（无回归）。

完成情况（提交 `936741b5`，验收通过）：`BlockShell` 统一承载块头部/门槛条/工具栏；`blockKindMeta` 注册表（kind → icon + labelKey，五个块各配图标）；`BlockList` 改用 `BlockShell`、`BranchEditor` 去掉重复的 branch-heading、`depth` 参数透传并落到 `data-depth`（为树形视觉预留）。纯重构，无视觉回归（仅新增图标与 data-depth，去掉分支块里重复的 "Branch" 标签）。`lint`/`tsc`/相关单测 37/37 通过，视觉截图确认无回归。

### 阶段 7：交互块家族（已完成）

完成情况（提交 `b03d7c66`，验收通过）：
- **就地交互块**（`kind:'interaction'`）：`operation` = `reveal`/`append`/`remove`，自包含 hook id（`nrp_hook_<id>`），编译为 SugarCube `<<link "label">><<replace/append/remove "#hook">>content<</replace/append/remove>><</link>><span id="hook">…</span>`，条件包裹整体；label 为空时跳过并在 UI 标 incomplete。
- **back/return 导航**：`VisualChoiceBlock.specialTarget?: 'back' | 'return'`，编译为 `<<back "label">>` / `<<return "label">>`（无 setter，条件包裹）；编辑器目标下拉框新增 Back/Return。
- 元数据：interaction 块原样往返（无目标重映射）、choice 的 specialTarget 随 spread 往返。
- 消费方：interaction 块 label/content 非空即算有内容；`passage-card` 摘要跳过；`stripStateReferences` 删除状态时剥掉 interaction 块的条件。
- 验收：`npm run lint` + `npx tsc --noEmit` + 相关单测 4 套 50/50；视觉截图确认 Interaction 块（Interaction text / Operation / Content / Add condition）正常渲染。

### 阶段 8：流程容器与表达式边界（已完成）

完成情况（提交 `0ea5e5df`，验收通过）：
- **raw 原始宏叶子块**（`kind:'raw'`）：verbatim SugarCube 文本（不 trim），条件包裹，空内容跳过；表达式边界逃生舱（定调 1 落地）。
- **variable 块加 source 字段**（`'state' | 'loopItem'`）：`loopItem` 编译为 `<<print _item>>`（配合 loop 块使用），`stateId` 变为可选。
- **switch 多路分支块**（`kind:'switch'`）：按状态值匹配 `cases`（`sugarCubeValue` 渲染值）+ `defaultBlocks`，编译 `<<switch $x>><<case v>>…<</case>><<default>>…<</default>><</switch>>`，条件包裹；状态缺失或 cases+default 全空时跳过；模拟器高亮匹配的 case、变灰其余。
- **loop 循环块**（`kind:'loop'`）：遍历 list 状态，编译 `<<for _item range $x>>body<</for>>`，body 递归编译；非 list 状态跳过；条件包裹。
- 元数据：switch/loop 的 stateId 原样、case 值原样、嵌套块递归往返。
- 消费方：switch/loop stateId 非空即算有内容；`stripStateReferences` 删除状态时清空其 stateId 并递归剥条件。
- 验收：`npm run lint` + `npx tsc --noEmit` + 相关单测 4 套 71/71；视觉截图确认 Switch 块（Switch on / Add case / Default）与 Loop 块（Loop over / Loop body，嵌套在 Default 内渲染正常）。

### 阶段 9：特殊段落可视化表面（已完成）

完成情况（提交 `a9db5bf4`，验收通过）：
- **状态初始化搬进 StoryInit**：新增 `compileStateInitialization(states)`；`compileVisualPassage` 优先把初始化块注入名为 `StoryInit` 的段落（缺失时回退旧的 start/first-visual 行为，保证旧故事不坏）；故事状态面板在「有状态且无 StoryInit」时**同一次 updateStory 内自动创建** StoryInit 段落（可见、可编辑），其 text 立即含初始化块。
- **StoryInit 编辑器预览**：编辑 StoryInit 时顶部显示只读的「自动生成的状态初始化」块（`<<if ndef…>>`），作者一眼可见默认运行逻辑。
- **特殊段落识别**：新增 `src/util/special-passages.ts` 注册表（StoryTitle/StoryAuthor/StorySubtitle/StoryInit/StoryCaption/StoryMenu/PassageHeader/PassageFooter/PassageDone，按精确名区分大小写），段落卡片显示角色徽标（如 StoryInit → INIT）、编辑器顶部显示「特殊段落：角色 —— 说明」注释（visual/source 两模式都有）。
- **创建菜单**：Passage 工具栏新增每个特殊段落的创建入口（`createSpecialPassage(story, name)`，重名时不重复创建、改为高亮已有段落）。
- widget→可复用组件：按定调 3 继续归「原始宏叶子」，未单列。
- 顺手修复：阶段 5 遗留的过时测试 `create-untitled-passage.test.ts`（断言 v1 visual 形状）更新为 v2。
- 验收：`npm run lint` + `npx tsc --noEmit` 通过；新增 4 个测试套件（special-passages/passage-card/passage-edit-contents/passage-actions/create-special-passage）+ 回归全绿；视觉验收确认地图 INIT 徽标、编辑器特殊段落注释与初始化预览。

### 阶段 10：紧凑树形编辑器视觉与交互重构（10A 已完成，10B–10D 待实现）

> 用户真实使用当前版本后确认：右侧编辑区的主要问题已经不是能力缺失，而是每个模块把完整表单长期铺开，导致信息密度低；同时块树虽在数据中存在，界面却没有把**包含、缩进、同级执行顺序、互斥分支、当前隐藏**投影成一眼可读的视觉结构。阶段 6.5 已准备 `BlockShell` 与 `data-depth`，本阶段正式消费这些地基。

已定案的总体形态：

- 采用**紧凑摘要树 + 选中模块就地展开 + 容器独立折叠 + 明确树线语义 + 临时模块选择器**；不再采用常驻的“结构树 + 另一块独立检查器”双栏布局。
- 普通模块默认只显示一行：图标、类型、结构摘要、条件/动作/错误状态和更多菜单；每个普通模块可独立展开/收缩，允许多个模块同时展开以便对照。
- 条件、Switch、循环等容器可以独立展开/折叠子树；折叠后必须保留条件、分支数量、子模块数量、读取/写入摘要和错误状态。
- 选中模块在原位置展开配置，避免作者在结构树与远处检查器之间反复对照；配置仍来自同一份块数据，不建立第二份表单状态或翻译模型。

模块双态投影合同：

- 参考图中的“复杂模块展示目录”视为各模块的**展开编辑态**参考；“完整 Passage 组合视图”视为多个模块的**紧凑摘要态**参考。两者不是两套编辑器，而是同一块数据的两种投影。
- `BlockShell` 统一负责图标、类型、摘要、条件/动作/错误状态、折叠、选中、拖拽手柄和更多菜单；每种块继续使用自己的专用 Editor 渲染展开表单，不强迫所有模块共享一张通用表单。
- 文本、修改变量、选择、条件、Switch、Loop、Include、raw 等现有模块都必须分别定义摘要态字段和展开态控件；摘要必须由真实块数据派生，不能维护手写副本。
- 相邻选择块的视觉组在遇到非选择块时自然结束；组头可显示选项数、带条件数、带动作数，但移动、编译和 metadata 仍以每条 `VisualChoiceBlock` 为单位。
- 模块类型、条件、动作、目标、权重、时长等高价值字段优先成为摘要标签；低频配置进入展开态或更多菜单。
- 地图节点未来可显示模块数、选择数、条件数、引用数、错误数、字数和预计时长等派生指标，但它们不是阶段 10 的前置条件，也不得成为新的事实源。

树形视觉语法：

- 连续竖线表示同一 `BlockList` 中从上到下的执行顺序；它是“同级顺序”，不是并行执行。
- 缩进和父级树线表示容器真正拥有子块；`If` / `Switch` 的分叉线表示互斥分支。
- `Include` 是运行时引用另一个 Passage，使用引用箭头/目标摘要，不伪装成父子包含。
- 当前测试快照下不执行的分支或模块使用低饱和灰化，并明确标注“当前未命中/当前隐藏”；红色只表示错误，不表示普通的“否则”。
- 颜色不能成为唯一信息来源；类型、图标、标签、线型和文字必须在无颜色时仍能表达关系。
- 顶层容器可使用轻量边框和底色；第二层及更深层级以树线 + 扁平行表达，禁止无限“卡片套卡片”挤压横向空间。

选择与插入规则：

- 保持当前 `VisualChoiceBlock`“一条块 = 一个玩家选项”的数据语义；第一阶段只允许把相邻选择块做**视觉分组**，不新增 `choiceGroup` schema，不改变编译与 metadata。
- 每个可插入位置仍只有一个“+ 在此添加模块”入口；模块面板点击后临时展开，可显示搜索、分类、最近使用和收藏，选择后自动收起。
- 不常驻一整排大模块按钮，不展示尚未实现的模块，避免固定占地和虚假能力承诺。
- 拖拽排序作为增强，但不是唯一操作；上移/下移与键盘移动必须保留，所有可移动块使用一致的拖拽手柄。

运行检查与引用：

- “运行检查”继续复用真实 SugarCube iframe、状态差异、渲染结果、执行记录和源码，不另造解释器或第二套测试语义。
- “引用”视图显示当前 Passage/模块引用谁、被谁引用，并能定位到具体块；它不改变现有 Include 或地图链接语义。

实现边界：

- 本阶段优先是视图与交互重构；默认不修改 `VisualPassageContentV2`、编译器、发布、导入和运行时语义。
- 折叠、选中、临时模块面板等纯视图状态不得写入故事事实源；如后续需要跨会话记忆，另行设计编辑器偏好，不污染发布 metadata。
- 不在本阶段顺带新增“跳转、等待、播放音效、注释”等尚不存在的块能力。

验收标准（DoD）：

1. 在当前右侧面板宽度下，无需滚动即可看清固定验收段落的顶层文本、展开的条件分支、满足/否则两路、选中的选择块和插入入口。
2. 固定验收段落同时证明：顶层同级顺序、两层包含、互斥分支、当前未命中、Include 引用五种关系；不能只靠颜色判断。
3. 普通块默认紧凑；点击模块可独立展开，再次点击自身收起，展开其他模块不会强制关闭它；容器折叠不丢结构摘要和错误状态。
4. 深度至少 3 层时仍能使用，不出现每层重复大 padding 导致内容区不可读的问题。
5. 模块选择器只在请求插入时出现，选择后收起；未实现模块不出现。
6. 拖拽、上移/下移和键盘移动得到一致结果；移动不得破坏分支/循环的父子归属。
7. 模拟器/运行检查切换测试值后，当前命中和隐藏状态同步更新；错误、隐藏、未命中使用不同视觉语义。
8. 不改变相同故事的编译 SugarCube、metadata round-trip、地图连线和真实运行结果；相关单测、lint、tsc 通过。
9. 主模型按“普通段落 / 条件展开 / 条件折叠 / 当前隐藏 / 深层嵌套 / 模块选择器 / 运行检查”关键状态亲自截图并逐张验收。

阶段 10A 完成情况（提交 `c72cde1d`，2026-08-20）：

- **同源摘要投影**：十种现有块均从真实块数据派生一行摘要；文本截断、Choice 目标、变量名、Set 表达式、Include 引用、交互动作、Branch/Switch/Loop 子模块计数均不写入第二份状态。
- **普通块独立展开**：普通块默认紧凑，点击摘要行后原位展开，再次点击自身收起；多个普通块可同时展开。实现使用纯视图 `Set<string>`，编辑器继续挂载原专用 Editor，不改块 schema 或编译语义。最初的单一展开规则在用户实测后由 `d48a6fad` 修正。
- **容器独立折叠**：Branch/Switch/Loop 使用独立的纯视图折叠集合，互不影响；折叠后保留结构摘要、条件、动作和错误标签，折叠状态不进入故事 metadata。
- **运行记录联动**：点击真实 SugarCube trace 条目会选中并展开目标普通块，同时自动展开其祖先容器；再次点击仍按原运行抽屉合同取消选中。
- **树形与状态视觉**：嵌套 `BlockList` 增加连续树线和连接线，深层块减少卡片包裹；“未完成”“当前隐藏”“当前未命中”与条件/动作使用不同的文字标签，颜色不是唯一信息来源。
- **验收**：`npm run lint`、`npx tsc --noEmit` 通过；`passage-visual-editor` + 编译/metadata/真实运行检查 4 套共 98 个测试通过。独立展开修正另有测试覆盖默认收起、多模块同时展开、再次点击单独收起及 trace 展开祖先；主模型已在本地 Web 开发版检查普通紧凑态、文本/Choice 展开态和条件/动作摘要。
- **保持不变**：`VisualPassageContentV2`、SugarCube 编译、发布、导入、metadata、地图连线和运行时语义均未修改。

阶段 10 后续切片：

1. **10B**：强化 If/Switch 的分叉视觉语法与“满足/否则”标识；相邻 Choice 只做视觉分组，不增加 `choiceGroup` schema。
2. **10C**：把末尾追加改为任意合法位置 `insertAt(index)`；统一拖拽手柄并保留上移/下移与键盘移动，首版限制在同一 `BlockList` 内。
3. **10D**：补齐引用视图、固定复杂验收段落和阶段 10 全部 7 类截图；复核真实 SugarCube、metadata round-trip 与地图连线不变。

### 阶段 10 之后：新模块候选池（方向记录，未排期、未实现）

> 以下能力来自参考图启发，只记录为后续产品探索方向。它们不属于当前能力、不属于阶段 10 DoD，也不代表已经决定数据模型或 SugarCube 编译方案。任何候选进入实现前，都必须先补齐 WHEN / READS / WRITES / OUTPUT / CODE / REFERENCES 契约、持久化方案、真实运行检查和人工验收场景。

内容与呈现候选：

- **角色对话**：文本块的专用创作形态，可包含说话人、头像、语气/演出提示；不得强迫普通文本进入角色领域模型。
- **显示图片**：图片资源、替代文本、布局与过渡效果；前置条件是资源导入、路径重映射、单文件发布内联和缺失资源检查。
- **播放音频 / 视觉效果**：播放、停止、音量、循环、淡入淡出；必须明确使用 SugarCube 音频能力还是自定义脚本，并验证浏览器自动播放限制。
- **注释 / 作者提示**：默认是编辑器专用 metadata，不输出给玩家；若支持玩家可见提示，应作为另一种有运行语义的模块，不混用。

流程与交互候选：

- **独立跳转 / 文本链接**：区分立即 `goto`、玩家点击链接、back/return 与携带参数；不能与现有 Choice/Include 的语义混写。
- **等待 / 定时**：持续时间、等待期间输出、结束后动作、是否阻塞；需要真实计时、取消、重复进入和执行记录合同。
- **玩家输入**：提示、输入变量、长度/格式校验、提交后动作；必须先补变量类型校验与运行时错误反馈。
- **加权随机 / 随机事件**：分支权重、空分支、随机种子、测试复现和 trace；运行检查必须能固定种子或记录抽样结果。
- **调用子流程 / 事件触发**：目标、参数、返回后动作、作用域和递归边界；在这些合同明确前不建立全局规则表。
- **通用并行执行**：高风险候选。音频、计时器、DOM 更新与状态写入的并发/取消/结束顺序未定义前，不创建仅凭名称工作的“并行”块。

数据与动作模板候选：

- **获得物品 / 状态变化 / 列表操作**优先评估为现有变量与列表动作的预设模板，而不是立即增加背包、物品、任务等领域模型。
- **复杂变量操作**可扩展字符串、列表、随机赋值和类型安全操作，但写入口必须校验目标类型与值来源兼容性；raw/free 保持“未知”而非伪装安全。

候选排序原则：

1. 先完成阶段 10，使现有模块的摘要态/展开态、树线和运行检查稳定。
2. 优先选择不需要新基础设施且能复用现有 SugarCube 语义的候选。
3. 涉及资源的模块先做统一资源管理和发布打包；涉及异步的模块先做计时/取消/trace 合同；涉及跨 Passage 调用的模块先做参数和作用域合同。
4. 每次只选择一个可独立验收的纵向切片，不按参考图一次性补齐全部模块。

### 阶段 6–9：SugarCube 全能力可视化（路线草案，阶段 6–9 全部完成）

> 方向决策（用户拍板）：目标是"全部做成我们的可视化适配"，让作者始终待在可视化里。**运行时唯一真相仍是 SugarCube**——可视化只是生成器/投影，永不反向解析（延续既有原则）。四条定调见下。

能力覆盖（按**语义家族归并**成少量可组合原语，而非一个宏一个节点）：

| 家族 | SugarCube 代表 | 视觉对应物 | 优先级 |
| --- | --- | --- | --- |
| 流程控制 | `<<if/elseif/else>>` `<<switch>>` `<<for>>` `<<silently>>` | 分支块（阶段5）／switch 块／循环块／静默块 | 容器型，逐批加 |
| 内容输出 | 文本、`<<print>>`/`<<=>>`、`<<include>>` | 文字块（阶段5）／变量插入块／引用块 | 引用块早做 |
| 链接与交互 | `[[link]]` `<<link>>` `<<replace>>` `<<append>>` `<<remove>>` `<<goto>>/<<back>>` | 选择块（阶段5）／就地改写交互块／跳转块 | 同段多交互关键 |
| 变量操作 | `<<set>>` `<<unset>>` 数学/字符串/数组操作 | 动作（扩展 unset、数组增删、拼接、计数） | 受表达式边界约束 |
| 数据结构 | `$list` `$obj` | 状态类型扩展 list/dict | 地基，早于宏 |
| 复用/自定义 | `<<widget>>` | 暂归「原始宏叶子」 | 后置 |
| 元/特殊能力 | `<<script>>`、特殊段落 | 原始 JS 叶子 + 特殊段落可视化表面 | 部分永远原始 |

四条定调（用户拍板）：
1. **表达式边界**：不做可视化表达式编辑器。常见操作做成**表单化动作**（加减固定量、布尔切换、数组增删、文本拼接、计数）；罕见复杂逻辑用**「表达式/原始宏」叶子**（verbatim SugarCube，原样透传，可被条件包裹与排序，但内容不结构化）。
2. **阶段 6 先做 `list`**：`VisualStoryState.type` 扩展 `list` + 配套增/删/查长/清空/包含动作，优先于引用块——它是 for 循环、背包、计数器的共同前提。
3. **widget → 组件**：暂不单列，先归「原始宏叶子」，以后再说。
4. **特殊段落做专门可视化表面**：StoryInit / StoryCaption / PassageHeader / PassageFooter 等默认运行的东西要有可见的可视化面。原则（用户原话）：**"一眼就能判断和预测运行后会怎样，这种藏起来的默认运行的东西越少越好"**。注：阶段 5 的故事状态面板天然就是 StoryInit 的可视化表面——全局状态与默认值应编译进 StoryInit（或等价集中点），而非像现在注入"某个段落"，这同时根治 init 块被剥的 bug。

分阶段路线：
- **阶段 5（已定）**：浅树 + 分支 + 人话条件 + 模拟器 + 状态面板 + 修 bug + 单向切源码。
- **阶段 6（已完成）**：状态类型扩展 `list` + 数组动作（push/remove/clear + includes/notIncludes）；加「变量插入块」「引用块」。提交 `75c8eae8`。
- **阶段 7（已完成）**：交互块家族（就地 reveal/append/remove + choice 的 back/return）。提交 `b03d7c66`。
- **阶段 8（已完成）**：流程容器（loop 循环块、switch 多路分支块）+ raw 原始宏叶子（表达式边界定案落地）。提交 `0ea5e5df`。
- **阶段 9（已完成）**：特殊段落可视化表面（StoryInit 等，含徽标/注释/创建菜单；初始化搬进 StoryInit）。可复用组件仍归原始宏叶子（未单列）。提交 `a9db5bf4`。

每一阶段独立可验收，且不推翻前阶段 schema：块是 tagged union，加种类是加法；改已有种类才升版本。

## 5. 关键文件地图

| 路径 | 作用 |
| --- | --- |
| `src/store/stories/stories.types.ts` | 故事/段落/可视化数据类型 |
| `src/store/stories/defaults.ts` | 故事默认值（含 `visual`） |
| `src/store/stories/action-creators/create-untitled-passage.ts` | 新建段落默认进入图形模式 |
| `src/dialogs/passage-edit/passage-visual-editor.tsx` | 图形编辑器主组件（节点树 blocks + 人话条件/动作 + 模拟器 + 切源码） |
| `src/dialogs/story-states/story-states-manager.tsx` | 故事状态管理（全局状态增删改 + 级联清理重编译） |
| `src/dialogs/story-states/story-states-dialog.tsx` | 故事状态对话框（故事级，工具栏按钮打开） |
| `src/routes/story-edit/toolbar/story-states-button.tsx` | 工具栏「故事状态」入口按钮 |
| `src/dialogs/passage-edit/passage-edit-contents.tsx` | 图形/源码编辑器分流 |
| `src/dialogs/passage-edit/passage-edit-stack.tsx` | 单段落停靠式编辑栈 |
| `src/dialogs/context/action-creators.ts` | 打开段落编辑器的对话框动作 |
| `src/dialogs/context/dialogs.tsx` / `dialogs.css` | 对话框容器与停靠布局 |
| `src/util/visual-passage.ts` | 可视化内容 → SugarCube 编译 |
| `src/util/visual-editor-metadata.ts` | metadata 序列化/解析/恢复 |
| `src/util/publish.ts` | 发布 HTML（嵌入 metadata） |
| `src/util/import.ts` | 导入 HTML（恢复 metadata） |
| `src/util/passage-is-empty.ts` | 段落空判断（按可视化内容） |
| `src/components/passage/passage-card.tsx` | 段落卡片摘要与双击编辑入口 |
| `public/locales/*.json` | 中英文案 |

## 6. 技术栈与命令

- React 16 + TypeScript 4.9 + Vite 5 + Electron 41。
- 测试：Jest + Testing Library；E2E：Playwright。

```bash
npm install              # 安装依赖
npm start                # Web 开发模式
npm run start:electron   # Electron 开发模式
npm run lint             # ESLint 检查 src（.js/.jsx/.ts/.tsx；CSS 已忽略）
npx tsc --noEmit         # TypeScript 检查
npx jest <path> --runInBand  # 运行指定测试
npm run test             # Jest watch 模式
npm run e2e              # Playwright E2E
```

## 7. 验收基线（后续每次改动后执行）

1. `npm run lint` 必须通过。
2. `npx tsc --noEmit` 必须通过。
3. 与本次改动相关的功能测试必须通过（优先运行受影响路径的测试）。
4. 全量测试现状（截至 `88d43ecf`）：
   - **17 个用例失败，4 个套件**：
     - `src/store/stories/reducer/repair/__tests__/repair-story.test.ts`
     - `src/store/persistence/electron-ipc/stories/__tests__/load.test.ts`
     - `src/store/persistence/local-storage/stories/__tests__/load.test.ts`
     - `src/store/stories/reducer/__tests__/create-story.test.ts`
   - 失败原因单一：`storyDefaults()` 新增 `visual` 字段后，旧测试期望未同步。
   - **按本项目原则，通用旧测试失败不阻塞后续开发**；是否修复由用户另行决定。

## 8. 已明确“不做/不需要”的事项

- 不做多故事格式适配（只保证 SugarCube 可用）。
- 不删除、不隐藏其他故事格式。
- 不做防呆、误操作保护、通用边界兼容。
- 不追求官方 Twine 的完整回归测试通过。
- 不把任意 SugarCube 源码自动逆向成图形表单。
- 阶段计划中未实现的可选交互（单击概要、空白收起、面板拖宽、多选批量属性、富文本、复制选择）**当前均不做**，用户明确要求时再排期；单向切换源码已在阶段 5 实现。
- 当前不处理全量测试的 17 个失败；如用户要求修复再处理。

## 9. 协作分工策略（强制）

> 用户与主模型约定的固定工作方式，任何新会话（含空对话）必须遵守：**主模型只做「计划 → 分派 → 验收」，所有重活交给 flash 子代理通过 `workflow` 执行。**

### 分工契约

| 环节 | 负责人 | 方式 |
| --- | --- | --- |
| 计划 / 拆解 / 写 brief | 主模型 | 目标、现状、约束、验收标准(DoD) 写入自包含 brief |
| 重活执行（写码、脚本、批量改动） | flash 子代理 | 主模型用 `workflow` 的 `agent(prompt, {model, provider})` 分派 |
| 验收（构建/测试/diff + 亲自截图 + 视觉） | 主模型 | 跑验证、亲自截图、`view_image` 判断，不合格打回 flash |

### 模型标识（当前 harness 配置，环境变化时以实际为准）

- flash 子代理：`provider: "opencode-go"`，`model: "deepseek-v4-flash"`
- 主模型：`provider: "opencode-go"`，`model: "deepseek-v4-pro"`
- 在 workflow 的 `meta.phases` 或每个 `agent()` 的 opts 里显式固定 flash，不依赖 preset 默认，避免子代理落到其他模型。

### 视觉验收闭环（2026-08 修订：flash 只实现，主模型亲自截图验收）

- flash 只负责**实现改动**（写码、脚本、批量改动）；**不截图、不做视觉判断**。
- 主模型在**验收阶段亲自**：启动应用、用 Playwright 对**少量关键状态（一般 5–8 张）**截图落盘，再用 `view_image` 逐一判断与总结。
- 首次若缺 chromium 二进制，先 `npx playwright install chromium`。

### 三条硬约定

1. **DoD 前置**：每次分派，验收标准必须写入 brief 且可验证（构建/测试/产物路径/截图路径）；验收时真查（跑构建/测试/读 diff），不靠感觉。
2. **升级通道**：架构决策、安全敏感、跨模块集成、flash 连续失败的任务，收回给主模型或升级为 `deepseek-v4-pro`，不硬交给 flash。
3. **审批上浮**：需要用户授权的操作（沙箱提权、安装系统依赖、危险命令等）由主模型显式上报，不得由 flash 子代理静默执行；会话审批被禁用时，相关操作直接失败/跳过，不得绕过。

## 10. 跨会话记忆协议（强制）

本文档是后续所有会话的工作前提。协议如下：

1. **新会话开始**：
   1. `git status --short --branch` 确认工作树与分支状态；
   2. `git log --oneline -5` 确认最新提交；
   3. 完整阅读本文件；
   4. 再开始执行任务。

2. **任何更新完成后**，agent 必须检查并更新本文档至少以下内容：
   - 新增/变更的提交 hash 与说明；
   - 阶段计划的推进或调整；
   - 数据模型、关键文件地图、命令的变化；
   - 验收测试结果（通过/失败及其原因）；
   - “不做/不需要”清单的变化；
   - 任何用户新做出的定位、原则或方向决策。

3. **更新方式**：
   - 随功能提交一起更新本文档；无法归入时单独用 `docs:` 提交。
   - 不得只改代码不更新文档。
   - 更新后文档内容必须与 `git log`、工作树、实际代码行为一致。

4. **会话结束前**：确认工作树状态和本文档都反映了最新事实；如不一致，先补文档再结束。

## 11. 新会话快速检查清单

- [ ] `git status --short --branch`
- [ ] `git log --oneline -5`
- [ ] 已完整阅读 `PROJECT_CONTEXT.md`
- [ ] 已确认协作分工策略：主模型计划/分派/验收，重活交 flash 经 workflow 执行
- [ ] 明确本次任务属于哪个阶段或是否为新增需求
- [ ] 完成后已更新本文件并提交
