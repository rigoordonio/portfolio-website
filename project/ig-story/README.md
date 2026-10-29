# Instagram launch story

- `story-1-video.mp4`: the 6 second story that was posted. The pixel critter from the Poke button laughs and jumps, lands on the moon button, and the page turns from night to day with the same circular reveal as the site. The address pulses at the end.
- `story-1.png`, `story-2.png`, `story-3.png`: still versions of three story frames.
- `tag-list.md`: AI and data analytics pages to tag by hand with mention stickers in the app (stories sent through the API can't carry tags or link stickers).
- `frames.py` and `shoot.cjs`: generate the still frames (`python3 frames.py <fonts dir>`, then `node shoot.cjs <dir with the frame html files>`).
- `video-source/`: the video. `video.html` draws every frame from a time value (`render(t)`), `render.cjs` captures 180 frames at 30 fps, and ffmpeg joins them:

```bash
cd video-source && mkdir -p frames && node render.cjs "$(pwd)"   # needs playwright
ffmpeg -framerate 30 -i frames/%04d.png -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -t 6 -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart -c:a aac -shortest story-1-video.mp4
```
