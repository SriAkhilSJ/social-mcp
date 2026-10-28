with open("components/agents/agent-panel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

target = """                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete this message"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0 mb-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}"""

replacement = """                    {!isUser && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 mb-1">
                        <button
                          type="button"
                          onClick={() => speakAgentVoice(msg.text, agentId)}
                          title={`Listen to message in ${AGENT_VOICE_CONFIGS[agentId]?.name || "agent"} voice`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete this message"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}"""

if target in text:
    text = text.replace(target, replacement)
    print("Replaced LF target")
elif target.replace("\n", "\r\n") in text:
    text = text.replace(target.replace("\n", "\r\n"), replacement.replace("\n", "\r\n"))
    print("Replaced CRLF target")
else:
    print("Target not found directly")

with open("components/agents/agent-panel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
