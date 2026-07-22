---
name: xuan-feature-map
description: Create or refine a Feature Map from vague product ideas, meeting notes, interviews, research, issue lists, or existing requirements. Use when the user needs a Markdown map from user pains to feature modules to a prioritized feature list before any information architecture or layout work.
---

# Xuan Feature Map

Create `.xuan/feature-map.md` in the active project. This artifact is a **Feature Map**, never a Feature Spec, PRD, sitemap, wireframe, or implementation plan.

## Workflow

1. Read all user-provided source material and relevant repository context.
2. Extract user pains. Distinguish evidence from inference; label unsupported but useful assumptions.
3. Group pains into capability-oriented feature modules. Do not group by screen position or UI component.
4. List the smallest meaningful features in each module and assign `P0`, `P1`, or `P2`.
5. Check that every feature traces to at least one pain and every P0 pain has coverage.
6. Write the document in the user's language.

Ask only when a missing fact would materially change the pain or module structure. Never invent quotes, research findings, or confirmed decisions.

## Required document shape

```markdown
# <Product or initiative> Feature Map

## User pains
### P-01 <Pain stated from the user's perspective>
- Evidence: <source, observation, or “Assumption”>
- Impact: <why it matters>

## Feature modules
### M-01 <Capability-oriented module>
- Solves: P-01, ...
- Outcome: <user outcome>

## Feature list
| ID | Module | Feature | User outcome | Priority | Solves |
|---|---|---|---|---|---|
| F-01 | M-01 | ... | ... | P0 | P-01 |

## Coverage
- P-01 → M-01 → F-01

## Assumptions and open questions
- ...
```

Use priorities consistently:

- `P0`: required to resolve the core pain or make the feature usable.
- `P1`: materially improves the primary workflow after P0 works.
- `P2`: optional enhancement or later expansion.

Stop after the Feature Map. Do not create pages, navigation, component choices, or coordinates in this stage.

