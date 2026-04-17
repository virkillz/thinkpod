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


_agent_vault/
  index.md 
  human_profile.md
  human_interest.md
  human_family.md
  agent_interest.md


### Schedule: kyh (know your human)
How it automatically know human better and make a note?

wake up:
- read human_profile.md 
- create list of question. 
- how to get answer?
- find information from vault?
- update human_profile.md

### Schedule: get random insight 
- pick random file in vault
- ask llm if theres something interesting about it. 
- use search to get relevant note. 
- make comment
- sent to inbox. 

### Schedule: Bonding
- find a relevant topic 
- use brave search 
- sent to inbox.





both vault_index.md and agent_vault_index.md are injected into system prompt. 


Let's talk about variety of agent initiative. This is what makes agent feels alive and active, not just a passive chatbot.

- Silently gather information about user. Periodically Agent review 
