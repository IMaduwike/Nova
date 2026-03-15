# Nova — AI Coding Assistant

A fast, private AI chatbot powered by Groq + Llama 3.3 70B with dynamic memory compression.

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "nova initial"
git remote add origin https://github.com/YOUR_USERNAME/nova.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repo
4. Go to **Settings → Environment Variables**
5. Add: `GROQ_API_KEY` = your key from https://console.groq.com
6. Click Deploy

That's it. Your Nova is live.

---

## How Memory Works

- Nova keeps the full conversation in memory during your session
- After **10 messages**, Nova automatically summarizes the conversation into bullet points
- The summary replaces the old history — keeping context without overflowing the model
- You can click the **memory pill** in the header to see exactly what Nova remembers
- A "⚡ memory compressed" divider appears in chat when compression happens

---

## Project Structure

```
nova/
├── api/
│   └── chat.js          ← Serverless function (Groq API + memory logic)
├── public/
│   └── index.html       ← Chat UI
├── vercel.json          ← Routing config
├── package.json
└── .gitignore
```
