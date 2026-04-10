The idea of this platform is note taking app where we feel like AI Agent also live inside of it. We can discuss document with it, ask agent to do anything with it, summarize, rewrite, edit, even delete. 


- When I open Floating Chat Button, I want the agent to be aware of the content of current page so i can discuss the docs with it. 

This means we will have chat session files (JSONL) connected to markdown file, recorded in SQL. Each file have its own session. 

The conversation history (this.messages) currently is stored only in memory — it lives on the AgentLoop instance as a plain array (private messages: LLMMessage[] = [] at AgentLoop.ts:54). It's initialized fresh each time a task runs (line 95) and is never written to disk or a database.

Currently there's no JSONL file or persistent storage for conversation history in this project. The messages exist only for the duration of a single task run, then are discarded when the AgentLoop instance is garbage collected.


Ultimately we also want to chat with Agent when we are in any pages including settings and agent have context about it, but we will implement this later. Meaning we will have session for settings_page, agent_page.


So when we open documents, we should inject the content of the document into system prompt as context.

SYSTEM PROMPT = 
DEFAULT_SYSTEM_PROMPT 

+ INVOCATION_PROMPT : 

"You are currently review markdown document {full path of the docs}. User may want to discuss the content and ask you to do edit, summarize, or other things. Use tools available to you whenever appropriate. Here's the content:

{docs content}"





## AGENT PROMPT MANAGEMENT

Because we will have multiple agent invocation based on task, schedule, docs review, etc, we need to be able to review and manage the system prompt for different kind of invocation type.


1. docs_review -> this is when we invoke chat with agent by clicking AgentFAB button when we open notes. 
2. general_chat. -> this one is when we click Agent FAB when we are anywhere else. 





## DOCUMENT LYFECYCLE

document capture 

insight gathering

does this document relevant? Should I put into archieve?

does it falls into these category?
- Journal - if talking about todays plan, activity, reflection
- Ideas - if talking about ideas
- Projects - if projects related.
- Peoples - If documenting about spesific person
- Others - the rest. 


document need cleanup for tidier format.

document seems to be belong to x folder. 



Need ability to Manage Tasks (Add, edit, delete), also Manage Scedules (Edit, add, delete)


## VAULT INDEX
Imagine if Agent create index.md containing short map and link to the vault. 


## AGENT VAULT and INDEX
we can have additional hidden folder called _agent_vault
Here Agent have also personal space to write things. This also have index.md.

both vault_index.md and agent_vault_index.md are injected into system prompt. 


## TASK and SCHEDULE
Currently there are no way to manage Task and Schedule in src/renderer/src/components/views/TasksView.tsx and src/renderer/src/components/views/ScheduleView.tsx

Task is a way for us to schedule prompt one time, and schedule is a way for us to schedule prompt in recurring fashioned.

create task
We should be able to create Task which is basically prompt to agent, and set schedule whether it is active immidiately or set time in the future. 
Task (if not yet done or not yet active) can be edited. 

create schedule
We also need to be able to create schedule with cron and prompt to agent.
Schedule can be viewed, edit and deleted.


