import { prisma } from "../lib/prisma";
import { simpleAgentQuery } from "./agent/agentService";

const db = prisma as any;

export async function createWidgetAgent(
  userId: string,
  data: {
    name: string;
    greeting?: string;
    personality?: string;
    workflowId?: string;
    knowledgeBaseId?: string;
    brandColor?: string;
    position?: string;
    avatarUrl?: string;
    allowedDomains?: string[];
  }
) {
  return db.widgetAgent.create({
    data: {
      userId,
      name: data.name,
      greeting: data.greeting || "Hi! How can I help you?",
      personality: data.personality || null,
      workflowId: data.workflowId || null,
      knowledgeBaseId: data.knowledgeBaseId || null,
      brandColor: data.brandColor || "#6366f1",
      position: data.position || "bottom-right",
      avatarUrl: data.avatarUrl || null,
      allowedDomains: data.allowedDomains || [],
    },
  });
}

export async function listWidgetAgents(userId: string) {
  return db.widgetAgent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWidgetAgent(id: string) {
  return db.widgetAgent.findUnique({ where: { id } });
}

export async function updateWidgetAgent(
  userId: string,
  id: string,
  data: Partial<{
    name: string;
    greeting: string;
    personality: string;
    workflowId: string;
    knowledgeBaseId: string;
    brandColor: string;
    position: string;
    avatarUrl: string;
    allowedDomains: string[];
    status: string;
  }>
) {
  const agent = await db.widgetAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== userId) throw new Error("Widget agent not found");
  return db.widgetAgent.update({ where: { id }, data });
}

export async function deleteWidgetAgent(userId: string, id: string) {
  const agent = await db.widgetAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== userId) throw new Error("Widget agent not found");
  return db.widgetAgent.delete({ where: { id } });
}

export async function getWidgetConfig(id: string) {
  const agent = await db.widgetAgent.findUnique({ where: { id } });
  if (!agent || agent.status !== "active") return null;
  return {
    id: agent.id,
    name: agent.name,
    greeting: agent.greeting,
    brandColor: agent.brandColor,
    position: agent.position,
    avatarUrl: agent.avatarUrl,
  };
}

const widgetConversations = new Map<string, Array<{ role: string; content: string }>>();

export async function sendWidgetMessage(
  agentId: string,
  sessionId: string,
  message: string
): Promise<{ response: string }> {
  const agent = await db.widgetAgent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status !== "active") throw new Error("Widget agent not available");

  const convKey = `${agentId}:${sessionId}`;
  const history = widgetConversations.get(convKey) || [];

  let systemPrompt = "You are a helpful AI assistant embedded on a website.";
  if (agent.personality) systemPrompt = agent.personality;

  // Use KB search context if linked
  let kbContext = "";
  if (agent.knowledgeBaseId) {
    try {
      const { searchKnowledge } = await import("./knowledgeBaseService");
      const chunks = await searchKnowledge(agent.knowledgeBaseId, message, 5);
      if (chunks.length > 0) {
        kbContext =
          "\n\nRelevant knowledge base context:\n" +
          chunks.map((c: any) => c.content).join("\n---\n");
      }
    } catch {
      // KB search failed, continue without context
    }
  }

  const conversationContext = history
    .slice(-10)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const fullPrompt = `${systemPrompt}${kbContext}\n\nConversation so far:\n${conversationContext}\n\nUser: ${message}\n\nRespond helpfully and concisely.`;

  const result = await simpleAgentQuery({
    prompt: fullPrompt,
    userId: agent.userId,
    maxTurns: 3,
    traceType: "widget_chat",
  });

  const response = result.result || "I'm sorry, I couldn't process your request.";

  history.push({ role: "user", content: message });
  history.push({ role: "assistant", content: response });
  if (history.length > 20) history.splice(0, history.length - 20);
  widgetConversations.set(convKey, history);

  // Increment conversation counter
  await db.widgetAgent.update({
    where: { id: agentId },
    data: { conversations: { increment: 1 } },
  });

  return { response };
}

export function generateEmbedScript(agentId: string, backendUrl: string): string {
  return `(function(){var d=document,s=d.createElement("script");s.async=true;
var AGENT_ID="${agentId}",API="${backendUrl}";
var sessionId=localStorage.getItem("vx_sid_"+AGENT_ID);
if(!sessionId){sessionId="vx_"+Math.random().toString(36).substr(2,12);localStorage.setItem("vx_sid_"+AGENT_ID,sessionId)}
var style=d.createElement("style");style.textContent=\`
.vx-widget{position:fixed;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.vx-bubble{width:56px;height:56px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform .2s}
.vx-bubble:hover{transform:scale(1.1)}
.vx-bubble svg{width:24px;height:24px;fill:#fff}
.vx-panel{display:none;width:380px;height:520px;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.18);flex-direction:column;background:#fff}
.vx-panel.open{display:flex}
.vx-header{padding:16px;color:#fff;font-weight:600;display:flex;align-items:center;justify-content:space-between}
.vx-header button{background:none;border:none;color:#fff;cursor:pointer;font-size:18px}
.vx-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.vx-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.4;word-wrap:break-word}
.vx-msg.bot{background:#f1f3f5;align-self:flex-start;border-bottom-left-radius:4px}
.vx-msg.user{color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.vx-input-area{display:flex;padding:12px;border-top:1px solid #e9ecef;gap:8px}
.vx-input-area input{flex:1;border:1px solid #dee2e6;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}
.vx-input-area input:focus{border-color:#6366f1}
.vx-input-area button{border:none;border-radius:8px;color:#fff;padding:8px 16px;cursor:pointer;font-size:14px}
.vx-powered{text-align:center;padding:4px;font-size:10px;color:#999}
.vx-powered a{color:#6366f1;text-decoration:none}
\`;d.head.appendChild(style);
fetch(API+"/api/widget/"+AGENT_ID+"/config").then(function(r){return r.json()}).then(function(cfg){
var color=cfg.brandColor||"#6366f1",pos=cfg.position||"bottom-right";
var isLeft=pos.indexOf("left")>-1;
var wrap=d.createElement("div");wrap.className="vx-widget";wrap.style.cssText=(isLeft?"left:20px":"right:20px")+";bottom:20px;";
var bubble=d.createElement("div");bubble.className="vx-bubble";bubble.style.background=color;
bubble.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
var panel=d.createElement("div");panel.className="vx-panel";panel.style.cssText="position:absolute;bottom:68px;"+(isLeft?"left:0":"right:0");
panel.innerHTML='<div class="vx-header" style="background:'+color+'"><span>'+cfg.name+'</span><button class="vx-close">&times;</button></div><div class="vx-messages"><div class="vx-msg bot">'+cfg.greeting+'</div></div><div class="vx-input-area"><input placeholder="Type a message..." /><button style="background:'+color+'">Send</button></div><div class="vx-powered">Powered by <a href="https://verxio.xyz" target="_blank">Verxio</a></div>';
wrap.appendChild(panel);wrap.appendChild(bubble);d.body.appendChild(wrap);
bubble.onclick=function(){panel.classList.toggle("open");bubble.style.display=panel.classList.contains("open")?"none":"flex"};
panel.querySelector(".vx-close").onclick=function(){panel.classList.remove("open");bubble.style.display="flex"};
var msgs=panel.querySelector(".vx-messages"),inp=panel.querySelector("input"),btn=panel.querySelector(".vx-input-area button");
function send(){var t=inp.value.trim();if(!t)return;inp.value="";
var um=d.createElement("div");um.className="vx-msg user";um.style.background=color;um.textContent=t;msgs.appendChild(um);msgs.scrollTop=msgs.scrollHeight;
var bm=d.createElement("div");bm.className="vx-msg bot";bm.textContent="...";msgs.appendChild(bm);msgs.scrollTop=msgs.scrollHeight;
fetch(API+"/api/widget/"+AGENT_ID+"/message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:t,sessionId:sessionId})}).then(function(r){return r.json()}).then(function(data){bm.textContent=data.response||"Sorry, something went wrong."}).catch(function(){bm.textContent="Connection error."});msgs.scrollTop=msgs.scrollHeight}
btn.onclick=send;inp.onkeydown=function(e){if(e.key==="Enter")send()};
});
})();`;
}
