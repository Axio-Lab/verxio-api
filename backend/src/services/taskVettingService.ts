import { basePrismaClient } from "@/lib/prisma";
import { simpleAgentQuery } from "./agent/agentService";

const prisma = basePrismaClient as any;

export async function vetSubmission(submissionId: string): Promise<string> {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { humanTask: { include: { user: { select: { id: true } } } } },
  });
  if (!submission) throw new Error("Submission not found");

  await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: { status: "VETTING", vetAttempts: { increment: 1 } },
  });

  const rules = Array.isArray(submission.humanTask.acceptanceRules)
    ? submission.humanTask.acceptanceRules
    : [];
  const rulesText =
    rules.length > 0
      ? rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")
      : "No specific rules defined. Evaluate general quality and completeness.";

  const sampleUrl = submission.humanTask.sampleEvidenceUrl;

  let prompt = `You are a strict quality inspector. Evaluate the submitted evidence against these acceptance rules:\n\n${rulesText}\n\n`;

  if (sampleUrl) {
    prompt += `REFERENCE/EXPECTED EVIDENCE: A sample of the expected outcome has been provided at: ${sampleUrl}\nCompare the worker's submission against this reference carefully. The submission should meet or exceed the standard shown in the sample.\n\n`;
  }

  if (submission.imageUrl) {
    prompt += `SUBMITTED EVIDENCE: An image has been submitted as evidence. The image is located at: ${submission.imageUrl}\nUse your vision capabilities or any available tools to analyze it.\n`;
  }
  if (submission.rawMessage) {
    prompt += `Worker's message: "${submission.rawMessage}"\n`;
  }

  prompt += `\nReturn JSON: { "score": 0-100, "passed": true/false, "findings": ["finding1", "finding2"], "summary": "brief summary" }\nBe strict and specific. Reference each rule.${sampleUrl ? " Compare against the reference sample." : ""}`;

  const agentResult = await simpleAgentQuery({
    prompt,
    userId: submission.humanTask.user?.id || submission.humanTask.userId,
    maxTurns: 5,
  });

  const text = agentResult.result || "";
  let result = {
    score: 50,
    passed: false,
    findings: ["Unable to parse evaluation"],
    summary: "Evaluation completed",
  };
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
    result = parsed;
  } catch {
    // use defaults
  }

  const passed = result.passed || result.score >= (submission.humanTask.passingScore || 70);
  const status = passed ? "PASSED" : "FAILED";

  await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: {
      aiScore: result.score,
      aiFindings: JSON.stringify(result.findings),
      aiFeedback: result.summary,
      status,
    },
  });

  const findings = result.findings.map((f: string) => `- ${f}`).join("\n");
  let feedback = `Score: ${result.score}/100 ${passed ? "Passed!" : "Please redo"}\n${findings}`;

  if (!passed && submission.humanTask.resubmissionAllowed) {
    feedback += "\n\nPlease try again and send a new photo.";
  }

  return feedback;
}

export async function vetTextSubmission(submissionId: string): Promise<string> {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { humanTask: { include: { user: { select: { id: true } } } } },
  });
  if (!submission) throw new Error("Submission not found");

  await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: { status: "VETTING", vetAttempts: { increment: 1 } },
  });

  const rules = Array.isArray(submission.humanTask.acceptanceRules)
    ? submission.humanTask.acceptanceRules
    : [];
  const rulesText =
    rules.length > 0
      ? rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")
      : "Confirm task completion.";

  const agentResult = await simpleAgentQuery({
    prompt: `You are a task compliance checker. Evaluate this text submission for task completion.

Rules:
${rulesText}

Worker message: "${submission.rawMessage || ""}"

Return JSON: { "score": 0-100, "passed": true/false, "findings": ["..."], "summary": "..." }`,
    userId: submission.humanTask.user?.id || submission.humanTask.userId,
    maxTurns: 5,
  });

  const text = agentResult.result || "";
  let result = {
    score: 75,
    passed: true,
    findings: ["Text submission received"],
    summary: "Submission noted",
  };
  try {
    result = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
  } catch {
    // use defaults
  }

  const passed = result.passed || result.score >= (submission.humanTask.passingScore || 70);

  await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: {
      aiScore: result.score,
      aiFindings: JSON.stringify(result.findings),
      aiFeedback: result.summary,
      status: passed ? "PASSED" : "FAILED",
    },
  });

  return `Score: ${result.score}/100 ${passed ? "Passed!" : "Please redo"}\n${result.findings.map((f: string) => `- ${f}`).join("\n")}`;
}
