# PROJECT_CONTEXT — 项目认知与工作约定

> 本文档是当前仓库的“固化认知”。后续任何新会话、空对话在开始工作前，**先完整阅读本文件**，再结合 `git log` 与工作树状态同步认知。
>
> 本文件固化于 `88d43ecf`（package-lock 版本同步提交）之后；读取时请以 `git log` 显示的实际 HEAD 为准。

---

## 1. 项目定位

- 本仓库是基于 **Twine 2.12.0 源码**（`twinejs`）的个人定制项目。
- **目的不是维护通用 Twine**，而是以 Twine 为底子，**彻底改造交互方式**，并按个人需求随时增加新功能。
- 只服务于仓库所有者一个人。所有产品、技术、验收判断都以“个人好用”为准。

## 2. 不可妥协的原则

1. **只适配 SugarCube**：编辑器生成、编译、持久化逻辑只针对 SugarCube；不需要兼容其他故事格式。
2. **其他故事格式原样保留**：Harlowe / Snowman / Chapbook 等不删除、不隐藏、不做适配。用户自己不会去点，不必处理。
3. **不需要防呆设计**：单人使用场景下，不为误操作、异常输入、极端边界做防御性设计；除非直接影响用户自己的正常使用流程，否则不主动加保护。
4. **不追求官方/通用兼容性**：不把上游 Twine 的兼容要求、公共用户场景、全套旧测试作为验收标准。
5. **开发主线是 `narrative-editor` 分支**：后续工作继续在该分支上提交推进。

## 3. Git 历史与当前状态

### 关键提交

| 提交 | 说明 |
| --- | --- |
| `e36c6009` | 上游原版提交（改造前最后的上游状态） |
| `32dfcc58` | **基线空提交**：`chore: establish upstream Twine baseline`，有意创建的改造分界标记 |
| `4729fac7` | **阶段 1 + 阶段 2 的功能提交**：`feat: add visual passage editor and metadata` |
| `88d43ecf` | `chore: sync package-lock version to 2.12.0`（保留并提交 package-lock 版本号同步） |

### 约定

- 开发分支：`narrative-editor`。
- 官方历史与 `origin/develop` 不主动修改。
- 本地 git 身份已配置为与功能提交一致：`IceBlade029 <707578197@qq.com>`。
- 是否推送 `origin/narrative-editor` 由用户决定，未经要求不主动 push。

## 4. 已完成的改造内容（提交 `4729fac7`）

用户确认阶段 1、阶段 2 均已完成，其代码产出全部在 `4729fac7` 中。主要分为两大块：

### 4.1 可视化段落编辑器（阶段 1 的主要产出）

#### 数据模型（`src/store/stories/stories.types.ts`）

- `Passage.visual?: VisualPassageContentV1`：段落的可视化结构化内容。
- `VisualPassageContentV1`：`{body, bodyCondition?, choices, version: 1}`。
- `VisualPassageChoice`：`{id, label, targetPassageId, condition?, actions}`。
- `VisualStoryState`：故事级状态变量，类型为 `boolean | number | text`。
- `VisualCondition`：`equals | notEquals | greaterThan | lessThan`。
- `VisualStateAction`：`set | increase | decrease`。
- `Story.visual?: VisualStoryContentV1`：故事级状态列表。

#### 默认行为

- `storyDefaults()` 给新故事添加 `visual: {states: [], version: 1}`。
- `createUntitledPassage` 给所有新建段落添加空 `visual`，即**新段落默认进入可视化编辑模式**。
- 默认故事格式从 `Harlowe 3.3.9` 改为 `SugarCube 2.37.3`。

#### 编辑器 UI

- 核心组件：`src/dialogs/passage-edit/passage-visual-editor.tsx`。
- `src/dialogs/passage-edit/passage-edit-contents.tsx` 通过 `passageUsesVisualEditor(passage)` 分流：
  - 有 `visual.version === 1` → 可视化编辑器；
  - 否则 → 原有 CodeMirror 源码编辑器。
- 可视化编辑器支持：
  - 故事状态变量管理（增删、命名、类型、默认值）；
  - 段落正文编辑（blur 提交）；
  - 选项编辑（文字、目标段落、显示条件、选择后动作）；
  - 查看/隐藏生成的 SugarCube 源码。

#### 编辑栈形态改造

- `addPassageEditors` 从“最多 6 个段落卡片堆叠”简化为**每次只编辑 1 个段落**。
- `PassageEditStack` 改为单个 `DialogCard`。
- 编辑器变为**右侧停靠面板**（约 `min(34rem, 42vw)`），使用 CSS `:has()` 让主画布让位。
- `Dialogs` 通过 `component.displayName === 'PassageEditStack'` 识别段落编辑器状态。

#### SugarCube 编译层（`src/util/visual-passage.ts`）

- `compileVisualPassage(content, story)` 将结构化内容编译为 SugarCube 源码：
  - 正文；
  - `[[label->passage]]` 链接及 `[动作]` setter；
  - `<<if>>` 条件；
  - 状态变量初始化（变量名 `$nrp_<id 清洗值>`，仅在首个可视化段落注入）。
- `passageUsesVisualEditor()`、`emptyVisualPassage()` 等工具函数。
- `passageIsEmpty()` 改为基于 `visual.body` / `visual.choices` 判断。
- 段落卡片摘要优先显示 `visual.body`。

### 4.2 可视化数据持久化（阶段 2 的主要产出）

`src/util/visual-editor-metadata.ts` 实现发布/导入时的结构化数据往返：

- **发布**（`src/util/publish.ts`）：在 `<tw-storydata>` 中嵌入：
  ```html
  <script type="application/json" data-narrative-editor>...</script>
  ```
- **导入**（`src/util/import.ts`）：解析该 metadata，恢复各段落的 `visual` 结构；目标段落 ID 通过段落名重新映射。
- **外部修改保护**：如果段落生成文本与 metadata 中的 `generatedText` 不一致（例如被外部工具或源码编辑过），该段落回退为源码模式，不恢复 `visual`。
- **版本校验**：仅恢复 `version === 1` 的 metadata。

### 4.3 其他配套改动

- `src/index.tsx`：改为 `i18nReady.then(...)` 后再渲染 React，避免翻译资源未加载完成。
- `src/components/control/card-button.tsx`：为 `react-transition-group` 补充 `nodeRef`。
- `public/locales/en-US.json` 与 `public/locales/zh-CN.json`：补齐可视化编辑器文案。
- 新增测试：
  - `src/util/__tests__/visual-passage.test.ts`
  - `src/util/__tests__/visual-editor-metadata.test.ts`
  - `src/util/__tests__/passage-is-empty.test.ts`
  - `src/dialogs/passage-edit/__tests__/passage-visual-editor.test.tsx`

## 5. 关键文件地图

| 路径 | 作用 |
| --- | --- |
| `src/store/stories/stories.types.ts` | 故事/段落/可视化数据类型 |
| `src/store/stories/defaults.ts` | 故事默认值（含 `visual`） |
| `src/store/stories/action-creators/create-untitled-passage.ts` | 新建段落默认进入可视化模式 |
| `src/dialogs/passage-edit/passage-visual-editor.tsx` | 可视化编辑器主组件 |
| `src/dialogs/passage-edit/passage-edit-contents.tsx` | 可视化/源码编辑器分流 |
| `src/dialogs/passage-edit/passage-edit-stack.tsx` | 单段落停靠式编辑栈 |
| `src/dialogs/context/action-creators.ts` | 打开段落编辑器的对话框动作 |
| `src/dialogs/context/dialogs.tsx` / `dialogs.css` | 对话框容器与停靠布局 |
| `src/util/visual-passage.ts` | 可视化内容 → SugarCube 编译 |
| `src/util/visual-editor-metadata.ts` | metadata 序列化/解析/恢复 |
| `src/util/publish.ts` | 发布 HTML（嵌入 metadata） |
| `src/util/import.ts` | 导入 HTML（恢复 metadata） |
| `src/util/passage-is-empty.ts` | 段落空判断（按可视化内容） |
| `src/components/passage/passage-card.tsx` | 段落卡片摘要 |
| `public/locales/*.json` | 中英文案 |

## 6. 技术栈与命令

- React 16 + TypeScript 4.9 + Vite 5 + Electron 41。
- 测试：Jest + Testing Library；E2E：Playwright。
- 常用命令：

```bash
npm install          # 安装依赖
npm start            # Web 开发模式
npm run start:electron  # Electron 开发模式
npm run lint         # ESLint 检查 src
npx tsc --noEmit     # TypeScript 检查
npx jest <path> --runInBand   # 运行指定测试
npm run test         # Jest watch 模式
npm run e2e          # Playwright E2E
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
- 当前**没有**“可视化/源码手动切换入口”的需求；如用户提出再实现。
- 当前不处理全量测试的 17 个失败；如用户要求修复再处理。

## 9. 新会话标准开局流程

1. `git status --short --branch` 确认工作树与分支状态。
2. `git log --oneline -5` 确认最新提交。
3. 阅读本文件（`PROJECT_CONTEXT.md`）。
4. 按本文档的定位、原则和验收基线执行用户任务。
