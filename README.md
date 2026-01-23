<div align="center">
  
  **Verxio is an autonomous self-learning copilot that turns every repeat task into a no-code agentic workflow**
</div>

<div align="center">
As an AI-powered assistant, Verxio helps you design, run, and manage automated workflows.
</div>

---

```mermaid

flowchart TB
    subgraph Frontend["Frontend (Next.js)"]
        VibePage[Vibe Page]
        WorkflowEditor[Workflow Editor]
        PlanNode[Plan Node Chat]
        AnalyticsPage[Analytics Dashboard]
    end
    
    subgraph AgentService["Claude Agent Service"]
        runAgentQuery[runAgentQuery]
        chatWithAgent[chatWithAgent]
        generateCode[generateCodeWithAgent]
        generateWorkflow[generateWorkflowWithAgent]
        generateSmartPrompt[generateSmartPrompt]
    end
    
    subgraph OpikLayer["Opik Integration Layer"]
        OpikService[opikService.ts]
        PromptOptimizer[promptOptimizer.ts]
        AnalyticsService[analyticsService.ts]
    end
    
    subgraph Opik["Opik Platform"]
        Traces[Traces DB]
        Metrics[Metrics]
        Optimizer[Agent Optimizer]
    end
    
    VibePage --> runAgentQuery
    WorkflowEditor --> generateWorkflow
    WorkflowEditor --> chatWithAgent
    PlanNode --> chatWithAgent
    WorkflowEditor --> generateCode
    
    runAgentQuery --> OpikService
    chatWithAgent --> OpikService
    generateCode --> OpikService
    generateWorkflow --> OpikService
    generateSmartPrompt --> OpikService
    
    OpikService --> Traces
    OpikService --> Metrics
    PromptOptimizer --> Optimizer
    
    AnalyticsService --> Traces
    AnalyticsService --> Metrics
    AnalyticsPage --> AnalyticsService

```




## Features
TBD
