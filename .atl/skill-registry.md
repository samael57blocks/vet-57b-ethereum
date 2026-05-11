# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Creating, opening, or preparing PRs for review | branch-pr | ~/.config/opencode/skills/branch-pr/SKILL.md |
| PRs over 400 lines, stacked PRs, review slices | chained-pr | ~/.config/opencode/skills/chained-pr/SKILL.md |
| Writing guides, READMEs, RFCs, onboarding, architecture docs | cognitive-doc-design | ~/.config/opencode/skills/cognitive-doc-design/SKILL.md |
| PR feedback, issue replies, reviews, Slack, GitHub comments | comment-writer | ~/.config/opencode/skills/comment-writer/SKILL.md |
| Go tests, go test coverage, Bubbletea teatest, golden files | go-testing | ~/.config/opencode/skills/go-testing/SKILL.md |
| Creating GitHub issues, bug reports, feature requests | issue-creation | ~/.config/opencode/skills/issue-creation/SKILL.md |
| Judgment day, dual review, adversarial review | judgment-day | ~/.config/opencode/skills/judgment-day/SKILL.md |
| Implementation, commit splitting, chained PRs | work-unit-commits | ~/.config/opencode/skills/work-unit-commits/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### branch-pr
- Every PR MUST link an approved issue (`status:approved`) — no exceptions
- Branch names MUST match `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`
- Use conventional commits for all commits
- Add exactly one `type:*` label per PR
- Run shellcheck on modified scripts before opening PR
- Automated checks must pass before merge

### chained-pr
- Split PRs over 400 changed lines unless maintainer accepts `size:exception`
- Keep each PR reviewable in ≤60 minutes
- State start/end, dependencies, follow-up, and out-of-scope in every chained PR
- Every child PR must include dependency diagram marking current PR with `📍`
- In Feature Branch Chain: tracker PR is draft/no-merge; child PR #1 targets tracker branch; later children target immediate parent branch
- Stacked PRs to main: each slice lands independently
- Do not mix chain strategies after choice is made

### cognitive-doc-design
- Lead with the answer: decision/outcome first, context after
- Progressive disclosure: happy path first, then details/edge cases
- Chunking: group related info into small sections, keep lists short
- Signposting: headings, labels, callouts, summaries for orientation
- Recognition over recall: prefer tables, checklists, examples, templates
- Review empathy: design so reviewers verify intent without reconstructing the story

### comment-writer
- Be useful fast: start with actionable point, don't recap the whole PR
- Be warm and direct: sound like a thoughtful teammate, not a bot
- Keep it short: 1-3 paragraphs or tight bullet list
- Explain why: give technical reason when asking for change
- Avoid pile-ons: comment on highest-value issue, not every preference
- Match thread language; in Spanish use Rioplatense voseo (podés, tenés, fijate)

### go-testing
- Prefer table-driven tests with `t.Run(tt.name, ...)`
- Test behavior and state transitions, not implementation trivia
- Use `t.TempDir()` for filesystem tests; never real home directory
- Integration tests skippable with `testing.Short()` for external commands
- Bubbletea: test `Model.Update()` directly; use `teatest` only for interactive flows
- Golden files: deterministic, update only through repo `-update` path
- Small mocks/interfaces around system boundaries

### issue-creation
- MUST use template (bug report or feature request) — blank issues disabled
- Every issue gets `status:needs-review` automatically
- Maintainer MUST add `status:approved` before any PR can be opened
- Search existing issues for duplicates before creating
- Questions go to Discussions, not issues

### judgment-day
- Resolve project skills before launching judges: read registry, inject compact rules
- Launch two blind judges in PARALLEL with identical target/criteria
- Classify: `WARNING (real)` only if normal intended use triggers it; else `WARNING (theoretical)`
- Confirmed issues (both judges agree CRITICAL/real WARNING): ask before fixing
- After fix, re-launch both judges before commit/push/done
- Terminal states: `JUDGMENT: APPROVED` or `JUDGMENT: ESCALATED`
- Max 2 fix iterations; after that ask user whether to continue

### work-unit-commits
- Commit by work unit: one deliverable behavior, fix, migration, or docs per commit
- Never commit by file type (no "models" then "services" then "tests")
- Keep tests with the code they verify — same commit
- Keep docs with the user-visible change they explain
- Each commit should be a candidate chained PR if the change grows
- Message explains outcome, not file list
- Before committing: confirm one clear purpose, repo works after this commit only, rollback is reasonable

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | /home/jesus/57Blocks/Courses/BlockChain/Ethereum/Dapp/vet-57b/AGENTS.md | Stack, rules, and conventions for the project |
| README.md | /home/jesus/57Blocks/Courses/BlockChain/Ethereum/Dapp/vet-57b/README.md | Project overview and exercise goals |
