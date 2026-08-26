# SDD-Workflow 总览

## 1. Plugin 与 Skill 的配合关系

| 组件 | 定位 | 提供物 |
|------|------|--------|
| **sdd-workflow-plugin** (TS 插件) | **强制约束 + 状态机** | Phase Gate 中间件、工具阻塞、Context 监控、Loop 检测、Rollback、状态持久化、11 个 Tool 命令 |
| **sdd-workflow skill** (文档型技能) | **执行引导 + 模板** | phases-reference.md、design-doc-template.md、interface-example.md（8 维）、dependency-example.md（5 维）、visualization-guide.md |

**协同链路**：Plugin 注入 Phase Prompt + 阻塞违规工具 → AI 读 Skill 文档获取模板 → `sdd_dispatch_skill` 按配置返回主技能/附加技能（不硬编码）→ AI 调用 Skill 执行任务 → `sdd_gate` 检查 → 用户确认 → Plugin 过渡下一阶段。

**Skill 调度规则**（`.sdd/workflow_config.json`）：`skills` 字段**完全替换**默认主技能；`additional_skills` 始终在 primary 之后追加调用；未配置则用 `default_primary_skills`。

---

## 2. 工作流原理

7 阶段线性状态机（Phase 0→6），每次切换必须满足 **Gate 检查 + 人工确认**，否则 Plugin 阻塞工具。

```
Phase Prompt 注入 → Skill 调度 → 执行任务 → 产物落地 → Gate check → 人工 approve → 过渡
```

**工具阻塞矩阵**：

| Phase | 阻塞 | 允许 |
|---|---|---|
| 0 | edit, bash | read, glob, grep, write |
| 1 | bash | read, glob, grep, edit, write |
| 2–6 | 无 | 全部（Phase 3 另加 Context 监控：50 edit 自动 refresh、单文件 20+ edit 触发 loop 检测） |

---

## 3. 支持的功能

- **Phase Gate**：阻塞跳阶段、阻塞违规工具、按 Phase 校验产物
- **State Persistence**：`.sdd/state.json` + `checkpoint.json`（每次 Gate 批准记录 git HEAD SHA）
- **Resume**：会话崩溃后从 checkpoint 恢复，重新注入 Phase Prompt
- **Context Refresh**：手动 `sdd_refresh` 或自动（每 50 edit）注入关键需求/设计/热点文件
- **Rollback**：`code_scope` = `none`（仅 SDD state+docs） / `related`（推荐，自动回退 task_plan 关联代码，其他提示用户） / `all`（全量）；基于 git SHA 执行 `git checkout`
- **Memory 3 层渐进披露**：timeline（节点上下文）/ details（完整决策）/ refresh（热点注入）
- **Skill 调度**：配置驱动，支持多 primary + 多 additional
- **Constitution 合规**：`CONSTITUTION/*.md` 规则在 Phase 1/2/3/5 自动校验

---

## 4. 人工参与环节

| 时机 | 动作 |
|------|------|
| **Phase 0** | 回答 AI 的需求澄清提问（Feature Overview / Requirement Specs / Performance / Core Modules）——不可假设，必须问 |
| **每次 Gate 切换** | 审查阶段产物 → `sdd_gate phase=N action=approve confirmed=true` 显式批准，未确认则 Plugin 阻塞 |
| **Phase 4 覆盖率补缺** | AI 识别 REQ-ID Scenario Matrix 缺口后询问是否补写测试 |
| **Rollback 其他代码** | `code_scope=related` 时，非 task_plan 列出的代码变更由用户决定逐个/全量/保留 |
| **Phase 1 设计澄清** | 主技能（如 brainstorming / requirement-web-kernel-clarifier）与用户的交互 |

---

## 5. 各阶段输入 / 输出

| Phase | 输入 | 主产物（输出） | Gate 通过条件 |
|---|---|---|---|
| **0 需求澄清** | 用户功能描述 + 主技能澄清 | `docs/features/<f>/findings.md`（Phase 0 段：Feature Overview / Requirement Specs (REQ-ID) / Performance / Core Modules） | 4 段齐全、无占位文本、需求来自用户而非假设 |
| **1 设计** | findings.md + design-doc-template / interface / dependency 模板 + 知识库（Knowledge Base First：先查 KB 再 grep 源码） | `docs/features/<f>/design.md`（Part 1 总体架构 · Part 2 数据流 PlantUML · Part 3 模块分解含 8 维接口+5 维依赖 · Part 4 集成验证）；同步更新 findings.md | design.md 生成 + Constitution 合规；高复杂度特性需完成模块分解与 8/5 维分析 |
| **2 实现规划** | design.md | `docs/features/<f>/task_plan.md`（任务分解 input/output/estimate、文件修改范围、verification 命令、测试策略） | 计划含 file changes/test/verification + 用户批准 |
| **3 模块开发** | task_plan.md | 源代码 + 单元测试变更；更新 task_plan.md 任务状态 | 所有任务完成 + 单测过 + 编译过 + lint/typecheck 过 |
| **4 集成测试** | 代码 + design.md 的 REQ-ID 映射 | 测试结果证据（integration/E2E/性能命令输出）；REQ-ID Scenario Matrix 覆盖率表；增量补的单测；写入 findings.md Phase 4 段 | 集成+E2E 过（带命令输出证据）+ REQ 覆盖率≥80% + 覆盖率矩阵完成 + verification-before-completion Skill 已调用 |
| **5 质量审查** | 代码 + 测试结果 | `docs/features/<f>/reviews/architecture_review.md` + `code_quality_review.md`（架构合规 / REQ→实现追溯 / 质量指标 / 测试覆盖率） | 4 类产物齐全 + requesting-code-review Skill 已调用 |
| **6 记忆持久化** | 全部前序产物 | `docs/features/<f>/COMPLETED` 标记；finalize findings.md / task_plan.md / design.md；聚合 `PROJECT_STATE.md`；更新 `AGENTS.md` | 所有 memory artifacts 存在 + PROJECT_STATE.md + AGENTS.md 已更新 |

---

## 6. 项目初始化产物（`sdd_init`）

```
.sdd/{state,project,workflow_config,checkpoint}.json
CONSTITUTION/{core,design-rules,implementation-rules,review-rules,workflow-rules}.md
docs/{features,knowledge,modules,collaboration}/
PROJECT_STATE.md
AGENTS.md
```

## 7. 默认 Skill 映射

| Phase | Default Skill |
|---|---|
| 0 | comprehensive-research-agent |
| 1 | brainstorming |
| 2 | writing-plans |
| 3 | subagent-driven-development |
| 4 | verification-before-completion |
| 5 | requesting-code-review |
| 6 | memory-systems |
