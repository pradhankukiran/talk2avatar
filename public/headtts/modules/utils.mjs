

/**
* Test if we are in Node.js environment
* @return {boolean} If true, we are in Node.js
*/
export function isNode() {
  return typeof import.meta !== 'undefined' &&
    typeof import.meta.url === 'string' &&
    import.meta.url.startsWith('file://');
}


/**
* Test support for Module Web Workers
* @return {boolean} If true, we support module web workers
*/
export function isModuleWebWorkers() {
  let support = false;
  try {
    const tester = {
      get type() { support = true; }
    }
    const worker = new Worker('blob://', tester);
  } finally {
    return support;
  }
}

/**
* Test support for WebGPU
* @return {boolean} If true, we support WebGPU
*/
export function isWebGPU() {
  return !!(globalThis && globalThis.navigator && globalThis.navigator.gpu);
}

/**
* Traceable subsystems
*/
export const traceMask = {
  connection: 1,
  messages: 2,
  events: 4,
  g2p: 8,
  language: 16
};

/**
* Make a deep copy
* @param {any} o Object
* @return {any} Copy of the object.
*/
export function deepCopy(o) {
  return JSON.parse(JSON.stringify(o));
}

/**
* Write console trace.
*
* @param {...any} outputs Output strings.
*/
export function trace( ...outputs ) {
  const s = "HeadTTS [" + new Date().toISOString().slice(11, 23) + "] ";
  console.log(s,...outputs);
}

/**
* A utility class that creates a Promise along with its associated
* resolve and reject methods, allowing manual control over the Promise.
*/
export class Deferred {
  constructor() {
    this.status = "pending";
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (value) => {
        this.status = "resolved";
        resolve(value);
      };
      this.reject = (reason) => {
        this.status = "rejected";
        reject(reason);
      };
    });
  }
}

// Create a lookup table for base64 decoding
const b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const b64Lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
for (let i = 0; i < b64Chars.length; i++) b64Lookup[b64Chars.charCodeAt(i)] = i;

/**
* Convert a Base64 MP3 chunk to ArrayBuffer.
* @param {string} chunk Base64 encoded chunk
* @return {ArrayBuffer} ArrayBuffer
*/
export function b64ToArrayBuffer(chunk) {

  // Calculate the needed total buffer length
  let bufLen = 3 * chunk.length / 4;
  if (chunk[chunk.length - 1] === '=') {
    bufLen--;
    if (chunk[chunk.length - 2] === '=') {
      bufLen--;
    }
  }

  // Create the ArrayBuffer
  const arrBuf = new ArrayBuffer(bufLen);
  const arr = new Uint8Array(arrBuf);
  let i, p = 0, c1, c2, c3, c4;

  // Populate the buffer
  for (i = 0; i < chunk.length; i += 4) {
    c1 = b64Lookup[chunk.charCodeAt(i)];
    c2 = b64Lookup[chunk.charCodeAt(i+1)];
    c3 = b64Lookup[chunk.charCodeAt(i+2)];
    c4 = b64Lookup[chunk.charCodeAt(i+3)];
    arr[p++] = (c1 << 2) | (c2 >> 4);
    arr[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    arr[p++] = ((c3 & 3) << 6) | (c4 & 63);
  }

  return arrBuf;
}


/**
* Encode float32 samples to PCM 16bit LE buffer.
*
* @param {Float32Array} samples Float32 samples
* @param {number} sampleRate Sample rate
* @param {boolean} [header=true] If true, add WAV header
* @return {ArrayBuffer} WAV or raw PCM 16bit LE samples.
*/
export function encodeAudio(samples, sampleRate, header=true) {
  const len = samples.length;
  let offset = header ? 44 : 0;
  const buffer = new ArrayBuffer(offset + len * 2);
  const view = new DataView(buffer);

  // Write WAV header
  if ( header ) {

    function writeString(view, off, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(off + i, string.charCodeAt(i));
      }
    }

    writeString(view, 0, "RIFF");
    view.setUint32(4, 32 + samples.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);
  }

  // Write samples as PCM 16bit LE
  for (let i = 0; i < len; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/**
* Concatenate an array of ArrayBuffers.
* @param {ArrayBuffer[]} bufs Array of ArrayBuffers
* @return {ArrayBuffer} Concatenated ArrayBuffer
*/
export function concatArrayBuffers(bufs) {
  const len = bufs.length;
  if ( len === 1 ) return bufs[0];
  let byteLen = 0;
  for( let i=0; i<len; i++ ) {
    byteLen += bufs[i].byteLength;
  }
  const buf = new ArrayBuffer(byteLen);
  const arr = new Uint8Array(buf);
  let p = 0;
  for( let i=0; i<len; i++ ) {
    arr.set( new Uint8Array(bufs[i]), p);
    p += bufs[i].byteLength;
  }
  return buf;
}

/**
* Convert PCM buffer to AudioBuffer.
* NOTE: Only signed 16bit little endian supported.
*
* @param {ArrayBuffer} buf PCM 16bit LE array buffer
* @return {AudioBuffer} AudioBuffer
*/
export function pcmToAudioBuffer(buf,samplerate,ctx) {
  const arr = new Int16Array(buf);
  const floats = new Float32Array(arr.length);
  const len = arr.length;
  for( let i=0; i<len; i++ ) {
    floats[i] = (arr[i] >= 0x8000) ? -(0x10000 - arr[i]) / 0x8000 : arr[i] / 0x7FFF;
  }
  const audio = ctx.createBuffer(1, floats.length, samplerate );
  audio.copyToChannel( floats, 0 , 0 );
  return audio;
}

/**
 * Inserts new segments of silence into a Float32Array of audio samples.
 *
 * @param {Float32Array} samples The original audio samples
 * @param {number} sampleRate The sample rate of the audio in Hz (e.g., 44100)
 * @param {number[][]} silences Sorted array of [time, duration] in milliseconds
 * @returns {Float32Array} A new Float32Array with silence segments inserted.
 */
export function insertSilences(samples, samplerate, silences) {
  
  // Convert times and durations to number of samples
  let nNewSamples = 0; // Total new samples
  silences.forEach( x => {
    x[0] = Math.floor((x[0] / 1000) * samplerate);
    x[1] = Math.floor((x[1] / 1000) * samplerate);
    nNewSamples += x[1];
  });

  // New Float32Array
  const result = new Float32Array( samples.length + nNewSamples );

  // Copy existing samples
  let readPos = 0;
  let writePos = 0;
  silences.forEach( x => {
    const start = Math.min(x[0], samples.length);
    const len = start - readPos;
    if (len > 0) {
      result.set(samples.subarray(readPos, start), writePos);
      readPos += len;
      writePos += len;
    }
    writePos += x[1]; // Add silence
  });
  if (readPos < samples.length) {
    result.set(samples.subarray(readPos), writePos);
  }

  return result;
}

