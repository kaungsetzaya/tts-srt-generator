from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import asyncio
import edge_tts
import os
import uuid

app = Flask(__name__)
CORS(app)

OUTPUT_DIR = "/root/tts-srt-generator/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VOICE_MAP = {"Thiha": "my-MM-ThihaNeural", "Nilar": "my-MM-NilarNeural"}

@app.route('/generate', methods=['POST'])
def generate():
    try:
        data = request.json
        text = data.get('text', '').strip()
        voice = VOICE_MAP.get(data.get('voice', 'Thiha'), "my-MM-ThihaNeural")
        
        # Pitch နှင့် Speed
        pitch = int(data.get('pitch', 0))
        speed = int(data.get('speed', 0))
        pitch_str = f"{pitch:+}Hz"
        rate_str = f"{speed:+}%"
        
        unique_id = str(uuid.uuid4())[:8]
        mp3_path = f"{OUTPUT_DIR}/{unique_id}.mp3"
        srt_path = f"{OUTPUT_DIR}/{unique_id}.srt"

        async def run_tts():
            communicate = edge_tts.Communicate(text, voice, pitch=pitch_str, rate=rate_str)
            submaker = edge_tts.SubMaker()
            
            with open(mp3_path, 'wb') as f:
                async for chunk in communicate.stream():
                    if chunk['type'] == 'audio':
                        f.write(chunk['data'])
                    elif chunk['type'] == 'WordBoundary':
                        submaker.create_sub((chunk['offset'], chunk['duration']), chunk['text'])
            
            # SubMaker ကနေ အချိန်အမှန်နဲ့ SRT ထုတ်ပေးမယ်
            with open(srt_path, 'w', encoding='utf-8') as f:
                f.write(submaker.generate_subs())

        asyncio.run(run_tts())
        
        with open(srt_path, 'r', encoding='utf-8') as f:
            srt_content = f.read()

        return jsonify({'audio_url': f'/audio/{unique_id}.mp3', 'srt_content': srt_content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_file(f"{OUTPUT_DIR}/{filename}", mimetype='audio/mpeg')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
