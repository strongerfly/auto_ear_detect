import { AbilityConstant, UIAbility, Want, abilityAccessCtrl, PermissionRequestResult } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';

const DOMAIN = 0x0000;
const TAG = 'EarCaptureShell';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, TAG, 'Ability onCreate ability=%{public}s launchReason=%{public}d', want.abilityName, launchParam.launchReason);
  }

  onDestroy(): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    this.requestCamera();
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'Failed to load the content. code=%{public}d', err.code);
        return;
      }
      hilog.info(DOMAIN, TAG, '%{public}s', 'Succeeded in loading pages/Index');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'Ability onForeground');
  }

  onBackground(): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'Ability onBackground');
  }

  private requestCamera(): void {
    const atManager = abilityAccessCtrl.createAtManager();
    atManager.requestPermissionsFromUser(this.context, ['ohos.permission.CAMERA'])
      .then((data: PermissionRequestResult) => {
        hilog.info(DOMAIN, TAG, 'camera authResults=%{public}s', JSON.stringify(data.authResults));
      })
      .catch((err: BusinessError) => {
        hilog.error(DOMAIN, TAG, 'camera request failed %{public}d %{public}s', err.code, err.message);
      });
  }
}
