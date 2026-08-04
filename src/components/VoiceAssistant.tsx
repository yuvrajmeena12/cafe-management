import { useState, useRef } from 'react'
import { Mic, Send, Loader2, Sparkles } from 'lucide-react'
import { answerBusinessQuestion } from '../lib/voiceAssistant'

const EXAMPLES = ['How many burgers sold today?', "What's today's revenue?", 'Profit this week?']

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function VoiceAssistant() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  async function ask(text: string) {
    if (!text.trim()) return
    setLoading(true)
    setAnswer(null)
    const result = await answerBusinessQuestion(text)
    setAnswer(result)
    setLoading(false)
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setQuery(transcript)
      ask(transcript)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className="bg-sage-700 text-white rounded-xl p-6">
      <h2 className="font-bold text-lg mb-1 flex items-center gap-2"><Sparkles size={18} /> AI Voice Assistant</h2>
      <p className="text-sage-300 text-sm mb-4">Ask a business question out loud, or type it — answers come straight from your real order data.</p>

      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(query)}
          placeholder="e.g. How many burgers sold today?"
          className="flex-1 px-4 py-2.5 rounded-lg text-sage-800 placeholder:text-sage-400"
        />
        {speechSupported && (
          <button
            onClick={startListening}
            className={`p-2.5 rounded-lg ${listening ? 'bg-red-500 animate-pulse' : 'bg-sage-600'}`}
            title="Ask by voice"
          >
            <Mic size={18} />
          </button>
        )}
        <button onClick={() => ask(query)} className="p-2.5 rounded-lg bg-saffron-500">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setQuery(ex); ask(ex) }}
            className="text-xs bg-sage-600/60 px-3 py-1.5 rounded-full hover:bg-sage-600"
          >
            {ex}
          </button>
        ))}
      </div>

      {answer && (
        <div className="bg-sage-600/50 rounded-lg p-4 whitespace-pre-line font-medium">
          {answer}
        </div>
      )}
    </div>
  )
}
