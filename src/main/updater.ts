import { app, dialog, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

// PRD 6장 논의 항목 — GitHub Releases(electron-builder.yml의 publish: github 설정)를
// 배포 채널로 써서, 사용자가 새 설치 파일을 직접 다시 받지 않아도 앱이 알아서 최신 버전을
// 받아 교체하도록 함. electron-updater가 `<repo>/releases/latest`에 올라간 latest.yml을
// 보고 현재 버전보다 높은 태그가 있으면 그 태그의 nsis 설치 파일을 받아옴.
//
// dev 모드(`npm run dev`)에는 electron-builder가 만들어주는 app-update.yml 자체가 없어서
// autoUpdater를 그대로 쓰면 바로 에러가 남 -> is.dev면 아무 것도 안 하고 조용히 리턴
function ensureConfigured(): boolean {
  if (is.dev) return false
  return true
}

function getMainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

// 자동(백그라운드) 체크와 트레이 메뉴의 수동 체크가 피드백 방식만 다르고 나머지 흐름은
// 같아서 하나로 합침. manual=true일 때만 "확인 중/최신 버전/에러" 알림을 사용자에게 보여줌
// (manual=false인 자동 체크에서까지 매번 "최신 버전입니다"를 띄우면 시끄러움. 또한 아직
// GitHub Releases에 올라간 버전이 하나도 없거나 오프라인이면 항상 실패하는데, 이걸 자동
// 체크 때마다 에러 다이얼로그로 띄우면 안 됨 — 조용히 콘솔에만 로그)
function checkForUpdates(manual: boolean): void {
  if (!ensureConfigured()) return

  autoUpdater.checkForUpdates().catch((error) => {
    console.error('[updater] checkForUpdates failed:', error)
    if (manual) {
      dialog.showMessageBox({
        type: 'info',
        title: '업데이트 확인',
        message: '업데이트를 확인하지 못했습니다.',
        detail: '인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.'
      })
    }
  })

  if (manual) {
    autoUpdater.once('update-not-available', () => {
      dialog.showMessageBox({
        type: 'info',
        title: '업데이트 확인',
        message: '이미 최신 버전을 사용하고 있습니다.',
        detail: `현재 버전: ${app.getVersion()}`
      })
    })
  }
}

export function initAutoUpdater(): void {
  if (!ensureConfigured()) return

  // 업데이트 확인 뒤 바로 다운로드까지 자동으로 진행(기본값 true)해서, "다운로드할까요?"를
  // 한 번 더 묻지 않고 "설치할까요?"만 물음 — 어차피 다운로드 자체는 눈에 안 띄는 백그라운드
  // 작업이라 사용자 확인을 한 번만 받는 쪽이 덜 번거로움
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    // 오프라인이거나 아직 릴리즈가 하나도 없는 저장소면 항상 여기로 옴 — 흔한 상황이라
    // 사용자에게는 알리지 않고 로그만 남김
    console.error('[updater] error:', error)
  })

  autoUpdater.on('update-downloaded', (info) => {
    const options = {
      type: 'info' as const,
      title: '업데이트 준비 완료',
      message: `새 버전(${info.version})이 준비되었습니다.`,
      detail: '지금 재시작해서 설치할까요? "나중에"를 누르면 다음에 앱을 껐다 켤 때 자동으로 설치됩니다.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1
    }
    const win = getMainWindow()
    const showDialog = win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
    showDialog.then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  // 시작하자마자 네트워크 요청을 쏘면 초기 렌더링과 경합할 수 있어서 살짝 늦춤
  setTimeout(() => checkForUpdates(false), 5000)
}

export function checkForUpdatesManually(): void {
  checkForUpdates(true)
}
