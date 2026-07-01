This audit command does three things:

Runs npm audit to find vulnerable installed packages
Reports findings for manual review (does NOT run npm audit fix,
since dependency versions are intentionally pinned per CLAUDE.md)
Runs tests to verify nothing is currently broken