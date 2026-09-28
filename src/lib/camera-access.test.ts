import { describe, expect, it } from "vitest";
import { cameraNotice } from "./camera-access";

describe("camera notice", () => {
  it("treats a denied camera as recoverable and distinct from a missing camera", () => {
    expect(
      cameraNotice({
        sim: false,
        camError: "NotAllowedError",
        camReady: false,
      }),
    ).toBe("denied");
    expect(
      cameraNotice({
        sim: false,
        camError: "NotFoundError",
        camReady: false,
      }),
    ).toBe("error");
    expect(
      cameraNotice({ sim: false, camError: null, camReady: false }),
    ).toBe("off");
    expect(
      cameraNotice({ sim: false, camError: null, camReady: true }),
    ).toBe("preview");
    expect(
      cameraNotice({
        sim: true,
        camError: "NotAllowedError",
        camReady: false,
      }),
    ).toBe("sim");
  });
});
