/**
 * Copyright 2018 Google LLC
 *
 * Original Source
 * https://github.com/johnhooks/web-audio-samples/blob/eed2a8613af551f2b1d166a01c834e8431fdf3c6/src/audio-worklet/design-pattern/lib/wasm-audio-helper.js
 *
 * Copyright 2023 John Hooks <bitmachina@outlook.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

// Byte per audio sample. (32 bit float)
const BYTES_PER_SAMPLE = Float32Array.BYTES_PER_ELEMENT;

// Basic byte unit of WASM heap. (16 bit = 2 bytes)
const BYTES_PER_UNIT = Uint16Array.BYTES_PER_ELEMENT;

// The max audio channel on Chrome is 32.
const MAX_CHANNEL_COUNT = 32;

// WebAudio's render quantum size.
const RENDER_QUANTUM_FRAMES = 128;

/**
 * A WASM HEAP wrapper for AudioBuffer class. This breaks down the AudioBuffer
 * into an Array of Float32Array for the convenient WASM operation.
 *
 * @class
 * @dependency Module A WASM module generated by the emscripten glue code.
 */
class HeapAudioBuffer {
	private _channelCount: number;
	private _channelData: Float32Array[] = [];
	private _dataPtr: number;
	private _isInitialized = true;
	private _length: number;
	private _maxChannelCount: number;
	private _module: EmscriptenModule;

	/**
	 * @constructor
	 * @param wasmModule WASM module generated by Emscripten.
	 * @param length Buffer frame length.
	 * @param channelCount Number of channels.
	 * @param maxChannelCount Maximum number of channels.
	 */
	constructor(
		wasmModule: EmscriptenModule,
		length: number,
		channelCount: number,
		maxChannelCount?: number
	) {
		// The |channelCount| must be greater than 0, and less than or equal to
		// the maximum channel count.
		this._module = wasmModule;
		this._length = length;
		this._maxChannelCount = maxChannelCount
			? Math.min(maxChannelCount, MAX_CHANNEL_COUNT)
			: channelCount;
		this._channelCount = channelCount;
		this._dataPtr = this._allocateHeap();
	}

	/**
	 * Allocates memory in the WASM heap and set up Float32Array views for the
	 * channel data.
	 *
	 * @returns The pointer to the channel data on the WASM heap.
	 * @private
	 */
	_allocateHeap(): number {
		const channelByteSize = this._length * BYTES_PER_SAMPLE;
		const dataByteSize = this._channelCount * channelByteSize;
		const dataPtr = this._module._malloc(dataByteSize);
		this._channelData = [];
		for (let i = 0; i < this._channelCount; ++i) {
			const startByteOffset = dataPtr + i * channelByteSize;
			const endByteOffset = startByteOffset + channelByteSize;
			// Get the actual array index by dividing the byte offset by 2 bytes.
			this._channelData[i] = this._module.HEAPF32.subarray(
				startByteOffset >> BYTES_PER_UNIT,
				endByteOffset >> BYTES_PER_UNIT
			);
		}
		return dataPtr;
	}

	/**
	 * Adapt the current channel count to the new input buffer.
	 *
	 * @param newChannelCount The new channel count.
	 */
	adaptChannel(newChannelCount: number) {
		if (newChannelCount < this._maxChannelCount) {
			this._channelCount = newChannelCount;
		}
	}

	/**
	 * Getter for the buffer length in frames.
	 *
	 * @return Buffer length in frames.
	 */
	get length(): number | null {
		return this._isInitialized ? this._length : null;
	}

	/**
	 * Getter for the number of channels.
	 *
	 * @return Buffer length in frames.
	 */
	get numberOfChannels(): number | null {
		return this._isInitialized ? this._channelCount : null;
	}

	/**
	 * Getter for the maxixmum number of channels allowed for the instance.
	 *
	 * @return Buffer length in frames.
	 */
	get maxChannelCount(): number | null {
		return this._isInitialized ? this._maxChannelCount : null;
	}

	/**
	 * Returns a Float32Array object for a given channel index. If the channel
	 * index is undefined, it returns the reference to the entire array of channel
	 * data.
	 *
	 * @param channelIndex Channel index.
	 * @return A channel data array or an array of channel data.
	 */
	getChannelData(): Float32Array[] | undefined;
	getChannelData(channelIndex: number): Float32Array | undefined;
	getChannelData(channelIndex?: number): Float32Array | Float32Array[] | undefined {
		if (channelIndex && channelIndex >= this._channelCount) {
			return undefined;
		}

		return typeof channelIndex === "undefined"
			? this._channelData
			: this._channelData[channelIndex];
	}

	/**
	 * Returns the base address of the allocated memory space in the WASM heap.
	 *
	 * @return WASM Heap address.
	 */
	getHeapAddress(): number {
		return this._dataPtr;
	}

	/**
	 * Returns the base address of the allocated memory space in the WASM heap.
	 *
	 * @return WASM Heap address.
	 */
	getPointer(): number {
		return this._dataPtr;
	}

	/**
	 * Frees the allocated memory space in the WASM heap.
	 */
	free(): void {
		this._isInitialized = false;
		this._module._free(this._dataPtr);
		this._channelData = [];
	}
}

export { MAX_CHANNEL_COUNT, RENDER_QUANTUM_FRAMES, HeapAudioBuffer };
