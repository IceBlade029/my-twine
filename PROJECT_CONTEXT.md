# PROJECT_CONTEXT — 项目认知、阶段计划与跨会话记忆

> **本文档是本仓库唯一的跨会话记忆源。**
>
> - 任何新会话、空对话在开始工作前，必须先阅读本文件，再结合 `git log` 与工作树状态同步认知。
> - 任何 agent 完成任何代码、配置、功能或决策更新后，**必须同步更新本文档**，使文档始终反映仓库最新状态。
> - 更新后随改动一起提交；无法归入同一提交时，单独用 `docs:` 提交。
> - 每次会话结束前，必须检查 `git status` 与本文档是否一致。
>
> 最后更新：新增「阶段 5：可视化编辑器重构」计划（节点树 + 人话条件 + 模拟器），并修订视觉验收流程（flash 只截图、主模型一次验收、不做全量截图）。读取时请以 `git log` 显示的实际 HEAD 为准。

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

### 阶段 5：可视化编辑器重构（计划中，未开始）

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

未决事项（待用户确认后再做）：是否加「切换回 SugarCube 源码」入口；模拟器与「Play 试玩」的关系；块排序交互（拖拽 vs 上/下移按钮）。

## 5. 关键文件地图

| 路径 | 作用 |
| --- | --- |
| `src/store/stories/stories.types.ts` | 故事/段落/可视化数据类型 |
| `src/store/stories/defaults.ts` | 故事默认值（含 `visual`） |
| `src/store/stories/action-creators/create-untitled-passage.ts` | 新建段落默认进入图形模式 |
| `src/dialogs/passage-edit/passage-visual-editor.tsx` | 图形编辑器主组件（正文/选择/状态/条件/动作） |
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
npm run lint             # ESLint 检查 src
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
- 阶段计划中未实现的可选交互（单击概要、空白收起、面板拖宽、多选批量属性、富文本、复制选择、源码切换按钮）**当前均不做**，用户明确要求时再排期。
- 当前不处理全量测试的 17 个失败；如用户要求修复再处理。

## 9. 协作分工策略（强制）

> 用户与主模型约定的固定工作方式，任何新会话（含空对话）必须遵守：**主模型只做「计划 → 分派 → 验收」，所有重活交给 flash 子代理通过 `workflow` 执行。**

### 分工契约

| 环节 | 负责人 | 方式 |
| --- | --- | --- |
| 计划 / 拆解 / 写 brief | 主模型 | 目标、现状、约束、验收标准(DoD) 写入自包含 brief |
| 重活执行（写码、脚本、批量改动、构建、测试、截图） | flash 子代理 | 主模型用 `workflow` 的 `agent(prompt, {model, provider})` 分派 |
| 验收（构建/测试/diff + 视觉） | 主模型 | 跑验证 + `view_image` 看截图，不合格打回 flash |

### 模型标识（当前 harness 配置，环境变化时以实际为准）

- flash 子代理：`provider: "deepseek-official"`，`model: "deepseek-v4-flash"`
- 主模型：`provider: "deepseek-official"`，`model: "deepseek-v4-pro"`
- 在 workflow 的 `meta.phases` 或每个 `agent()` 的 opts 里显式固定 flash，不依赖 preset 默认，避免子代理落到其他模型。

### 视觉验收闭环（2026-08 修订：截图与验收彻底分工，不做全量截图）

- flash 只负责**截图**：按主模型在 brief 里点名的**少量关键状态（一般 5–8 张）**用 Playwright 截图落盘，返回 `{label, path}` 清单；**不做任何"好不好用"的判断**，也不做全量遍历截图（太慢）。
- 主模型负责**视觉验收（仅一次）**：用 `view_image` 看 flash 交回的截图做判断与总结；不再由 flash 先解读一遍、主模型又复读一遍。
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
