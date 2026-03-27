"""Generate a guqin-style background music WAV for Chinese Chess using Karplus-Strong synthesis."""
import numpy as np
from scipy.signal import lfilter
import wave

SR = 22050  # lower sample rate — keeps file small, fine for this timbre

def karplus_strong(freq, duration, sr=SR, decay=0.998, brightness=0.5):
    """Plucked string via Karplus-Strong — sounds like a real stringed instrument."""
    n_samples = int(sr * duration)
    buf_len = max(int(sr / freq), 2)
    buf = np.random.uniform(-1, 1, buf_len).astype(np.float64)
    for _ in range(int((1 - brightness) * 4)):
        buf = np.convolve(buf, [0.5, 0.5], mode='same')

    out = np.zeros(n_samples)
    for i in range(n_samples):
        idx = i % buf_len
        out[i] = buf[idx]
        next_idx = (idx + 1) % buf_len
        buf[idx] = decay * 0.5 * (buf[idx] + buf[next_idx])

    return out


def apply_reverb(signal, sr=SR, room_size=0.6, wet=0.3):
    """Simple Schroeder-style reverb."""
    delays_ms = [29, 37, 43, 53, 67, 79]
    result = signal.copy()
    for d in delays_ms:
        delay_samples = int(sr * d * room_size / 1000)
        decay = 0.3 * wet
        if delay_samples < len(signal):
            delayed = np.zeros(len(signal))
            delayed[delay_samples:] = signal[:-delay_samples] * decay
            result += delayed
    peak = np.max(np.abs(result))
    if peak > 0:
        result = result / peak
    return result


def fade_note(samples, fade_in=0.01, fade_out=0.08, sr=SR):
    n = len(samples)
    fi = int(sr * fade_in)
    fo = int(sr * fade_out)
    if fi > 0 and fi < n:
        samples[:fi] *= np.linspace(0, 1, fi)
    if fo > 0 and fo < n:
        samples[-fo:] *= np.linspace(1, 0, fo)
    return samples


def generate_guqin_music(total_duration=90):
    """Generate ~90 seconds of guqin-style music (loops seamlessly)."""
    scale = [293.66, 349.23, 392.00, 440.00, 523.25,
             587.33, 698.46, 783.99, 880.00]
    low_scale = [146.83, 174.61, 196.00, 220.00, 261.63]

    output = np.zeros(int(SR * total_duration))
    pos = 0

    np.random.seed(42)

    phrase_patterns = [
        ([0, 2, 3, 1, 0], [2.5, 2.0, 2.2, 1.8, 3.0], 0.997, 0.4),
        ([4, 3, 2, 3, 1], [1.8, 2.0, 2.5, 1.5, 2.8], 0.996, 0.45),
        ([5, 4, 3, 2, 0], [2.0, 1.8, 2.2, 2.0, 3.2], 0.996, 0.4),
        ([0, 1, 3, 4, 3, 2], [1.5, 1.2, 1.8, 2.0, 1.5, 2.5], 0.997, 0.5),
        ([3, 5, 4, 2, 1, 0], [1.8, 1.5, 2.0, 1.8, 2.2, 3.0], 0.997, 0.45),
        ([2, 4, 5, 4, 3, 1], [1.5, 1.8, 2.2, 1.5, 2.0, 2.8], 0.996, 0.5),
        ([4, 5, 7, 5, 4, 3], [1.5, 1.8, 2.5, 1.5, 2.0, 2.5], 0.995, 0.55),
        ([5, 6, 5, 4, 3, 2], [2.0, 1.5, 2.0, 1.8, 2.2, 3.0], 0.996, 0.5),
        ([3, 2, 0, 1, 0], [2.0, 2.2, 2.5, 1.8, 3.5], 0.997, 0.4),
        ([4, 3, 1, 2, 0], [1.8, 2.0, 2.5, 2.0, 3.5], 0.997, 0.38),
    ]

    phrase_idx = 0
    while pos < len(output) - SR:
        pattern = phrase_patterns[phrase_idx % len(phrase_patterns)]
        indices, durations, decay, brightness = pattern

        for note_i, (si, dur) in enumerate(zip(indices, durations)):
            if pos >= len(output) - SR:
                break

            dur_actual = dur * (0.95 + np.random.random() * 0.1)
            freq = scale[si]

            note = karplus_strong(freq, dur_actual, decay=decay, brightness=brightness)
            note = fade_note(note, fade_in=0.005, fade_out=0.15)

            # Occasional bass drone
            if note_i == 0 and np.random.random() < 0.4:
                bass_freq = low_scale[min(si, len(low_scale) - 1)]
                bass = karplus_strong(bass_freq, dur_actual * 1.5, decay=0.999, brightness=0.3)
                bass = fade_note(bass, fade_in=0.02, fade_out=0.3) * 0.15
                end_b = min(pos + len(bass), len(output))
                output[pos:end_b] += bass[:end_b - pos]

            # Occasional harmonic (泛音)
            if np.random.random() < 0.2:
                harm = karplus_strong(freq * 2, dur_actual * 0.6, decay=0.994, brightness=0.6)
                harm = fade_note(harm, fade_in=0.003, fade_out=0.1) * 0.08
                harm_start = pos + int(SR * 0.1)
                end_h = min(harm_start + len(harm), len(output))
                if harm_start < len(output):
                    output[harm_start:end_h] += harm[:end_h - harm_start]

            vol = 0.35 + np.random.random() * 0.15
            end = min(pos + len(note), len(output))
            output[pos:end] += note[:end - pos] * vol

            pos += int(SR * dur_actual)

        pause = 1.5 + np.random.random() * 1.5
        pos += int(SR * pause)
        phrase_idx += 1

    # Cross-fade last 3s with first 3s for seamless loop
    xfade = int(SR * 3)
    fade_out_env = np.linspace(1, 0, xfade)
    fade_in_env = np.linspace(0, 1, xfade)
    output[-xfade:] = output[-xfade:] * fade_out_env + output[:xfade] * fade_in_env

    print("Applying reverb...")
    output = apply_reverb(output, room_size=0.8, wet=0.35)

    peak = np.max(np.abs(output))
    if peak > 0:
        output = output / peak * 0.85

    return output


def save_wav(samples, filename, sr=SR):
    samples_16 = np.clip(samples * 32767, -32768, 32767).astype(np.int16)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(samples_16.tobytes())
    size_mb = len(samples_16) * 2 / 1024 / 1024
    print(f"Saved {filename} ({len(samples_16) / sr:.0f}s, {size_mb:.1f} MB)")


if __name__ == '__main__':
    print("Generating guqin music...")
    music = generate_guqin_music(total_duration=90)
    save_wav(music, '/Users/ying/chinese_chess/bgm.wav')
    print("Done!")
