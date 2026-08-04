import { useState } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

interface Message { role: 'user' | 'bot'; text: string }

/**
 * UI shell for the assistant. Wire the onSend handler to a Supabase Edge
 * Function (e.g. `ai-chatbot`) that forwards the message + live menu/FAQ
 * context to OpenAI and returns a reply. Kept as a local stub here so the
 * widget works out of the box before that function is deployed.
 */
export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: "Hi! I'm the Saffron & Sage assistant. Ask me about our menu, hours, or your order status." },
  ])

  function send() {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', text: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    // TODO: replace with fetch('/functions/v1/ai-chatbot', { body: { message: input } })
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Thanks for your message! (Connect this widget to the ai-chatbot edge function to get real answers.)' },
      ])
    }, 500)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden">
      {open && (
        <div className="w-80 h-96 card flex flex-col mb-3 shadow-xl">
          <div className="bg-sage-700 text-white px-4 py-3 rounded-t-xl flex justify-between items-center">
            <span className="font-semibold">Cafe Assistant</span>
            <button onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[80%] px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-saffron-500 text-white ml-auto' : 'bg-sage-50 text-sage-700'}`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-sage-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-sage-100 focus:outline-none"
            />
            <button onClick={send} className="bg-saffron-500 text-white p-2 rounded-lg"><Send size={16} /></button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full bg-saffron-500 text-white flex items-center justify-center shadow-lg"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  )
}
