/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Set to 'cloudflare' when the admin UI is deployed against a CF Worker backend.
	 *  Defaults to 'standalone' (Railway / Node.js backend). */
	readonly VITE_DEPLOYMENT_MODE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
