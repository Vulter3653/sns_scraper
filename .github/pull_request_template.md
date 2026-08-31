## Summary

- 

## Scope

- [ ] I read `docs/project-blueprint.md`
- [ ] I read `AGENTS.md`
- [ ] I read `docs/agent-writing-rules.md`
- [ ] Changed files stay within this task's intended scope
- [ ] No unrelated refactor, dependency upgrade, or UI change is mixed into this PR

## Records

- [ ] `CHANGELOG.md` is updated
- [ ] New changelog records include attribution such as `(codex)` / `(gemini)` / `(claude)` / `(human)`
- [ ] `docs/progress.md` is updated when this changes function, architecture, workflow, policy, handoff, or current state
- [ ] `docs/debug-log.md` is updated when this investigates a defect/blocker or changes workflow confidence
- [ ] Historical entries were preserved rather than rewritten or summarized

## Verification

- [ ] `npm run validate:records`
- [ ] Relevant deterministic tests completed
- [ ] `npm run build` completed when runtime/UI/package behavior changed
- [ ] `git diff --check` completed

## Live validation

- [ ] Live E2E was run where applicable
- [ ] If live E2E was not run, the PR explicitly records `BLOCKED`, `SKIP`, or `NOT LIVE-VALIDATED` and the reason
- [ ] Fixture/deterministic results are not presented as live platform evidence

## Security

- [ ] No secrets, cookies, tokens, browser profile data, private keys, proxy credentials, or environment CA/NSS state are included

## Remaining uncertainty / blocker

- 
