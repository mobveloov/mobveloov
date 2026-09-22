/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEFT_BANNER_IMAGE_URL?: string;
  readonly VITE_LEFT_BANNER_TARGET_URL?: string;
  readonly VITE_RIGHT_BANNER_IMAGE_URL?: string;
  readonly VITE_RIGHT_BANNER_TARGET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
