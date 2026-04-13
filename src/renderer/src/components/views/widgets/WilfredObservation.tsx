import { Quote, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../../store/appStore.js'
import { useEffect, useState } from 'react'

interface WilfredObservationProps {
  agentName: string
}

const WRITING_PROMPTS = [
  "You don't need a good idea. You just need a starting sentence.",
  "What's been stuck in your head lately? Spill it out.",
  "Write badly. You can't edit a blank page.",
  "What are you avoiding thinking about? Start there.",
  "One paragraph is enough. Seriously.",
  "If today had a headline, what would it be?",
  "What's something you believe that most people disagree with?",
  "Write like no one will ever read this. Because maybe they won't.",
  "What problem have you been quietly carrying?",
  "Describe your day, but only the parts that mattered.",
  "What are you overthinking right now?",
  "If you had to explain your current mood in detail, what would you say?",
  "What's a small thing that annoyed you today?",
  "What are you excited about—but haven't admitted yet?",
  "Start with: 'I don't know why, but…' and keep going.",
  "What's one idea you keep coming back to?",
  "Write something you wouldn't say out loud.",
  "What are you trying to figure out lately?",
  "Document today. Future you might care.",
  "What's something you changed your mind about recently?",
  "Explain something you understand well, as simply as possible.",
  "What's your latest 'this might be stupid, but…' idea?",
  "What's draining your energy these days?",
  "What does 'progress' look like for you right now?",
  "Write a message to yourself from 6 months ago.",
  "Write a message to yourself 6 months from now.",
  "What's something you wish you started earlier?",
  "If you had 10 minutes to think clearly, what would you write?",
  "What are you pretending not to know?",
  "Turn your current confusion into words.",
  "What's one decision you've been delaying?",
  "What would you do if you weren't afraid of being wrong?",
  "Write about something you noticed but didn't process.",
  "What's the simplest version of your current problem?",
  "If your thoughts had a structure, what would it look like?",
  "What's one thing that felt meaningful today?",
  "What are you curious about right now?",
  "Write down the question you actually want answered.",
  "What are you trying to prove—and to whom?",
  "Start messy. Clarity comes later.",
  "What would make today feel complete?",
  "What's one thing you learned recently?",
  "Write like you're explaining this to a close friend.",
  "What are you holding back from saying?",
  "If your mind is noisy, write the noise.",
  "What's something small that made you pause today?",
  "What does your ideal day look like—honestly?",
  "Write one honest paragraph. That's enough.",
  "What are you optimizing for in life right now?",
  "You're already thinking—why not write it down?",
  "What assumption are you making that might be wrong?",
  "If you could only work on one thing today, what would it be?",
  "What's the difference between what you say and what you mean?",
  "Write about a moment when you felt completely present.",
  "What would you do with an extra hour today?",
  "What's a question you're afraid to ask?",
  "Describe your current state of mind in three sentences.",
  "What are you grateful for right now, specifically?",
  "What's something you know you should let go of?",
  "If you had to teach someone one thing today, what would it be?",
  "What's the story you keep telling yourself?",
  "Write about something that surprised you recently.",
  "What would your 10-year-old self think of you now?",
  "What's a risk you're considering but haven't taken?",
  "Describe a perfect moment from your past week.",
  "What are you defending that doesn't need defending?",
  "If you could change one thing about yesterday, what would it be?",
  "What's something you do that nobody notices?",
  "Write about a conversation you wish you'd had.",
  "What pattern keeps repeating in your life?",
  "What would make you feel proud today?",
  "What's the gap between where you are and where you want to be?",
  "Write about something you're learning slowly.",
  "What advice would you give to someone in your exact situation?",
  "What's your relationship with time right now?",
  "Describe your energy level and what's affecting it.",
  "What's something you're doing out of habit, not intention?",
  "If you could have a conversation with anyone, who and why?",
  "What's the last thing that made you laugh?",
  "Write about a small victory you haven't celebrated.",
  "What are you comparing yourself to?",
  "What would 'enough' look like for you?",
  "Describe your workspace and what it says about you.",
  "What's a boundary you need to set?",
  "Write about something you're procrastinating on.",
  "What does rest mean to you right now?",
  "What's your current definition of success?",
  "If you trusted yourself completely, what would you do?",
  "What's something you need to hear right now?",
  "Write about a choice you made that changed things.",
  "What are you carrying that isn't yours to carry?",
  "What does your intuition keep telling you?",
  "Describe how you want to feel at the end of today.",
  "What's a compliment you struggle to accept?",
  "Write about something you're proud of but don't talk about.",
  "What would you do if you had permission to fail?",
  "What's the difference between busy and productive for you?",
  "Describe a moment when you felt like yourself.",
  "What are you resisting right now?",
]

function getHourlyPrompt(): string {
  const now = new Date()
  const hoursSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60))
  const index = hoursSinceEpoch % WRITING_PROMPTS.length
  return WRITING_PROMPTS[index]
}

export function WilfredObservation({ agentName }: WilfredObservationProps) {
  const agentAvatar = useAppStore((state) => state.agentAvatar)
  const [prompt, setPrompt] = useState(getHourlyPrompt())
  const [isRotating, setIsRotating] = useState(false)

  const handleRefresh = () => {
    setIsRotating(true)
    const randomIndex = Math.floor(Math.random() * WRITING_PROMPTS.length)
    setPrompt(WRITING_PROMPTS[randomIndex])
    setTimeout(() => setIsRotating(false), 600)
  }

  useEffect(() => {
    const updatePrompt = () => {
      setPrompt(getHourlyPrompt())
    }

    const now = new Date()
    const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds()
    
    const timeout = setTimeout(() => {
      updatePrompt()
      const interval = setInterval(updatePrompt, 60 * 60 * 1000)
      return () => clearInterval(interval)
    }, msUntilNextHour)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <section className="relative bg-parchment-light rounded-r-lg py-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <img 
            src={agentAvatar} 
            alt={agentName}
            className="w-12 h-12 rounded-full border-2 border-accent/20 shadow-sm"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Quote className="w-4 h-4 text-accent/60" />
            <p className="text-xs font-sans font-semibold text-accent tracking-wide uppercase">
              {agentName}
            </p>
            <button
              onClick={handleRefresh}
              className="ml-auto text-ink-light hover:text-accent transition-colors duration-200 group"
              title="Get a different prompt"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRotating ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          <blockquote className="font-serif text-[1.1rem] text-ink-primary leading-relaxed italic border-l-2 border-accent/30 pl-4">
            {prompt}
          </blockquote>
        </div>
      </div>
    </section>
  )
}
