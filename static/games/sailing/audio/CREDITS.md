# Ocean recordings

These recordings are bundled locally; the game makes no requests to their original hosts.

- `ocean-swell-1.mp3` and `ocean-swell-2.mp3`: “Beach Ocean Waves” by jasinski, extracted/submitted by qubodup. Sources: `wave_01_cc0-18363__jasinski__alkaibeach.flac` and `wave_02_cc0-18363__jasinski__alkaibeach.flac` from https://opengameart.org/content/beach-ocean-waves (original: https://freesound.org/people/jasinski/sounds/18363/).
- `water-lap-1.mp3` and `water-lap-2.mp3`: “Water Waves” by transitking, extracted/submitted by qubodup. Sources: `wave_01_cc0-11505__transitking__wavesound.flac` and `wave_02_cc0-11505__transitking__wavesound.flac` from https://opengameart.org/content/water-waves (original: https://freesound.org/people/transitking/sounds/11505/).

Both source pages license these assets under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/ (legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode).

Tideline adaptations: 65 Hz high-pass and 6.5 kHz low-pass filtering, loudness normalization to -23 LUFS / -3 dBTP, conversion to 32 kHz stereo MP3 at 112 kbit/s. At runtime, the mixer overlaps varied excerpts into a long stereo ocean bed and uses quieter recordings for close hull water.

Conversion recipe (FFmpeg):

    ffmpeg -i source.flac -af 'highpass=f=65,lowpass=f=6500,loudnorm=I=-23:TP=-3:LRA=11' -ar 32000 -c:a libmp3lame -b:a 112k output.mp3

License/source pages verified on 2026-09-20. Procedural wind, fabric, wood and reward sounds remain original game code.
