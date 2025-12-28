<script setup lang="ts">
import {ref, shallowRef} from 'vue'
import {FFmpeg} from '@ffmpeg/ffmpeg'
import {toBlobURL} from '@ffmpeg/util'
import Module from 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js'

const ffmpeg = new FFmpeg()
const loaded = ref(false)
const loading = ref(false)
const selectedFiles = shallowRef()
const downloadRef = shallowRef()
const fileInput = shallowRef()
const targetUrl = shallowRef()
const progressRef = ref()
const messageRef = ref()
const videoRef = ref()

function toHumanReadable(size: number) {
  const names = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB']
  const units = [1024, 1024 * 1024, 1024 * 1024 * 1024, 1024 * 1024 * 1024 * 1024, 1024 * 1024 * 1024 * 1024 * 1024]
  for (let i = 0; i < units.length; i++) {
    if (size < 1024) {
      return size.toFixed(2) + names[i]
    }
    size /= units[i]
  }
}

async function load() {
  if (loading.value || loaded.value) {
    return
  }
  loading.value = true
  ffmpeg.on('log', ({message}) => {
    if (message.toLowerCase()?.includes('abort')) {
      return messageRef.value = ''
    }
    messageRef.value = message
    console.log(message)
  })
  ffmpeg.on('progress', ({progress, time}) => {
    progressRef.value = `${(progress * 100).toFixed(2)} % (已转换的视频时长: ${(time / 1000000).toFixed(2)} s)`
  })
  const response = await fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm')
  if (!response || !response.body) {
    throw 'net error'
  }
  const total = 32 * 1024 * 1024
  const reader = response.body.getReader()
  const chunk = []
  let loadedSize = 0
  while (true) {
    const {done, value} = await reader.read()
    if (done) {
      downloadRef.value = '已下载100%'
      break
    }
    loadedSize += value.byteLength
    // console.log(loadedSize, total)
    downloadRef.value = `已下载${(loadedSize * 100 / total).toFixed(2)}%`
    // console.log(toHumanReadable(value.byteLength) + '/s')
    chunk.push(value)
  }
  const wasmBinary = await (new Blob(chunk)).arrayBuffer()
  await (await Module({wasmBinary})).ready
  // toBlobURL is used to bypass CORS issue, urls with the same
  // domain can be used directly.
  await ffmpeg.load({
    coreURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm', 'application/wasm'),
    // workerURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.worker.js', 'text/javascript')
  })
  loading.value = false
  loaded.value = true
}

async function transcode() {
  const command = []
  for (const file of selectedFiles.value) {
    const input = await readFromBlobOrFile(file)
    // Create a Uint8Array view of the ArrayBuffer
    const uint8Array = new Uint8Array(input)
    await ffmpeg.writeFile(file.name, uint8Array)
    command.push('-i')
    command.push(file.name)
  }
  command.push('-c')
  command.push('copy')
  command.push('output.mp4')
  // const input = await readFromBlobOrFile(inputFile)
  // await ffmpeg.writeFile('input.webm', await fetchFile('https://raw.githubusercontent.com/ffmpegwasm/testdata/master/Big_Buck_Bunny_180_10s.webm'))
  await ffmpeg.exec(command)
  const data = await ffmpeg.readFile('output.mp4')
  targetUrl.value = URL.createObjectURL(new Blob([data.buffer], {type: 'video/mp4'}))
  videoRef.value.src = targetUrl.value
}

function resetUrl() {
  if (targetUrl.value) {
    try {
      URL.revokeObjectURL(targetUrl.value)
    } catch (e) {
      console.error(e)
    }
  }
  targetUrl.value = ''
}

function download() {
  const a = document.createElement('a')
  a.href = targetUrl.value
  a.download = 'merged.mp4'
  a.target = '_blank'
  a.click()
  a.remove()
}

// 辅助函数：将 File/Blob 转换为 Uint8Array
async function readFromBlobOrFile(blobOrFile: any) {
  if (blobOrFile instanceof Blob) {
    return await blobOrFile.arrayBuffer()
  } else if (blobOrFile instanceof File) {
    return await blobOrFile.arrayBuffer()
  }
  throw new Error('Unsupported type')
}

function handleFileChange() {
  // You can iterate over the selected files
  for (const file of fileInput.value.files) {
    console.log('File Name:', file.name)
    console.log('File Size:', file.size, 'bytes')
    console.log('File Type:', file.type)
    // You can then use the File API to read the file content
    // e.g., using FileReader
  }
  selectedFiles.value = fileInput.value.files // Get the FileList object
}

function reset() {
  selectedFiles.value = []
  progressRef.value = ''
  messageRef.value = ''
  resetUrl()
}
</script>
<template>
  <div v-if="loaded">
    <video ref="videoRef" controls></video>
    <label v-if="!selectedFiles?.length">
      <span>选择需要合并的文件</span>
      <input type="file" ref="fileInput" multiple @change="handleFileChange">
    </label>
    <div v-else-if="!targetUrl">
      <span>已选择 {{ selectedFiles?.length }} 个文件</span>
      <button @click="transcode">开始合并文件</button>
    </div>
    <div v-else>
      <button @click="download">下载</button>
      <button @click="reset">重新选择</button>
    </div>
    <p v-if="progressRef">{{ progressRef }}</p>
    <p v-if="messageRef">{{ messageRef }}</p>
    <p v-if="false">Open Developer Tools (Ctrl+Shift+I) to View Logs</p>
  </div>
  <button v-else-if="loading">正在下载...{{ downloadRef }}</button>
  <button v-else @click="load">点击下载转码库 (约 31 MB)</button>
</template>
<style lang="scss">
html, body {
  margin: 0;
  padding: 0;
}

#app {
  width: 100vw;
  height: 100vh;

  &, div {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  div {
    gap: 2vh;
    width: 100%;
    flex-direction: column;
    max-width: min(80vw, 80vh);
  }

  p {
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: min(80vw, 80vh);
  }

  button {
    width: 100%;
    height: 6vh;
    cursor: pointer;
    border-radius: 3vh;
    max-width: min(80vw, 80vh);
  }

  video {
    width: min(80vw, 80vh);
    height: min(50vw, 50vh);
  }

  label {
    width: 100%;

    span {
      border: 2px solid buttonborder;
      background-color: buttonface;
      justify-content: center;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      border-radius: 3vh;
      cursor: pointer;
      padding: 1vh;
      height: 6vh;
      width: 100%;
    }

    input {
      display: none;
    }
  }
}
</style>
