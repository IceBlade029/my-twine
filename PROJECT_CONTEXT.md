# PROJECT_CONTEXT — 项目认知、阶段计划与跨会话记忆

> **本文档是本仓库唯一的跨会话记忆源。**
>
> - 任何新会话、空对话在开始工作前，必须先阅读本文件，再结合 `git log` 与工作树状态同步认知。
> - 任何 agent 完成任何代码、配置、功能或决策更新后，**必须同步更新本文档**，使文档始终反映仓库最新状态。
> - 更新后随改动一起提交；无法归入同一提交时，单独用 `docs:` 提交。
> - 每次会话结束前，必须检查 `git status` 与本文档是否一致。
>
> 最后更新：回填阶段 3/4 计划、建立跨会话记忆协议。读取时请以 `git log` 显示的实际 HEAD 为准。

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

## 9. 跨会话记忆协议（强制）

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

## 10. 新会话快速检查清单

- [ ] `git status --short --branch`
- [ ] `git log --oneline -5`
- [ ] 已完整阅读 `PROJECT_CONTEXT.md`
- [ ] 明确本次任务属于哪个阶段或是否为新增需求
- [ ] 完成后已更新本文件并提交
