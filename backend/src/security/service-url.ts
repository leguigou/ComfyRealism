export class ServiceUrlError extends Error {
  readonly statusCode = 403;
}

const toOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const getAllowedServiceOrigins = () => {
  const configured = (process.env.SERVICE_URL_ALLOWLIST || '').split(',');
  const candidates = [
    process.env.COMFY_URL,
    process.env.LLM_URL,
    'http://127.0.0.1:8188',
    'http://localhost:8188',
    'http://127.0.0.1:11434',
    'http://localhost:11434',
    ...configured,
  ];

  return new Set(
    candidates
      .map(value => toOrigin(value?.trim()))
      .filter((value): value is string => Boolean(value))
  );
};

export const validateServiceUrl = (value: unknown, serviceName: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ServiceUrlError(`${serviceName} URL is required`);
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ServiceUrlError(`Invalid ${serviceName} URL`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ServiceUrlError(`Invalid ${serviceName} URL`);
  }

  const allowsPerUserLlmUrl = serviceName === 'LLM'
    && process.env.ALLOW_USER_LLM_URLS?.toLowerCase() === 'true';
  if (allowsPerUserLlmUrl) {
    return url.toString().replace(/\/$/, '');
  }

  if (!getAllowedServiceOrigins().has(url.origin)) {
    throw new ServiceUrlError(
      `${serviceName} origin is not allowed. Add ${url.origin} to SERVICE_URL_ALLOWLIST.`
    );
  }

  return url.toString().replace(/\/$/, '');
};
