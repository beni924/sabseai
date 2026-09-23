import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { Sandbox } from '@e2b/code-interpreter'
import { waitUntil } from '@vercel/functions'

export type VideoJobData = {
  id: string
  prompt: string
  duration: number
  aspectRatio: string
  status: 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed'
  progressMessage: string
  videoUrl?: string
  error?: string
  createdAt: number
  updatedAt: number
}

// Global in-memory store for active video jobs
declare global {
  // eslint-disable-next-line no-var
  var __videoJobsMap: Map<string, VideoJobData> | undefined
}

if (!globalThis.__videoJobsMap) {
  globalThis.__videoJobsMap = new Map<string, VideoJobData>()
}

const jobsMap = globalThis.__videoJobsMap

export function getVideoJob(id: string): VideoJobData | undefined {
  return jobsMap.get(id)
}

export function createVideoJob(prompt: string, duration: number, aspectRatio: string): VideoJobData {
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const now = Date.now()

  const job: VideoJobData = {
    id,
    prompt,
    duration,
    aspectRatio,
    status: 'starting',
    progressMessage: 'Writing video script with Gemini AI...',
    createdAt: now,
    updatedAt: now,
  }

  jobsMap.set(id, job)

  // Start background processing pipeline
 waitUntil(executePipeline(id, prompt, duration, aspectRatio))

  return job
}

function updateJob(id: string, update: Partial<VideoJobData>) {
  const current = jobsMap.get(id)
  if (!current) return
  const updated: VideoJobData = {
    ...current,
    ...update,
    updatedAt: Date.now(),
  }
  jobsMap.set(id, updated)
}

async function executePipeline(jobId: string, prompt: string, duration: number, aspectRatio: string) {
  try {
    const e2bKey = process.env.E2B_API_KEY
    if (!e2bKey) {
      throw new Error('E2B_API_KEY is not configured in environment variables. Add E2B_API_KEY in project settings.')
    }

    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!googleKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured in environment variables.')
    }

    // Step 1: Script & Scene Generation with Gemini
    updateJob(jobId, {
      status: 'starting',
      progressMessage: 'Generating scene script & voiceover lines with Gemini AI...',
    })

    const targetSceneCount = Math.max(3, Math.min(6, Math.round(duration / 8)))

    const systemPrompt = `You are a viral YouTube Shorts and TikTok video creator.
Create a fast-paced, engaging short video script based on this prompt: "${prompt}".
The video total duration is approx ${duration} seconds.
Generate exactly ${targetSceneCount} short scenes.

For each scene, provide:
1. "narration": 1-2 punchy spoken sentences for voiceover (10-25 words).
2. "visual_prompt": Detailed cinematic visual description for AI image generation (portrait vertical 9:16 aspect ratio, dramatic lighting, vivid colors, 8k).

Respond strictly with a JSON object in this format:
{
  "scenes": [
    {
      "narration": "Voiceover line here...",
      "visual_prompt": "Visual description here..."
    }
  ]
}`

    const geminiRes = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: systemPrompt,
    })

    let parsedScenes: Array<{ narration: string; visual_prompt: string }> = []
    try {
      const jsonMatch = geminiRes.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.scenes)) {
          parsedScenes = parsed.scenes
        }
      }
    } catch {
      // Fallback scene parsing if JSON regex failed
    }

    if (parsedScenes.length === 0) {
      parsedScenes = [
        {
          narration: prompt,
          visual_prompt: `Cinematic portrait of ${prompt}, vibrant colors, 9:16 aspect ratio`,
        },
        {
          narration: `Exploring the fascinating details of ${prompt}.`,
          visual_prompt: `Detailed cinematic close-up of ${prompt}, dramatic lighting, 9:16 aspect ratio`,
        },
        {
          narration: `Thank you for watching! Like and subscribe for more.`,
          visual_prompt: `Cinematic epic final shot of ${prompt}, breathtaking atmospheric background, 9:16 aspect ratio`,
        },
      ]
    }

    let width = 1080
    let height = 1920
    if (aspectRatio === '16:9') {
      width = 1920
      height = 1080
    } else if (aspectRatio === '1:1') {
      width = 1080
      height = 1080
    }

    // Step 2: E2B Sandbox Assembly
    updateJob(jobId, {
      status: 'processing',
      progressMessage: 'Launching E2B sandbox & synthesizing speech with edge-tts...',
    })

    const sandbox = await Sandbox.create({
      apiKey: e2bKey,
    })

    try {
      updateJob(jobId, {
        status: 'processing',
        progressMessage: 'Generating visuals with Pollinations.ai & rendering Ken Burns video with FFmpeg...',
      })

      const payloadJson = JSON.stringify({
        scenes: parsedScenes.map((s, idx) => ({
          ...s,
          seed: Math.floor(Math.random() * 1000000) + idx * 10,
        })),
        width,
        height,
      })

      const pythonScript = `
import os
import sys
import json
import asyncio
import base64
import urllib.parse
import urllib.request
import subprocess

print("=== STARTING FREE VIDEO PIPELINE ===")

subprocess.run(["pip", "install", "-q", "edge-tts", "requests"], check=False)

has_ffmpeg = subprocess.run(["which", "ffmpeg"], capture_output=True).returncode == 0
if not has_ffmpeg:
    print("Installing ffmpeg...")
    subprocess.run(["apt-get", "update", "-qq"], check=False)
    subprocess.run(["apt-get", "install", "-y", "-qq", "ffmpeg"], check=False)

input_data = json.loads('''${payloadJson.replace(/'/g, "\\'")}''')
scenes = input_data.get("scenes", [])
width = input_data.get("width", 1080)
height = input_data.get("height", 1920)

import edge_tts

async def make_tts(text, audio_path, srt_path):
    communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
    submaker = edge_tts.SubMaker()
    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)
    srt_text = submaker.get_srt()
    if not srt_text.strip():
        srt_text = f"1\\n00:00:00,000 --> 00:00:15,000\\n{text}\\n"
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_text)

os.makedirs("/tmp/render", exist_ok=True)
scene_files = []

for i, scene in enumerate(scenes):
    print(f"Processing Scene {i+1}/{len(scenes)}...")
    narration = scene.get("narration", "")
    visual_prompt = scene.get("visual_prompt", "")
    seed = scene.get("seed", 42)

    audio_path = f"/tmp/render/scene_{i}.mp3"
    srt_path = f"/tmp/render/scene_{i}.srt"
    img_path = f"/tmp/render/scene_{i}.png"
    mp4_path = f"/tmp/render/scene_{i}.mp4"

    asyncio.run(make_tts(narration, audio_path, srt_path))

    encoded_p = urllib.parse.quote(visual_prompt)
    img_url = f"https://image.pollinations.ai/prompt/{encoded_p}?width={width}&height={height}&nologo=true&seed={seed}"
    try:
        req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(img_path, "wb") as f:
            f.write(resp.read())
    except Exception as e:
        print(f"Warning: Failed image fetch: {e}")
        subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=0x1e1e2e:s={width}x{height}", "-vframes", "1", img_path], check=False)

    probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprintwrappers=1:nokey=1", audio_path]
    probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
    try:
        duration = float(probe_res.stdout.strip())
    except Exception:
        duration = 5.0
    duration = max(3.0, duration + 0.3)

    fps = 25
    total_frames = int(fps * duration)
    vf_kenburns = f"scale={width}:{height},zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}"

    srt_escaped = srt_path.replace(":", "\\\\:")
    cmd_sub = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", img_path,
        "-i", audio_path,
        "-filter_complex", f"[0:v]{vf_kenburns},subtitles={srt_escaped}:force_style='Fontname=Arial,Fontsize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=100'[v]",
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest", mp4_path
    ]

    res = subprocess.run(cmd_sub, capture_output=True)
    if res.returncode != 0:
        cmd_nosub = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", img_path,
            "-i", audio_path,
            "-filter_complex", f"[0:v]{vf_kenburns}[v]",
            "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", mp4_path
        ]
        subprocess.run(cmd_nosub, check=True)

    scene_files.append(mp4_path)

list_file = "/tmp/render/concat.txt"
with open(list_file, "w") as f:
    for sf in scene_files:
        f.write(f"file '{sf}'\\n")

final_concat = "/tmp/render/final.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", final_concat], check=True)

with open(final_concat, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

print("=== RESULT_BASE64_START ===")
print(b64)
print("=== RESULT_BASE64_END ===")
`

      const execution = await sandbox.runCode(pythonScript)

      let b64Result = ''
      const logs = execution.logs.stdout.join('\n')

      const startIdx = logs.indexOf('=== RESULT_BASE64_START ===')
      const endIdx = logs.indexOf('=== RESULT_BASE64_END ===')

      if (startIdx !== -1 && endIdx !== -1) {
        b64Result = logs
          .substring(startIdx + '=== RESULT_BASE64_START ==='.length, endIdx)
          .trim()
      }

      if (!b64Result) {
        throw new Error(`Video rendering pipeline did not produce output video data. Logs: ${logs.slice(-500)}`)
      }

      const videoUrl = `data:video/mp4;base64,${b64Result}`

      updateJob(jobId, {
        status: 'succeeded',
        progressMessage: 'Video generation completed!',
        videoUrl,
      })
    } finally {
      await sandbox.kill().catch(() => {})
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred during video generation.'
    updateJob(jobId, {
      status: 'failed',
      progressMessage: 'Video generation failed.',
      error: message,
    })
  }
}
