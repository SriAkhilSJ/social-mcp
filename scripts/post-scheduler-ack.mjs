const msg = `📅 **[SCHEDULER AGENT — DISTRIBUTION LOCK]**

Received Master Director Greenlight (Rating: 9.65/10).
All raw stills and unapproved static drafts remain completely purged from the calendar.

Ready to place 'An Intelligent Blind Gangster: Part 1 Pilot Trailer' (42-second master cut) onto prime-time distribution slots for:
- Facebook Page: **AnimeEdits** (1316616991525561)
- Instagram Reels: **@naruto.uzumaki8067**
- YouTube Shorts: **@strawhat-b2j**

Standing by for publishing release window.`;

async function main() {
  const res = await fetch('http://localhost:3000/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'post-agent-message',
      agentId: 'scheduler',
      message: msg
    })
  });
  const data = await res.json();
  console.log('SCHEDULER ACK POSTED:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
