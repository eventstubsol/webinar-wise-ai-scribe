
import { useState, useEffect } from 'react';

interface DynamicTimeoutConfig {
  baseTimeout: number;
  perWebinarTimeout: number;
  maxTimeout: number;
  webinarCount?: number;
}

export const useDynamicTimeout = (config: DynamicTimeoutConfig) => {
  const [calculatedTimeout, setCalculatedTimeout] = useState(config.baseTimeout);

  useEffect(() => {
    if (config.webinarCount) {
      // Calculate timeout based on webinar count: base + (count * per-webinar time)
      const dynamicTimeout = Math.min(
        config.baseTimeout + (config.webinarCount * config.perWebinarTimeout),
        config.maxTimeout
      );
      setCalculatedTimeout(dynamicTimeout);
    }
  }, [config.webinarCount, config.baseTimeout, config.perWebinarTimeout, config.maxTimeout]);

  return {
    timeoutMs: calculatedTimeout,
    timeoutMinutes: Math.round(calculatedTimeout / 60000),
    isExtended: calculatedTimeout > config.baseTimeout
  };
};
