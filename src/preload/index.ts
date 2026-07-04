import { contextBridge, ipcRenderer } from 'electron'

const api = {
  runQuery: (query: string) => ipcRenderer.invoke('query:run', query),
  searchSuggestions: (query: string) => ipcRenderer.invoke('query:suggest', query),
  getHistory: () => ipcRenderer.invoke('query:history'),
  exportReport: (format: string, result: any) => ipcRenderer.invoke('query:export', format, result),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
}

contextBridge.exposeInMainWorld('api', api)
