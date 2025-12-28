<script setup lang="ts">
import {ref, shallowRef} from 'vue'
import {FFmpeg} from '@ffmpeg/ffmpeg'
import {toBlobURL} from '@ffmpeg/util'

const ffmpeg = new FFmpeg()
const loaded = ref(false)
const loading = ref(false)
const selectedFiles = shallowRef()
const fileInput = shallowRef()
const targetUrl = shallowRef()
const progressRef = ref()
const messageRef = ref()
const videoRef = ref()

async function load() {
  if (loading.value || loaded.value) {
    return
  }
  loading.value = true
  ffmpeg.on('log', ({message}) => {
    messageRef.value.innerHTML = message
    console.log(message)
  })
  ffmpeg.on('progress', ({progress, time}) => {
    progressRef.value.innerHTML = `${progress * 100} % (transcoded time: ${time / 1000000} s)`
  })
  // toBlobURL is used to bypass CORS issue, urls with the same
  // domain can be used directly.
  await ffmpeg.load({
    coreURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm', 'application/wasm'),
    workerURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.worker.js', 'text/javascript')
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
</script>
<template>
  <div v-if="loaded">
    <video width="400" height="400" ref="videoRef" controls></video>
    <br/>
    <input v-if="!selectedFiles?.length" type="file" ref="fileInput" multiple @change="handleFileChange">
    <button v-else-if="!targetUrl" @click="transcode">合并文件</button>
    <button v-else @click="download">下载</button>
    <p ref="progressRef"></p>
    <p ref="messageRef"></p>
    <p v-if="false">Open Developer Tools (Ctrl+Shift+I) to View Logs</p>
  </div>
  <button v-else-if="loading">正在加载...</button>
  <button v-else @click="load">点击加载 ffmpeg 库文件 (约 31 MB)</button>
</template>
<style scoped>
</style>
