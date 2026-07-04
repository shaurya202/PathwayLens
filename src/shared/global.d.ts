import { PathwayLensAPI } from './preload'

declare global {
  interface Window {
    api: PathwayLensAPI
    electron: any
  }
}

export {}
