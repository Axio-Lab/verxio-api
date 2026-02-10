# Verxio Agent Skills

This directory contains built-in Agent Skills that extend the Verxio agent's capabilities.

## What are Agent Skills?

Agent Skills are folders containing a `SKILL.md` file that provides instructions, procedures, and knowledge for specific tasks. They follow the [Agent Skills specification](https://agentskills.io).

## Structure

Each skill is a directory with:

```
skill-name/
├── SKILL.md          # Required: YAML frontmatter + Markdown instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: additional documentation
└── assets/           # Optional: templates, resources
```

## Adding a New Skill

1. Create a new directory with a lowercase, hyphenated name (e.g., `my-new-skill`)
2. Create `SKILL.md` with required frontmatter:

   ```yaml
   ---
   name: my-new-skill
   description: What this skill does and when to use it.
   ---
   # Skill Instructions

   ## When to use this skill
   ...
   ## How to use it
   ...
   ```

3. Optionally add `scripts/`, `references/`, or `assets/` directories
4. The skill will be automatically discovered and loaded by the agent

## Specification

See the [Agent Skills specification](https://agentskills.io/specification) for complete format details.

## Validation

Skills are validated on load. Invalid skills will be skipped with a warning.
