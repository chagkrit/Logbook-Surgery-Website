const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();

export const appUrl = (configuredAppUrl || window.location.origin).replace(/\/+$/, "");
