# AcademyGallery — CLAUDE.md

> 面向论文模块化学习的知识库工具。用户上传学术论文（PDF），系统自动提取各类内容模块（系统架构图、摘要、实验结果图等），并提供 AI 分析、集中展示与专题学习功能。

---

## 1. 项目目标与分期规划

### Phase 1（当前）
- PDF 上传与图片提取
- 系统架构图（`arch_figure`）的识别、提取与 VLM 分析
- Gallery 主页三视图（Library / Topic study / Browse by module）
- 论文详情页（Full analysis）

### Phase 2
- Abstract 模块：提取摘要文本，结构化分析
- Series 学习流：按模块顺序串联同一篇论文的多个模块

### Phase 3+
- Eval figures 模块：实验结果图提取与分析
- Algorithm 模块：伪代码块提取
- 跨论文语义检索（基于 embedding）
- 跨论文横向对比视图

---

## 2. 技术栈

| 层次 | 选型 |
|------|------|
| 后端 | Python · FastAPI |
| PDF 解析 | PyMuPDF (`fitz`) |
| VLM 分析 | Anthropic Claude API（Vision） |
| 数据库 | SQLite（早期） → PostgreSQL（扩展后） |
| 向量检索 | ChromaDB 或 Qdrant |
| 前端 | Next.js · Tailwind CSS |
| 文件存储 | 本地文件系统（`/data/figures/`） |

---

## 3. 数据模型

### 3.1 核心实体

```
Paper
├── id               UUID, PK
├── title            str
├── venue            str          # OSDI / ATC / EuroSys / SoCC …
├── year             int
├── authors          str
├── doi              str, nullable
├── pdf_path         str          # 本地路径
├── processing_status enum        # pending | processing | done | failed
└── uploaded_at      datetime

ContentItem          ← 所有模块的抽象基表，不拆分
├── id               UUID, PK
├── paper_id         UUID, FK → Paper
├── module_type      enum         # arch_figure | abstract | eval_figure | algorithm
├── image_path       str, nullable  # 图片类模块的存储路径
├── page_number      int, nullable
├── caption          str, nullable  # 图注原文
├── analysis_json    TEXT (JSON)  # 随 module_type 变化，见 §3.2
├── embedding_vector BLOB, nullable  # 统一向量化，支持跨模块语义检索
├── created_at       datetime
└── processing_status enum        # pending | done | failed

UserAnnotation
├── id               UUID, PK
├── item_id          UUID, FK → ContentItem
├── note_text        str
├── tags             str (JSON array)
└── created_at       datetime

Topic                ← 专题学习单元
├── id               UUID, PK
├── name             str
├── description      str, nullable
└── created_at       datetime

TopicPaper           ← 专题与论文的关联（多对多）
├── topic_id         UUID, FK → Topic
├── paper_id         UUID, FK → Paper
├── order            int          # 专题内阅读顺序
└── progress_json    TEXT (JSON)  # { "abstract": true, "arch_figure": true, "eval_figure": false }
```

### 3.2 analysis_json Schema（按 module_type）

**`arch_figure`（Phase 1）**
```json
{
  "components": [
    { "name": "Borgmaster", "role": "Centralized controller, replicates state via Paxos" }
  ],
  "dataflow": [
    "Client submits job → Borgmaster → Scheduler → Borglet"
  ],
  "core_problem": "Efficiently schedule heterogeneous workloads across 10k+ machines",
  "design_insight": "Two-class job priority enables resource overcommitment without SLO violation",
  "tradeoffs": ["Centralized master simplifies consistency but limits horizontal scale"],
  "related_systems": ["Mesos", "YARN", "Kubernetes"]
}
```

**`abstract`（Phase 2）**
```json
{
  "problem_statement": "...",
  "proposed_approach": "...",
  "key_contributions": ["...", "..."],
  "evaluation_summary": "...",
  "keywords": ["serverless", "cold start", "isolation"],
  "novelty_claim": "..."
}
```

**`eval_figure`（Phase 3）**
```json
{
  "figure_type": "bar | line | heatmap | table",
  "metrics": ["latency (p99)", "throughput (req/s)"],
  "baselines": ["OpenWhisk", "Knative"],
  "headline_result": "2.8× lower cold-start latency vs baseline",
  "workload_desc": "Mixed serverless workload, 100–10000 RPS",
  "caveats": ["Single-region experiment", "Synthetic trace"]
}
```

---

## 4. 后端架构

### 4.1 目录结构

```
backend/
├── main.py
├── models/
│   ├── paper.py
│   ├── content_item.py
│   ├── topic.py
│   └── annotation.py
├── routers/
│   ├── papers.py
│   ├── content.py
│   └── topics.py
├── services/
│   ├── pdf_extractor.py     # PDF 解析与图片提取
│   ├── figure_classifier.py # 图片分类（arch / eval / other）
│   ├── vlm_analyzer.py      # VLM 分析，管理 prompt template
│   ├── embedder.py          # 向量化 analysis_json
│   └── module_registry.py   # 插件式模块注册表
└── prompts/
    ├── arch_figure.txt
    ├── abstract.txt
    └── eval_figure.txt
```

### 4.2 处理流水线

```
PDF 上传
  └─► PyMuPDF 提取所有图片 + caption
        └─► VLM 图片分类（arch_figure / eval_figure / other）
              └─► 半自动确认（Phase 1 可人工标记）
                    └─► module_registry[module_type].analyze(image)
                          └─► 写入 ContentItem.analysis_json
                                └─► embedder.embed(analysis_json) → embedding_vector
```

**插件式 Extractor 接口**（新增模块只需实现此接口）：
```python
class BaseExtractor:
    module_type: str

    def extract(self, pdf_path: str) -> list[ExtractedItem]:
        """从 PDF 中定位并提取原始内容"""
        ...

    def analyze(self, item: ExtractedItem) -> dict:
        """调用 VLM，返回符合该模块 schema 的 analysis_json"""
        ...
```

### 4.3 VLM Prompt 设计原则

- 输出格式固定为 JSON，系统提示中明确禁止 markdown 包裹
- 按 module_type 维护独立 prompt 文件（`prompts/arch_figure.txt`）
- Prompt 结构：`[角色设定] + [图片输入] + [输出 schema] + [示例]`

**arch_figure prompt 核心片段**：
```
You are analyzing a system architecture figure from an academic systems paper.
Output ONLY valid JSON matching this schema exactly. No markdown, no preamble.

Schema:
{
  "components": [{"name": str, "role": str}],
  "dataflow": [str],
  "core_problem": str,
  "design_insight": str,
  "tradeoffs": [str],
  "related_systems": [str]
}
```

### 4.4 API 路由

```
POST   /papers                    上传 PDF，创建 Paper，触发异步处理
GET    /papers                    列出所有论文（含处理状态）
GET    /papers/{id}               论文详情 + 所有 ContentItem
GET    /papers/{id}/full          全文分析视图数据

GET    /content                   列出 ContentItem，支持 ?module_type=arch_figure&venue=ATC
GET    /content/{id}              单个 ContentItem 详情 + analysis_json

GET    /topics                    专题列表
POST   /topics                    创建专题
POST   /topics/{id}/papers        向专题添加论文
PATCH  /topics/{id}/papers/{pid}  更新论文在专题中的学习进度

POST   /content/{id}/annotations  添加用户标注
GET    /search?q=&module_type=    语义检索（基于 embedding）
```

---

## 5. 前端架构

### 5.1 目录结构

```
frontend/
├── app/
│   ├── page.tsx                  # 主页（Gallery）
│   ├── papers/[id]/page.tsx      # 论文全文分析页
│   └── topics/[id]/page.tsx      # 专题学习页
├── components/
│   ├── layout/
│   │   ├── NavTabs.tsx           # Library / Topic study / Browse by module
│   │   └── SearchBar.tsx
│   ├── library/
│   │   ├── PaperCard.tsx         # 论文卡片（含模块 chip）
│   │   └── ModuleChip.tsx        # done / partial / pending 状态
│   ├── topic/
│   │   ├── TopicCard.tsx         # 专题卡片（含进度条）
│   │   ├── StudyFocusSelector.tsx # All / Abstract only / Arch only …
│   │   └── PaperProgressRow.tsx
│   ├── browse/
│   │   ├── FigureGrid.tsx        # 模块内容卡片网格
│   │   └── FigureCard.tsx
│   ├── detail/
│   │   ├── FullAnalysisPage.tsx  # 论文详情页容器
│   │   ├── ModuleAnalysisPanel.tsx  # switch(module_type) 渲染不同字段
│   │   ├── ArchFigurePanel.tsx
│   │   ├── AbstractPanel.tsx
│   │   └── EvalFigurePanel.tsx
│   └── shared/
│       ├── ProgressBar.tsx
│       └── StatusBadge.tsx
└── lib/
    ├── api.ts                    # fetch 封装
    └── types.ts                  # Paper / ContentItem / Topic 类型定义
```

### 5.2 主页三视图

主页由顶部一级导航 tab 控制三个独立视图，tab 持久化到 URL query（`?view=library`）：

#### Library（默认视图）
- 以论文为单位展示卡片列表
- 每张卡片右侧显示架构图缩略图（`image_path` 的 thumbnail）
- 模块 chip 颜色语义：绿色=已完成 / 橙色=部分完成 / 灰色=未开启
- 支持按 venue、year 筛选；顶部搜索框全文检索 title + analysis_json

#### Topic study（专题学习视图）
- 卡片网格，每张卡片代表一个专题
- 卡片内：专题名、论文数、各论文进度列表、总进度条、状态标签（Not started / In progress / Completed）
- **Study focus 选择器**（位于视图顶部）：
  - `All modules`：专题内按论文展示所有模块
  - `Abstract only`：只展示每篇论文的摘要分析
  - `Arch figures only`：只展示架构图
  - `Eval figures only`：只展示实验结果图
- 选择器状态持久化到 localStorage，切换专题时保留

#### Browse by module（模块浏览视图）
- 顶部模块类型切换（Arch figures / Abstract / Eval figures / Algorithm）
- 下方图片/文本网格，点击进入单个 ContentItem 详情
- 支持按 venue、topic、tag 筛选

### 5.3 论文详情页（Full analysis）

路由：`/papers/[id]`

布局：顶部论文元信息 → 垂直堆叠各模块分析面板，顺序为 Abstract → Arch figure → Eval figures → Algorithm

`ModuleAnalysisPanel` 根据 `module_type` 渲染不同内容：

```tsx
switch (item.module_type) {
  case 'arch_figure':  return <ArchFigurePanel item={item} />
  case 'abstract':     return <AbstractPanel item={item} />
  case 'eval_figure':  return <EvalFigurePanel item={item} />
}
```

**ArchFigurePanel 布局**：左侧原图（可放大）/ 右侧分析，下方 tabs：Design decisions / Comparison / Related papers / My notes

### 5.4 专题学习页

路由：`/topics/[id]`

- 顶部：专题名 + Study focus 选择器
- 论文列表按 `TopicPaper.order` 排序
- 每篇论文展开后显示对应 focus 的 ContentItem
- 进度标记：用户阅读完某模块后手动勾选，写回 `TopicPaper.progress_json`

---

## 6. 扩展性约定

新增模块时需要且只需要：

1. 在 `module_type` enum 中添加新值
2. 在 `prompts/` 下新建对应 prompt 文件
3. 实现 `BaseExtractor` 子类，注册到 `module_registry`
4. 新建对应的前端 Panel 组件（如 `AlgorithmPanel.tsx`），在 `ModuleAnalysisPanel` 的 switch 中添加一个 case

不需要改动：数据库表结构、API 路由逻辑、Gallery 主页框架、Topic study 进度逻辑。

---

## 7. Phase 1 实施优先级

```
Week 1
  ├── 数据库建表（Paper + ContentItem）
  ├── PDF 上传接口 + PyMuPDF 图片提取
  └── 前端：PDF 上传 UI + 处理状态轮询

Week 2
  ├── VLM 分类（arch_figure vs other）+ 人工确认页面
  ├── arch_figure VLM 分析 + analysis_json 写入
  └── 前端：Library 视图 + PaperCard

Week 3
  ├── 论文详情页 + ArchFigurePanel
  ├── Browse by module 视图（arch_figure）
  └── Topic 创建 + TopicCard（进度暂为手动）

Week 4
  ├── Embedding + 基础语义检索
  ├── UserAnnotation（My notes）
  └── Study focus 选择器联动
```

---

## 8. 关键设计决策备忘

| 决策 | 选择 | 理由 |
|------|------|------|
| 图片分类策略 | Phase 1 人工确认，Phase 2 VLM 自动 | 避免早期分类错误污染数据 |
| 存储结构 | ContentItem 单表，不按模块拆表 | 新增模块零迁移成本 |
| Embedding 时机 | 写入 analysis_json 后异步执行 | 不阻塞主流程 |
| Series 学习顺序 | Abstract → Arch figure → Eval figures | 符合论文阅读自然顺序 |
| Study focus 粒度 | 专题级别，不是全局 | 不同专题可能需要不同学习方式 |
| 前端路由 | `/papers/[id]` 全文分析，`/topics/[id]` 专题学习 | 两种访问路径语义清晰 |
