/**
 * Remotion Skills Loader
 *
 * Loads and formats Remotion skills/rules from the backend skills directory.
 * Caches the content for performance.
 */

import { readFile, readdir } from "fs/promises";
import { join } from "path";

// Resolve paths relative to the backend directory
// When running, process.cwd() is the backend directory
// Skills are at: backend/src/skills/remotion/
const SKILLS_DIR = join(process.cwd(), "src/skills/remotion");
const RULES_DIR = join(SKILLS_DIR, "rules");

// Cache for loaded skills content
let cachedSkillsContent: string | null = null;

/**
 * Loads the main SKILL.md file
 */
async function loadMainSkill(): Promise<string> {
  try {
    const skillPath = join(SKILLS_DIR, "SKILL.md");
    const content = await readFile(skillPath, "utf-8");
    return content;
  } catch (error) {
    console.error("[RemotionSkills] Error loading main skill:", error);
    return "";
  }
}

/**
 * Loads all rule files from the rules directory
 */
async function loadRuleFiles(): Promise<Array<{ name: string; content: string }>> {
  try {
    const files = await readdir(RULES_DIR, { withFileTypes: true });
    const ruleFiles: Array<{ name: string; content: string }> = [];

    for (const file of files) {
      // Only process .md files, skip directories
      if (file.isFile() && file.name.endsWith(".md")) {
        try {
          const filePath = join(RULES_DIR, file.name);
          const content = await readFile(filePath, "utf-8");
          ruleFiles.push({
            name: file.name.replace(".md", ""),
            content,
          });
        } catch (error) {
          console.error(`[RemotionSkills] Error loading rule file ${file.name}:`, error);
        }
      }
    }

    // Sort by name for consistent ordering
    ruleFiles.sort((a, b) => a.name.localeCompare(b.name));

    return ruleFiles;
  } catch (error) {
    console.error("[RemotionSkills] Error reading rules directory:", error);
    return [];
  }
}

/**
 * Formats the skills content for inclusion in prompts
 */
function formatSkillsContent(
  mainSkill: string,
  rules: Array<{ name: string; content: string }>
): string {
  let formatted = `# REMOTION SKILLS AND BEST PRACTICES\n\n`;

  // Add main skill overview
  if (mainSkill) {
    formatted += `${mainSkill}\n\n`;
  }

  // Add all rule files
  if (rules.length > 0) {
    formatted += `## Detailed Rules and Examples\n\n`;
    for (const rule of rules) {
      // Remove frontmatter if present (lines starting with ---)
      let content = rule.content;
      const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
      if (frontmatterMatch) {
        content = content.replace(frontmatterMatch[0], "");
      }

      formatted += `### ${rule.name}\n\n${content}\n\n---\n\n`;
    }
  }

  return formatted;
}

/**
 * Loads all Remotion skills and returns formatted content for prompts
 * Results are cached for performance
 */
export async function loadRemotionSkills(): Promise<string> {
  // Return cached content if available
  if (cachedSkillsContent !== null) {
    return cachedSkillsContent;
  }

  try {
    // Load main skill and all rules in parallel
    const [mainSkill, rules] = await Promise.all([loadMainSkill(), loadRuleFiles()]);

    // Format the content
    cachedSkillsContent = formatSkillsContent(mainSkill, rules);

    return cachedSkillsContent;
  } catch (error) {
    console.error("[RemotionSkills] Error loading skills:", error);
    // Return a fallback message
    return `# REMOTION SKILLS AND BEST PRACTICES\n\nError loading Remotion skills. Please refer to Remotion documentation.`;
  }
}

/**
 * Clears the skills cache (useful for testing or hot-reloading)
 */
export function clearSkillsCache(): void {
  cachedSkillsContent = null;
}
