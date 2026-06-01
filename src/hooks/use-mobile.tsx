import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const hasWindow = typeof window !== "undefined";
  const [isMobile, setIsMobile] = React.useState<boolean>(
    hasWindow ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );

  React.useEffect(() => {
    if (!hasWindow) return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", onChange);
    onChange();

    return () => mql.removeEventListener("change", onChange);
  }, [hasWindow]);

  return isMobile;
}
