import { createContext, useContext } from "react";
import type { Session } from "../types.ts";
export const SessionContext = createContext<Session | null>(null);
export const useSession = (): Session => useContext(SessionContext)!;
