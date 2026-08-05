/**
 * Thin compatibility layer so pages written against react-router-dom work on
 * TanStack Router without rewriting every component.
 */
import {
  Link as TanstackLink,
  useParams as useTanstackParams,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

export function useNavigate() {
  const router = useRouter();
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      router.history.go(to);
      return;
    }
    router.navigate({ href: to, replace: options?.replace } as never);
  };
}

export function useParams<T = Record<string, string | undefined>>() {
  return useTanstackParams({ strict: false } as never) as T;
}


export function useSearchParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const router = useRouter();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const params = new URLSearchParams(searchStr ?? "");
  const set = (next: URLSearchParams) => {
    const qs = next.toString();
    router.navigate({
      href: `${router.state.location.pathname}${qs ? `?${qs}` : ""}`,
    } as never);
  };
  return [params, set];
}

export function Link({
  to,
  children,
  ...rest
}: { to: string; children?: ReactNode } & Record<string, unknown>) {
  const Anchor = TanstackLink as never as React.ComponentType<Record<string, unknown>>;
  return (
    <Anchor to={to} {...rest}>
      {children}
    </Anchor>
  );
}

type NavLinkRender = ((state: { isActive: boolean }) => ReactNode) | ReactNode;

export function NavLink({
  to,
  end = false,
  className,
  children,
  ...rest
}: {
  to: string;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
  children?: NavLinkRender;
} & Record<string, unknown>) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  const Anchor = TanstackLink as never as React.ComponentType<Record<string, unknown>>;
  return (
    <Anchor
      to={to}
      className={typeof className === "function" ? className({ isActive }) : className}
      {...rest}
    >
      {typeof children === "function" ? children({ isActive }) : children}
    </Anchor>
  );
}
