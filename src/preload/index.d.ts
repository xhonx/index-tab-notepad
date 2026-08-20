export interface TabAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  startDrag: () => void
  stopDrag: () => void
  expandWindow: () => void
  collapseWindow: () => void
  updateTabCount: (count: number) => void
}

declare global {
  interface Window {
    tabAPI: TabAPI
  }
}
