import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x0000;
const TAG = 'EarCaptureShell';

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    // Lets a human inspect the page from a DevEco debug session.
    // This flag does not mean the shell has been installed or tested.
    webview.WebviewController.setWebDebuggingAccess(true);
  }

  build() {
    Column() {
      // index.html is produced by `npm run harmony:sync` at the repo root.
      // Vite `base` is `./`, so built JS/CSS stay relative to that file.
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .onlineImageAccess(true)
        .mixedMode(MixedMode.All)
        .onPermissionRequest((event) => {
          if (event) {
            const resources = event.request.getAccessibleResource();
            hilog.info(DOMAIN, TAG, 'web permission request count=%{public}d', resources.length);
            if (resources.length === 0) {
              event.request.deny();
            } else {
              event.request.grant(resources);
            }
          }
        })
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
  }
}
